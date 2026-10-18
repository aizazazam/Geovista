import geopandas as gpd, folium

g = gpd.read_file("grid_scores.geojson")
c = g.to_crs(32642).geometry.centroid.to_crs(4326)
m = folium.Map(location=[c.y.mean(), c.x.mean()], zoom_start=14,
               tiles="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
               attr="Esri World Street Map")

q1, q2 = g["score"].quantile([0.33, 0.66])
def color(s):
    return "#2ecc71" if s > q2 else "#f1c40f" if s > q1 else "#e74c3c"

folium.GeoJson(
    g.to_json(),
    style_function=lambda f: {"fillColor": color(f["properties"]["score"]),
                              "color": "grey", "weight": 0.3, "fillOpacity": 0.55},
    tooltip=folium.GeoJsonTooltip(fields=["competitor_density", "poi_density", "score"]),
).add_to(m)

m.save("map.html")
print("Saved map.html")