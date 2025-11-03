from pathlib import Path
import yaml
from typing import Dict, Any, Optional


class ProjectConfig:
    """Service for reading project-specific configuration."""

    def __init__(self, project_path: str):
        """
        Initialize project config reader.

        Args:
            project_path: Path to project root directory
        """
        self.project_path = Path(project_path).expanduser().resolve()
        self.config_file = self.project_path / ".mlops-config.yaml"
        self._config = None

    def load(self) -> Dict[str, Any]:
        """
        Load project configuration from .mlops-config.yaml.

        Returns:
            Dictionary with project configuration.
            Returns defaults if file doesn't exist.
        """
        if self._config is not None:
            return self._config

        # Default configuration
        self._config = {
            "conda_env": None,
            "train_script": "train.py",
            "default_overrides": {},
            "install_editable": False,
            "package_name": None  # If None, will use project name
        }

        # Load from file if exists
        if self.config_file.exists():
            try:
                with open(self.config_file, 'r') as f:
                    user_config = yaml.safe_load(f) or {}
                    self._config.update(user_config)
            except Exception as e:
                # If config file is invalid, use defaults
                print(f"Warning: Could not parse .mlops-config.yaml: {e}")

        return self._config

    @property
    def conda_env(self) -> Optional[str]:
        """Get conda environment name."""
        return self.load().get("conda_env")

    @property
    def train_script(self) -> str:
        """Get training script path."""
        return self.load().get("train_script", "train.py")

    @property
    def default_overrides(self) -> Dict[str, Any]:
        """Get default Hydra overrides."""
        return self.load().get("default_overrides", {})

    @property
    def install_editable(self) -> bool:
        """Check if package should be installed in editable mode."""
        return self.load().get("install_editable", False)

    @property
    def package_name(self) -> Optional[str]:
        """Get package name for pip install/uninstall."""
        return self.load().get("package_name")

    def exists(self) -> bool:
        """Check if project config file exists."""
        return self.config_file.exists()
