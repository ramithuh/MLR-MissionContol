from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    """Application settings."""

    app_name: str = "MLOps Mission Control"
    app_version: str = "0.1.0"

    # Paths
    base_dir: Path = Path(__file__).resolve().parent.parent.parent.parent
    config_dir: Path = base_dir / "config"
    clusters_config_path: Path = config_dir / "clusters.yaml"
    slurm_template_path: Path = config_dir / "slurm_template.j2"

    # Database
    database_url: str = "sqlite:///./mlops_mission_control.db"

    # Job monitoring
    job_poll_interval: int = 30  # seconds
    log_tail_lines: int = 100

    class Config:
        env_file = ".env"


settings = Settings()
