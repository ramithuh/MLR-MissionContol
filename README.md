# MLOps Mission Control Dashboard

A centralized web dashboard for submitting and monitoring Hydra-configured ML jobs across multiple SLURM clusters.

## Vision

**Eliminate manual SSH logins and SLURM script writing.**

Workflow: **Push Code → Configure Visually → Launch → Monitor**

## Architecture

```
┌─────────────┐
│   Browser   │
│  (React UI) │
└──────┬──────┘
       │ HTTP/REST
       │
┌──────▼──────────────────────┐
│  Backend (FastAPI)          │
│  - Project Manager          │
│  - Auto Job Polling         │
│  - SLURM Script Generator   │
│  - Job Monitor              │
└──────┬──────────────────────┘
       │ SSH (Paramiko)
       │
┌──────▼──────────────────────┐
│  Remote SLURM Clusters      │
│  - Job Submission           │
│  - GPU Availability Check   │
│  - Log Retrieval            │
└─────────────────────────────┘
```

## Features

### MVP Features (Implemented)
- **Project Management**: Track local ML repos and their remote origins
- **Automatic Job Polling**: Background status updates every 30s (stops when jobs complete)
- **Project-Level Configuration**: Per-project conda environments and training scripts via `.mlops-config.yaml`
- **Real-time GPU Availability**: Live GPU availability by type (A6000, A100, etc.) with 60s caching
- **Multi-cluster Support**: Manage jobs across multiple SLURM clusters
- **Multi-node Support**: Configure distributed PyTorch Lightning jobs
- **WandB Integration**: Auto-detect and link to WandB runs from logs
- **Job History**: Track all experiments per project with descriptions
- **Toast Notifications**: Visual feedback for all operations (success/error)

### Future Enhancements
- **Hydra Config UI**: Auto-generated forms from Hydra YAML configs (Phase 2)
- **Job Cancellation**: Cancel running jobs from UI
- **Log Viewer UI**: View job logs directly in browser
- **Job Analytics**: Success rates, resource usage graphs
- **Multi-user Support**: Authentication and authorization

## Tech Stack

### Backend
- **FastAPI** - Modern async web framework
- **SQLAlchemy** - ORM with SQLite
- **APScheduler** - Background job polling
- **Paramiko** - SSH/SFTP operations
- **GitPython** - Git metadata extraction
- **PyYAML** - Config file parsing
- **Jinja2** - SLURM script templating

### Frontend
- **React 18** - UI framework
- **Vite** - Build tool
- **TailwindCSS** - Styling
- **React Router** - Navigation
- **Axios** - HTTP client
- **react-hot-toast** - Toast notifications

## Project Structure

```
MLR-MissionContol/
├── backend/
│   ├── app/
│   │   ├── api/              # FastAPI routes
│   │   │   ├── projects.py   # Project management
│   │   │   ├── jobs.py       # Job submission & monitoring
│   │   │   └── clusters.py   # Cluster info & GPU availability
│   │   ├── core/             # Core config and utilities
│   │   │   ├── config.py
│   │   │   ├── database.py
│   │   │   └── ssh_manager.py
│   │   ├── services/         # Business logic
│   │   │   ├── git_service.py
│   │   │   ├── project_config.py   # .mlops-config.yaml reader
│   │   │   ├── slurm_generator.py
│   │   │   ├── job_monitor.py
│   │   │   └── job_poller.py       # Background status polling
│   │   ├── models/           # SQLAlchemy models
│   │   │   ├── project.py
│   │   │   └── job.py
│   │   └── main.py           # FastAPI app entry
│   └── environment.yml       # Conda environment
├── frontend/
│   ├── src/
│   │   ├── pages/            # Page components
│   │   │   ├── Dashboard.jsx
│   │   │   ├── ProjectView.jsx
│   │   │   └── LaunchJob.jsx
│   │   ├── services/         # API client
│   │   │   └── api.js
│   │   └── App.jsx
│   ├── package.json
│   └── vite.config.js
├── config/
│   ├── clusters.yaml.example # Cluster config template
│   └── slurm_template.j2     # SLURM script template
├── docs/
│   ├── PROJECT_CONFIG.md     # Project config guide
│   └── MVP_REVIEW.md         # Architecture review
└── scripts/
    └── check_gpu_availability.py  # GPU checker for clusters
```

