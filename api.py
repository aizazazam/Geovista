from fastapi import FastAPI
import geopandas as gpd, json

app = FastAPI(title="Geovista API")
g = gpd.read_file("grid_scores.geojson")

@app.get("/top")
def top(n: int = 10):
    return json.loads(g.sort_values("score", ascending=False).head(n).to_json())