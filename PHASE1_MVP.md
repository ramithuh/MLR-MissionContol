# Phase 1 MVP - Testing Guide

## What We Built 🎉

Phase 1 MVP is complete! Here's what's now fully functional:

### Backend Features ✅
- **SSH Connection Management**: Secure connections to multiple clusters
- **SLURM Job Submission**: Full workflow from script generation to sbatch
- **GPU Availability Monitoring**: Real-time GPU status with your custom script
- **Partition Detection**: Auto-detect available SLURM partitions
- **Cluster Constraints**: Filter partitions/GPUs by what you have access to
- **Job Status Monitoring**: Query job status via squeue/sacct
- **Log Fetching**: Retrieve job logs and auto-detect WandB URLs
- **Dynamic Script Generation**: Jinja2 templates for SLURM scripts

### Frontend Features ✅
- **Project Management**: Add/view/sync local Git projects
- **Job Launcher**: Interactive form for resource configuration
- **GPU Availability Display**: See free GPUs, pending jobs, and which nodes
- **Job History**: Track all experiments per project
- **Dashboard**: Overview of all projects and recent jobs

## Prerequisites

Before testing, ensure:

1. **Backend setup**:
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

2. **Frontend setup**:
   ```bash
   cd frontend
   npm install
   ```

3. **Cluster configuration** (`config/clusters.yaml`):
   ```yaml
   clusters:
     - name: "my-cluster"
       host: "username@login.cluster.edu"
       ssh_key_path: "~/.ssh/cluster_key"
       workspace: "/scratch/username/mlops-jobs"
       allowed_partitions:  # Optional
         - "gpu"
       allowed_gpu_types:   # Optional
         - "A6000"
   ```

4. **GPU script deployed on cluster**:
   ```bash
   scp scripts/check_gpu_availability.py username@cluster:~/
   ssh username@cluster "chmod +x ~/check_gpu_availability.py && pip install tabulate"
   ```

5. **SSH key authentication working**:
   ```bash
   ssh -i ~/.ssh/cluster_key username@cluster
   # Should work without password prompt
   ```

## Testing Workflow

### Step 1: Start the Application

**Terminal 1 - Backend:**
```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload

# Expected output:
# INFO:     Uvicorn running on http://127.0.0.1:8028
# INFO:     Application startup complete.
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev

# Expected output:
# VITE v5.x.x  ready in xxx ms
# ➜  Local:   http://localhost:5173/
```

### Step 2: Test Backend API (Optional)

Open http://localhost:8028/docs for interactive API documentation.

**Test SSH connection:**
```bash
curl -X POST http://localhost:8028/api/clusters/my-cluster/test-connection
```

Expected:
```json
{
  "cluster": "my-cluster",
  "status": "Connected successfully",
  "reachable": true,
  "hostname": "login01.cluster.edu"
}
```

**Test GPU availability:**
```bash
curl http://localhost:8028/api/clusters/my-cluster/gpu-availability
```

Expected:
```json
{
  "total_free_gpus": 8,
  "gpus": [
    {
      "gpu_type": "A6000",
      "total": 16,
      "available": 8,
      "in_use": 8,
      "pending": 2,
      "nodes_with_free": ["node01:4", "node02:4"]
    }
  ]
}
```

**Test partitions:**
```bash
curl http://localhost:8028/api/clusters/my-cluster/partitions
```

Expected:
```json
["gpu", "cpu", "interactive"]
```

### Step 3: Test Frontend End-to-End

1. **Open Dashboard**: http://localhost:5173

2. **Add a Project**:
   - Click "+ Add Project"
   - Enter path to your local ML project (e.g., `/home/you/my-ml-project`)
   - Must be a Git repo with a remote configured
   - Click "Add"

   ✅ **Verify**: Project card appears with repo name, branch, and commit SHA

3. **Launch a Job**:
   - Click "Launch Job" on your project
   - Fill out the form:
     - **Job Name**: `test-run-1`
     - **Description**: `Testing Phase 1 MVP`
     - **Cluster**: Select your cluster
     - Wait ~2 seconds for GPU data to load
     - **Partition**: Select from dropdown
     - **GPU Type**: Select from dropdown (shows availability)
     - **Number of Nodes**: `1`
     - **GPUs per Node**: `1`
   - Click "Submit Job"

   ✅ **Verify**: Redirected to project view, job appears in history with status "SUBMITTING"

