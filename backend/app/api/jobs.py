from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from pydantic import BaseModel
from datetime import datetime
import yaml
import tempfile
import logging
from pathlib import Path

from app.core.database import get_db
from app.core.config import settings
from app.core.ssh_manager import SSHManager
from app.models.job import Job
from app.models.project import Project
from app.services.slurm_generator import SlurmScriptGenerator
from app.services.job_monitor import JobMonitor
from app.services.project_config import ProjectConfig

router = APIRouter()
logger = logging.getLogger(__name__)


# Pydantic schemas
class JobCreate(BaseModel):
    project_id: str
    name: str
    description: str | None = None
    cluster: str
    partition: str
    gpu_type: str | None = None
    num_nodes: int = 1
    gpus_per_node: int = 1
    hydra_overrides: Dict[str, Any] | None = None


class JobResponse(BaseModel):
    id: str
    project_id: str
    name: str
    description: str | None
    commit_sha: str
    cluster: str
    partition: str
    gpu_type: str | None
    num_nodes: int
    gpus_per_node: int
    hydra_overrides: Dict[str, Any] | None
    slurm_job_id: str | None
    slurm_status: str | None
    slurm_script: str | None
    wandb_run_url: str | None
    submitted_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Helper functions
def generate_slurm_script_for_job(job: Job, project: Project, cluster: dict) -> str:
    """
    Generate SLURM script for a job without submitting it.

    Returns:
        The generated SLURM script content
    """
    # Load project configuration
    project_config = ProjectConfig(project.local_path)

    # Generate SLURM script
    generator = SlurmScriptGenerator()

    # Build python command using project's train script
    python_command = generator.build_python_command(
        script_path=project_config.train_script,
        hydra_overrides=job.hydra_overrides,
        num_nodes=job.num_nodes
    )

    # Generate script with project's conda env (overrides cluster-level setting)
    conda_env = project_config.conda_env or cluster.get('conda_env')

    script_content = generator.generate_script(
        job_name=job.name,
        partition=job.partition,
        num_nodes=job.num_nodes,
        gpus_per_node=job.gpus_per_node,
        repo_url=project.repo_url,
        commit_sha=job.commit_sha,
        workspace_dir=cluster['workspace'],
        python_command=python_command,
        gpu_type=job.gpu_type,
        output_file=f"{cluster['workspace']}/logs/{job.name}-%j.out",
        conda_env=conda_env
    )

    return script_content


def submit_slurm_job_sync(job_id: str, db: Session):
    """
    Submit a SLURM job to the cluster.

    This function:
    1. Generates SLURM script from template
    2. Uploads script to cluster
    3. Executes sbatch
    4. Updates job record with SLURM job ID
    """
    # Get job from database
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        logger.error(f"Job {job_id} not found")
        return

    # Get project
    project = db.query(Project).filter(Project.id == job.project_id).first()
    if not project:
        logger.error(f"Project {job.project_id} not found")
        job.slurm_status = "FAILED"
        db.commit()
        return

    # Get cluster config
    try:
        with open(settings.clusters_config_path, 'r') as f:
            config = yaml.safe_load(f)
            clusters = {c['name']: c for c in config.get('clusters', [])}
    except Exception as e:
        logger.error(f"Error reading cluster config: {e}")
        job.slurm_status = "FAILED"
        db.commit()
        return

    if job.cluster not in clusters:
        logger.error(f"Cluster {job.cluster} not found in config")
        job.slurm_status = "FAILED"
        db.commit()
        return

    cluster = clusters[job.cluster]

    # Parse host
    if '@' in cluster['host']:
        username, hostname = cluster['host'].split('@')
    else:
        logger.error(f"Invalid host format: {cluster['host']}")
        job.slurm_status = "FAILED"
        db.commit()
        return

    try:
        # Generate SLURM script
        script_content = generate_slurm_script_for_job(job, project, cluster)

        # Save script to database
        job.slurm_script = script_content
        db.commit()

        logger.info(f"Generated SLURM script for job {job.name}")

        # Connect to cluster
        ssh = SSHManager(
            host=hostname,
            username=username,
            key_path=cluster['ssh_key_path']
        )

        with ssh:
            # Create directories on cluster
            ssh.execute_command(f"mkdir -p {cluster['workspace']}/scripts")
            ssh.execute_command(f"mkdir -p {cluster['workspace']}/logs")

            # Write script to temporary file locally
            with tempfile.NamedTemporaryFile(mode='w', suffix='.sh', delete=False) as f:
                f.write(script_content)
                local_script_path = f.name

            # Upload script to cluster
            remote_script_path = f"{cluster['workspace']}/scripts/{job.name}_{job.id}.sh"
            ssh.upload_file(local_script_path, remote_script_path)

            # Make script executable
            ssh.execute_command(f"chmod +x {remote_script_path}")

            # Submit job
            job_monitor = JobMonitor(ssh)
            slurm_job_id, error = job_monitor.submit_job(remote_script_path)

            # Clean up local temp file
            Path(local_script_path).unlink()

            if slurm_job_id:
                job.slurm_job_id = slurm_job_id
                job.slurm_status = "PENDING"
                logger.info(f"Job {job.name} submitted successfully with SLURM ID {slurm_job_id}")
            else:
                job.slurm_status = "FAILED"
                logger.error(f"Failed to submit job {job.name}: {error}")

            db.commit()

    except Exception as e:
        logger.error(f"Error submitting job {job.name}: {e}")
        job.slurm_status = "FAILED"
        db.commit()


