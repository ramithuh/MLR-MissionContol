# Project Configuration Guide

## Overview

Each ML project can have a `.mlops-config.yaml` file in its root directory to specify:
- Conda environment name
- Training script path
- Other project-specific settings

## File Location

```
your-ml-project/
├── .mlops-config.yaml    ← Add this file
├── train.py
├── conf/
└── ...
```

## Example `.mlops-config.yaml`

```yaml
# Conda environment to activate on cluster
# This environment must already exist on the target cluster!
conda_env: "pytorch"

# Training script to execute
# Path relative to project root
train_script: "train.py"

# Optional: Default Hydra overrides
# default_overrides:
#   batch_size: 32
#   lr: 0.001
```

## Minimal Example

```yaml
conda_env: "pytorch"
train_script: "train.py"
```

## If File Doesn't Exist

Defaults will be used:
- No conda environment activation (uses system python3)
- Looks for `train.py` in project root

## Multi-Environment Projects

If you have different environments for different experiments:

```yaml
conda_env: "pytorch-latest"  # For most experiments
train_script: "train.py"

# You can create multiple config files and switch them:
# .mlops-config-tf.yaml for TensorFlow experiments
# .mlops-config-jax.yaml for JAX experiments
```

## Prerequisites

Before submitting jobs, ensure your conda environment exists on the cluster:

```bash
ssh cluster
conda create -n pytorch python=3.10 pytorch torchvision pytorch-cuda=11.8 -c pytorch -c nvidia
conda create -n tensorflow python=3.10 tensorflow-gpu
```
