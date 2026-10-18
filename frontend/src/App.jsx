import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const API = "http://127.0.0.1:8000";

export default function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${API}/cells`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  const cuts = useMemo(() => {
    if (!data) return null;
    const s = data.features.map((f) => f.properties.score).sort((a, b) => a - b);
    return [s[Math.floor(s.length * 0.33)], s[Math.floor(s.length * 0.66)]];
  }, [data]);

  const style = (f) => {
    const v = f.properties.score;
    const color = v > cuts[1] ? "#2ecc71" : v > cuts[0] ? "#f1c40f" : "#e74c3c";
    return { fillColor: color, color: "#888", weight: 0.3, fillOpacity: 0.55 };
  };

  const onEach = (f, layer) => {
    const p = f.properties;
    layer.bindTooltip(
      `Score: ${p.score.toFixed(1)}<br>Competitors: ${p.competitor_density}<br>POIs: ${p.poi_density}`
    );
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "10px 16px", background: "#222", color: "#fff", fontFamily: "sans-serif" }}>
        <b>Geovista</b> - business location suitability
        <span style={{ float: "right", fontSize: 13 }}>
          <span style={{ color: "#2ecc71" }}>■</span> high &nbsp;
          <span style={{ color: "#f1c40f" }}>■</span> medium &nbsp;
          <span style={{ color: "#e74c3c" }}>■</span> low
        </span>
      </div>
      {error && <div style={{ padding: 12, color: "crimson" }}>Could not load data: {error}. Is the backend running?</div>}
      {!data && !error && <div style={{ padding: 12 }}>Loading...</div>}
      <MapContainer center={[24.93, 67.09]} zoom={14} style={{ flex: 1 }}>
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
          attribution="Esri World Street Map"
        />
        {data && <GeoJSON data={data} style={style} onEachFeature={onEach} />}
      </MapContainer>
    </div>
  );
}