4. **Check Job on Cluster**:
   ```bash
   ssh username@cluster
   squeue -u username  # Should see your job

   # Check generated script
   cat /scratch/username/mlops-jobs/scripts/test-run-1_*.sh
   ```

   ✅ **Verify**: Job is in queue, script looks correct

5. **Monitor Job Status**:
   - On project view, refresh page
   - Status should change: SUBMITTING → PENDING → RUNNING → COMPLETED

   ✅ **Verify**: Status updates correctly

6. **View Logs** (once job starts):
   - Click on job row (when implemented) or use API:
   ```bash
   # Get job ID from dashboard, then:
   curl http://localhost:8028/api/jobs/{job_id}/logs
   ```

   ✅ **Verify**: Logs appear, WandB URL detected if present

## What Gets Created on Cluster

When you submit a job, this structure is created:

```
/scratch/username/mlops-jobs/
├── scripts/
│   └── test-run-1_{uuid}.sh       # Generated SLURM script
├── logs/
│   └── test-run-1-{slurm_id}.out  # Job output logs
└── test-run-1/                     # Cloned repository
    ├── .git/
    ├── train.py
    └── ... (your code at specified commit)
```

## Sample Generated SLURM Script

```bash
#!/bin/bash
#SBATCH --job-name=test-run-1
#SBATCH --partition=gpu
#SBATCH --nodes=1
#SBATCH --ntasks-per-node=1
#SBATCH --gres=gpu:A6000:1
#SBATCH --time=24:00:00
#SBATCH --output=/scratch/username/mlops-jobs/logs/test-run-1-%j.out

echo "========================================="
echo "SLURM Job ID: $SLURM_JOB_ID"
echo "Running on: $(hostname)"
echo "Started at: $(date)"
echo "========================================="

cd /scratch/username/mlops-jobs || exit 1

REPO_DIR="/scratch/username/mlops-jobs/test-run-1"
if [ ! -d "$REPO_DIR" ]; then
    echo "Cloning repository..."
    git clone git@github.com:you/repo.git "$REPO_DIR"
else
    echo "Repository exists, updating..."
    cd "$REPO_DIR" && git fetch
fi

cd "$REPO_DIR" || exit 1

echo "Checking out commit: abc123..."
git checkout abc123

echo "Executing: python train.py"
python train.py

echo "Finished at: $(date)"
```

## Troubleshooting

### "Project has no remote repository URL"
- Make sure your local project has a Git remote:
  ```bash
  cd /path/to/your/project
  git remote -v
  ```
- If not, add one:
  ```bash
  git remote add origin git@github.com:you/repo.git
  ```

### SSH Connection Failed
- Test SSH manually: `ssh -i ~/.ssh/cluster_key username@cluster`
- Check key permissions: `chmod 600 ~/.ssh/cluster_key`
- Verify key is in cluster's `~/.ssh/authorized_keys`

### GPU Script Not Found
- Deploy script: `scp scripts/check_gpu_availability.py username@cluster:~/`
- Test manually: `ssh username@cluster "python3 ~/check_gpu_availability.py --json"`

### Job Stays in SUBMITTING
- Check backend logs for errors
- Verify workspace directory exists on cluster:
  ```bash
  ssh username@cluster "mkdir -p /scratch/username/mlops-jobs/scripts"
  ```

### No GPUs Shown
- Make sure `allowed_gpu_types` in config matches actual GPU types
- Test script manually on cluster
- Check if script has required permissions

## Database

Jobs are stored in: `backend/mlops_mission_control.db`

View job records:
```bash
cd backend
sqlite3 mlops_mission_control.db
> SELECT name, cluster, slurm_job_id, slurm_status FROM jobs;
```

Reset database (if needed):
```bash
rm backend/mlops_mission_control.db
# Restart backend - it will recreate the DB
```

## Next Steps (Phase 2)

After verifying Phase 1 works:
- [ ] Implement Hydra config parsing
- [ ] Dynamic form generation for Hydra overrides
- [ ] Background job status polling
- [ ] Configurable training script path
- [ ] Job cancellation
- [ ] Better error messages in UI

## Success Criteria ✅

Phase 1 MVP is successful if you can:
1. ✅ Add a local project to the dashboard
2. ✅ See real GPU availability from your cluster
3. ✅ Submit a job via the UI
4. ✅ See the job appear in SLURM queue on cluster
5. ✅ Monitor job status through the dashboard
6. ✅ Access job logs

**Congratulations! You have a working MLOps Mission Control!** 🚀
