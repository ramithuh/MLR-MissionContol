# Architecture Document

## System Overview

MLOps Mission Control is a full-stack web application for managing ML experiments across SLURM clusters.

```
┌──────────────────────────────────────────────────────────────┐
│                        User Browser                          │
│                     (React Frontend)                         │
└────────────────────────┬─────────────────────────────────────┘
                         │ HTTP/REST API
                         │
┌────────────────────────▼─────────────────────────────────────┐
│                   FastAPI Backend                            │
│  ┌────────────┐  ┌────────────┐  ┌─────────────┐            │
│  │  Project   │  │    Job     │  │  Cluster    │            │
│  │  Manager   │  │  Manager   │  │  Manager    │            │
│  └────────────┘  └────────────┘  └─────────────┘            │
│  ┌────────────┐  ┌────────────┐  ┌─────────────┐            │
│  │   Hydra    │  │   SLURM    │  │     Job     │            │
│  │   Parser   │  │ Generator  │  │  Monitor    │            │
│  └────────────┘  └────────────┘  └─────────────┘            │
│                                                               │
│  ┌──────────────────────────────────────────────┐            │
│  │         SQLite Database                      │            │
│  │  - Projects  - Jobs  - Metadata              │            │
│  └──────────────────────────────────────────────┘            │
└────────────────────────┬─────────────────────────────────────┘
                         │ SSH (Paramiko)
                         │
┌────────────────────────▼─────────────────────────────────────┐
│              Remote SLURM Clusters                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │  Cluster A   │  │  Cluster B   │  │  Cluster C   │       │
│  │  (A6000 GPUs)│  │  (A100 GPUs) │  │ (RTX GPUs)   │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└──────────────────────────────────────────────────────────────┘
```

## Component Breakdown

### Frontend (React + Vite)

**Technology**: React 18, Vite, TailwindCSS, React Router, Axios, react-hot-toast

**Pages**:
- `Dashboard.jsx`: Overview of all projects and recent jobs
- `ProjectView.jsx`: Detailed view of a project and its job history
- `LaunchJob.jsx`: Form to configure and submit new jobs

**Services**:
- `api.js`: Axios-based HTTP client for backend communication

**Key Features**:
- Real-time job status display (auto-updates via background polling)
- Toast notifications for all user actions (success/error feedback)
- GPU availability visualization with caching
- Dynamic resource configuration
- WandB integration links

### Backend (FastAPI)

**Technology**: Python 3.10+, FastAPI, SQLAlchemy, APScheduler, Paramiko, GitPython

**API Modules** (`app/api/`):
- `projects.py`: Project management endpoints
- `jobs.py`: Job submission and monitoring endpoints
- `clusters.py`: Cluster information and GPU availability endpoints (with 60s caching)

**Core Modules** (`app/core/`):
- `config.py`: Application settings and configuration
- `database.py`: SQLAlchemy setup and session management
- `ssh_manager.py`: SSH connection manager using Paramiko

**Service Modules** (`app/services/`):
- `git_service.py`: Git repository metadata extraction
- `project_config.py`: Project-level configuration reader (.mlops-config.yaml)
- `slurm_generator.py`: Dynamic SLURM script generation from templates
- `job_monitor.py`: Job status checking and log fetching
- `job_poller.py`: Background job status polling (APScheduler)
- `hydra_parser.py`: Hydra YAML configuration parsing (Phase 2)

**Data Models** (`app/models/`):
- `project.py`: SQLAlchemy model for ML projects
- `job.py`: SQLAlchemy model for SLURM jobs

### Configuration

**Files**:
- `config/clusters.yaml`: Cluster definitions (SSH hosts, keys, workspaces) - excluded from git
- `config/clusters.yaml.example`: Template for cluster configuration
- `config/slurm_template.j2`: Jinja2 template for SLURM batch scripts

**Project-Level Configuration**:
- `.mlops-config.yaml`: Per-project settings (conda env, train script, etc.)

### Scripts

- `scripts/check_gpu_availability.py`: Deployed on clusters to report GPU usage

## Data Models

### Project Model
```python
{
    "id": "uuid",
    "name": "project-name",
    "local_path": "/path/to/project",
    "repo_url": "git@github.com:user/repo.git",
    "current_branch": "main",
    "current_commit": "abc123...",
    "added_at": "timestamp",
    "last_synced": "timestamp"
}
```