@router.post("/preview", response_model=dict)
async def preview_job(
    job_data: JobCreate,
    db: Session = Depends(get_db)
):
    """
    Preview the SLURM script that would be generated for a job without submitting it.

    Returns:
        Dictionary with 'script' key containing the generated SLURM script
    """
    # Validate project exists
    project = db.query(Project).filter(Project.id == job_data.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Validate project has remote URL
    if not project.repo_url:
        raise HTTPException(
            status_code=400,
            detail="Project has no remote repository URL. Push your code first."
        )

    # Get cluster config
    try:
        with open(settings.clusters_config_path, 'r') as f:
            config = yaml.safe_load(f)
            clusters = {c['name']: c for c in config.get('clusters', [])}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading cluster config: {str(e)}")

    if job_data.cluster not in clusters:
        raise HTTPException(status_code=404, detail=f"Cluster '{job_data.cluster}' not found")

    cluster = clusters[job_data.cluster]

    # Create temporary job object (not saved to DB)
    temp_job = Job(
        project_id=job_data.project_id,
        name=job_data.name,
        description=job_data.description,
        commit_sha=project.current_commit,
        cluster=job_data.cluster,
        partition=job_data.partition,
        gpu_type=job_data.gpu_type,
        num_nodes=job_data.num_nodes,
        gpus_per_node=job_data.gpus_per_node,
        hydra_overrides=job_data.hydra_overrides,
    )

    try:
        # Generate SLURM script
        script_content = generate_slurm_script_for_job(temp_job, project, cluster)
        return {"script": script_content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating script: {str(e)}")


@router.post("/", response_model=JobResponse)
async def submit_job(
    job_data: JobCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Submit a new SLURM job.

    Workflow:
    1. Validate project exists
    2. Get current commit SHA from project
    3. Generate SLURM script from template
    4. SSH to cluster and submit job
    5. Store job in database
    6. Start background task to monitor job status
    """
    # Validate project exists
    project = db.query(Project).filter(Project.id == job_data.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Validate project has remote URL
    if not project.repo_url:
        raise HTTPException(
            status_code=400,
            detail="Project has no remote repository URL. Push your code first."
        )

    # Create job record
    job = Job(
        project_id=job_data.project_id,
        name=job_data.name,
        description=job_data.description,
        commit_sha=project.current_commit,
        cluster=job_data.cluster,
        partition=job_data.partition,
        gpu_type=job_data.gpu_type,
        num_nodes=job_data.num_nodes,
        gpus_per_node=job_data.gpus_per_node,
        hydra_overrides=job_data.hydra_overrides,
        slurm_status="SUBMITTING"
    )

    db.add(job)
    db.commit()
    db.refresh(job)

    # Submit job in background
    background_tasks.add_task(submit_slurm_job_sync, job.id, db)

    return job


@router.get("/", response_model=List[JobResponse])
async def list_jobs(
    project_id: str | None = None,
    db: Session = Depends(get_db)
):
    """
    Get all jobs, optionally filtered by project.
    """
    query = db.query(Job)

    if project_id:
        query = query.filter(Job.project_id == project_id)

    jobs = query.order_by(Job.submitted_at.desc()).all()
    return jobs


@router.get("/{job_id}", response_model=JobResponse)
async def get_job(job_id: str, db: Session = Depends(get_db)):
    """Get a specific job."""
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.post("/{job_id}/refresh-status")
async def refresh_job_status(job_id: str, db: Session = Depends(get_db)):
    """
    Manually refresh job status from SLURM cluster.
    """
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if not job.slurm_job_id:
        return {"message": "Job not yet submitted to SLURM", "job": job}

    # Get cluster config
    try:
        with open(settings.clusters_config_path, 'r') as f:
            config = yaml.safe_load(f)
            clusters = {c['name']: c for c in config.get('clusters', [])}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading cluster config: {str(e)}")

    if job.cluster not in clusters:
        raise HTTPException(status_code=404, detail=f"Cluster '{job.cluster}' not found")

    cluster = clusters[job.cluster]

    # Parse host
    if '@' in cluster['host']:
        username, hostname = cluster['host'].split('@')
    else:
        raise HTTPException(status_code=500, detail=f"Invalid host format: {cluster['host']}")

    # Get job status
    try:
        ssh = SSHManager(
            host=hostname,
            username=username,
            key_path=cluster['ssh_key_path']
        )

        with ssh:
            job_monitor = JobMonitor(ssh)
            status, reason = job_monitor.get_job_status(job.slurm_job_id)

            job.slurm_status = status
            db.commit()
            db.refresh(job)

            return {
                "message": "Status updated",
                "job": job,
                "reason": reason
            }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error getting job status: {str(e)}"
        )


@router.get("/{job_id}/logs")
async def get_job_logs(job_id: str, db: Session = Depends(get_db)):
    """
    Fetch job logs from cluster and extract WandB URL.
    """
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if not job.slurm_job_id:
        return {
            "logs": "Job not yet submitted to SLURM",
            "wandb_url": None
        }

    # Get cluster config
    try:
        with open(settings.clusters_config_path, 'r') as f:
            config = yaml.safe_load(f)
            clusters = {c['name']: c for c in config.get('clusters', [])}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading cluster config: {str(e)}")

    if job.cluster not in clusters:
        raise HTTPException(status_code=404, detail=f"Cluster '{job.cluster}' not found")

    cluster = clusters[job.cluster]

    # Parse host
    if '@' in cluster['host']:
        username, hostname = cluster['host'].split('@')
    else:
        raise HTTPException(status_code=500, detail=f"Invalid host format: {cluster['host']}")

    # Fetch logs
    try:
        ssh = SSHManager(
            host=hostname,
            username=username,
            key_path=cluster['ssh_key_path']
        )

        with ssh:
            job_monitor = JobMonitor(ssh)

            # Construct log file path
            log_path = f"{cluster['workspace']}/logs/{job.name}-{job.slurm_job_id}.out"

            # Fetch logs
            logs = job_monitor.get_job_logs(log_path, tail_lines=settings.log_tail_lines)

            # Extract WandB URL if exists
            wandb_url = job_monitor.extract_wandb_url(logs)

            # Update job if WandB URL found
            if wandb_url and not job.wandb_run_url:
                job.wandb_run_url = wandb_url
                db.commit()

            return {
                "logs": logs,
                "wandb_url": wandb_url or job.wandb_run_url
            }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching logs: {str(e)}"
        )
