import paramiko
from pathlib import Path
from typing import Tuple, Optional
import logging

logger = logging.getLogger(__name__)


class SSHManager:
    """Manages SSH connections to remote SLURM clusters."""

    def __init__(self, host: str, username: str, key_path: str):
        """
        Initialize SSH manager.

        Args:
            host: Hostname or IP address
            username: SSH username
            key_path: Path to private SSH key
        """
        self.host = host
        self.username = username
        self.key_path = Path(key_path).expanduser()
        self.client: Optional[paramiko.SSHClient] = None

    def connect(self) -> None:
        """Establish SSH connection."""
        self.client = paramiko.SSHClient()
        self.client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

        try:
            self.client.connect(
                hostname=self.host,
                username=self.username,
                key_filename=str(self.key_path),
                timeout=10
            )
            logger.info(f"Connected to {self.username}@{self.host}")
        except Exception as e:
            logger.error(f"Failed to connect to {self.host}: {e}")
            raise

    def execute_command(self, command: str) -> Tuple[str, str, int]:
        """
        Execute command on remote host.

        Args:
            command: Shell command to execute

        Returns:
            Tuple of (stdout, stderr, exit_code)
        """
        if not self.client:
            self.connect()

        logger.debug(f"Executing: {command}")
        stdin, stdout, stderr = self.client.exec_command(command)

        exit_code = stdout.channel.recv_exit_status()
        stdout_str = stdout.read().decode('utf-8')
        stderr_str = stderr.read().decode('utf-8')

        return stdout_str, stderr_str, exit_code

    def upload_file(self, local_path: str, remote_path: str) -> None:
        """Upload file to remote host via SFTP."""
        if not self.client:
            self.connect()

        sftp = self.client.open_sftp()
        try:
            sftp.put(local_path, remote_path)
            logger.info(f"Uploaded {local_path} to {remote_path}")
        finally:
            sftp.close()

    def download_file(self, remote_path: str, local_path: str) -> None:
        """Download file from remote host via SFTP."""
        if not self.client:
            self.connect()

        sftp = self.client.open_sftp()
        try:
            sftp.get(remote_path, local_path)
            logger.info(f"Downloaded {remote_path} to {local_path}")
        finally:
            sftp.close()

    def close(self) -> None:
        """Close SSH connection."""
        if self.client:
            self.client.close()
            logger.info(f"Disconnected from {self.host}")

    def __enter__(self):
        """Context manager entry."""
        self.connect()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit."""
        self.close()
