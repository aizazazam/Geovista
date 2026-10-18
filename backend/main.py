from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import geopandas as gpd, json, os

app = FastAPI(title="Geovista API")
app.add_middleware(CORSMiddleware, allow_origins=["*"],
                   allow_methods=["*"], allow_headers=["*"])

DATA = os.path.join(os.path.dirname(__file__), "..", "grid_scores.geojson")
grid = gpd.read_file(DATA)

@app.get("/health")
def health():
    return {"status": "ok", "cells": len(grid)}

@app.get("/cells")
def cells():
    return json.loads(grid.to_json())

@app.get("/top")
def top(n: int = 10):
    return json.loads(grid.sort_values("score", ascending=False).head(n).to_json())