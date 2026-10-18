import osmnx as ox, geopandas as gpd, numpy as np
from scipy.spatial import cKDTree

place = "Gulshan-e-Iqbal, Karachi, Pakistan"
comp = ox.features_from_place(place, {"amenity": ["cafe", "restaurant"], "shop": "bakery"})
poi  = ox.features_from_place(place, {"amenity": True, "shop": True})
poi_other = poi[~poi.index.isin(comp.index)]          # POIs that are NOT competitors

g = gpd.read_file("grid_scores.geojson").to_crs(32642)
cent = np.c_[g.geometry.centroid.x, g.geometry.centroid.y]

def count(feats):
    f = feats.to_crs(32642).geometry.centroid
    tree = cKDTree(np.c_[f.x, f.y])
    return [len(x) for x in tree.query_ball_point(cent, r=500)]

g["comp"] = count(comp)
g["poi_other"] = count(poi_other)
g["comp_share"] = g.comp / (g.comp + g.poi_other + 1)

print("POIs total:", len(poi), "| competitors:", len(comp), "| non-competitor POIs:", len(poi_other))
print("Correlation (non-competitor POIs vs competitors):", round(g.poi_other.corr(g.comp), 2))
g.to_crs(4326).to_file("grid_scores_v2.geojson", driver="GeoJSON")