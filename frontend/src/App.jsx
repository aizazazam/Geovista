import { useCallback, useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, GeoJSON, Pane, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const VERSIONS = {
  v0: { label: "v0: POIs vs competitors", short: "v0 baseline", cells: "/cells", report: "/report", max: 60 },
  v2: { label: "v2: demand vs saturation", short: "v2 improved", cells: "/v2/cells", report: "/v2/report", max: 100 },
};

const BASES = {
  light: {
    label: "Light",
    labels: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    attr: "Esri, HERE, Garmin",
    native: 16,
  },
  dark: {
    label: "Dark",
    labels: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    attr: "Esri, HERE, Garmin",
    native: 16,
  },
  street: {
    label: "Street",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
    attr: "Esri World Street Map",
    subdomains: "abc",
  },
  osm: {
    label: "Detailed",
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attr: "&copy; OpenStreetMap contributors",
    native: 19,
  },
  sat: {
    label: "Satellite",
    labels: "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attr: "Esri World Imagery",
    subdomains: "abc",
  },
};

const PALETTES = {
  classic: {
    label: "Classic",
    bands: ["#e74c3c", "#f1c40f", "#2ecc71"],
    accent: { light: "#1f8f55", dark: "#4cd08a" },
  },
  teal: {
    label: "Teal",
    light: ["#d5f5ee", "#7fd8c8", "#2fb5a3", "#0f8a7e", "#0a5c55"],
    dark: ["#0f3d3a", "#14665f", "#1f9e92", "#3ed1bf", "#9ff5e8"],
    accent: { light: "#0f766e", dark: "#4fd1c5" },
  },
  blue: {
    label: "Blue",
    light: ["#dbeafe", "#93c5fd", "#3b82f6", "#1d4ed8", "#1e3a8a"],
    dark: ["#16264d", "#1e40af", "#3b82f6", "#7cb2ff", "#dbeafe"],
    accent: { light: "#1d4ed8", dark: "#7cb2ff" },
  },
  amber: {
    label: "Amber",
    light: ["#fef3c7", "#fcd34d", "#f59e0b", "#c2410c", "#7c2d12"],
    dark: ["#3b1d0e", "#9a3412", "#ea580c", "#fbbf24", "#fef3c7"],
    accent: { light: "#c2410c", dark: "#fbbf24" },
  },
  violet: {
    label: "Violet",
    light: ["#ede9fe", "#c4b5fd", "#8b5cf6", "#6d28d9", "#3b0764"],
    dark: ["#2a1458", "#5b21b6", "#8b5cf6", "#c4b5fd", "#f5f3ff"],
    accent: { light: "#6d28d9", dark: "#c4b5fd" },
  },
};

function hexA(h, a) {
  const [r, g, b] = [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16));
  return `rgba(${r},${g},${b},${a})`;
}

function makeScale(pal, mapDark) {
  if (pal.bands) {
    const rgbs = pal.bands.map((h) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16)));
    return {
      discrete: true,
      gradient: `linear-gradient(90deg, ${pal.bands[0]} 0 33%, ${pal.bands[1]} 33% 66%, ${pal.bands[2]} 66% 100%)`,
      color(p, alpha) {
        const c = rgbs[p > 0.66 ? 2 : p > 0.33 ? 1 : 0];
        return alpha === undefined ? `rgb(${c[0]},${c[1]},${c[2]})` : `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
      },
    };
  }
  const stops = pal[mapDark ? "dark" : "light"];
  const rgb = stops.map((h) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16)));
  return {
    gradient: `linear-gradient(90deg, ${stops.join(", ")})`,
    color(p, alpha) {
      const x = Math.min(1, Math.max(0, p)) * (rgb.length - 1);
      const i = Math.min(rgb.length - 2, Math.floor(x));
      const f = x - i;
      const c = rgb[i].map((v, k) => Math.round(v + (rgb[i + 1][k] - v) * f));
      return alpha === undefined ? `rgb(${c[0]},${c[1]},${c[2]})` : `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
    },
  };
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap');
.gv { --ink:#14262b; --ink-2:#4a5d62; --ink-3:#7a8b8f; --line:#dde5e6; --bg:#f3f6f6; --accent:#0e6b66; --accent-soft:#e0f0ee; --card:#fff; --head:#14262b; --on-accent:#fff; --accent-hover:#0a5753; --err-bg:#fdecec; --err-line:#f3c1c0; --err-fg:#8f2a27;
  height:100%; background:var(--bg); display:flex; flex-direction:column; font-family:'DM Sans',system-ui,-apple-system,'Segoe UI',sans-serif; color:var(--ink); }
