import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, GeoJSON, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const API = "http://127.0.0.1:8000";

const VERSIONS = {
  v0: { label: "v0: POIs vs competitors", cells: "/cells", report: "/report", max: 60 },
  v2: { label: "v2: demand vs saturation", cells: "/v2/cells", report: "/v2/report", max: 100 },
};

function normalise(version, geo) {
  geo.features.forEach((f) => {
    const p = f.properties;
    if (version === "v0") {
      p._score = p.score;
      p._comp = p.competitor_density;
      p._poi = p.poi_density;
    } else {
      p._score = p.score_v2;
      p._comp = p.comp;
      p._poi = p.poi_other;
    }
  });
  return geo;
}

function FitBounds({ data }) {
  const map = useMap();
  useEffect(() => {
    if (!data) return;
    map.invalidateSize();
    map.fitBounds(L.geoJSON(data).getBounds(), { padding: [30, 30] });
  }, [data, map]);
  return null;
}

function FlyTo({ target }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo(target.center, 17, { duration: 0.8 });
  }, [target, map]);
  return null;
}

const th = { textAlign: "left", padding: "4px 6px", borderBottom: "1px solid #ccc", fontSize: 12 };
const td = { padding: "4px 6px", fontSize: 13 };

export default function App() {
  const [version, setVersion] = useState("v2");
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [minScore, setMinScore] = useState(0);
  const [selected, setSelected] = useState(null);
  const [target, setTarget] = useState(null);

  useEffect(() => {
    setData(null);
    setError(null);
    setSelected(null);
    setTarget(null);
    setMinScore(0);
    fetch(`${API}${VERSIONS[version].cells}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((g) => setData(normalise(version, g)))
      .catch((e) => setError(e.message));
  }, [version]);

  const scores = useMemo(
    () => (data ? data.features.map((f) => f.properties._score) : []),
    [data]
  );

  const cuts = useMemo(() => {
    if (!data) return null;
    const s = [...scores].sort((a, b) => a - b);
    return [s[Math.floor(s.length * 0.33)], s[Math.floor(s.length * 0.66)]];
  }, [data, scores]);

  const top20 = useMemo(() => {
    if (!data) return [];
    return [...data.features]
      .sort((a, b) => b.properties._score - a.properties._score)
      .slice(0, 20);
  }, [data]);

  const style = (f) => {
    const v = f.properties._score;
    if (v < minScore) return { fillOpacity: 0, opacity: 0 };
    const color = v > cuts[1] ? "#2ecc71" : v > cuts[0] ? "#f1c40f" : "#e74c3c";
    return { fillColor: color, color: "#888", weight: 0.3, fillOpacity: 0.55 };
  };

  const onEach = (f, layer) => {
    const p = f.properties;
    let tip = `Score: ${p._score.toFixed(1)}<br>Competitors: ${p._comp}<br>POIs: ${p._poi}`;
    if (version === "v2") tip += `<br>Saturation: ${Number(p.saturation).toFixed(3)}`;
    layer.bindTooltip(tip);
    layer.on("click", () => {
      const rank = scores.filter((s) => s > p._score).length + 1;
      setSelected({ ...p, rank, total: scores.length });
    });
  };

  const goTo = (f, i) => {
    const c = L.geoJSON(f).getBounds().getCenter();
    setTarget({ center: [c.lat, c.lng] });
    setSelected({ ...f.properties, rank: i + 1, total: scores.length });
  };

  const band = selected
    ? selected._score > cuts[1] ? "High" : selected._score > cuts[0] ? "Medium" : "Low"
    : null;

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", fontFamily: "sans-serif" }}>
      <div style={{ padding: "10px 16px", background: "#222", color: "#fff", fontSize: 15 }}>
        <b>Geovista</b> - business location suitability
      </div>

      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <div style={{ width: 330, overflowY: "auto", background: "#f7f7f7", padding: 12, boxSizing: "border-box" }}>
          <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>Scoring version</div>
          <select
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            style={{ width: "100%", padding: 6, marginBottom: 12 }}
          >
            {Object.entries(VERSIONS).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>

          <div style={{ fontSize: 12, color: "#555" }}>Min score: <b>{minScore}</b></div>
          <input
            type="range" min="0" max={VERSIONS[version].max} step="5" value={minScore}
            onChange={(e) => setMinScore(Number(e.target.value))}
            style={{ width: "100%", marginBottom: 12 }}
          />

          <a
            href={`${API}${VERSIONS[version].report}?n=10`}
            style={{
              display: "block", textAlign: "center", padding: "8px 0", background: "#27ae60",
              color: "#fff", borderRadius: 4, textDecoration: "none", fontSize: 14, marginBottom: 12,
            }}
          >
            Download report (PDF)
          </a>

          <div style={{ fontSize: 13, marginBottom: 12 }}>
            <span style={{ color: "#2ecc71" }}>■</span> high &nbsp;
            <span style={{ color: "#f1c40f" }}>■</span> medium &nbsp;
            <span style={{ color: "#e74c3c" }}>■</span> low
            <span style={{ color: "#777" }}> (relative to this area)</span>
          </div>

          {error && <div style={{ color: "crimson", fontSize: 13 }}>Could not load data: {error}. Is the backend running?</div>}
          {!data && !error && <div style={{ fontSize: 13 }}>Loading...</div>}

          {data && (
            <>
              <div style={{ fontWeight: "bold", margin: "6px 0" }}>Top 20 locations</div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={th}>#</th>
                    <th style={th}>Score</th>
                    <th style={th}>Comp.</th>
                    <th style={th}>POIs</th>
                  </tr>
                </thead>
                <tbody>
                  {top20.map((f, i) => {
                    const p = f.properties;
                    const active = selected && selected.rank === i + 1 && selected._score === p._score;
                    return (
                      <tr
                        key={i}
                        onClick={() => goTo(f, i)}
                        style={{ cursor: "pointer", background: active ? "#d6eaf8" : "transparent" }}
                      >
                        <td style={td}>{i + 1}</td>
                        <td style={td}>{p._score.toFixed(1)}</td>
                        <td style={td}>{p._comp}</td>
                        <td style={td}>{p._poi}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div style={{ fontSize: 11, color: "#777", marginTop: 6 }}>Click a row to zoom the map to that cell.</div>
            </>
          )}
        </div>

        <div style={{ flex: 1, position: "relative" }}>
          <MapContainer center={[24.93, 67.09]} zoom={14} style={{ height: "100%" }}>
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
              attribution="Esri World Street Map"
            />
            {data && <FitBounds data={data} />}
            <FlyTo target={target} />
            {data && (
              <GeoJSON key={`${version}-${minScore}`} data={data} style={style} onEachFeature={onEach} />
            )}
          </MapContainer>

          {selected && (
            <div style={{
              position: "absolute", top: 12, right: 12, width: 260, zIndex: 1000,
              background: "#fff", padding: 14, borderRadius: 6,
              boxShadow: "0 2px 10px rgba(0,0,0,0.3)", fontSize: 14,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <b>Selected location ({version})</b>
                <span style={{ cursor: "pointer" }} onClick={() => setSelected(null)}>✕</span>
              </div>
              <div style={{ fontSize: 30, fontWeight: "bold", margin: "8px 0 2px" }}>
                {selected._score.toFixed(1)}<span style={{ fontSize: 14 }}> / 100</span>
              </div>
              <div style={{ marginBottom: 8 }}>{band} (relative to this area)</div>
              <div>Rank: {selected.rank} of {selected.total}</div>
              <div>Competitors within 500 m: {selected._comp}</div>
              <div>{version === "v2" ? "Non-competitor POIs" : "POIs"} within 500 m: {selected._poi}</div>
              {version === "v2" && (
                <div>Saturation (competitors per POI): {Number(selected.saturation).toFixed(3)}</div>
              )}
              <div style={{ fontSize: 12, color: "#666", marginTop: 10 }}>
                {version === "v2"
                  ? "Score v2 = 50% demand (log of POIs) + 50% (1 - saturation), normalised. Only cells with at least 5 non-competitor POIs are scored."
                  : "Score v0 = 60% POI density + 40% (1 - competitor density), normalised."}{" "}
                It is decision support, not a guarantee of success.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}