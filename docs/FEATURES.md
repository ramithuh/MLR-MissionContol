# MLOps Mission Control - Feature Guide

Comprehensive guide to all features in MLOps Mission Control.

## Table of Contents
1. [Job Submission & Configuration](#job-submission--configuration)
2. [Hydra Integration](#hydra-integration)
3. [Job Management](#job-management)
4. [Monitoring & Logs](#monitoring--logs)
5. [Multi-Cluster Support](#multi-cluster-support)

---

## Job Submission & Configuration

### Resource Configuration

Configure compute resources for your SLURM jobs:

#### GPU Configuration
- **GPU Type Selection**: Choose from available GPUs (A6000, A100, H100, etc.)
- **Real-time Availability**: See live GPU availability and nodes with free GPUs
- **Multi-GPU Support**: Request multiple GPUs per node (1-8)
- **Multi-node Support**: Distribute training across multiple nodes

#### CPU & Memory Configuration
- **CPUs per Task**: Specify CPU cores per task (default: 8)
  - Useful for data loading pipelines
  - Adjust based on I/O requirements
- **Memory Allocation**: Set memory per job (e.g., 64G, 128G, 256G)
  - Prevents OOM errors
  - Optimize for dataset size

#### Time Limits
Flexible time limit formats:
- `HH:MM:SS` - Hours, minutes, seconds (e.g., `24:00:00` = 24 hours)
- `DD-HH:MM:SS` - Days, hours, minutes, seconds (e.g., `7-00:00:00` = 7 days)

**Example Configuration:**
```yaml
Cluster: babel
Partition: general
GPU Type: A6000
Num Nodes: 1
GPUs per Node: 2
CPUs per Task: 16
Memory: 128G
Time Limit: 48:00:00
```

---

## Hydra Integration

MLOps Mission Control automatically parses your Hydra configuration files and generates a dynamic UI.

### Config Name Override

Override the default `config.yaml` with alternate configuration files:

**Use Case:** You have multiple model architectures, each with its own config:
```
conf/
├── config.yaml                  # Default
├── config_qwen2.5_0.5b.yaml    # Small model
├── config_qwen2.5_1.5b.yaml    # Medium model
└── config_qwen2.5_7b.yaml      # Large model
```

**How it works:**
1. Dashboard detects all `config*.yaml` files in your `conf/` directory
2. Dropdown appears with available configs
3. Selecting a config triggers `--config-name` in your training command
4. Parameter groups update automatically based on selected config

**Generated Command:**
```bash
python3 train.py --config-name config_qwen2.5_1.5b data.batch_size=32
```

### Configuration Groups

Hydra configuration groups appear as dropdowns in the UI:

**Example `conf/config.yaml`:**
```yaml
defaults:
  - data: default
  - model: transformer
  - optimizer: adamw
```

**UI Behavior:**
- Groups appear as dropdown menus
- Options come from files in `conf/data/`, `conf/model/`, `conf/optimizer/`
- Only non-default selections are added as overrides
- Prevents redundant overrides

### Parameter Overrides

Dynamically generated form fields for your config parameters:

**Supported Types:**
- **Numeric**: Integer and float inputs
- **Boolean**: Checkboxes
- **String**: Text inputs
- **Enums**: Dropdowns for predefined choices

**Smart Features:**
- **Parameter Caching**: Previous values auto-populate on next submission
- **Initial Load Preservation**: Cached values survive config changes
- **Auto-population**: `experiment_suffix` can auto-fill from job description

**Example:**
```yaml
data:
  batch_size: 32        # Numeric input
  num_workers: 4        # Numeric input

model:
  hidden_size: 768      # Numeric input
  dropout: 0.1          # Float input

training:
  use_amp: true         # Checkbox
```

### Raw Hydra Overrides

For advanced Hydra features not covered by the UI:

**Supports:**
- `key=value` - Set parameter
- `+key=value` - Add new parameter
- `~key` - Delete parameter
- `group/option=value` - Config group selection
- `nested.key=value` - Nested config

**Example:**
```
plinder_path=/net/galaxy/data/plinder +partial_ckpt=wandb_symlinks/run123/checkpoints/batch_370000.ckpt model.train_t_dist=beta
```

**Merge Behavior:**
- Raw overrides are added **after** dropdown selections
- Same keys in raw overrides will **override** dropdown selections
- Use for one-off experiments or features not in UI

### Experiment Suffix Auto-population

When your Hydra config includes an `experiment_suffix` parameter (commonly used for WandB run naming), the dashboard can auto-populate it from your job description:

**How it works:**
1. Add description: "use eos as mask token, but try lower LR"
2. Dashboard detects `experiment_suffix` in config schema
3. Auto-fills: `experiment_suffix="use eos as mask token, but try lower LR"`
4. Visual indicator shows feature is active

**Generated Command:**
```bash
python3 train.py experiment_suffix="use eos as mask token, but try lower LR"
```

**Benefits:**
- Consistent naming between dashboard and WandB
- No need to type description twice
- Proper shell escaping for spaces and special characters

---

## Job Management

### Job Cloning

Duplicate job configurations for rapid experimentation:

**Use Case:** You ran an experiment and want to tweak one parameter

**How it works:**
1. Click the actions dropdown (⋮) next to any job
2. Select "Clone Run"
3. Navigate to launch page with all settings pre-populated
4. Visual banner shows:
   - Original job name
   - Original commit SHA (for reference)
   - Current commit SHA (that will be used)

**Smart Behavior:**
- Uses **current commit** by default (not original)
  - Rationale: You're usually iterating on latest code
  - Original commit shown for reference
- All fields pre-populated:
  - Resources (GPUs, CPUs, memory)
  - Cluster and partition
  - Hydra config name
  - All parameter overrides
  - Raw overrides

**Example Workflow:**
```
Original Job:
- Commit: abc1234
- Config: config_qwen2.5_1.5b
- Params: lr=1e-4, batch_size=32

Clone Run (current commit: def5678):
✓ Resources: Same as original
✓ Config: config_qwen2.5_1.5b
✓ Params: lr=1e-4, batch_size=32
→ Modify lr to 1e-5
→ Submit new job
```

### Job Archiving

Keep your workspace clean by archiving completed experiments:

**Features:**
- Archive button in job actions dropdown
- Toggle view between active and archived jobs
- Unarchive if you need to reference later
- Archived jobs excluded from default view

**Use Case:** After a paper submission, archive all related experiments to declutter your dashboard while preserving history.

### Actions Dropdown

Clean, organized UI for job actions:

**Available Actions:**
- **Clone Run** (green) - Duplicate configuration
- **View Script** (blue) - See generated SLURM script
- **View Logs** (purple) - Full job logs in browser
- **Archive** (yellow) - Archive completed job
- **Unarchive** (green) - Restore archived job

**Benefits:**
- Clean table layout (no button clutter)
- Contextual actions (only shows available options)
- Click outside to close

---

## Monitoring & Logs

### Automatic Job Polling

Background service checks job status every 30 seconds:

**Polling Behavior:**
- Only polls jobs in active states: `PENDING`, `RUNNING`, `CONFIGURING`
- Stops polling when jobs reach terminal states: `COMPLETED`, `FAILED`, `CANCELLED`
- Groups jobs by cluster (efficient SSH usage)
- Updates UI automatically

**Monitored Information:**
- SLURM job status
- WandB run URL (auto-extracted from logs)
- Job completion time
- Error messages (if any)

### Log Viewer

View full SLURM job logs directly in browser:

**Features:**
- Full log file retrieval (not just tail)
- Includes SLURM job headers:
  - Job ID, nodes, resources
  - Start time, environment info
- Monospace formatting for easy reading
- Refresh button to update logs
- Auto-scrollable for long outputs

**Access:** Click "View Logs" in job actions dropdown (only available after job starts)

**Example Log Content:**
```
=========================================
SLURM Job ID: 5809433
Running on: node042
Started at: Wed Nov 20 15:23:45 EST 2024
=========================================
Python: /home/user/miniconda3/envs/pytorch/bin/python3
Python version: Python 3.11.14
CUDA_VISIBLE_DEVICES: 0,1
=========================================

Executing: python3 train.py --config-name config_qwen2.5_1.5b ...

[Training logs follow...]
```

### WandB Integration

Automatic detection and linking to WandB runs:

**How it works:**
1. Your training script logs to WandB
2. WandB prints run URL to stdout
3. Job poller extracts URL from logs
4. Dashboard displays clickable links:
   - "View Run" - Main WandB page
   - "Logs" - WandB logs tab

**Requirements:**
- WandB URL must appear in job stdout
- Format: `wandb: ... View run at https://wandb.ai/...`

---

## Multi-Cluster Support

### Cluster Configuration

Define multiple SLURM clusters in `config/clusters.yaml`:

```yaml
clusters:
  - name: "babel"
    host: "user@login.babel.cs.cmu.edu"
    ssh_key_path: "~/.ssh/id_ed25519"
    workspace: "/home/user/mlops-jobs"
    allowed_partitions:
      - "general"
      - "preempt"
    allowed_gpu_types:
      - "A6000"
      - "A100_40GB"
```

### VPN Support

For clusters behind VPN (e.g., GlobalProtect):

```yaml
  - name: "csb"
    host: "user@cluster.csb.pitt.edu"
    ssh_key_path: "~/.ssh/id_ed25519"
    workspace: "/net/galaxy/home/user/mlops-jobs"
    requires_vpn: true
    vpn_protocol: "gp"
    vpn_portal: "https://portal-palo.pitt.edu"
    vpn_username: "user"
    vpn_gateway: "BYOD-GATEWAY-CL"
```

**Dashboard displays:**
- Connection status indicator
- VPN connection instructions
- Error messages if cluster unreachable

### SSH ControlMaster

For optimal performance, configure SSH ControlMaster (persistent connections):

See [SSH_CONTROLMASTER_SETUP.md](./SSH_CONTROLMASTER_SETUP.md) for setup instructions.

**Benefits:**
- Reuse SSH connections (no repeated authentication)
- Faster job submission and monitoring
- Reduced cluster login node load
- Connections persist for 6 hours

---

## Best Practices

### Job Naming
- Use descriptive names: `tinyzero_diffusion-{timestamp}`
- Add descriptions for every job
- Descriptions auto-populate `experiment_suffix` if configured

### Resource Optimization
- Monitor GPU availability before submission
- Use appropriate memory allocations (avoid over-requesting)
- Set realistic time limits (jobs killed if exceeded)

### Configuration Management
- Use `.mlops-config.yaml` for project-specific settings
- Leverage config name override for different model sizes
- Keep raw overrides for experimental features

### Experiment Tracking
- Use job archiving to organize completed experiments
- Clone jobs for systematic parameter sweeps
- Link WandB runs for metric visualization

---

## Troubleshooting

### Job Won't Submit
1. Check cluster connection status
2. Verify GPU availability
3. Check SSH keys and permissions
4. Review generated SLURM script (View Script button)

### Logs Not Appearing
- Job must start running first (PENDING jobs have no logs)
- Check log file path in SLURM script
- Verify workspace directory exists on cluster

### Config Not Parsing
- Ensure Hydra config syntax is valid
- Check `conf/` directory exists in project
- Verify `.mlops-config.yaml` points to correct training script

### Parameters Not Caching
- Clear browser cache and refresh
- Check job submission completed successfully
- Verify database has write permissions

---

For more information, see:
- [PROJECT_CONFIG.md](./PROJECT_CONFIG.md) - Project configuration guide
- [SSH_CONTROLMASTER_SETUP.md](./SSH_CONTROLMASTER_SETUP.md) - SSH optimization
- [MVP_REVIEW.md](./MVP_REVIEW.md) - Architecture and performance analysis
