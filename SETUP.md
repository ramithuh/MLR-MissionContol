# Setup Guide

## Prerequisites

- Python 3.10 or higher
- Node.js 18 or higher
- SSH access to SLURM clusters with key-based authentication
- Git

## Initial Setup

### 1. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# The database will be created automatically on first run
```

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# This will install React, Vite, TailwindCSS, and other dependencies
```

### 3. Configuration

#### Configure Clusters

Edit `config/clusters.yaml`:

```yaml
clusters:
  - name: "your-cluster-name"
    host: "username@login.cluster.edu"
    ssh_key_path: "~/.ssh/your_cluster_key"
    workspace: "/scratch/username/mlops-jobs"
```

#### Setup SSH Keys

Ensure your SSH keys are properly configured:

```bash
# Generate key if needed
ssh-keygen -t rsa -b 4096 -f ~/.ssh/cluster_key

# Copy public key to cluster
ssh-copy-id -i ~/.ssh/cluster_key.pub username@login.cluster.edu

# Set proper permissions
chmod 600 ~/.ssh/cluster_key
```

#### Deploy GPU Checker Script

Copy the GPU availability script to your cluster:

```bash
scp scripts/check_gpu_availability.py username@login.cluster.edu:~/
ssh username@login.cluster.edu "chmod +x ~/check_gpu_availability.py"
```

### 4. Running the Application

#### Start Backend

```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload

# Backend will run on http://localhost:8000
# API docs available at http://localhost:8000/docs
```

#### Start Frontend

Open a new terminal:

```bash
cd frontend
npm run dev

# Frontend will run on http://localhost:5173
```

### 5. First Steps

1. Open http://localhost:5173 in your browser
2. Click "Add Project" and enter the path to your ML project
3. Select a cluster and configure resources
4. Launch your first job!

## Troubleshooting

### SSH Connection Issues

Test SSH connection:
```bash
ssh -i ~/.ssh/cluster_key username@login.cluster.edu
```

If this fails:
- Check SSH key permissions (`chmod 600 ~/.ssh/cluster_key`)
- Verify the key is added to `~/.ssh/authorized_keys` on the cluster
- Check cluster firewall settings

### Database Issues

If you need to reset the database:
```bash
cd backend
rm mlops_mission_control.db
# Restart the backend - it will recreate the database
```

### Port Already in Use

If port 8000 or 5173 is already in use:

Backend:
```bash
uvicorn app.main:app --reload --port 8001
```

Frontend: Edit `vite.config.js` and change the port.

## Next Steps

After setting up the skeleton:

1. **Test SSH Connection**: Use the backend to test connecting to your cluster
2. **Implement GPU Checker**: Customize `scripts/check_gpu_availability.py` for your cluster
3. **Add Hydra Parser**: Implement full Hydra config parsing for your project structure
4. **Add Job Monitoring**: Implement background tasks to poll job status

## Development Workflow

1. Make changes to backend or frontend
2. Both have hot-reload enabled, so changes appear automatically
3. Check backend logs in the terminal running uvicorn
4. Check frontend console in browser DevTools
5. Test API endpoints at http://localhost:8000/docs

## Production Deployment

For production deployment:

1. Build frontend: `cd frontend && npm run build`
2. Serve frontend build with nginx or similar
3. Run backend with gunicorn: `gunicorn -w 4 -k uvicorn.workers.UvicornWorker app.main:app`
4. Use systemd or similar to manage backend process
5. Setup reverse proxy (nginx) to route requests
