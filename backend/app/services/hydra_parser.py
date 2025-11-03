from pathlib import Path
from typing import Dict, Any, List
import yaml


class HydraParser:
    """Service for parsing Hydra configuration files."""

    def __init__(self, project_path: str):
        """
        Initialize Hydra parser.

        Args:
            project_path: Path to project root (should contain conf/ or configs/ directory)
        """
        self.project_path = Path(project_path).expanduser().resolve()

        # Support both "conf" and "configs" directory names
        if (self.project_path / "configs").exists():
            self.conf_dir = self.project_path / "configs"
        elif (self.project_path / "conf").exists():
            self.conf_dir = self.project_path / "conf"
        else:
            raise ValueError(f"Hydra config directory not found (tried 'conf' and 'configs'): {self.project_path}")

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

        # Extract defaults from main config
        defaults_map = self._extract_defaults(result["main_config"])

        # Parse config groups (subdirectories in conf/)
        for item in self.conf_dir.iterdir():
            if item.is_dir() and not item.name.startswith('.'):
                group_name = item.name
                group_data = self._parse_group(item)

                # Set the actual default from the defaults section
                if group_name in defaults_map:
                    default_value = defaults_map[group_name]

                    # Check if it's a multi-value config (list)
                    if isinstance(default_value, list):
                        group_data["default"] = default_value
                        group_data["multi_value"] = True
                    else:
                        group_data["default"] = default_value
                        group_data["multi_value"] = False
                else:
                    # Fallback to first option if no default specified
                    group_data["default"] = group_data["options"][0] if group_data["options"] else None
                    group_data["multi_value"] = False

                result["config_groups"][group_name] = group_data

        return result

    def _extract_defaults(self, main_config: Dict[str, Any]) -> Dict[str, str]:
        """
        Extract default config group selections from the 'defaults' section.

        Example input:
            defaults:
              - model: diffusion
              - tokenizer: llama
              - training: default

        Returns:
            {"model": "diffusion", "tokenizer": "llama", "training": "default"}
        """
        defaults_map = {}

        if "defaults" not in main_config:
            return defaults_map

        for item in main_config["defaults"]:
            if isinstance(item, dict):
                # Format: - model: diffusion
                for group_name, default_value in item.items():
                    if not group_name.startswith("_"):  # Skip _self_
                        defaults_map[group_name] = default_value
            elif isinstance(item, str) and not item.startswith("_"):
                # Format: - some_config (implies group name = config name)
                defaults_map[item] = item

        return defaults_map

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
            "configs": configs,
            "default": None  # Will be set by parse_config_groups
        }

    def build_ui_schema(self) -> Dict[str, Any]:
        """
        Build a JSON schema suitable for dynamic UI form generation.

        Returns a simplified structure that the frontend can use to
        create dropdowns, text inputs, etc.
        """
        parsed = self.parse_config_groups()
        ui_schema = {
            "groups": [],
            "parameters": []
        }

        # Add config group selectors
        for group_name, group_data in parsed["config_groups"].items():
            ui_schema["groups"].append({
                "name": group_name,
                "type": "select",
                "options": group_data["options"],
                "default": group_data.get("default"),  # Use the actual default from config
                "multi_value": group_data.get("multi_value", False)  # Pass multi-value flag to UI
            })

        # Extract configurable parameters from main config
        main_config = parsed["main_config"]
        ui_schema["parameters"] = self._extract_ui_parameters(main_config)

        return ui_schema

    def _extract_ui_parameters(self, config: Dict[str, Any], prefix: str = "") -> List[Dict[str, Any]]:
        """
        Extract parameters suitable for UI input from config.

        Args:
            config: Configuration dictionary
            prefix: Key prefix for nested parameters

        Returns:
            List of parameter definitions for UI
        """
        parameters = []
        skip_keys = {"defaults", "hydra", "logger"}  # Skip special Hydra keys

        for key, value in config.items():
            if key in skip_keys:
                continue

            # Skip interpolations (${...})
            if isinstance(value, str) and "${" in value:
                continue

            # Handle nested configs (but not config sections that represent objects)
            if isinstance(value, dict):
                # If the dict has _target_, it's an object instantiation, skip it
                if "_target_" not in value:
                    # Recurse into nested configs
                    nested = self._extract_ui_parameters(value, prefix=f"{prefix}{key}.")
                    parameters.extend(nested)
            else:
                # This is a configurable parameter
                param_key = f"{prefix}{key}"
                param_type = self._infer_param_type(value)

                parameters.append({
                    "key": param_key,
                    "type": param_type,
                    "default": value,
                    "label": key.replace("_", " ").title()
                })

        return parameters

    def _infer_param_type(self, value: Any) -> str:
        """Infer HTML input type from value."""
        if isinstance(value, bool):
            return "checkbox"
        elif isinstance(value, int):
            return "number"
        elif isinstance(value, float):
            return "number"
        else:
            return "text"