## Quick Start

See [QUICKSTART.md](QUICKSTART.md) for detailed setup instructions.

### Prerequisites
- Python 3.10+ (conda recommended)
- Node.js 18+
- SSH access to SLURM clusters with key-based auth

### 1. Backend Setup (Conda)
```bash
cd backend
conda env create -f environment.yml
conda activate mlops-control
python -m uvicorn app.main:app --reload --port 8028
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

### 3. Configure Your Clusters

Copy the example config:
```bash
cp config/clusters.yaml.example config/clusters.yaml
```

Edit `config/clusters.yaml`:
```yaml
clusters:
  - name: "my-cluster"
    host: "username@login.cluster.edu"
    ssh_key_path: "~/.ssh/id_ed25519"
    workspace: "/home/username/mlops-jobs"
    allowed_partitions:
      - "gpu"
    allowed_gpu_types:
      - "A6000"
      - "A100_40GB"
```

### 4. Deploy GPU Checker Script

Copy `scripts/check_gpu_availability.py` to your cluster's home directory:
```bash
scp scripts/check_gpu_availability.py username@login.cluster.edu:~/
ssh username@login.cluster.edu "pip install --user tabulate"
```

### 5. Configure Your ML Project

In your ML project root, create `.mlops-config.yaml`:
```yaml
conda_env: "pytorch"        # Conda env name on cluster
train_script: "train.py"    # Training script path
```

See [docs/PROJECT_CONFIG.md](docs/PROJECT_CONFIG.md) for more options.

## Documentation

- **[QUICKSTART.md](QUICKSTART.md)** - Detailed setup guide
- **[SETUP.md](SETUP.md)** - Installation and configuration
- **[docs/PROJECT_CONFIG.md](docs/PROJECT_CONFIG.md)** - Project configuration guide
- **[docs/MVP_REVIEW.md](docs/MVP_REVIEW.md)** - Architecture analysis and optimization review
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - Technical architecture details

## Development Status

### Phase 1: MVP - COMPLETE
- [x] Project management (add/list/sync)
- [x] Git metadata extraction
- [x] Job submission with resource configuration
- [x] Automatic job status polling
- [x] Multi-cluster support
- [x] Real-time GPU availability
- [x] Project-level configuration system
- [x] Toast notifications for UX feedback

### Phase 2: Enhanced Features
- [ ] Hydra config parser with dynamic UI
- [ ] Job cancellation from UI
- [ ] Log viewer in browser
- [ ] Job filtering and search
- [ ] WandB metrics display

### Phase 3: Production Features
- [ ] Multi-user authentication
- [ ] Job analytics dashboard
- [ ] Email notifications
- [ ] Hyperparameter sweep support
- [ ] Database migrations (Alembic)

## Usage Workflow

1. **Add Project**: Point to your local ML project directory
2. **Sync**: Pull latest git metadata (commit SHA, branch)
3. **Launch Job**: Select cluster, GPU type, resources
4. **Monitor**: Auto-updates every 30s, view logs, click WandB links
5. **Iterate**: Submit variations, track experiments

## Security

- SSH keys never committed to Git (`.gitignore` configured)
- `config/clusters.yaml` excluded from version control
- Key-based authentication only (no passwords)
- Input validation with Pydantic
- SQLAlchemy ORM prevents SQL injection

## Performance

- **Job Polling**: Only polls active jobs, stops when complete
- **GPU Caching**: 60-second cache reduces cluster load
- **Efficient SSH**: Groups jobs by cluster (1 connection per cluster)
- **Minimal Impact**: Standard SLURM queries, minimal cluster overhead

See [docs/MVP_REVIEW.md](docs/MVP_REVIEW.md) for detailed performance analysis.

## Contributing

This is currently a personal project. Feel free to fork and adapt for your needs!

## License

MIT

## Acknowledgments

Built with Claude Code for streamlining ML experiment workflows across SLURM clusters.