.gv[data-theme="dark"] { color-scheme:dark; --ink:#e6eef0; --ink-2:#a9bcc0; --ink-3:#7d9297; --line:#2b3f45; --bg:#101c20; --accent:#4fd1c5; --accent-soft:#16363a; --card:#17262b; --head:#0a1316; --on-accent:#0a1316; --accent-hover:#7fe0d6; --err-bg:#3a1e1f; --err-line:#6b2f2e; --err-fg:#f3b4b2; }
.gv * { box-sizing:border-box; }
.gv button { font-family:inherit; }
.gv :focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
.gv-head { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:10px 16px; background:var(--head); color:#fff; flex-wrap:wrap; }
.gv-title { font-size:17px; font-weight:700; letter-spacing:0.2px; }
.gv-sub { font-size:12.5px; color:#a9bcc0; margin-left:10px; }
.gv-seg { display:flex; background:var(--bg); border:1px solid var(--line); border-radius:8px; padding:2px; gap:2px; }
.gv-seg button { flex:1; border:0; background:transparent; padding:7px 10px; border-radius:6px; font-size:13px; font-weight:500; color:var(--ink-2); cursor:pointer; transition:background .15s,color .15s; }
.gv-seg button:hover { color:var(--ink); }
.gv-seg button[aria-pressed="true"] { background:var(--card); color:var(--accent); font-weight:700; box-shadow:0 0 0 1px var(--line); }
.gv-head .gv-seg { background:#1f373d; border-color:#2c4950; }
.gv-head .gv-seg button { color:#a9bcc0; padding:5px 10px; font-size:12.5px; }
.gv-head .gv-seg button:hover { color:#fff; }
.gv-head .gv-seg button[aria-pressed="true"] { background:#fff; color:#14262b; box-shadow:none; }
.gv-side { background:var(--bg); padding:12px; overflow-y:auto; display:flex; flex-direction:column; gap:10px; }
.gv-card { background:var(--card); border:1px solid var(--line); border-radius:8px; padding:12px; }
.gv-h { font-size:13px; font-weight:700; margin:0 0 8px; }
.gv-muted { font-size:12px; color:var(--ink-3); }
.gv-desc { font-size:12.5px; color:var(--ink-2); margin-top:8px; }
.gv-range { width:100%; accent-color:var(--accent); margin:6px 0 2px; }
.gv-btn { display:block; text-align:center; padding:10px 0; background:var(--accent); color:var(--on-accent); border-radius:8px; text-decoration:none; font-size:14px; font-weight:500; transition:background .15s; }
.gv-btn:hover { background:color-mix(in srgb, var(--accent) 82%, #000); }
.gv-legend { display:flex; align-items:center; gap:14px; font-size:12.5px; flex-wrap:wrap; }
.gv-grad { height:10px; border-radius:5px; }
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
.gv-err { background:var(--err-bg); border:1px solid var(--err-line); color:var(--err-fg); border-radius:8px; padding:12px; font-size:13px; }
.gv-err button { margin-top:8px; border:1px solid var(--err-fg); background:var(--card); color:var(--err-fg); padding:6px 12px; border-radius:6px; cursor:pointer; font-size:13px; }
.gv-spin { width:16px; height:16px; border:3px solid var(--line); border-top-color:var(--accent); border-radius:50%; animation:gvspin .8s linear infinite; }
@keyframes gvspin { to { transform:rotate(360deg); } }
.gv-panel { position:absolute; z-index:1000; background:var(--card); border-radius:10px; padding:14px; overflow-y:auto; box-shadow:0 6px 24px rgba(20,38,43,.28); animation:gvin .18s ease-out; }
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
.gv-tbtn { border:1px solid #2c4950; background:#1f373d; color:#a9bcc0; padding:5px 12px; border-radius:8px; font-size:12.5px; font-weight:500; cursor:pointer; }
.gv-tbtn:hover { color:#fff; }
.gv[data-theme="dark"] .leaflet-tooltip { background:#17262b; color:#e6eef0; border-color:#2b3f45; }
.gv[data-theme="dark"] .leaflet-tooltip-top:before { border-top-color:#17262b; }
.gv[data-theme="dark"] .leaflet-tooltip-bottom:before { border-bottom-color:#17262b; }
.gv[data-theme="dark"] .leaflet-tooltip-left:before { border-left-color:#17262b; }
.gv[data-theme="dark"] .leaflet-tooltip-right:before { border-right-color:#17262b; }
.gv[data-theme="dark"] .leaflet-bar a { background:#17262b; color:#e6eef0; border-bottom-color:#2b3f45; }
.gv[data-theme="dark"] .leaflet-bar a:hover { background:#1f3339; }
.gv[data-theme="dark"] .leaflet-control-attribution { background:rgba(23,38,43,.85); color:#a9bcc0; }
.gv[data-theme="dark"] .leaflet-control-attribution a { color:#7fd6cf; }
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

function reweight(version, geo, w) {
  if (version !== "v2" || w === 50 || geo.features[0]?.properties?.demand === undefined) return geo;
  const k = w / 100;
  const mx = Math.max(...geo.features.map((f) => Number(f.properties.saturation)));
  return {
    ...geo,
    features: geo.features.map((f) => {
      const p = f.properties;
      const s = 100 * (k * p.demand + (1 - k) * (1 - p.saturation / mx));
      return { ...f, properties: { ...p, _score: s } };
    }),
  };
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
  const [theme, setTheme] = useState(() => {
    try {
      const s = localStorage.getItem("gv-theme");
      if (s === "dark" || s === "light") return s;
    } catch (e) {
      console.warn("Theme storage unavailable");
    }
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  const [base, setBase] = useState(theme === "dark" ? "dark" : "light");
  const [palette, setPalette] = useState(() => {
    try {
      const s = localStorage.getItem("gv-palette");
      if (s && PALETTES[s]) return s;
    } catch (e) {
      console.warn("Palette storage unavailable");
    }
    return "classic";
  });
  const mapDark = base === "dark" || base === "sat";
  const scale = useMemo(() => makeScale(PALETTES[palette], mapDark), [palette, mapDark]);
  const [rawData, setData] = useState(null); const [demandW, setDemandW] = useState(50); const data = useMemo(() => (rawData ? reweight(version, rawData, demandW) : null), [rawData, version, demandW]);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [minScore, setMinScore] = useState(0);
  const [selected, setSelected] = useState(null);
  const [target, setTarget] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

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
    setMinScore(0); setDemandW(50); setMaxComp(null);
    fetch(`${API}${VERSIONS[version].cells}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((g) => setData(normalise(version, g)))
      .catch((e) => setError(e.message));
  }, [version, reloadKey]);

  const scores = useMemo(
    () => (data ? data.features.map((f) => f.properties._score) : []),
    [data]
  );

  const sorted = useMemo(() => [...scores].sort((a, b) => a - b), [scores]);

  const cuts = useMemo(() => {
    if (!data) return null;
    return [sorted[Math.floor(sorted.length * 0.33)], sorted[Math.floor(sorted.length * 0.66)]];
  }, [data, sorted]);

  const pctOf = useCallback(
    (v) => {
      if (sorted.length < 2) return 1;
      let lo = 0;
      let hi = sorted.length;
      while (lo < hi) {
        const m = (lo + hi) >> 1;
        if (sorted[m] < v) lo = m + 1;
        else hi = m;
      }
      return lo / (sorted.length - 1);
    },
    [sorted]
  );

  const top20 = useMemo(() => {
    if (!data) return [];
    return [...data.features]
      .sort((a, b) => b.properties._score - a.properties._score)
      .slice(0, 20);
  }, [data]);

  const [maxComp, setMaxComp] = useState(null); const compMax = useMemo(() => (rawData ? Math.max(...rawData.features.map((f) => Number(f.properties._comp) || 0)) : 0), [rawData]); const shown = useMemo(() => (data ? data.features.filter((f) => f.properties._score >= minScore && (version !== "v2" || f.properties._comp <= (maxComp ?? Infinity))).length : 0), [data, minScore, maxComp, version]);

  const bandOf = (v) => (v > cuts[1] ? "High" : v > cuts[0] ? "Medium" : "Low");

  const style = useCallback(
    (f) => {
      const v = f.properties._score;
      if (v < minScore || (version === "v2" && f.properties._comp > (maxComp ?? Infinity))) return { fillOpacity: 0, opacity: 0 };
      const p = pctOf(v);
      if (scale.discrete) {
        return { fillColor: scale.color(p), color: "#888", weight: 0.3, opacity: 1, fillOpacity: 0.55 };
      }
      return {
        fillColor: scale.color(p),
        color: mapDark ? "#0a1316" : "#ffffff",
        weight: 0.6,
        opacity: 0.5,
        fillOpacity: 0.25 + 0.65 * p,
      };
    },
    [minScore, maxComp, version, pctOf, scale, mapDark]
  );

  const onEach = (f, layer) => {
    const p = f.properties;
    let tip = `<b>Score ${p._score.toFixed(1)}</b><br>Competitors: ${p._comp}<br>POIs: ${p._poi}`;
    if (version === "v2") tip += `<br>Saturation: ${Number(p.saturation).toFixed(3)}`;
    layer.bindTooltip(tip, { sticky: true });
    layer.on("click", () => {
      const rank = scores.filter((s) => s > p._score).length + 1;
      setSelected({ ...p, rank, total: scores.length, feature: f });
    });
  };

  const goTo = (f, i) => {
    const c = L.geoJSON(f).getBounds().getCenter();
    setTarget({ center: [c.lat, c.lng] });
    setSelected({ ...f.properties, rank: i + 1, total: scores.length, feature: f });
  };

  const closePanel = () => setSelected(null);

  const changePalette = (k) => {
    setPalette(k);
    try {
      localStorage.setItem("gv-palette", k);
    } catch (e) {
      console.warn("Palette storage unavailable");
    }
  };

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try {
      localStorage.setItem("gv-theme", next);
    } catch (e) {
      console.warn("Theme storage unavailable");
    }
    if (next === "dark" && base === "light") setBase("dark");
    if (next === "light" && base === "dark") setBase("light");
  };

  const band = selected ? bandOf(selected._score) : null;
  const pctSel = selected ? pctOf(selected._score) : 0;
  const b = BASES[base];
  const acc = PALETTES[palette].accent[theme];
  const rootStyle = { "--accent": acc, "--accent-soft": hexA(acc, theme === "dark" ? 0.2 : 0.12) };

  const panelPos = isMobile
    ? { left: 8, right: 8, bottom: 8, maxHeight: "55%" }
    : { top: 12, right: 12, width: 270 };

  return (
    <div className="gv" data-theme={theme} style={rootStyle}>
      <style>{CSS}</style>

      <header className="gv-head">
        <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap" }}>
          <span className="gv-title">Geovista</span>
          {!isMobile && <span className="gv-sub">Business location suitability, Gulshan-e-Iqbal, Karachi</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div className="gv-seg" role="group" aria-label="Map style">
            {Object.entries(BASES).map(([k, v]) => (
              <button key={k} aria-pressed={base === k} onClick={() => setBase(k)}>{v.label}</button>
            ))}
          </div>
          <button className="gv-tbtn" onClick={toggleTheme} title="Switch colour theme">
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
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
            {version === "v2" && (<div style={{ marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid var(--line)" }}><h2 className="gv-h">Demand weight <span style={{ color: "var(--accent)" }}>{demandW}%</span></h2><input className="gv-range" type="range" min="0" max="100" step="10" value={demandW} aria-label="Demand weight" onChange={(e) => { setDemandW(Number(e.target.value)); setSelected(null); }} /><div className="gv-muted">Saturation weight {100 - demandW}%. At 50% the scores match the PDF report.</div></div>)}{version === "v2" && compMax > 0 && (<div style={{ marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid var(--line)" }}><h2 className="gv-h">Max competitors within 500 m <span style={{ color: "var(--accent)" }}>{maxComp ?? compMax}</span></h2><input className="gv-range" type="range" min="0" max={compMax} step="1" value={maxComp ?? compMax} aria-label="Maximum competitors" onChange={(e) => { const v = Number(e.target.value); setMaxComp(v >= compMax ? null : v); setSelected(null); }} /><div className="gv-muted">Cells with more competitors are hidden from the map.</div></div>)}<h2 className="gv-h">Hide cells scoring below <span style={{ color: "var(--accent)" }}>{minScore}</span></h2>
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
            <div className="gv-grad" style={{ background: scale.gradient }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginTop: 4 }}>
              <span>Lower</span><span>Higher</span>
            </div>
            <div className="gv-muted" style={{ marginTop: 6 }}>Colours are relative to this area.</div>
            <div className="gv-seg" role="group" aria-label="Colour palette" style={{ marginTop: 10 }}>
              {Object.entries(PALETTES).map(([k, v]) => (
                <button key={k} aria-pressed={palette === k} onClick={() => changePalette(k)}>{v.label}</button>
              ))}
            </div>
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
                        <span className="gv-bar"><i style={{ width: `${Math.min(100, p._score)}%`, background: scale.color(pctOf(p._score)) }} /></span>
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
            <Pane name="labels" style={{ zIndex: 450, pointerEvents: "none" }}>
              {b.labels && <TileLayer key={`lbl-${base}`} url={b.labels} maxNativeZoom={16} maxZoom={19} />}
            </Pane>
            {rawData && <FitBounds data={rawData} />}
            <FlyTo target={target} />
            {data && (
              <GeoJSON
                key={`${version}-${minScore}-${demandW}-${maxComp}`}
                data={data}
                style={style}
                onEachFeature={onEach}
              />
            )}
            {data && selected && selected.feature && (
              <GeoJSON
                key={`sel-${version}-${minScore}-${selected.rank}-${selected._score}`}
                data={selected.feature}
                interactive={false}
                style={{ color: mapDark ? "#ffffff" : "#14262b", weight: 2.5, opacity: 1, fill: false }}
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
              <span className="gv-pill" style={{ background: scale.color(pctSel, 0.18), color: "var(--ink)", border: `1px solid ${scale.color(pctSel, 0.7)}` }}>
                {band} (relative to this area)
              </span>
              <div className="gv-gauge">
                <i style={{ width: `${Math.min(100, selected._score)}%`, background: scale.color(pctSel) }} />
              </div>
              <dl className="gv-kv">
                <dt>Rank</dt>
                <dd>{selected.rank} of {selected.total}</dd>{selected.feature && (() => { const c = L.geoJSON(selected.feature).getBounds().getCenter(); return (<><dt>Coordinates</dt><dd>{c.lat.toFixed(5)}, {c.lng.toFixed(5)}</dd><dt>Map</dt><dd><a href={`https://www.google.com/maps?q=${c.lat},${c.lng}`} target="_blank" rel="noreferrer">Open in Google Maps</a></dd></>); })()}
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
                    ? `Score v2 = ${demandW}% demand (log of POIs) + ${100 - demandW}% (1 - saturation), normalised. Only cells with at least 5 non-competitor POIs are scored.`
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