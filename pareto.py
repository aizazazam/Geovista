import geopandas as gpd

g = gpd.read_file("grid_scores.geojson")
g = g[g.poi_density >= 5].copy()

print("Correlation (POI vs competitors):", round(g.poi_density.corr(g.competitor_density), 2))

# Pareto front: maximise POI, minimise competitors
g = g.sort_values(["poi_density", "competitor_density"], ascending=[False, True])
best_comp, keep = float("inf"), []
for i, c in zip(g.index, g.competitor_density):
    if c < best_comp:
        keep.append(i)
        best_comp = c
front = g.loc[keep]
print("Pareto-optimal cells:", len(front), "of", len(g))
print(front[["poi_density", "competitor_density", "score"]].head(15))

import matplotlib.pyplot as plt
plt.scatter(g.competitor_density, g.poi_density, s=6, alpha=0.4, label="candidate cells")
f = front.sort_values("competitor_density")
plt.plot(f.competitor_density, f.poi_density, "r.-", label="Pareto front")
plt.xlabel("Competitors within 500 m"); plt.ylabel("POIs within 500 m"); plt.legend()
plt.savefig("pareto.png", dpi=150)