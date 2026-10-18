import osmnx as ox, geopandas as gpd, numpy as np
from shapely.geometry import box

place = "Gulshan-e-Iqbal, Karachi, Pakistan"

comp = ox.features_from_place(place, {"amenity": ["cafe", "restaurant"], "shop": "bakery"})
poi  = ox.features_from_place(place, {"amenity": True, "shop": True})
print("Competitors found:", len(comp), "| POIs found:", len(poi))

comp, poi = comp.to_crs(32642), poi.to_crs(32642)

minx, miny, maxx, maxy = poi.total_bounds
cells = [box(x, y, x+250, y+250)
         for x in np.arange(minx, maxx, 250)
         for y in np.arange(miny, maxy, 250)]
grid = gpd.GeoDataFrame(geometry=cells, crs=32642)

c = grid.geometry.centroid.buffer(500)
grid["competitor_density"] = [comp.intersects(b).sum() for b in c]
grid["poi_density"]        = [poi.intersects(b).sum()  for b in c]

n = lambda s: (s - s.min()) / (s.max() - s.min() + 1e-9)
grid["score"] = 100 * (0.6*n(grid.poi_density) + 0.4*(1 - n(grid.competitor_density)))

grid.to_crs(4326).to_file("grid_scores.geojson", driver="GeoJSON")
print(grid.sort_values("score", ascending=False).head())
import time
from scipy.spatial import cKDTree

# old method: brute force
t0 = time.time()
old = [poi.intersects(b).sum() for b in c]
t_old = time.time() - t0

# new method: KD-tree
cent = np.c_[grid.geometry.centroid.x, grid.geometry.centroid.y]
poi_xy = np.c_[poi.geometry.centroid.x, poi.geometry.centroid.y]
t0 = time.time()
tree = cKDTree(poi_xy)
new = [len(x) for x in tree.query_ball_point(cent, r=500)]
t_new = time.time() - t0

print(f"Brute force: {t_old:.2f}s | KD-tree: {t_new:.2f}s | speedup: {t_old/t_new:.1f}x")
print("Max count difference:", max(abs(a-b) for a, b in zip(old, new)))