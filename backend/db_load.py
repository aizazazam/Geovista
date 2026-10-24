import os
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

gdf = gpd.read_file("../grid_scores.geojson")
print("Loaded", len(gdf), "cells, CRS:", gdf.crs)

gdf.to_postgis("grid_scores", engine, if_exists="replace", index=False)
print("Done: table grid_scores written")