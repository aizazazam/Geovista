from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import geopandas as gpd, json, os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from urllib.parse import quote_plus
import pandas as pd
from io import BytesIO
from fastapi.responses import StreamingResponse
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

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

@app.get("/report")
def report(n: int = 10):
    sql = """SELECT score, competitor_density AS comp, poi_density AS poi,
                    ST_Y(ST_Centroid(geometry)) AS lat,
                    ST_X(ST_Centroid(geometry)) AS lon
             FROM grid_scores ORDER BY score DESC LIMIT :n"""
    df = pd.read_sql(text(sql), engine, params={"n": n})

    styles = getSampleStyleSheet()
    rows = [["Rank", "Score", "Competitors", "POIs", "Lat", "Lon"]]
    for i, r in enumerate(df.itertuples(), start=1):
        rows.append([i, f"{r.score:.1f}", int(r.comp), int(r.poi),
                     f"{r.lat:.5f}", f"{r.lon:.5f}"])

    table = Table(rows, repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#222222")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
    ]))

    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4)
    doc.build([
        Paragraph("Geovista - Top Locations Report", styles["Title"]),
        Paragraph(f"Top {n} cells (250 m grid, Gulshan-e-Iqbal, Karachi), ranked by score.", styles["Normal"]),
        Spacer(1, 12),
        table,
        Spacer(1, 12),
        Paragraph("Score v0 = 60% POI density + 40% (1 - competitor density), normalised to 0-100. "
                  "It is decision support, not a guarantee of success.", styles["Italic"]),
    ])
    buf.seek(0)
    return StreamingResponse(buf, media_type="application/pdf",
                             headers={"Content-Disposition": "attachment; filename=geovista_report.pdf"})


V2_COLS = """geometry, poi_other, comp,
             demand::float AS demand, saturation::float AS saturation,
             score_v2::float AS score_v2"""


@app.get("/v2/cells")
def cells_v2():
    gdf = read(f"SELECT {V2_COLS} FROM grid_scores_v2 WHERE is_candidate")
    return json.loads(gdf.to_json())


@app.get("/v2/top")
def top_v2(n: int = 10):
    gdf = read(f"SELECT {V2_COLS} FROM grid_scores_v2 WHERE is_candidate "
               "ORDER BY score_v2 DESC LIMIT :n", {"n": n})
    return json.loads(gdf.to_json())


@app.get("/v2/report")
def report_v2(n: int = 10):
    sql = """SELECT score_v2::float AS score, comp, poi_other AS poi,
                    saturation::float AS sat,
                    ST_Y(ST_Centroid(geometry)) AS lat,
                    ST_X(ST_Centroid(geometry)) AS lon
             FROM grid_scores_v2 WHERE is_candidate
             ORDER BY score_v2 DESC LIMIT :n"""
    df = pd.read_sql(text(sql), engine, params={"n": n})

    styles = getSampleStyleSheet()
    rows = [["Rank", "Score v2", "Competitors", "POIs", "Saturation", "Lat", "Lon"]]
    for i, r in enumerate(df.itertuples(), start=1):
        rows.append([i, f"{r.score:.1f}", int(r.comp), int(r.poi),
                     f"{r.sat:.3f}", f"{r.lat:.5f}", f"{r.lon:.5f}"])

    table = Table(rows, repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#222222")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
    ]))

    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4)
    doc.build([
        Paragraph("Geovista - Top Locations Report (score v2)", styles["Title"]),
        Paragraph(f"Top {n} candidate cells (250 m grid, Gulshan-e-Iqbal, Karachi). "
                  "Only cells with at least 5 non-competitor POIs are scored.", styles["Normal"]),
        Spacer(1, 12),
        table,
        Spacer(1, 12),
        Paragraph("Score v2 = 50% demand + 50% (1 - saturation), normalised to 0-100. "
                  "Demand is the log of non-competitor POIs within 500 m; saturation is "
                  "competitors per non-competitor POI. It is decision support, not a "
                  "guarantee of success.", styles["Italic"]),
    ])
    buf.seek(0)
    return StreamingResponse(buf, media_type="application/pdf",
                             headers={"Content-Disposition": "attachment; filename=geovista_report_v2.pdf"})