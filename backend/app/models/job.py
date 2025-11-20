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
    cpus_per_task = Column(Integer, nullable=False, default=8)  # CPUs per task
    memory = Column(String, nullable=False, default="64G")  # Memory allocation
    time_limit = Column(String, nullable=True, default="24:00:00")  # HH:MM:SS format

    # Hydra configuration
    hydra_overrides = Column(JSON, nullable=True)  # Stored as JSON (from dropdown selections)
    raw_hydra_overrides = Column(Text, nullable=True)  # Raw override string for advanced users
    config_name = Column(String, nullable=True)  # Hydra --config-name override

    # SLURM job info
    slurm_job_id = Column(String, nullable=True)
    slurm_status = Column(String, nullable=True)  # PENDING, RUNNING, COMPLETED, FAILED
    slurm_script = Column(Text, nullable=True)  # Store the generated SLURM script
    error_message = Column(Text, nullable=True)  # Capture submission/execution errors

    # WandB integration
    wandb_run_url = Column(String, nullable=True)

    # Logs (optional: can store tail or path)
    logs = Column(Text, nullable=True)

    # Timestamps
    submitted_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Archive status
    archived = Column(Integer, default=0)  # 0 = active, 1 = archived

    # Relationship
    project = relationship("Project", back_populates="jobs")

    def __repr__(self):
        return f"<Job(name='{self.name}', status='{self.slurm_status}', slurm_id='{self.slurm_job_id}')>"
