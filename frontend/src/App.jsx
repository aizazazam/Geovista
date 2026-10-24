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
    if (data) map.fitBounds(L.geoJSON(data).getBounds());
  }, [data, map]);
  return null;
}

export default function App() {
  const [version, setVersion] = useState("v2");
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [minScore, setMinScore] = useState(0);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    setData(null);
    setError(null);
    setSelected(null);
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

  const band = selected
    ? selected._score > cuts[1] ? "High" : selected._score > cuts[0] ? "Medium" : "Low"
    : null;

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "10px 16px", background: "#222", color: "#fff", fontFamily: "sans-serif", fontSize: 14 }}>
        <b>Geovista</b> - business location suitability
        <select
          value={version}
          onChange={(e) => setVersion(e.target.value)}
          style={{ marginLeft: 16 }}
        >
          {Object.entries(VERSIONS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <span style={{ marginLeft: 20, fontSize: 13 }}>
          Min score: {minScore}{" "}
          <input
            type="range" min="0" max={VERSIONS[version].max} step="5" value={minScore}
            onChange={(e) => setMinScore(Number(e.target.value))}
          />
        </span>
        <a
          href={`${API}${VERSIONS[version].report}?n=10`}
          style={{
            marginLeft: 20, padding: "5px 12px", background: "#27ae60", color: "#fff",
            borderRadius: 4, textDecoration: "none", fontSize: 13,
          }}
        >
          Download report (PDF)
        </a>
        <span style={{ float: "right", fontSize: 13 }}>
          <span style={{ color: "#2ecc71" }}>■</span> high &nbsp;
          <span style={{ color: "#f1c40f" }}>■</span> medium &nbsp;
          <span style={{ color: "#e74c3c" }}>■</span> low
        </span>
      </div>
      {error && <div style={{ padding: 12, color: "crimson" }}>Could not load data: {error}. Is the backend running?</div>}
      {!data && !error && <div style={{ padding: 12 }}>Loading...</div>}
      <div style={{ flex: 1, position: "relative" }}>
        <MapContainer center={[24.93, 67.09]} zoom={14} style={{ height: "100%" }}>
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
            attribution="Esri World Street Map"
          />
          {data && <FitBounds data={data} />}
          {data && (
            <GeoJSON key={`${version}-${minScore}`} data={data} style={style} onEachFeature={onEach} />
          )}
        </MapContainer>

        {selected && (
          <div style={{
            position: "absolute", top: 12, right: 12, width: 260, zIndex: 1000,
            background: "#fff", padding: 14, borderRadius: 6,
            boxShadow: "0 2px 10px rgba(0,0,0,0.3)", fontFamily: "sans-serif", fontSize: 14,
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
  );
}