import geopandas as gpd, numpy as np, folium

g = gpd.read_file("grid_scores_v2.geojson")
g = g.dropna(subset=["poi_other", "comp"])
g = g[g.is_valid & ~g.geometry.is_empty]
g = g[g.poi_other >= 5].copy()                      # candidate cells only
n = lambda s: (s - s.min()) / (s.max() - s.min() + 1e-9)

g["demand"] = n(np.log1p(g.poi_other))
g["saturation"] = (g.comp / (g.poi_other + 1)).round(3)
g["score_v2"] = (100 * (0.5 * g.demand + 0.5 * (1 - n(g.saturation)))).round(1)

# Pareto front: maximise POIs, minimise competitors
s = g.sort_values(["poi_other", "comp"], ascending=[False, True])
best, keep = float("inf"), []
for i, c in zip(s.index, s.comp):
    if c < best:
        keep.append(i); best = c
front = g.loc[keep]

cols = ["geometry", "poi_other", "comp", "saturation", "score_v2"]
ctr = g.to_crs(32642).geometry.centroid.to_crs(4326)
m = folium.Map(location=[ctr.y.mean(), ctr.x.mean()], zoom_start=14,
               tiles="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
               attr="Esri World Street Map")

q1, q2 = g.score_v2.quantile([0.33, 0.66])
color = lambda v: "#2ecc71" if v > q2 else "#f1c40f" if v > q1 else "#e74c3c"
tip = folium.GeoJsonTooltip(fields=["poi_other", "comp", "saturation", "score_v2"],
                            aliases=["Non-competitor POIs", "Competitors", "Saturation", "Score v2"])

folium.GeoJson(g[cols].to_json(), name="Score v2 (candidate cells)",
               style_function=lambda f: {"fillColor": color(f["properties"]["score_v2"]),
                                         "color": "grey", "weight": 0.3, "fillOpacity": 0.55},
               tooltip=tip).add_to(m)

folium.GeoJson(front[cols].to_json(), name="Pareto-optimal cells",
               style_function=lambda f: {"fillOpacity": 0, "color": "black", "weight": 2.5},
               tooltip=tip).add_to(m)

folium.LayerControl().add_to(m)
m.save("map_v2.html")
print("Saved map_v2.html |", len(g), "candidate cells |", len(front), "Pareto cells")