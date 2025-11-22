from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
from apscheduler.schedulers.background import BackgroundScheduler

from app.core.config import settings
from app.core.database import init_db
from app.api import projects, jobs, clusters, wandb
from app.services.job_poller import poll_job_statuses

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Centralized dashboard for ML experiment submission and monitoring"
)

# Create background scheduler for job polling
scheduler = BackgroundScheduler()
scheduler.add_job(
    poll_job_statuses,
    'interval',
    seconds=settings.job_poll_interval,
    id='job_status_poller',
    name='Poll SLURM job statuses',
    replace_existing=True
)

# CORS middleware for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite dev server (local development)
        "https://mlr.ramith.io",  # Production frontend (Cloudflare Tunnel)
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    """Initialize database and start background tasks on startup."""
    logger.info("Starting MLOps Mission Control...")
    init_db()
    logger.info("Database initialized")

    # Start background job poller
    scheduler.start()
    logger.info(f"Job status poller started (polling every {settings.job_poll_interval}s)")


@app.on_event("shutdown")
async def shutdown_event():
    """Clean up on shutdown."""
    logger.info("Shutting down...")
    scheduler.shutdown()
    logger.info("Background scheduler stopped")


@app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "app": settings.app_name,
        "version": settings.app_version,
        "status": "running"
    }


# Include API routers
app.include_router(projects.router, prefix="/api/projects", tags=["projects"])
app.include_router(jobs.router, prefix="/api/jobs", tags=["jobs"])
app.include_router(wandb.router, prefix="/api/wandb", tags=["wandb"])
app.include_router(clusters.router, prefix="/api/clusters", tags=["clusters"])


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8028, reload=True)
