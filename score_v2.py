import geopandas as gpd, numpy as np

g = gpd.read_file("grid_scores_v2.geojson")
g = g[g.poi_other >= 5].copy()            # candidate cells only

n = lambda s: (s - s.min()) / (s.max() - s.min() + 1e-9)

g["demand"] = n(np.log1p(g.poi_other))     # log: dampens the huge core
g["saturation"] = g.comp / (g.poi_other + 1)   # competitors per non-competitor POI
g["score_v2"] = 100 * (0.5 * g.demand + 0.5 * (1 - n(g.saturation)))

print("Correlation demand vs saturation:", round(g.demand.corr(g.saturation), 2))
print(g.sort_values("score_v2", ascending=False)[["poi_other", "comp", "saturation", "score_v2"]].head(10))

# stability check, same as before
top = lambda w: set((100 * (w * g.demand + (1 - w) * (1 - n(g.saturation)))).nlargest(20).index)
base = top(0.5)
for w in [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]:
    print(f"w={w:.1f} overlap with 0.5: {len(top(w) & base)}/20")
d_only = set(g.demand.nlargest(20).index)
print("Top-20 overlap, demand-only vs score_v2:", len(d_only & top(0.5)), "/ 20")