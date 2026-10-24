import os
import numpy as np
import geopandas as gpd
from dotenv import load_dotenv
from sqlalchemy import create_engine
from urllib.parse import quote_plus

load_dotenv()
user = os.getenv("DB_USER")
pw = quote_plus(os.getenv("DB_PASSWORD"))
host = os.getenv("DB_HOST")
port = os.getenv("DB_PORT")
name = os.getenv("DB_NAME")
engine = create_engine(f"postgresql+psycopg2://{user}:{pw}@{host}:{port}/{name}")

g = gpd.read_file("../grid_scores_v2.geojson")
n = lambda s: (s - s.min()) / (s.max() - s.min() + 1e-9)

# same filter as Aizaz's mapv2.py
cand = (g.poi_other.notna() & g.comp.notna() & (g.poi_other >= 5)
        & g.is_valid & ~g.geometry.is_empty)
c = g[cand].copy()
c["demand"] = n(np.log1p(c.poi_other))
c["saturation"] = (c.comp / (c.poi_other + 1)).round(3)
c["score_v2"] = (100 * (0.5 * c.demand + 0.5 * (1 - n(c.saturation)))).round(1)

g["demand"] = c.demand
g["saturation"] = c.saturation
g["score_v2"] = c.score_v2
g["is_candidate"] = cand

print("cells:", len(g), "| candidates:", int(cand.sum()))
print("score_v2 range:", c.score_v2.min(), "-", c.score_v2.max())
g.to_postgis("grid_scores_v2", engine, if_exists="replace", index=False)
print("written: grid_scores_v2")