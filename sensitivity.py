import geopandas as gpd

g0 = gpd.read_file("grid_scores.geojson")
n = lambda s: (s - s.min()) / (s.max() - s.min() + 1e-9)

def run(g, label):
    poi, comp = n(g.poi_density), n(g.competitor_density)
    top = lambda w: set((w * poi + (1 - w) * (1 - comp)).nlargest(20).index)
    base = top(0.6)
    print(f"\n{label}: {len(g)} cells")
    print("w_poi | overlap with w=0.6 | avg competitors in top-20")
    for w in [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]:
        t = top(w)
        print(f"{w:.1f}   | {len(t & base):2d}/20             | {g.loc[list(t), 'competitor_density'].mean():.1f}")

run(g0, "All cells")
run(g0[g0.poi_density >= 5], "Candidates only (POI >= 5)")