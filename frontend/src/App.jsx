import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, GeoJSON, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const API = "http://127.0.0.1:8000";

const VERSIONS = {
  v0: { label: "v0: POIs vs competitors", short: "v0 baseline", cells: "/cells", report: "/report", max: 60 },
  v2: { label: "v2: demand vs saturation", short: "v2 improved", cells: "/v2/cells", report: "/v2/report", max: 100 },
};

const BASES = {
  light: {
    label: "Light",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    attr: "Esri, HERE, Garmin",
    native: 16,
  },
  street: {
    label: "Street",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
    attr: "Esri World Street Map",
    subdomains: "abc",
  },
  sat: {
    label: "Satellite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attr: "Esri World Imagery",
    subdomains: "abc",
  },
};

const BAND = {
  High: { color: "#2f9e6b", bg: "#dff3e8", fg: "#1d6b45" },
  Medium: { color: "#e9b53f", bg: "#fbf0cf", fg: "#7a5a0c" },
  Low: { color: "#d9534f", bg: "#fadcdb", fg: "#8f2a27" },
};

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap');
.gv { --ink:#14262b; --ink-2:#4a5d62; --ink-3:#7a8b8f; --line:#dde5e6; --bg:#f3f6f6; --accent:#0e6b66; --accent-soft:#e0f0ee;
  height:100%; display:flex; flex-direction:column; font-family:'DM Sans',system-ui,-apple-system,'Segoe UI',sans-serif; color:var(--ink); }
