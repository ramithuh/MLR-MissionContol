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
│  - Hydra Config Parser      │
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

- **Project Management**: Track local ML repos and their remote origins
- **Dynamic Resource Selection**: Real-time GPU availability by type (A6000, A100, etc.)
- **Hydra Config UI**: Auto-generated forms from Hydra YAML configs
- **Multi-node Support**: Configure distributed PyTorch Lightning jobs
- **WandB Integration**: Auto-detect and link to WandB runs
- **Job History**: Track all experiments per project with descriptions

## Tech Stack

### Backend
- **FastAPI** - Modern async web framework
- **SQLAlchemy** - ORM with SQLite
- **Paramiko** - SSH/SFTP operations
- **GitPython** - Git metadata extraction
- **PyYAML** - Hydra config parsing
- **Jinja2** - SLURM script templating

### Frontend
- **React 18** - UI framework
- **Vite** - Build tool
- **TailwindCSS** - Styling
- **Axios** - HTTP client

## Project Structure

```
MLR-MissionContol/
├── backend/
│   ├── app/
│   │   ├── api/              # FastAPI routes
│   │   │   ├── projects.py
│   │   │   ├── jobs.py
│   │   │   └── clusters.py
│   │   ├── core/             # Core config and utilities
│   │   │   ├── config.py
│   │   │   ├── database.py
│   │   │   └── ssh_manager.py
│   │   ├── services/         # Business logic
│   │   │   ├── git_service.py
│   │   │   ├── hydra_parser.py
│   │   │   ├── slurm_generator.py
│   │   │   └── job_monitor.py
│   │   ├── models/           # SQLAlchemy models
│   │   │   ├── project.py
│   │   │   └── job.py
│   │   └── main.py           # FastAPI app entry
│   ├── tests/
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/       # React components
│   │   ├── pages/            # Page components
│   │   │   ├── Dashboard.jsx
│   │   │   ├── ProjectView.jsx
│   │   │   └── LaunchJob.jsx
│   │   ├── services/         # API client
│   │   └── App.jsx
│   ├── package.json
│   └── vite.config.js
├── config/
│   ├── clusters.yaml         # Cluster definitions
│   └── slurm_template.j2     # SLURM script template
└── scripts/
    └── check_gpu_availability.py  # Your existing GPU checker
```

## Development Roadmap

### Phase 1: MVP (Core Loop)
- [x] Project structure setup
- [ ] Backend: SSH connection to one cluster
- [ ] Backend: Simple SLURM job submission
- [ ] Frontend: Basic UI with submit button
- [ ] End-to-end: Submit one hardcoded job

### Phase 2: Core Features
- [ ] Project management (add/list local repos)
- [ ] Git metadata extraction
- [ ] Hydra config parser
- [ ] Dynamic UI form generation
- [ ] Multi-cluster support
- [ ] GPU availability integration
- [ ] Multi-node configuration

### Phase 3: Monitoring & Polish
- [ ] Job status polling
- [ ] Job history per project
- [ ] WandB URL detection
- [ ] Error handling and validation
- [ ] UI polish and UX refinement

## Getting Started

### Prerequisites
- Python 3.10+
- Node.js 18+
- SSH access to SLURM clusters with key-based auth

### Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

### Configuration

1. Create `config/clusters.yaml`:
```yaml
clusters:
  - name: "dgx-cluster-a"
    host: "user@login.cluster-a.edu"
    ssh_key_path: "~/.ssh/cluster_a_key"
    workspace: "/scratch/username/mlops-jobs"
```

2. Ensure SSH keys are properly configured with correct permissions:
```bash
chmod 600 ~/.ssh/cluster_a_key
```

## License

MIT
