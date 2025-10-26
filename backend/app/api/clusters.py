from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
from pydantic import BaseModel
from datetime import datetime, timedelta
import yaml
import json
from pathlib import Path

from app.core.config import settings
from app.core.ssh_manager import SSHManager

router = APIRouter()

# Simple in-memory cache for GPU availability
# Format: {cluster_name: (data, timestamp)}
gpu_cache: Dict[str, tuple] = {}
GPU_CACHE_DURATION = 60  # seconds


# Pydantic schemas
class ClusterInfo(BaseModel):
    name: str
    host: str
    ssh_key_path: str
    workspace: str
    allowed_partitions: List[str] = []
    allowed_gpu_types: List[str] = []


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
    1. Checks cache first (60 second TTL)
    2. If cache miss, SSHs to the cluster
    3. Runs check_gpu_availability.py --json
    4. Parses JSON output, caches it, and returns GPU availability data
    """
    # Check cache first
    if cluster_name in gpu_cache:
        cached_data, cached_time = gpu_cache[cluster_name]
        age = (datetime.now() - cached_time).total_seconds()
        if age < GPU_CACHE_DURATION:
            # Return cached data with age indicator
            cached_data['cached'] = True
            cached_data['cache_age_seconds'] = int(age)
            return cached_data

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

                # Filter by allowed_gpu_types if specified
                if cluster.get('allowed_gpu_types'):
                    allowed_types = set(cluster['allowed_gpu_types'])
                    gpu_data['gpus'] = [
                        gpu for gpu in gpu_data['gpus']
                        if gpu['gpu_type'] in allowed_types
                    ]
                    # Recalculate total_free_gpus after filtering
                    gpu_data['total_free_gpus'] = sum(
                        gpu['available'] for gpu in gpu_data['gpus']
                    )

                # Cache the result
                gpu_data['cached'] = False
                gpu_data['cache_age_seconds'] = 0
                gpu_cache[cluster_name] = (gpu_data.copy(), datetime.now())

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
    If cluster config has allowed_partitions, filters results.
    Otherwise runs `sinfo -o %P` and returns all partitions.
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

    # If allowed_partitions is specified, return that
    if cluster.get('allowed_partitions'):
        return cluster['allowed_partitions']

    # Otherwise, query SLURM
    # Parse host
    if '@' in cluster['host']:
        username, hostname = cluster['host'].split('@')
    else:
        raise HTTPException(status_code=500, detail=f"Invalid host format: {cluster['host']}")

    # Connect and get partitions
    try:
        ssh = SSHManager(
            host=hostname,
            username=username,
            key_path=cluster['ssh_key_path']
        )

        with ssh:
            stdout, stderr, exit_code = ssh.execute_command("sinfo -o %P --noheader")

            if exit_code != 0:
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to get partitions: {stderr}"
                )

            # Parse partition names (remove asterisks which indicate default partition)
            partitions = []
            for line in stdout.strip().split('\n'):
                partition = line.strip().rstrip('*')
                if partition and partition not in partitions:
                    partitions.append(partition)

            return partitions

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error connecting to cluster: {str(e)}"
        )


@router.post("/{cluster_name}/test-connection")
async def test_cluster_connection(cluster_name: str):
    """
    Test SSH connection to a cluster.
    Attempts to connect and run a simple command.
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

    # Parse host
    if '@' in cluster['host']:
        username, hostname = cluster['host'].split('@')
    else:
        raise HTTPException(status_code=500, detail=f"Invalid host format: {cluster['host']}")

    # Test connection
    try:
        ssh = SSHManager(
            host=hostname,
            username=username,
            key_path=cluster['ssh_key_path']
        )

        with ssh:
            # Run simple test command
            stdout, stderr, exit_code = ssh.execute_command("echo 'MLOps Mission Control connection test' && hostname")

            if exit_code == 0:
                return {
                    "cluster": cluster_name,
                    "status": "Connected successfully",
                    "reachable": True,
                    "hostname": stdout.strip().split('\n')[-1],
                    "message": "SSH connection is working correctly"
                }
            else:
                return {
                    "cluster": cluster_name,
                    "status": "Connection failed",
                    "reachable": False,
                    "error": stderr
                }

    except Exception as e:
        return {
            "cluster": cluster_name,
            "status": f"Connection error: {str(e)}",
            "reachable": False,
            "error": str(e)
        }
