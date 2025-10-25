from pathlib import Path
from typing import Dict, Any, List
import yaml


class HydraParser:
    """Service for parsing Hydra configuration files."""

    def __init__(self, project_path: str):
        """
        Initialize Hydra parser.

        Args:
            project_path: Path to project root (should contain conf/ directory)
        """
        self.project_path = Path(project_path).expanduser().resolve()
        self.conf_dir = self.project_path / "conf"

        if not self.conf_dir.exists():
            raise ValueError(f"Hydra conf directory not found: {self.conf_dir}")

    def parse_config_groups(self) -> Dict[str, Any]:
        """
        Parse Hydra configuration directory and extract config groups.

        Returns:
            Dictionary structure:
            {
                "config_groups": {
                    "model": {
                        "options": ["resnet50", "vit"],
                        "default": "resnet50",
                        "configs": {
                            "resnet50": {"layers": 50, "pretrained": true},
                            "vit": {"patch_size": 16, "hidden_dim": 768}
                        }
                    },
                    "optimizer": {
                        "options": ["adam", "sgd"],
                        ...
                    }
                },
                "main_config": {...}  # config.yaml contents
            }
        """
        result = {
            "config_groups": {},
            "main_config": {}
        }

        # Parse main config.yaml if exists
        main_config_path = self.conf_dir / "config.yaml"
        if main_config_path.exists():
            with open(main_config_path, 'r') as f:
                result["main_config"] = yaml.safe_load(f) or {}

        # Parse config groups (subdirectories in conf/)
        for item in self.conf_dir.iterdir():
            if item.is_dir() and not item.name.startswith('.'):
                group_name = item.name
                result["config_groups"][group_name] = self._parse_group(item)

        return result

    def _parse_group(self, group_dir: Path) -> Dict[str, Any]:
        """
        Parse a single config group directory.

        Args:
            group_dir: Path to group directory (e.g., conf/model/)

        Returns:
            Dictionary with options and their configs
        """
        options = []
        configs = {}

        for yaml_file in group_dir.glob("*.yaml"):
            option_name = yaml_file.stem
            options.append(option_name)

            with open(yaml_file, 'r') as f:
                config_content = yaml.safe_load(f) or {}
                configs[option_name] = config_content

        return {
            "options": sorted(options),
            "configs": configs
        }

    def build_ui_schema(self) -> Dict[str, Any]:
        """
        Build a JSON schema suitable for dynamic UI form generation.

        Returns a simplified structure that the frontend can use to
        create dropdowns, text inputs, etc.
        """
        parsed = self.parse_config_groups()
        ui_schema = {
            "groups": []
        }

        for group_name, group_data in parsed["config_groups"].items():
            ui_schema["groups"].append({
                "name": group_name,
                "type": "select",
                "options": group_data["options"],
                "default": group_data["options"][0] if group_data["options"] else None
            })

        return ui_schema
