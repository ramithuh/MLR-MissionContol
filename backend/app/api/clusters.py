from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
from pydantic import BaseModel
import yaml
import json
from pathlib import Path

from app.core.config import settings
from app.core.ssh_manager import SSHManager

router = APIRouter()


# Pydantic schemas
class ClusterInfo(BaseModel):
    name: str
    host: str
    ssh_key_path: str
    workspace: str


class GPUAvailability(BaseModel):
    gpu_type: str
    total: int
    available: int
    in_use: int
    pending: int = 0
    nodes_with_free: List[str] = []


@router.get("/", response_model=List[ClusterInfo])
async def list_clusters():
    """
    Get list of configured clusters from clusters.yaml.
    """
    try:
        with open(settings.clusters_config_path, 'r') as f:
            config = yaml.safe_load(f)
            clusters = config.get('clusters', [])
            return clusters
    except FileNotFoundError:
        raise HTTPException(
            status_code=500,
            detail=f"Cluster configuration not found at {settings.clusters_config_path}"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading cluster config: {str(e)}")


@router.get("/{cluster_name}/gpu-availability")
async def get_gpu_availability(cluster_name: str) -> Dict[str, Any]:
    """
    Check real-time GPU availability on a cluster.

    This endpoint:
    1. Finds cluster config
    2. SSHs to the cluster
    3. Runs check_gpu_availability.py --json
    4. Parses JSON output and returns GPU availability data
    """
    # Get cluster config
    try:
        with open(settings.clusters_config_path, 'r') as f:
            config = yaml.safe_load(f)
            clusters = {c['name']: c for c in config.get('clusters', [])}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading cluster config: {str(e)}")

    if cluster_name not in clusters:
        raise HTTPException(status_code=404, detail=f"Cluster '{cluster_name}' not found")

    cluster = clusters[cluster_name]

    # Parse host into username and hostname
    if '@' in cluster['host']:
        username, hostname = cluster['host'].split('@')
    else:
        raise HTTPException(status_code=500, detail=f"Invalid host format: {cluster['host']}")

    # Connect via SSH and run the script
    try:
        ssh = SSHManager(
            host=hostname,
            username=username,
            key_path=cluster['ssh_key_path']
        )

        with ssh:
            # Run the GPU availability script with --json flag
            # Assumes script is in home directory on cluster
            stdout, stderr, exit_code = ssh.execute_command(
                "python3 ~/check_gpu_availability.py --json"
            )

            if exit_code != 0:
                raise HTTPException(
                    status_code=500,
                    detail=f"GPU availability script failed: {stderr}"
                )

            # Parse JSON output
            try:
                gpu_data = json.loads(stdout)
                return gpu_data
            except json.JSONDecodeError as e:
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to parse GPU data: {str(e)}"
                )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error connecting to cluster: {str(e)}"
        )


@router.get("/{cluster_name}/partitions")
async def get_partitions(cluster_name: str) -> List[str]:
    """
    Get available SLURM partitions on a cluster.
    Runs `sinfo` and parses output.
    """
    # TODO: Implement via SSH
    return ["gpu", "cpu", "interactive"]


@router.post("/{cluster_name}/test-connection")
async def test_cluster_connection(cluster_name: str):
    """
    Test SSH connection to a cluster.
    """
    # TODO: Implement SSH connection test
    return {
        "cluster": cluster_name,
        "status": "Connection test not yet implemented",
        "reachable": False
    }
