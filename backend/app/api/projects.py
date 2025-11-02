from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel
from datetime import datetime

from app.core.database import get_db
from app.models.project import Project
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


@router.get("/{project_id}/hydra-config")
async def get_hydra_config(project_id: str, db: Session = Depends(get_db)):
    """
    Parse Hydra configuration from project's conf/ or configs/ directory.
    Returns a JSON structure for dynamic UI form generation.
    """
    from app.services.hydra_parser import HydraParser

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    try:
        parser = HydraParser(project.local_path)
        config_data = parser.parse_config_groups()
        ui_schema = parser.build_ui_schema()

        return {
            "success": True,
            "config_groups": config_data["config_groups"],
            "main_config": config_data["main_config"],
            "ui_schema": ui_schema
        }
    except ValueError as e:
        # No Hydra config directory found
        return {
            "success": False,
            "error": str(e),
            "config_groups": {},
            "main_config": {},
            "ui_schema": {"groups": []}
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error parsing Hydra config: {str(e)}")


@router.delete("/{project_id}")
async def delete_project(project_id: str, db: Session = Depends(get_db)):
    """Delete a project."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    db.delete(project)
    db.commit()

    return {"message": "Project deleted successfully"}
