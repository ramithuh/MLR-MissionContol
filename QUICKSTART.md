# Quick Start Guide

Get MLOps Mission Control running in 5 minutes!

## 1. Install Dependencies

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### Frontend
```bash
cd frontend
npm install
```

## 2. Configure Your Cluster

Edit `config/clusters.yaml`:

```yaml
clusters:
  - name: "my-cluster"
    host: "username@login.cluster.edu"
    ssh_key_path: "~/.ssh/cluster_key"
    workspace: "/scratch/username/mlops-jobs"
```

**Test your SSH connection:**
```bash
ssh -i ~/.ssh/cluster_key username@login.cluster.edu
```

## 3. Start the Application

**Terminal 1 - Backend:**
```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

## 4. Use the Dashboard

1. Open http://localhost:5173
2. Click **"+ Add Project"**
3. Enter your ML project path (e.g., `/home/you/my-ml-project`)
4. Click **"Add"**
5. Click **"Launch Job"** on your project
6. Configure resources and submit!

## Example Workflow

```bash
# 1. Have an ML project with Hydra configs
cd ~/my-ml-project
git add . && git commit -m "Ready for experiment"
git push

# 2. Add project in dashboard
# Enter: /home/you/my-ml-project

# 3. Launch job
# Select cluster → Configure GPUs → Submit

# 4. Monitor on dashboard
# Status updates automatically
# Click WandB link when available
```

## File Structure You Created

```
MLR-MissionContol/
├── backend/              # FastAPI server
│   ├── app/
│   │   ├── api/         # REST endpoints
│   │   ├── core/        # Config, DB, SSH
│   │   ├── models/      # SQLAlchemy models
│   │   ├── services/    # Business logic
│   │   └── main.py      # App entry point
│   └── requirements.txt
├── frontend/            # React app
│   ├── src/
│   │   ├── pages/       # Dashboard, LaunchJob, etc.
│   │   ├── services/    # API client
│   │   └── App.jsx
│   └── package.json
├── config/
│   ├── clusters.yaml    # Your clusters
│   └── slurm_template.j2
├── scripts/
│   └── check_gpu_availability.py
├── README.md
├── SETUP.md            # Detailed setup
├── ARCHITECTURE.md     # System design
└── QUICKSTART.md       # This file
```

## What Works Now (Skeleton)

- ✅ Project management (add/list/view)
- ✅ Git metadata extraction
- ✅ Cluster configuration
- ✅ Database models
- ✅ API endpoints (with TODOs)
- ✅ Frontend UI (placeholder data)
- ✅ SSH connection framework

## What to Implement Next (Phase 1 - MVP)

1. **Test SSH Connection**: Implement `clusters.py` endpoint to actually connect
2. **Submit a Job**: Complete the job submission logic in `jobs.py`
3. **Generate SLURM Script**: Wire up `slurm_generator.py`
4. **Upload & Execute**: Use `ssh_manager.py` to upload script and run `sbatch`

## Quick Test

Test the backend API (with backend running):

```bash
# Health check
curl http://localhost:8000/

# List projects
curl http://localhost:8000/api/projects/

# List clusters
curl http://localhost:8000/api/clusters/

# API documentation
open http://localhost:8000/docs
```

## Common Issues

**Database not found?**
- It's created automatically on first run
- Check `backend/mlops_mission_control.db`

**SSH connection fails?**
- Verify key permissions: `chmod 600 ~/.ssh/cluster_key`
- Test manually: `ssh -i ~/.ssh/cluster_key user@host`

**Frontend can't reach backend?**
- Check backend is running on port 8000
- Check CORS settings in `backend/app/main.py`

**Module not found errors?**
- Activate venv: `source venv/bin/activate`
- Reinstall: `pip install -r requirements.txt`

## Next Steps

See the development roadmap in `README.md`:
- **Phase 1**: Get end-to-end job submission working
- **Phase 2**: Add Hydra config parsing and dynamic forms
- **Phase 3**: Implement monitoring and WandB integration

Happy experimenting! 🚀