.gv * { box-sizing:border-box; }
.gv button { font-family:inherit; }
.gv :focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
.gv-head { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:10px 16px; background:var(--ink); color:#fff; }
.gv-title { font-size:17px; font-weight:700; letter-spacing:0.2px; }
.gv-sub { font-size:12.5px; color:#a9bcc0; margin-left:10px; }
.gv-seg { display:flex; background:var(--bg); border:1px solid var(--line); border-radius:8px; padding:2px; gap:2px; }
.gv-seg button { flex:1; border:0; background:transparent; padding:7px 10px; border-radius:6px; font-size:13px; font-weight:500; color:var(--ink-2); cursor:pointer; transition:background .15s,color .15s; }
.gv-seg button:hover { color:var(--ink); }
.gv-seg button[aria-pressed="true"] { background:#fff; color:var(--accent); font-weight:700; box-shadow:0 0 0 1px var(--line); }
.gv-head .gv-seg { background:#1f373d; border-color:#2c4950; }
.gv-head .gv-seg button { color:#a9bcc0; padding:5px 10px; font-size:12.5px; }
.gv-head .gv-seg button:hover { color:#fff; }
.gv-head .gv-seg button[aria-pressed="true"] { background:#fff; color:var(--ink); box-shadow:none; }
.gv-side { background:var(--bg); padding:12px; overflow-y:auto; display:flex; flex-direction:column; gap:10px; }
.gv-card { background:#fff; border:1px solid var(--line); border-radius:8px; padding:12px; }
.gv-h { font-size:13px; font-weight:700; margin:0 0 8px; }
.gv-muted { font-size:12px; color:var(--ink-3); }
.gv-desc { font-size:12.5px; color:var(--ink-2); margin-top:8px; }
.gv-range { width:100%; accent-color:var(--accent); margin:6px 0 2px; }
.gv-btn { display:block; text-align:center; padding:10px 0; background:var(--accent); color:#fff; border-radius:8px; text-decoration:none; font-size:14px; font-weight:500; transition:background .15s; }
.gv-btn:hover { background:#0a5753; }
.gv-legend { display:flex; align-items:center; gap:14px; font-size:12.5px; flex-wrap:wrap; }
.gv-dot { display:inline-block; width:11px; height:11px; border-radius:3px; margin-right:5px; vertical-align:-1px; }
.gv-list { display:flex; flex-direction:column; }
.gv-lh, .gv-row { display:grid; grid-template-columns:26px 1fr 42px 42px; gap:8px; align-items:center; }
.gv-lh { font-size:11.5px; color:var(--ink-3); padding:0 8px 4px; border-bottom:1px solid var(--line); }
.gv-row { width:100%; text-align:left; border:0; background:transparent; padding:6px 8px; border-radius:6px; cursor:pointer; font-size:13px; color:var(--ink); transition:background .12s; }
.gv-row:hover { background:var(--bg); }
.gv-row[aria-current="true"] { background:var(--accent-soft); }
.gv-rank { font-weight:700; color:var(--ink-2); }
.gv-sc { display:flex; align-items:center; gap:8px; font-variant-numeric:tabular-nums; }
.gv-sc b { min-width:34px; font-weight:700; }
.gv-bar { flex:1; height:6px; background:var(--line); border-radius:3px; overflow:hidden; }
.gv-bar i { display:block; height:100%; border-radius:3px; }
.gv-num { font-variant-numeric:tabular-nums; color:var(--ink-2); text-align:right; }
.gv-err { background:#fdecec; border:1px solid #f3c1c0; color:#8f2a27; border-radius:8px; padding:12px; font-size:13px; }
.gv-err button { margin-top:8px; border:1px solid #d9534f; background:#fff; color:#8f2a27; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:13px; }
.gv-spin { width:16px; height:16px; border:3px solid var(--line); border-top-color:var(--accent); border-radius:50%; animation:gvspin .8s linear infinite; }
@keyframes gvspin { to { transform:rotate(360deg); } }
.gv-panel { position:absolute; z-index:1000; background:#fff; border-radius:10px; padding:14px; overflow-y:auto; box-shadow:0 6px 24px rgba(20,38,43,.28); animation:gvin .18s ease-out; }
@keyframes gvin { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:none; } }
.gv-ph { display:flex; justify-content:space-between; align-items:center; font-size:13px; font-weight:700; }
.gv-x { border:0; background:transparent; font-size:16px; line-height:1; cursor:pointer; color:var(--ink-3); padding:4px 6px; border-radius:6px; }
.gv-x:hover { background:var(--bg); color:var(--ink); }
.gv-big { font-size:38px; font-weight:700; line-height:1.1; margin:8px 0 6px; font-variant-numeric:tabular-nums; }
.gv-big span { font-size:14px; font-weight:400; color:var(--ink-3); margin-left:4px; }
.gv-pill { display:inline-block; font-size:12px; font-weight:700; padding:2px 10px; border-radius:999px; }
.gv-gauge { height:8px; background:var(--line); border-radius:4px; margin:10px 0 12px; overflow:hidden; }
.gv-gauge i { display:block; height:100%; border-radius:4px; transition:width .35s ease; }
.gv-kv { display:grid; grid-template-columns:1fr auto; gap:5px 12px; font-size:13px; }
.gv-kv dt { color:var(--ink-2); }
.gv-kv dd { margin:0; font-weight:700; text-align:right; font-variant-numeric:tabular-nums; }
.gv-note { font-size:12px; color:var(--ink-3); margin-top:12px; line-height:1.45; }
.leaflet-tooltip { font-family:'DM Sans',system-ui,sans-serif; font-size:12.5px; border-radius:6px; }
@media (prefers-reduced-motion: reduce) { .gv-panel, .gv-gauge i, .gv-spin { animation:none; transition:none; } }
`;

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

export default function App() {
  const [version, setVersion] = useState("v2");
  const [base, setBase] = useState("light");
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [minScore, setMinScore] = useState(0);
  const [selected, setSelected] = useState(null);
  const [target, setTarget] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  const geoRef = useRef(null);
  const hiRef = useRef(null);

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);

  useEffect(() => {
    setData(null);
    setError(null);
    setSelected(null);
    setTarget(null);
    setMinScore(0);
    hiRef.current = null;
    fetch(`${API}${VERSIONS[version].cells}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((g) => setData(normalise(version, g)))
      .catch((e) => setError(e.message));
  }, [version, reloadKey]);

  useEffect(() => {
    hiRef.current = null;
  }, [minScore]);

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

  const shown = useMemo(() => scores.filter((s) => s >= minScore).length, [scores, minScore]);

  const bandOf = (v) => (v > cuts[1] ? "High" : v > cuts[0] ? "Medium" : "Low");

  const style = (f) => {
    const v = f.properties._score;
    if (v < minScore) return { fillOpacity: 0, opacity: 0 };
    return { fillColor: BAND[bandOf(v)].color, color: "#888", weight: 0.3, fillOpacity: 0.55 };
  };

  const highlight = (layer) => {
    if (hiRef.current && geoRef.current) geoRef.current.resetStyle(hiRef.current);
    hiRef.current = layer;
    if (layer) {
      layer.setStyle({ color: "#14262b", weight: 2.5, opacity: 1, fillOpacity: 0.75 });
      layer.bringToFront();
    }
  };

  const onEach = (f, layer) => {
    const p = f.properties;
    let tip = `<b>Score ${p._score.toFixed(1)}</b><br>Competitors: ${p._comp}<br>POIs: ${p._poi}`;
    if (version === "v2") tip += `<br>Saturation: ${Number(p.saturation).toFixed(3)}`;
    layer.bindTooltip(tip, { sticky: true });
    layer.on("click", () => {
      const rank = scores.filter((s) => s > p._score).length + 1;
      highlight(layer);
      setSelected({ ...p, rank, total: scores.length });
    });
  };

  const goTo = (f, i) => {
    const c = L.geoJSON(f).getBounds().getCenter();
    setTarget({ center: [c.lat, c.lng] });
    let found = null;
    if (geoRef.current) {
      geoRef.current.eachLayer((l) => {
        if (l.feature === f) found = l;
      });
    }
    highlight(found);
    setSelected({ ...f.properties, rank: i + 1, total: scores.length });
  };

  const closePanel = () => {
    highlight(null);
    setSelected(null);
  };

  const band = selected ? bandOf(selected._score) : null;
  const b = BASES[base];

  const panelPos = isMobile
    ? { left: 8, right: 8, bottom: 8, maxHeight: "55%" }
    : { top: 12, right: 12, width: 270 };

  return (
    <div className="gv">
      <style>{CSS}</style>

      <header className="gv-head">
        <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap" }}>
          <span className="gv-title">Geovista</span>
          {!isMobile && <span className="gv-sub">Business location suitability, Gulshan-e-Iqbal, Karachi</span>}
        </div>
        <div className="gv-seg" role="group" aria-label="Map style">
          {Object.entries(BASES).map(([k, v]) => (
            <button key={k} aria-pressed={base === k} onClick={() => setBase(k)}>{v.label}</button>
          ))}
        </div>
      </header>

      <div style={{ flex: 1, display: "flex", flexDirection: isMobile ? "column" : "row", minHeight: 0 }}>
        <aside
          className="gv-side"
          style={{ width: isMobile ? "100%" : 340, maxHeight: isMobile ? "45%" : "none", flexShrink: 0 }}
        >
          <section className="gv-card">
            <h2 className="gv-h">Scoring version</h2>
            <div className="gv-seg" role="group" aria-label="Scoring version">
              {Object.entries(VERSIONS).map(([k, v]) => (
                <button key={k} aria-pressed={version === k} onClick={() => setVersion(k)}>{v.short}</button>
              ))}
            </div>
            <div className="gv-desc">{VERSIONS[version].label}</div>
          </section>

          <section className="gv-card">
            <h2 className="gv-h">Hide cells scoring below <span style={{ color: "var(--accent)" }}>{minScore}</span></h2>
            <input
              className="gv-range"
              type="range" min="0" max={VERSIONS[version].max} step="5" value={minScore}
              aria-label="Minimum score"
              onChange={(e) => setMinScore(Number(e.target.value))}
            />
            <div className="gv-muted">
              {data ? `${shown} of ${scores.length} cells shown` : "Waiting for data"}
            </div>
          </section>

          <section className="gv-card">
            <div className="gv-legend">
              {["High", "Medium", "Low"].map((k) => (
                <span key={k}><i className="gv-dot" style={{ background: BAND[k].color }} />{k}</span>
              ))}
            </div>
            <div className="gv-muted" style={{ marginTop: 6 }}>Colours are relative to this area.</div>
          </section>

          <a className="gv-btn" href={`${API}${VERSIONS[version].report}?n=10`}>
            Download report (PDF)
          </a>

          {error && (
            <div className="gv-err" role="alert">
              Could not load data ({error}). Check that the backend is running, then try again.
              <br />
              <button onClick={() => setReloadKey((k) => k + 1)}>Try again</button>
            </div>
          )}

          {!data && !error && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
              <div className="gv-spin" />
              Loading map data...
            </div>
          )}

          {data && (
            <section className="gv-card">
              <h2 className="gv-h">Top 20 locations</h2>
              <div className="gv-list">
                <div className="gv-lh">
                  <span>#</span><span>Score</span><span style={{ textAlign: "right" }}>Comp.</span><span style={{ textAlign: "right" }}>POIs</span>
                </div>
                {top20.map((f, i) => {
                  const p = f.properties;
                  const active = !!selected && selected.rank === i + 1 && selected._score === p._score;
                  return (
                    <button key={i} className="gv-row" aria-current={active} onClick={() => goTo(f, i)}>
                      <span className="gv-rank">{i + 1}</span>
                      <span className="gv-sc">
                        <b>{p._score.toFixed(1)}</b>
                        <span className="gv-bar"><i style={{ width: `${Math.min(100, p._score)}%`, background: BAND[bandOf(p._score)].color }} /></span>
                      </span>
                      <span className="gv-num">{p._comp}</span>
                      <span className="gv-num">{p._poi}</span>
                    </button>
                  );
                })}
              </div>
              <div className="gv-muted" style={{ marginTop: 8 }}>Select a row to zoom the map to that cell.</div>
            </section>
          )}
        </aside>

        <div style={{ flex: 1, position: "relative", minHeight: isMobile ? 280 : 0 }}>
          <MapContainer center={[24.93, 67.09]} zoom={14} style={{ height: "100%" }}>
            <TileLayer key={base} url={b.url} attribution={b.attr} maxNativeZoom={b.native || 19} maxZoom={19} />
            {data && <FitBounds data={data} />}
            <FlyTo target={target} />
            {data && (
              <GeoJSON
                ref={geoRef}
                key={`${version}-${minScore}`}
                data={data}
                style={style}
                onEachFeature={onEach}
              />
            )}
          </MapContainer>

          {selected && (
            <div className="gv-panel" style={panelPos} role="dialog" aria-label="Selected location details">
              <div className="gv-ph">
                <span>Selected location ({version})</span>
                <button className="gv-x" onClick={closePanel} aria-label="Close details">✕</button>
              </div>
              <div className="gv-big">
                {selected._score.toFixed(1)}<span>/ 100</span>
              </div>
              <span className="gv-pill" style={{ background: BAND[band].bg, color: BAND[band].fg }}>
                {band} (relative to this area)
              </span>
              <div className="gv-gauge">
                <i style={{ width: `${Math.min(100, selected._score)}%`, background: BAND[band].color }} />
              </div>
              <dl className="gv-kv">
                <dt>Rank</dt>
                <dd>{selected.rank} of {selected.total}</dd>
                <dt>Competitors within 500 m</dt>
                <dd>{selected._comp}</dd>
                <dt>{version === "v2" ? "Non-competitor POIs" : "POIs"} within 500 m</dt>
                <dd>{selected._poi}</dd>
                {version === "v2" && (
                  <>
                    <dt>Saturation (competitors per POI)</dt>
                    <dd>{Number(selected.saturation).toFixed(3)}</dd>
                  </>
                )}
              </dl>
              {!isMobile && (
                <div className="gv-note">
                  {version === "v2"
                    ? "Score v2 = 50% demand (log of POIs) + 50% (1 - saturation), normalised. Only cells with at least 5 non-competitor POIs are scored."
                    : "Score v0 = 60% POI density + 40% (1 - competitor density), normalised."}{" "}
                  It is decision support, not a guarantee of success.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}