"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { rankListings } from "../lib/affinity";

const SRC_LABEL = { castrorosero: "Castro Rosero", luciaprada: "Lucía Prada", vopropiedadraiz: "VO Propiedad", administrabienes: "Administra B.", propio: "Inventario propio" };
const LBL = { tipo: "Tipo", precio: "Precio", ubicacion: "Ubicación", habitaciones: "Habitaciones", banos: "Baños", estrato: "Estrato", area: "Área" };
const CRIT_DEFS = [
  { k: "tipo", label: "Tipo de propiedad", kind: "select", src: "types" },
  { k: "precio", label: "Precio máximo", kind: "number", ph: "ej. 300000000" },
  { k: "ubicacion", label: "Ubicación", kind: "select", src: "cities" },
  { k: "habitaciones", label: "Habitaciones (mín.)", kind: "number", ph: "ej. 3" },
  { k: "banos", label: "Baños (mín.)", kind: "number", ph: "ej. 2" },
  { k: "estrato", label: "Estrato", kind: "select", src: "estratos" },
  { k: "area", label: "Área m² (mín.)", kind: "number", ph: "ej. 70" },
  { k: "amenidades", label: "Amenidades", kind: "disabled", hint: "Requiere enriquecimiento (Fase 2)" },
];
const fmt = (n) => (n == null ? "—" : "$" + Number(n).toLocaleString("es-CO"));
const cap = (s) => (s ? String(s).replace(/-/g, " ") : "");

export default function Home() {
  const [listings, setListings] = useState([]);
  const [weights, setWeights] = useState({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [biz, setBiz] = useState("venta");
  const [crit, setCrit] = useState({
    tipo: { v: "apartamento", db: false }, precio: { v: "", db: false }, ubicacion: { v: "manizales", db: false },
    habitaciones: { v: "", db: false }, banos: { v: "", db: false }, estrato: { v: "", db: false },
    area: { v: "", db: false }, amenidades: { v: "", db: false },
  });

  useEffect(() => {
    (async () => {
      const [l, w] = await Promise.all([
        supabase.from("listings").select("*").eq("is_active", true).limit(2000),
        supabase.from("affinity_weights").select("criterio,peso"),
      ]);
      if (l.error) { setErr(l.error.message); setLoading(false); return; }
      setListings(l.data || []);
      const wobj = {}; (w.data || []).forEach((r) => (wobj[r.criterio] = r.peso));
      setWeights(wobj);
      setLoading(false);
    })();
  }, []);

  const types = useMemo(() => [...new Set(listings.map((d) => d.property_type).filter(Boolean))].sort(), [listings]);
  const cities = useMemo(() => [...new Set(listings.map((d) => d.city).filter(Boolean))].sort(), [listings]);
  const estratos = ["1", "2", "3", "4", "5", "6"];
  const opts = { types, cities, estratos };

  const { shown, excluded } = useMemo(() => {
    const pool = listings.filter((d) => d.business_type === biz);
    return rankListings(pool, crit, weights);
  }, [listings, crit, biz, weights]);

  const setV = (k, v) => setCrit((c) => ({ ...c, [k]: { ...c[k], v } }));
  const setDb = (k, db) => setCrit((c) => ({ ...c, [k]: { ...c[k], db } }));
  const sources = [...new Set(listings.map((d) => d.source))];

  return (
    <>
      <header className="header"><div className="bar">
        <span className="logo"><span className="mk" />Real<b>Tinder</b></span>
        <span className="spacer" />
        <span className="count"><b>{sources.length}</b> fuentes · <b>{listings.length}</b> inmuebles</span>
      </div></header>

      <div className="wrap"><div className="layout">
        <aside className="panel sticky">
          <div className="phead"><h2>Criterios del cliente</h2><p>Ajusta y el match se recalcula al instante</p></div>
          <div className="seg">
            {["venta", "arriendo"].map((b) => (
              <button key={b} className={biz === b ? "on" : ""} onClick={() => setBiz(b)}>{b === "venta" ? "Venta" : "Arriendo"}</button>
            ))}
          </div>
          <div className="crits">
            {CRIT_DEFS.map((d) => {
              const c = crit[d.k];
              return (
                <div key={d.k} className={"crit" + (d.kind === "disabled" ? " dis" : "")}>
                  <div className="top">
                    <label>{d.label}</label>
                    <span className="wt">peso {weights[d.k] ?? "—"}</span>
                    <span className="grow" />
                    {d.kind !== "disabled" && (
                      <label className={"db-tog" + (c.db ? " act" : "")}>
                        <input type="checkbox" checked={c.db} onChange={(e) => setDb(d.k, e.target.checked)} />obligatorio
                      </label>
                    )}
                  </div>
                  {d.kind === "select" && (
                    <select value={c.v} onChange={(e) => setV(d.k, e.target.value)}>
                      <option value="">Cualquiera</option>
                      {opts[d.src].map((o) => <option key={o} value={o}>{cap(o)}</option>)}
                    </select>
                  )}
                  {d.kind === "number" && <input type="number" value={c.v} placeholder={d.ph} onChange={(e) => setV(d.k, e.target.value)} />}
                  {d.kind === "disabled" && <div className="hint">{d.hint}</div>}
                </div>
              );
            })}
          </div>
        </aside>

        <main>
          {loading ? (
            <div className="empty">Cargando inventario en vivo…</div>
          ) : err ? (
            <div className="empty">Error leyendo Supabase: {err}</div>
          ) : (
            <>
              <div className="rhead">
                <h2>{shown.length} propiedades</h2>
                <span className="sub">ordenadas por afinidad · {biz}{excluded.length ? ` · ${excluded.length} excluidas por deal breaker` : ""}</span>
              </div>
              <div className="grid">
                {shown.length ? shown.map((s) => <Card key={s.it.dedupe_key} s={s} />)
                  : <div className="empty">Ningún inmueble de esta operación cumple los criterios activos.</div>}
              </div>
            </>
          )}
        </main>
      </div></div>
    </>
  );
}

function Card({ s }) {
  const it = s.it;
  const cls = s.pct >= 85 ? "hi" : s.pct >= 60 ? "mid" : "lo";
  const loc = [it.neighborhood, it.city].filter(Boolean).map(cap).join(", ") || "—";
  return (
    <article className="card">
      <div className="thumb">
        {it.image_url ? <img src={it.image_url} alt="" loading="lazy" /> : null}
        <span className="srcbadge">{SRC_LABEL[it.source] || it.source}</span>
        {it.estrato ? <span className="estbadge">Estrato {it.estrato}</span> : null}
        <div className={"matchband " + cls}>
          <span>{s.pct}% MATCH</span>{s.penalPts > 0 ? <span className="pen">−{s.penalPts}%</span> : null}
        </div>
      </div>
      <div className="cbody">
        <span className="ptype">{cap(it.property_type) || "inmueble"}</span>
        <span className="price tnum">{fmt(it.price_cop)} <small>{it.business_type === "arriendo" ? "/mes" : "COP"}</small></span>
        <span className="loc">📍 {loc}</span>
        <div className="feats tnum"><span>🛏 {it.beds ?? "—"}</span><span>🚿 {it.baths ?? "—"}</span><span>📐 {it.area_m2 ? it.area_m2 + " m²" : "—"}</span></div>
        <span className="ctitle">{it.title ? it.title.slice(0, 68) : ""}</span>
        {it.url ? <span className="clink"><a href={it.url} target="_blank" rel="noopener noreferrer">Ver original ↗</a></span>
          : <span className="clink" style={{ color: "var(--faint)" }}>Inventario propio</span>}
      </div>
    </article>
  );
}
