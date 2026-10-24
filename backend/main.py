from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import geopandas as gpd, json, os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from urllib.parse import quote_plus

load_dotenv()

user = os.getenv("DB_USER")
pw = quote_plus(os.getenv("DB_PASSWORD"))
host = os.getenv("DB_HOST")
port = os.getenv("DB_PORT")
name = os.getenv("DB_NAME")

engine = create_engine(f"postgresql+psycopg2://{user}:{pw}@{host}:{port}/{name}")

app = FastAPI(title="Geovista API")
app.add_middleware(CORSMiddleware, allow_origins=["*"],
                   allow_methods=["*"], allow_headers=["*"])


def read(sql, params=None):
    return gpd.read_postgis(text(sql), engine, geom_col="geometry", params=params)


@app.get("/health")
def health():
    with engine.connect() as conn:
        n = conn.execute(text("SELECT COUNT(*) FROM grid_scores")).scalar()
    return {"status": "ok", "cells": n}


@app.get("/cells")
def cells():
    return json.loads(read("SELECT * FROM grid_scores").to_json())


@app.get("/top")
def top(n: int = 10):
    gdf = read("SELECT * FROM grid_scores ORDER BY score DESC LIMIT :n", {"n": n})
    return json.loads(gdf.to_json())