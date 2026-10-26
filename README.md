![CI](https://github.com/aizazazam/Geovista/actions/workflows/ci.yml/badge.svg)

# Geovista

Web app that scores business locations on a 250 m grid over Gulshan-e-Iqbal, Karachi (3528 cells), using OpenStreetMap data (828 competitors, 5713 POIs).

University Complex Engineering Problem (CEP), FAST-NUCES Karachi, course CS2021 OODS.

## Who built what

| Part | Owner |
|---|---|
| GIS pipeline: OpenStreetMap data, 250 m grid, density features, v0 scoring, sensitivity and Pareto analysis, v2 scoring | Abdullah |
| Backend (FastAPI), PostGIS database, frontend (React + Leaflet), Docker, deployment, MLOps | Aizaz |

Note: the roles were swapped after the proposal. Early commits (Docker, README, .gitignore) carry the "[Abdullah]" prefix by mistake. From now on commits use "[Aizaz]". The git history was not rewritten.

Both of us share one laptop and one GitHub account (approved by the teacher). Commits are prefixed with the author name, e.g. `[Abdullah]`.

## Scoring

- **v0:** 0.6 * POI density + 0.4 * (1 - competitor density), normalised 0-100. Unstable: POIs and competitors correlate at 0.93, so the top-20 cells change completely when weights change.
- **v2:** 50% demand (log of non-competitor POIs) + 50% (1 - saturation), where saturation = competitors / (non-competitor POIs + 1). Only cells with at least 5 non-competitor POIs are scored (1268 cells). Input correlation is 0.16 and the top-20 overlap across weights is 12-20 of 20.

This is decision support, not a guarantee of success. Scores are not yet validated against real business outcomes.

## Tech stack

- Database: PostgreSQL + PostGIS (Docker image `postgis/postgis:17-3.5`)
- Backend: Python, FastAPI, SQLAlchemy, GeoPandas
- Frontend: React, Vite, react-leaflet, served by nginx in Docker
- Containers: Docker Compose

## Run with Docker

Requirements: Docker Desktop.

1. Create `backend/.env` with the database settings (user, password, database name). This file is git-ignored and must never be committed.
2. From the repo root, start the database first:

   ```powershell
   docker compose --env-file backend/.env up -d db
   ```

3. Load the data into the container database (from `backend`, with the Python venv active):

   ```powershell
   $env:DB_HOST="localhost"; $env:DB_PORT="5433"; python db_load.py; python db_loadv2.py
   ```

   Each script writes 3528 rows (`grid_scores`, `grid_scores_v2`).

4. From the repo root, build and start everything:

   ```powershell
   docker compose --env-file backend/.env up --build
   ```

5. Open:
   - Backend health check: http://127.0.0.1:8000/health (should show 3528 cells)
   - Web app: http://localhost:5173

## Run without Docker (development)

Needs a local PostgreSQL with PostGIS and the `geovista` database loaded.

```powershell
# backend
cd backend
venv\Scripts\activate
python -m uvicorn main:app --reload

# frontend (new terminal)
cd frontend
npm run dev
```

## API endpoints

| Endpoint | Description |
|---|---|
| `/health` | Status and cell count |
| `/cells`, `/top` | v0 cells and top cells |
| `/report` | v0 PDF report |
| `/v2/cells`, `/v2/top` | v2 cells and top cells |
| `/v2/report` | v2 PDF report (includes saturation) |

## Web app features

v0/v2 selector, ranked top-20 list (click a row to zoom to the cell), colour bands (high/medium/low) with five colour palettes, minimum-score filter, hover tooltip, click-for-details panel (score, rank, competitors, POIs, saturation, coordinates and a Google Maps link), five basemaps (Light, Dark, Street, Detailed, Satellite), light/dark theme, PDF report download.

v2 only: a demand-weight slider (re-weights demand vs saturation live; at 50% the scores match the backend and the PDF report) and a maximum-competitors filter. The PDF report always uses the default 50/50 weights.

## Experiment tracking (MLflow, local only)

MLflow records the scoring experiments (v0 and v2 weight sweeps) so the runs can be compared. It tracks scoring runs only: there is no predictive model and there are no training labels. MLflow is not part of the Docker setup or the CI pipeline.

```powershell
pip install mlflow
python mlflow_log.py
mlflow ui --backend-store-uri sqlite:///mlflow.db
```

Run these from the repository root. Then open http://127.0.0.1:5000 and select the geovista-scoring experiment (22 runs: 14 for v0, 7 for v2, 1 v2 summary). The files mlflow.db and mlruns/ are git-ignored.

## Status

Done: data pipeline, v0 and v2 scoring, sensitivity analysis, KD-tree benchmark, Pareto front, backend, frontend, Docker setup, API tests (pytest), GitHub Actions CI, local MLflow tracking of the scoring runs.

Not done: validation against real outcomes (no labels available), road accessibility, a predictive ML model, online deployment (the app runs locally and in Docker only), authentication, a map-based area picker (the app covers Gulshan-e-Iqbal only).

Planned next: road accessibility and, if labels can be found, validation.
