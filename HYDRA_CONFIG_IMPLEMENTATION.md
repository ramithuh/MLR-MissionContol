# Hydra Config UI Implementation

## Summary

Implemented dynamic Hydra configuration form generation for the MLOps Mission Control dashboard.

## What Was Implemented

### Backend Changes

1. **Updated `HydraParser` service** (`backend/app/services/hydra_parser.py`):
   - Added support for both `conf/` and `configs/` directory names
   - Enhanced `build_ui_schema()` to extract configurable parameters from main config
   - Added parameter type inference for proper UI input generation
   - Extracts both config groups (model, data, training) and scalar parameters (epochs, batch_size, lr, etc.)

2. **Implemented API endpoint** (`backend/app/api/projects.py:110`):
   - `GET /api/projects/{project_id}/hydra-config`
   - Returns parsed Hydra config structure for UI generation
   - Gracefully handles projects without Hydra configs

### Frontend Changes

1. **Created `HydraConfigForm` component** (`frontend/src/components/HydraConfigForm.jsx`):
   - Dynamically generates form fields from parsed Hydra config
   - Supports config group selection (dropdowns)
   - Supports parameter overrides (number, text, checkbox inputs)
   - Shows active overrides summary
   - Allows resetting individual parameters to defaults

2. **Updated `LaunchJob` page** (`frontend/src/pages/LaunchJob.jsx`):
   - Integrated `HydraConfigForm` component
   - Passes `hydra_overrides` to job submission API
   - Replaced "Phase 2" placeholder with functional UI

## How It Works

### For Users:

1. Navigate to a project's "Launch Job" page
2. The Hydra config is automatically parsed and displayed
3. **Config Groups** (dropdowns): Select model architecture, dataset, training strategy, etc.
4. **Parameters** (inputs): Override specific values like epochs, batch_size, learning rate
5. Only modified values are sent as overrides (keeps command clean)
6. Submit job - overrides are passed as Hydra CLI arguments

### Generated Command Example:

If user selects:
- model: `diffusion`
- data: `shakespeare`
- training.epochs: `100`
- data.batch_size: `32`

Generated command:
```bash
python3 train.py model=diffusion data=shakespeare training.epochs=100 data.batch_size=32
```

## Tested With

- **Project**: `tinyzero_diffusion`
- **Config structure**: `configs/config.yaml` with nested groups
- **Extracted**: 5 config groups, 7 parameters

## Future Enhancements

- [ ] Support for list/dict parameter types
- [ ] Config validation (min/max values)
- [ ] Tooltips with parameter descriptions
- [ ] Save/load config presets
- [ ] Show available options from config group YAML files
- [ ] Advanced mode for free-form override input