### Job Model
```python
{
    "id": "uuid",
    "project_id": "uuid",
    "name": "experiment-name",
    "description": "Optional description",
    "commit_sha": "abc123...",
    "cluster": "cluster-name",
    "partition": "gpu",
    "gpu_type": "A6000",
    "num_nodes": 2,
    "gpus_per_node": 4,
    "hydra_overrides": {...},
    "slurm_job_id": "12345",
    "slurm_status": "RUNNING",
    "wandb_run_url": "https://wandb.ai/...",
    "logs": "...",
    "submitted_at": "timestamp",
    "updated_at": "timestamp"
}
```

## API Endpoints

### Projects
- `POST /api/projects/` - Add a project
- `GET /api/projects/` - List all projects
- `GET /api/projects/{id}` - Get project details
- `POST /api/projects/{id}/sync` - Sync project Git metadata
- `GET /api/projects/{id}/hydra-config` - Get Hydra configuration
- `DELETE /api/projects/{id}` - Delete project

### Jobs
- `POST /api/jobs/` - Submit a new job
- `GET /api/jobs/` - List jobs (optionally filter by project)
- `GET /api/jobs/{id}` - Get job details
- `POST /api/jobs/{id}/refresh-status` - Refresh job status from cluster
- `GET /api/jobs/{id}/logs` - Fetch job logs

### Clusters
- `GET /api/clusters/` - List configured clusters
- `GET /api/clusters/{name}/gpu-availability` - Get GPU availability
- `GET /api/clusters/{name}/partitions` - Get SLURM partitions
- `POST /api/clusters/{name}/test-connection` - Test SSH connection

## Workflow

### Job Submission Flow

1. **User selects project** on Dashboard
2. **User clicks "Launch Job"**
3. **Frontend loads**:
   - Project metadata (current commit SHA)
   - Available clusters
4. **User selects cluster** → Frontend fetches:
   - GPU availability (via SSH to cluster)
   - SLURM partitions
5. **User configures**:
   - Job name and description
   - GPU type and quantity
   - Number of nodes
   - Hydra config overrides (Phase 2)
6. **User submits** → Backend:
   - Creates job record in DB (status: SUBMITTING)
   - Generates SLURM script from template
   - SSHs to cluster
   - Uploads SLURM script
   - Runs `sbatch` command
   - Captures SLURM job ID
   - Updates job record with job ID and status
7. **Background monitoring** (Implemented):
   - APScheduler runs job poller every 30 seconds
   - Only polls jobs with active statuses (PENDING, RUNNING, CONFIGURING, SUBMITTING)
   - Automatically stops polling when jobs reach terminal states
   - Updates job status in database in real-time

### Job Monitoring Flow (Implemented)

1. **Background task runs every 30 seconds** (APScheduler)
2. **Query database** for jobs with active statuses only
3. **Group jobs by cluster** to minimize SSH connections
4. **SSH to cluster** and run `squeue -j {job_id}` or `sacct -j {job_id}`
5. **Update job status** in database if changed
6. **Skip polling** if no active jobs exist
7. **Frontend displays** updated status on page refresh (no active polling needed)

## Security Considerations

- **SSH Keys**: Stored locally, never in Git or database
- **File Permissions**: SSH keys must be `chmod 600`
- **No Credentials**: All auth is key-based, no passwords
- **CORS**: Frontend and backend on different ports, CORS configured
- **Input Validation**: Pydantic models validate all API inputs
- **SQL Injection**: SQLAlchemy ORM prevents SQL injection
- **Path Traversal**: User inputs sanitized before file operations

## Current Implementation Status

### Implemented (MVP Complete)
- Project management with Git integration
- Multi-cluster job submission
- Real GPU availability with caching
- Background job status polling (APScheduler)
- Project-level configuration system (.mlops-config.yaml)
- Toast notifications for user feedback
- WandB URL extraction from logs

### Phase 2: Enhanced Features
- Full Hydra config parser with UI form generation
- Job cancellation from UI
- Log viewer in browser
- Job filtering and search

### Phase 3: Production Features
- Multi-user support with authentication
- Job history analytics and dashboards
- Email/Slack notifications
- Hyperparameter sweep support
- Database migrations (Alembic)
- Integration with other experiment trackers (MLflow, etc.)
