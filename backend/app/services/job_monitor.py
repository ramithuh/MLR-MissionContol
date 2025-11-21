import re
from typing import Optional, Tuple

from app.core.ssh_manager import SSHManager


class JobMonitor:
    """Service for monitoring SLURM job status and logs."""

    def __init__(self, ssh_manager: SSHManager, use_login_shell: bool = False):
        """
        Initialize job monitor.

        Args:
            ssh_manager: SSH connection to cluster
            use_login_shell: Whether to use login shell for SLURM commands
        """
        self.ssh = ssh_manager
        self.use_login_shell = use_login_shell

    def get_job_status(self, slurm_job_id: str) -> Tuple[str, Optional[str]]:
        """
        Query SLURM job status.

        Args:
            slurm_job_id: SLURM job ID

        Returns:
            Tuple of (status, reason)
            Status can be: PENDING, RUNNING, COMPLETED, FAILED, CANCELLED
        """
        # First try squeue (for running/pending jobs)
        cmd = f"squeue -j {slurm_job_id} -h -o '%T'"
        stdout, stderr, exit_code = self.ssh.execute_command(cmd, use_login_shell=self.use_login_shell)

        if exit_code == 0 and stdout.strip():
            status = stdout.strip()
            return self._normalize_status(status), None

        # If not in queue, check sacct (for completed/failed jobs)
        cmd = f"sacct -j {slurm_job_id} -n -o State --parsable2"
        stdout, stderr, exit_code = self.ssh.execute_command(cmd, use_login_shell=self.use_login_shell)

        if exit_code == 0 and stdout.strip():
            lines = stdout.strip().split('\n')
            # Take first non-empty line (usually the job step)
            status = lines[0] if lines else "UNKNOWN"
            return self._normalize_status(status), None

        return "UNKNOWN", "Job not found in squeue or sacct"

    def get_job_logs(self, log_path: str, tail_lines: int = None, max_lines: int = None) -> str:
        """
        Fetch job logs from cluster.

        Args:
            log_path: Path to SLURM output file on cluster
            tail_lines: Number of lines to fetch from end of file. If None, fetches full file.
            max_lines: Deprecated, ignored for backwards compatibility

        Returns:
            Log content (with carriage returns cleaned and progress bars filtered)
        """
        if tail_lines is not None:
            # User specified number of lines - just get those with simple tail
            cmd = f"tail -n {tail_lines} {log_path}"
        else:
            # Fetch full file but filter out intermediate progress bar updates
            # Keep lines with 100% and skip intermediate percentage updates
            cmd = f"cat {log_path} | sed 's/.*\\r//g' | grep -v -E '\\s+[0-9]{{1,2}}%\\|' || cat {log_path}"

        # Use longer timeout for log fetching (up to 2 minutes)
        stdout, stderr, exit_code = self.ssh.execute_command(
            cmd,
            use_login_shell=self.use_login_shell,
            timeout=120
        )

        if exit_code == 0:
            return stdout
        else:
            return f"Error fetching logs: {stderr}"

    @staticmethod
    def _clean_progress_bars(log_content: str) -> str:
        """
        Clean up carriage return (\r) based progress bars from log content.

        Progress bars use \r to overwrite lines. In terminal this looks clean,
        but in raw logs it creates thousands of lines. We keep only the final
        state of each progress bar sequence.

        Args:
            log_content: Raw log content with \r characters

        Returns:
            Cleaned log content with only final progress bar states
        """
        if '\r' not in log_content:
            # No carriage returns, return as-is
            return log_content

        lines = []
        current_line = ""

        for char in log_content:
            if char == '\r':
                # Carriage return - reset current line
                current_line = ""
            elif char == '\n':
                # Newline - save current line and start new one
                if current_line:  # Only add non-empty lines
                    lines.append(current_line)
                current_line = ""
            else:
                # Regular character
                current_line += char

        # Don't forget the last line if there's no trailing newline
        if current_line:
            lines.append(current_line)

        return '\n'.join(lines)

    def extract_wandb_url(self, log_content: str) -> Optional[str]:
        """
        Extract WandB run URL from logs.

        Looks for patterns like:
        - "wandb: 🚀 View run at https://wandb.ai/..."
        - "View run at https://wandb.ai/..."

        Args:
            log_content: Job log content

        Returns:
            WandB URL if found, None otherwise
        """
        # Common WandB URL patterns
        patterns = [
            r'View run at (https://wandb\.ai/[^\s]+)',
            r'wandb: .*?(https://wandb\.ai/[^\s]+)',
            r'(https://wandb\.ai/[^\s]+)'
        ]

        for pattern in patterns:
            match = re.search(pattern, log_content)
            if match:
                return match.group(1).strip()

        return None

    def submit_job(self, sbatch_script_path: str) -> Tuple[str, Optional[str]]:
        """
        Submit a SLURM job via sbatch.

        Args:
            sbatch_script_path: Path to sbatch script on remote cluster

        Returns:
            Tuple of (slurm_job_id, error_message)
        """
        cmd = f"sbatch {sbatch_script_path}"
        stdout, stderr, exit_code = self.ssh.execute_command(cmd, use_login_shell=self.use_login_shell)

        if exit_code == 0:
            # Parse job ID from output: "Submitted batch job 12345"
            match = re.search(r'Submitted batch job (\d+)', stdout)
            if match:
                job_id = match.group(1)
                return job_id, None
            else:
                return None, f"Could not parse job ID from: {stdout}"
        else:
            return None, f"sbatch failed: {stderr}"

    @staticmethod
    def _normalize_status(status: str) -> str:
        """
        Normalize SLURM status codes to simplified statuses.

        SLURM has many status codes, we simplify them:
        - PENDING, CONFIGURING -> PENDING
        - RUNNING -> RUNNING
        - COMPLETED -> COMPLETED
        - FAILED, TIMEOUT, OUT_OF_MEMORY, NODE_FAIL -> FAILED
        - CANCELLED -> CANCELLED
        """
        status = status.upper()

        if status in ["PENDING", "CONFIGURING"]:
            return "PENDING"
        elif status in ["RUNNING"]:
            return "RUNNING"
        elif status in ["COMPLETED"]:
            return "COMPLETED"
        elif status in ["FAILED", "TIMEOUT", "OUT_OF_MEMORY", "NODE_FAIL"]:
            return "FAILED"
        elif status in ["CANCELLED", "CANCELED"]:
            return "CANCELLED"
        else:
            return status
