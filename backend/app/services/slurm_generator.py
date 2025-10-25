from jinja2 import Template
from pathlib import Path
from typing import Dict, Any

from app.core.config import settings


class SlurmScriptGenerator:
    """Service for generating SLURM batch scripts from templates."""

    def __init__(self, template_path: str | None = None):
        """
        Initialize SLURM script generator.

        Args:
            template_path: Path to Jinja2 template file.
                          If None, uses default from settings.
        """
        if template_path:
            self.template_path = Path(template_path)
        else:
            self.template_path = settings.slurm_template_path

        if not self.template_path.exists():
            raise FileNotFoundError(f"SLURM template not found: {self.template_path}")

        with open(self.template_path, 'r') as f:
            self.template = Template(f.read())

    def generate_script(
        self,
        job_name: str,
        partition: str,
        num_nodes: int,
        gpus_per_node: int,
        repo_url: str,
        commit_sha: str,
        workspace_dir: str,
        python_command: str,
        gpu_type: str | None = None,
        time_limit: str = "24:00:00",
        output_file: str | None = None,
        **extra_vars
    ) -> str:
        """
        Generate a SLURM batch script.

        Args:
            job_name: Name for the SLURM job
            partition: SLURM partition to use
            num_nodes: Number of nodes to request
            gpus_per_node: Number of GPUs per node
            repo_url: Git repository URL
            commit_sha: Git commit SHA to checkout
            workspace_dir: Remote workspace directory
            python_command: Python training command to run
            gpu_type: GPU type constraint (e.g., "A6000")
            time_limit: Wall time limit
            output_file: Path for SLURM output file
            **extra_vars: Additional template variables

        Returns:
            Generated SLURM script as string
        """
        # Calculate total GPUs
        total_gpus = num_nodes * gpus_per_node

        # Build template context
        context = {
            "job_name": job_name,
            "partition": partition,
            "num_nodes": num_nodes,
            "gpus_per_node": gpus_per_node,
            "total_gpus": total_gpus,
            "gpu_type": gpu_type,
            "time_limit": time_limit,
            "output_file": output_file or f"slurm-%j.out",
            "repo_url": repo_url,
            "commit_sha": commit_sha,
            "workspace_dir": workspace_dir,
            "python_command": python_command,
            **extra_vars
        }

        # Render template
        script = self.template.render(**context)
        return script

    def build_python_command(
        self,
        script_path: str,
        hydra_overrides: Dict[str, Any] | None = None,
        num_nodes: int = 1
    ) -> str:
        """
        Build the Python training command with Hydra overrides.

        Args:
            script_path: Path to training script (e.g., "train.py")
            hydra_overrides: Dictionary of Hydra config overrides
            num_nodes: Number of nodes (for distributed training setup)

        Returns:
            Complete python command string
        """
        cmd = f"python {script_path}"

        # Add Hydra overrides
        if hydra_overrides:
            for key, value in hydra_overrides.items():
                cmd += f" {key}={value}"

        # Add distributed training flags if multi-node
        if num_nodes > 1:
            cmd = f"srun {cmd}"

        return cmd
