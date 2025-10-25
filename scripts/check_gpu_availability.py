#!/usr/bin/env python3
"""
GPU Availability Checker for SLURM Clusters

This script parses SLURM node and job data to report GPU availability.
It can output in human-readable table format or JSON for programmatic use.

Usage:
    # Human-readable table
    ./check_gpu_availability.py

    # JSON output for API consumption
    ./check_gpu_availability.py --json
"""

import subprocess
import re
import json
import argparse
from collections import defaultdict
from tabulate import tabulate
import textwrap

TYPE_ORDER = ["1080Ti", "A4500", "6000Ada", "A6000", "L40", "L40S", "A100_40GB", "A100_80GB", "H100", "gpu"]
WRAP_WIDTH = 55
EXCLUDE_STATES = {"DRAIN", "DRAINED", "DOWN"}

def parse_gres(gres: str) -> dict[str, int]:
    """Parse SLURM GRES string to extract GPU types and counts."""
    if not gres or gres == "N/A":
        return {}
    gpus = defaultdict(int)
    for match in re.finditer(r'(?:gres/gpu|gpu):?([A-Za-z0-9_]+)?[:=]?(\d+)?', gres):
        model, count = match.groups()
        gpus[model.lower() if model else 'gpu'] += int(count or 1)
    return dict(gpus)

def get_gpu_data():
    """
    Query SLURM for GPU availability data.

    Returns:
        tuple: (total_gpus, free_gpus, total_free, pending_gpus)
    """
    total_gpus = defaultdict(int)
    free_gpus = defaultdict(list)
    pending_gpus = defaultdict(int)

    # Parse node data
    try:
        nodes = subprocess.check_output("scontrol show node", shell=True, text=True).strip().split('\n\n')
    except subprocess.CalledProcessError:
        return {}, {}, 0, {}

    for node_block in nodes:
        node = re.search(r'NodeName=(\S+)', node_block)
        state = re.search(r'State=(\S+)', node_block)
        if not node or not state or EXCLUDE_STATES & set(state.group(1).split('+')):
            continue
        node_name = node.group(1)

        gres = parse_gres(re.search(r'Gres=(.*)', node_block).group(1)) if re.search(r'Gres=(.*)', node_block) else {}
        alloc = parse_gres(re.search(r'AllocTRES=(.*)', node_block).group(1)) if re.search(r'AllocTRES=(.*)', node_block) else {}

        for model, count in gres.items():
            total_gpus[model] += count
            free = count - alloc.get(model, 0)
            if free > 0:
                free_gpus[model].append(f"{node_name}:{free}")

    # Parse pending jobs
    try:
        jobs = subprocess.check_output('squeue --state=PD -a -o "%.18i %.2t %.25R %.20b" --noheader', shell=True, text=True).strip().splitlines()
        for job in jobs:
            parts = job.split(maxsplit=3)
            if len(parts) == 4 and parts[2].strip() in {"(Resources)", "(Priority)"}:
                pending_gpus.update({k: v + pending_gpus[k] for k, v in parse_gres(parts[3]).items()})
    except subprocess.CalledProcessError:
        pass

    total_free = sum(int(node.split(':')[1]) for nodes in free_gpus.values() for node in nodes)
    return total_gpus, free_gpus, total_free, pending_gpus

def print_table(total_gpus, free_gpus, total_free, pending_gpus):
    """Print GPU availability in human-readable table format."""
    table = []
    for model in TYPE_ORDER:
        if model.lower() in total_gpus or model.lower() in pending_gpus:
            total = total_gpus.get(model.lower(), 0)
            free = sum(int(n.split(':')[1]) for n in free_gpus.get(model.lower(), []))
            pending = pending_gpus.get(model.lower(), 0)
            nodes = " ".join(sorted(free_gpus.get(model.lower(), []))) or "None"
            wrapped_nodes = "\n".join(textwrap.wrap(nodes, width=WRAP_WIDTH))
            table.append([model, total, free, pending, wrapped_nodes])
    print(f"Total free GPUs: {total_free}")
    print(tabulate(table, headers=["Model", "Total", "Free", "Pending", "Nodes with Free GPUs"], tablefmt="grid"))

def print_json(total_gpus, free_gpus, total_free, pending_gpus):
    """Print GPU availability in JSON format for API consumption."""
    gpus = []
    for model in TYPE_ORDER:
        if model.lower() in total_gpus or model.lower() in pending_gpus:
            total = total_gpus.get(model.lower(), 0)
            free_count = sum(int(n.split(':')[1]) for n in free_gpus.get(model.lower(), []))
            pending = pending_gpus.get(model.lower(), 0)
            in_use = total - free_count

            gpus.append({
                "gpu_type": model,
                "total": total,
                "available": free_count,
                "in_use": in_use,
                "pending": pending,
                "nodes_with_free": free_gpus.get(model.lower(), [])
            })

    output = {
        "total_free_gpus": total_free,
        "gpus": gpus
    }
    print(json.dumps(output, indent=2))

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Check GPU availability on SLURM cluster")
    parser.add_argument("--json", action="store_true", help="Output in JSON format")
    args = parser.parse_args()

    total_gpus, free_gpus, total_free, pending_gpus = get_gpu_data()

    if args.json:
        print_json(total_gpus, free_gpus, total_free, pending_gpus)
    else:
        print_table(total_gpus, free_gpus, total_free, pending_gpus)
