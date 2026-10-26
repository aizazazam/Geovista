import geopandas as gpd, numpy as np, mlflow

mlflow.set_tracking_uri("sqlite:///mlflow.db")
mlflow.set_experiment("geovista-scoring")

n = lambda s: (s - s.min()) / (s.max() - s.min() + 1e-9)
WEIGHTS = [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]
count = 0


def v0_runs(g, label):
    global count
    poi, comp = n(g.poi_density), n(g.competitor_density)
    top = lambda w: set((w * poi + (1 - w) * (1 - comp)).nlargest(20).index)
    base = top(0.6)
    corr = float(g.poi_density.corr(g.competitor_density))
    for w in WEIGHTS:
        t = top(w)
        with mlflow.start_run(run_name=f"v0 | {label} | w_poi={w}"):
            mlflow.set_tags({"version": "v0", "logic": "sensitivity.py"})
            mlflow.log_params({"cell_set": label, "w_poi": w, "n_cells": len(g)})
            mlflow.log_metrics({
                "top20_overlap_with_w0.6": len(t & base),
                "avg_competitors_top20": float(g.loc[list(t), "competitor_density"].mean()),
                "input_correlation": corr,
            })
        count += 1


g0 = gpd.read_file("grid_scores.geojson")
v0_runs(g0, "all cells")
v0_runs(g0[g0.poi_density >= 5], "candidates (POI>=5)")

g = gpd.read_file("grid_scores_v2.geojson")
g = g[g.poi_other >= 5].copy()
g["demand"] = n(np.log1p(g.poi_other))
g["saturation"] = g.comp / (g.poi_other + 1)
sat_n = n(g.saturation)
top2 = lambda w: set((100 * (w * g.demand + (1 - w) * (1 - sat_n))).nlargest(20).index)
base2 = top2(0.5)
corr2 = float(g.demand.corr(g.saturation))

for w in WEIGHTS:
    t = top2(w)
    with mlflow.start_run(run_name=f"v2 | w_demand={w}"):
        mlflow.set_tags({"version": "v2", "logic": "score_v2.py"})
        mlflow.log_params({"w_demand": w, "n_cells": len(g)})
        mlflow.log_metrics({
            "top20_overlap_with_w0.5": len(t & base2),
            "avg_competitors_top20": float(g.loc[list(t), "comp"].mean()),
            "input_correlation": corr2,
        })
    count += 1

d_only = set(g.demand.nlargest(20).index)
score = 100 * (0.5 * g.demand + 0.5 * (1 - sat_n))
with mlflow.start_run(run_name="v2 | summary"):
    mlflow.set_tags({"version": "v2", "logic": "score_v2.py"})
    mlflow.log_params({"candidate_cells": len(g), "min_poi_other": 5})
    mlflow.log_metrics({
        "input_correlation": corr2,
        "demand_only_vs_v2_top20_overlap": len(d_only & base2),
        "score_min": float(score.min()),
        "score_max": float(score.max()),
    })
    mlflow.log_artifact("score_v2.py")
    mlflow.log_artifact("sensitivity.py")
count += 1

print(count, "runs logged")
print("v2 correlation demand vs saturation:", round(corr2, 2))
print("v2 demand-only vs v2 top-20 overlap:", len(d_only & base2), "/ 20")
print("v2 score range:", round(float(score.min()), 1), "-", round(float(score.max()), 1))
