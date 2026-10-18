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