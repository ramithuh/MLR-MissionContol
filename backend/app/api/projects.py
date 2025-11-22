from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel
from datetime import datetime

from app.core.database import get_db
from app.models.project import Project
from app.models.job import Job
from app.services.git_service import GitService

router = APIRouter()


# Pydantic schemas
class ProjectCreate(BaseModel):
    local_path: str


class ProjectResponse(BaseModel):
    id: str
    name: str
    local_path: str
    repo_url: str | None
    current_branch: str | None
    current_commit: str | None
    added_at: datetime
    last_synced: datetime
    canvas_state: str | None

    class Config:
        from_attributes = True


@router.post("/", response_model=ProjectResponse)
async def create_project(project_data: ProjectCreate, db: Session = Depends(get_db)):
    """
    Add a new project by analyzing a local Git repository.

    This endpoint:
    1. Validates the path exists and is a Git repo
    2. Extracts repo metadata (name, remote URL, branch, commit)
    3. Stores project in database
    """
    git_service = GitService(project_data.local_path)

    try:
        metadata = git_service.get_repo_metadata()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid Git repository: {str(e)}")

    # Check if project already exists
    existing = db.query(Project).filter(Project.name == metadata["name"]).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Project '{metadata['name']}' already exists")

    # Create new project
    project = Project(
        name=metadata["name"],
        local_path=project_data.local_path,
        repo_url=metadata["repo_url"],
        current_branch=metadata["branch"],
        current_commit=metadata["commit_sha"]
    )

    db.add(project)
    db.commit()
    db.refresh(project)

    return project


@router.get("/", response_model=List[ProjectResponse])
async def list_projects(db: Session = Depends(get_db)):
    """Get all projects."""
    projects = db.query(Project).all()
    return projects


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: str, db: Session = Depends(get_db)):
    """Get a specific project."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.post("/{project_id}/sync")
async def sync_project(project_id: str, db: Session = Depends(get_db)):
    """
    Sync project metadata with local Git repository.
    Updates repo URL, branch, and commit SHA.
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    git_service = GitService(project.local_path)
    metadata = git_service.get_repo_metadata()

    project.repo_url = metadata["repo_url"]
    project.current_branch = metadata["branch"]
    project.current_commit = metadata["commit_sha"]

    db.commit()
    db.refresh(project)

    return project


class CanvasStateUpdate(BaseModel):
    canvas_state: str


@router.put("/{project_id}/canvas-state")
async def update_canvas_state(
    project_id: str, 
    state_data: CanvasStateUpdate, 
    db: Session = Depends(get_db)
):
    """Update the canvas state for a project."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    project.canvas_state = state_data.canvas_state
    db.commit()
    
    return {"success": True}


@router.get("/{project_id}/hydra-config")
async def get_hydra_config(project_id: str, config_name: str = None, db: Session = Depends(get_db)):
    """
    Parse Hydra configuration from project's conf/ or configs/ directory.
    Returns a JSON structure for dynamic UI form generation.

    Args:
        project_id: ID of the project
        config_name: Optional name of the config file (e.g., "config_qwen2.5_1.5b").
                    If not provided, defaults to "config.yaml"
    """
    from app.services.hydra_parser import HydraParser

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    try:
        parser = HydraParser(project.local_path)
        config_data = parser.parse_config_groups(config_name)
        ui_schema = parser.build_ui_schema(config_name)

        return {
            "success": True,
            "config_groups": config_data["config_groups"],
            "main_config": config_data["main_config"],
            "available_configs": config_data["available_configs"],
            "ui_schema": ui_schema
        }
    except ValueError as e:
        # No Hydra config directory found
        return {
            "success": False,
            "error": str(e),
            "config_groups": {},
            "main_config": {},
            "available_configs": [],
            "ui_schema": {"groups": []}
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error parsing Hydra config: {str(e)}")


@router.get("/{project_id}/config")
async def get_project_config(project_id: str, db: Session = Depends(get_db)):
    """
    Get project-specific configuration from .mlops-config.yaml
    """
    from app.services.project_config import ProjectConfig

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    config = ProjectConfig(project.local_path)

    return {
        "exists": config.exists(),
        "conda_env": config.conda_env,
        "train_script": config.train_script,
        "default_overrides": config.default_overrides,
        "install_editable": config.install_editable,
        "package_name": config.package_name,
        "config_file_path": str(config.config_file)
    }


@router.get("/{project_id}/last-job-config")
async def get_last_job_config(project_id: str, db: Session = Depends(get_db)):
    """
    Get the configuration from the most recently submitted job for this project.
    Used to pre-populate the launch form with previous run settings.
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Get most recent job for this project
    last_job = (
        db.query(Job)
        .filter(Job.project_id == project_id)
        .order_by(Job.submitted_at.desc())
        .first()
    )

    if not last_job:
        return {
            "success": False,
            "message": "No previous jobs found"
        }

    # Return the cached configuration
    return {
        "success": True,
        "config": {
            "description": last_job.description,
            "cluster_name": last_job.cluster,
            "partition": last_job.partition,
            "num_nodes": last_job.num_nodes,
            "gpus_per_node": last_job.gpus_per_node,
            "gpu_type": last_job.gpu_type,
            "cpus_per_task": last_job.cpus_per_task,
            "memory": last_job.memory,
            "time_limit": last_job.time_limit,
            "config_name": last_job.config_name,
            "hydra_overrides": last_job.hydra_overrides or {},
            "raw_hydra_overrides": last_job.raw_hydra_overrides or ""
        }
    }


@router.delete("/{project_id}")
async def delete_project(project_id: str, db: Session = Depends(get_db)):
    """Delete a project."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    db.delete(project)
    db.commit()

    return {"message": "Project deleted successfully"}
