"""Background service for polling SLURM job status."""

import logging
import yaml
from typing import Dict
from datetime import datetime
from pathlib import Path

from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.core.config import settings
from app.core.ssh_manager import SSHManager
from app.models.job import Job
from app.services.job_monitor import JobMonitor

logger = logging.getLogger(__name__)


class JobStatusPoller:
    """Background service to periodically poll SLURM clusters for job status."""

    def __init__(self):
        """Initialize the job status poller."""
        self.running = False

    def poll_all_jobs(self):
        """
        Poll all active jobs and update their statuses.

        This function:
        1. Queries DB for jobs that might need status updates
        2. Groups jobs by cluster
        3. For each cluster, SSHs in and checks all job statuses
        4. Updates the database with new statuses
        """
        if self.running:
            logger.debug("Poll already in progress, skipping...")
            return

        self.running = True
        try:
            db = SessionLocal()
            try:
                # Get jobs that are not in terminal states
                active_statuses = ["PENDING", "RUNNING", "CONFIGURING", "SUBMITTING"]
                active_jobs = db.query(Job).filter(
                    Job.slurm_status.in_(active_statuses),
                    Job.slurm_job_id.isnot(None)
                ).all()

                if not active_jobs:
                    logger.debug("No active jobs to poll")
                    return

                logger.info(f"Polling {len(active_jobs)} active jobs")

                # Group jobs by cluster
                jobs_by_cluster = {}
                for job in active_jobs:
                    if job.cluster not in jobs_by_cluster:
                        jobs_by_cluster[job.cluster] = []
                    jobs_by_cluster[job.cluster].append(job)

                # Load cluster config
                with open(settings.clusters_config_path, 'r') as f:
                    config = yaml.safe_load(f)
                    clusters = {c['name']: c for c in config.get('clusters', [])}

                # Poll each cluster
                for cluster_name, jobs in jobs_by_cluster.items():
                    if cluster_name not in clusters:
                        logger.error(f"Cluster {cluster_name} not found in config")
                        continue

                    self._poll_cluster_jobs(cluster_name, clusters[cluster_name], jobs, db)

                db.commit()

            finally:
                db.close()

        except Exception as e:
            logger.error(f"Error in job polling: {e}", exc_info=True)
        finally:
            self.running = False

    def _poll_cluster_jobs(
        self,
        cluster_name: str,
        cluster_config: Dict,
        jobs: list,
        db: Session
    ):
        """
        Poll all jobs on a specific cluster.

        Args:
            cluster_name: Name of the cluster
            cluster_config: Cluster configuration dict
            jobs: List of Job objects to poll
            db: Database session
        """
        try:
            # Parse host
            if '@' in cluster_config['host']:
                username, hostname = cluster_config['host'].split('@')
            else:
                logger.error(f"Invalid host format for cluster {cluster_name}")
                return

            # Connect to cluster
            ssh = SSHManager(
                host=hostname,
                username=username,
                key_path=cluster_config['ssh_key_path']
            )

            with ssh:
                job_monitor = JobMonitor(ssh)

                # Check status for each job
                for job in jobs:
                    try:
                        status, reason = job_monitor.get_job_status(job.slurm_job_id)

                        if status != job.slurm_status:
                            logger.info(
                                f"Job {job.name} ({job.slurm_job_id}): "
                                f"{job.slurm_status} -> {status}"
                            )
                            job.slurm_status = status
                            job.updated_at = datetime.utcnow()

                    except Exception as e:
                        logger.error(
                            f"Error checking status for job {job.id} "
                            f"(SLURM ID {job.slurm_job_id}): {e}"
                        )

        except Exception as e:
            logger.error(f"Error connecting to cluster {cluster_name}: {e}")


# Global poller instance
job_poller = JobStatusPoller()


def poll_job_statuses():
    """Entry point for scheduled polling."""
    job_poller.poll_all_jobs()
