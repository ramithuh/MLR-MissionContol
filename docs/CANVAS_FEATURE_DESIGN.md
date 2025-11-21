# Canvas Feature Design Document

**Date:** 2025-11-21
**Status:** Proposed

## 1. Overview
The "Canvas" feature allows users to visualize the lineage of their jobs as a tree structure. This enables users to understand the relationship between experiments (e.g., "Job B was created by branching off Job A") and facilitates hyperparameter tuning by allowing users to easily "branch" from an existing job configuration.

## 2. User Experience

### 2.1 Visualization
- Users navigate to a new "Canvas" tab in the application.
- They see a 2D canvas (using `React Flow`) displaying nodes representing jobs.
- Nodes are connected by edges representing the parent-child relationship.
- **Nodes:**
    - Display Job Name, ID (short), Status (color-coded), and basic metrics (e.g., runtime).
    - Status colors:
        - Green: Completed
        - Blue: Running
        - Yellow: Pending
        - Red: Failed
- **Interactions:**
    - **Pan/Zoom:** Users can move around the canvas and zoom in/out.
    - **Click:** Clicking a node shows detailed job info (sidebar or modal).
    - **Branch:** A "Branch" button on the node allows creating a new job based on this one.

### 2.2 Branching Workflow
1. User clicks "Branch" on "Job A".
2. The "New Job" modal opens.
3. The configuration (Hydra overrides, resources, etc.) is pre-filled with "Job A's" settings.
4. User modifies a parameter (e.g., `lr=0.01` -> `lr=0.001`).
5. User submits the job.
6. A new "Job B" appears on the canvas, connected to "Job A" with an arrow.

## 3. Technical Architecture

### 3.1 Backend (FastAPI + SQLAlchemy)

**Database Schema Changes:**
We need to track the lineage. We will add a self-referential foreign key to the `jobs` table.

```python
class Job(Base):
    # ... existing columns ...
    parent_job_id = Column(String, ForeignKey("jobs.id"), nullable=True)
    
    # Relationships
    children = relationship("Job", backref=backref("parent", remote_side=[id]))
```

**API Updates:**
- `POST /api/jobs/`: Accept `parent_job_id` in the request body.
- `GET /api/jobs/`: Return `parent_job_id` in the response so the frontend can construct the graph.

### 3.2 Frontend (React + Vite)

**Libraries:**
- **React Flow:** For rendering the node graph. It handles the complex logic of positioning, dragging, and connecting nodes.
- **Dagre (Optional):** For automatic layout (auto-arranging the tree so it looks nice without manual dragging).

**Components:**
- `CanvasView.jsx`: Main container for the React Flow instance.
- `JobNode.jsx`: Custom node component to display job details and the "Branch" button.

## 4. Implementation Steps

1.  **Database Migration:**
    - Add `parent_job_id` column to `jobs` table.
    - *Note:* Since Alembic is not set up, we may need to handle this via raw SQL or DB recreation if data persistence isn't critical.

2.  **Backend Logic:**
    - Update `Job` model.
    - Update `JobCreate` and `JobResponse` schemas.
    - Update submission logic to handle `parent_job_id`.

3.  **Frontend Setup:**
    - Install `reactflow`.
    - Create `CanvasView` component.
    - Integrate with `JobSubmissionModal` to support "pre-filling" from a parent job.

4.  **Testing:**
    - Verify lineage is saved correctly.
    - Verify the graph renders correctly.
    - Verify branching preserves config.
