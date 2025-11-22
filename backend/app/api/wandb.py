from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import wandb
import pandas as pd
import os
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

# Ensure WANDB_API_KEY is set in environment
if not os.getenv("WANDB_API_KEY"):
    logger.warning("WANDB_API_KEY not set. WandB features will not work.")

class MetricRequest(BaseModel):
    entity: str
    project: str
    run_ids: List[str]

class HistoryRequest(BaseModel):
    entity: str
    project: str
    run_ids: List[str]
    metric_keys: List[str]
    max_steps: Optional[int] = 500

@router.post("/metrics")
async def get_available_metrics(request: MetricRequest):
    """
    Fetch all available metrics for the given runs.
    Returns a list of common metrics found in these runs.
    """
    try:
        api = wandb.Api()
        metrics = set()
        
        for run_id in request.run_ids:
            try:
                run = api.run(f"{request.entity}/{request.project}/{run_id}")
                # Use summary for fast metric discovery
                metrics.update(run.summary.keys())
            except Exception as e:
                logger.error(f"Error fetching metrics for run {run_id}: {e}")
                continue
                
        # Filter out internal wandb keys (start with _) except _step, _runtime, _timestamp
        filtered_metrics = [
            m for m in metrics 
            if not m.startswith("_") or m in ["_step", "_runtime", "_timestamp"]
        ]
        
        return {"metrics": sorted(filtered_metrics)}
        
    except Exception as e:
        logger.error(f"WandB API Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/history")
async def get_run_history(request: HistoryRequest):
    """
    Fetch history data for specific runs and metrics.
    Returns data formatted for Plotly.
    """
    try:
        api = wandb.Api()
        plot_data = []
        
        for run_id in request.run_ids:
            try:
                run = api.run(f"{request.entity}/{request.project}/{run_id}")
                
                # Always fetch _step for x-axis
                keys_to_fetch = ["_step"] + request.metric_keys
                
                # Fetch history
                history = run.scan_history(keys=keys_to_fetch)
                
                # Convert to list of dicts
                data = [row for row in history]
                
                if not data:
                    continue
                    
                df = pd.DataFrame(data)
                
                # Filter by max_steps if needed
                if request.max_steps and "_step" in df.columns:
                    df = df[df["_step"] <= request.max_steps]
                
                # Sort by step
                if "_step" in df.columns:
                    df = df.sort_values("_step")
                
                # Prepare traces for each metric
                for metric in request.metric_keys:
                    if metric in df.columns:
                        plot_data.append({
                            "name": f"{run.name} - {metric}",
                            "x": df["_step"].tolist() if "_step" in df.columns else df.index.tolist(),
                            "y": df[metric].tolist(),
                            "type": "scatter",
                            "mode": "lines",
                            "run_id": run_id
                        })
                        
            except Exception as e:
                logger.error(f"Error fetching history for run {run_id}: {e}")
                continue
                
        return {"data": plot_data}
        
    except Exception as e:
        logger.error(f"WandB API Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
