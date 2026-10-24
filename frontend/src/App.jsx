import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, GeoJSON, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const API = "http://127.0.0.1:8000";

function FitBounds({ data }) {
  const map = useMap();
  useEffect(() => {
    if (data) map.fitBounds(L.geoJSON(data).getBounds());
  }, [data, map]);
  return null;
}

export default function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [minScore, setMinScore] = useState(0);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    fetch(`${API}/cells`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  const scores = useMemo(
    () => (data ? data.features.map((f) => f.properties.score) : []),
    [data]
  );

  const cuts = useMemo(() => {
    if (!data) return null;
    const s = [...scores].sort((a, b) => a - b);
    return [s[Math.floor(s.length * 0.33)], s[Math.floor(s.length * 0.66)]];
  }, [data, scores]);

  const style = (f) => {
    const v = f.properties.score;
    if (v < minScore) return { fillOpacity: 0, opacity: 0 };
    const color = v > cuts[1] ? "#2ecc71" : v > cuts[0] ? "#f1c40f" : "#e74c3c";
    return { fillColor: color, color: "#888", weight: 0.3, fillOpacity: 0.55 };
  };

  const onEach = (f, layer) => {
    const p = f.properties;
    layer.bindTooltip(
      `Score: ${p.score.toFixed(1)}<br>Competitors: ${p.competitor_density}<br>POIs: ${p.poi_density}`
    );
    layer.on("click", () => {
      const rank = scores.filter((s) => s > p.score).length + 1;
      setSelected({ ...p, rank, total: scores.length });
    });
  };

  const band = selected
    ? selected.score > cuts[1] ? "High" : selected.score > cuts[0] ? "Medium" : "Low"
    : null;

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "10px 16px", background: "#222", color: "#fff", fontFamily: "sans-serif" }}>
        <b>Geovista</b> - business location suitability
        <span style={{ marginLeft: 24, fontSize: 13 }}>
          Min score: {minScore}{" "}
          <input
            type="range" min="0" max="60" step="5" value={minScore}
            onChange={(e) => setMinScore(Number(e.target.value))}
          />
        </span>
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
          {data && <GeoJSON key={minScore} data={data} style={style} onEachFeature={onEach} />}
        </MapContainer>

        {selected && (
          <div style={{
            position: "absolute", top: 12, right: 12, width: 250, zIndex: 1000,
            background: "#fff", padding: 14, borderRadius: 6,
            boxShadow: "0 2px 10px rgba(0,0,0,0.3)", fontFamily: "sans-serif", fontSize: 14,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <b>Selected location</b>
              <span style={{ cursor: "pointer" }} onClick={() => setSelected(null)}>✕</span>
            </div>
            <div style={{ fontSize: 30, fontWeight: "bold", margin: "8px 0 2px" }}>
              {selected.score.toFixed(1)}<span style={{ fontSize: 14 }}> / 100</span>
            </div>
            <div style={{ marginBottom: 8 }}>{band} (relative to this area)</div>
            <div>Rank: {selected.rank} of {selected.total}</div>
            <div>Competitors within 500 m: {selected.competitor_density}</div>
            <div>POIs within 500 m: {selected.poi_density}</div>
            <div style={{ fontSize: 12, color: "#666", marginTop: 10 }}>
              Score v0 = 60% POI density + 40% (1 − competitor density), normalised.
              It is decision support, not a guarantee of success.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}