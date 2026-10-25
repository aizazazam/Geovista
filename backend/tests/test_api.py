from fastapi.testclient import TestClient
import main

client = TestClient(main.app)


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok", "cells": 3528}


def test_cells_v0():
    r = client.get("/cells")
    assert r.status_code == 200
    feats = r.json()["features"]
    assert len(feats) == 3528
    assert all("score" in f["properties"] for f in feats)


def test_top_v0_sorted():
    r = client.get("/top?n=5")
    scores = [f["properties"]["score"] for f in r.json()["features"]]
    assert len(scores) == 5
    assert scores == sorted(scores, reverse=True)
    assert abs(scores[0] - 62.4) < 0.1


def test_cells_v2_candidates_only():
    r = client.get("/v2/cells")
    assert r.status_code == 200
    feats = r.json()["features"]
    assert len(feats) == 1268
    assert all(0 <= f["properties"]["score_v2"] <= 100 for f in feats)
    assert all(f["properties"]["poi_other"] >= 5 for f in feats)


def test_top_v2_best_cell():
    r = client.get("/v2/top?n=3")
    scores = [f["properties"]["score_v2"] for f in r.json()["features"]]
    assert scores == sorted(scores, reverse=True)
    assert abs(scores[0] - 94.8) < 0.1


def test_reports_are_pdf():
    for url in ("/report?n=5", "/v2/report?n=5"):
        r = client.get(url)
        assert r.status_code == 200
        assert r.headers["content-type"] == "application/pdf"
        assert r.content.startswith(b"%PDF")