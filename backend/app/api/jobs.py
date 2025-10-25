from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from pydantic import BaseModel

from app.core.database import get_db
from app.models.job import Job
from app.models.project import Project

router = APIRouter()


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
    wandb_run_url: str | None
    submitted_at: str
    updated_at: str

    class Config:
        from_attributes = True


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

    # TODO: Background task to actually submit job
    # background_tasks.add_task(submit_slurm_job, job.id)

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

    # TODO: Implement job status polling
    # Use SSH to run `squeue -j {job.slurm_job_id}` or `sacct -j {job.slurm_job_id}`
    # Update job.slurm_status

    return {"message": "Status refresh not yet implemented", "job": job}


@router.get("/{job_id}/logs")
async def get_job_logs(job_id: str, db: Session = Depends(get_db)):
    """
    Fetch job logs from cluster.
    """
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # TODO: SSH to cluster and cat the log file
    # Look for WandB URL in logs

    return {
        "logs": job.logs or "Logs not yet available",
        "wandb_url": job.wandb_run_url
    }
