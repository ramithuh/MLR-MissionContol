from sqlalchemy import Column, String, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.core.database import Base


class Project(Base):
    """SQLAlchemy model for ML projects."""

    __tablename__ = "projects"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False, unique=True)
    local_path = Column(String, nullable=False)
    repo_url = Column(String, nullable=True)  # Remote URL
    current_branch = Column(String, nullable=True)
    current_commit = Column(String, nullable=True)
    added_at = Column(DateTime, default=datetime.utcnow)
    last_synced = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    canvas_state = Column(String, nullable=True)  # JSON string storing nodes, edges, and visibleJobIds

    # Relationship to jobs
    jobs = relationship("Job", back_populates="project", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Project(name='{self.name}', branch='{self.current_branch}')>"
