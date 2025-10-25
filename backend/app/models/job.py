from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, JSON, Text
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.core.database import Base


class Job(Base):
    """SQLAlchemy model for SLURM jobs."""

    __tablename__ = "jobs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)

    # Job metadata
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    commit_sha = Column(String, nullable=False)

    # Cluster configuration
    cluster = Column(String, nullable=False)
    partition = Column(String, nullable=False)
    gpu_type = Column(String, nullable=True)  # e.g., "A6000", "A100"
    num_nodes = Column(Integer, nullable=False, default=1)
    gpus_per_node = Column(Integer, nullable=False, default=1)

    # Hydra configuration
    hydra_overrides = Column(JSON, nullable=True)  # Stored as JSON

    # SLURM job info
    slurm_job_id = Column(String, nullable=True)
    slurm_status = Column(String, nullable=True)  # PENDING, RUNNING, COMPLETED, FAILED

    # WandB integration
    wandb_run_url = Column(String, nullable=True)

    # Logs (optional: can store tail or path)
    logs = Column(Text, nullable=True)

    # Timestamps
    submitted_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship
    project = relationship("Project", back_populates="jobs")

    def __repr__(self):
        return f"<Job(name='{self.name}', status='{self.slurm_status}', slurm_id='{self.slurm_job_id}')>"
