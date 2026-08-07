"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase, configError, explainError } from "../lib/supabaseClient";
import { rankListings } from "../lib/affinity";
import { useSession } from "../lib/useSession";

const SRC_LABEL = { castrorosero: "Castro Rosero", luciaprada: "Lucía Prada", vopropiedadraiz: "VO Propiedad", administrabienes: "Administra B.", propio: "Inventario propio" };
const LBL = { tipo: "Tipo", precio: "Precio", ubicacion: "Ubicación", barrio: "Barrio", habitaciones: "Habitaciones", banos: "Baños", estrato: "Estrato", area: "Área" };
const CRIT_DEFS = [
  { k: "tipo", label: "Tipo de propiedad", kind: "select", src: "types" },
  { k: "precio", label: "Precio máximo", kind: "number", ph: "ej. 300000000" },
  { k: "ubicacion", label: "Ubicación (ciudad)", kind: "select", src: "cities" },
  { k: "barrio", label: "Barrio", kind: "select", src: "barrios" },
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
    tipo: { v: "apartamento", db: false }, precio: { v: "", db: false }, ubicacion: { v: "manizales", db: false }, barrio: { v: "", db: false },
    habitaciones: { v: "", db: false }, banos: { v: "", db: false }, estrato: { v: "", db: false },
    area: { v: "", db: false }, amenidades: { v: "", db: false },
  });
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ nombre: "", apellido: "", celular: "", email: "" });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  // En móvil los criterios viven en una hoja inferior que se abre bajo demanda:
  // ocupaban toda la primera pantalla y empujaban los resultados fuera de vista.
  // En escritorio el panel está siempre visible y este estado no se usa.
  const [filtros, setFiltros] = useState(false);
  const session = useSession();

  // Con la hoja abierta, el scroll del fondo "atraviesa" y mueve el listado.
  useEffect(() => {
    if (!filtros) return;
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previo; };
  }, [filtros]);

  useEffect(() => {
    (async () => {
      if (configError) { setErr(explainError(null)); setLoading(false); return; }
      try {
        const [l, w] = await Promise.all([
          supabase.from("listings").select("*").eq("is_active", true).limit(2000),
          supabase.from("affinity_weights").select("criterio,peso"),
        ]);
        // Cualquiera de las dos que falle es un fallo real: sin pesos la
        // afinidad se calcula contra {} y todo sale "peso —" con 0% de match,
        // en silencio. Antes solo se revisaba l.error.
        const bad = l.error || w.error;
        if (bad) { setErr(explainError(bad)); setLoading(false); return; }
        setListings(l.data || []);
        const wobj = {}; (w.data || []).forEach((r) => (wobj[r.criterio] = r.peso));
        setWeights(wobj);
      } catch (e) {
        setErr(explainError(e));
      }
      setLoading(false);
    })();
  }, []);

  const types = useMemo(() => [...new Set(listings.map((d) => d.property_type).filter(Boolean))].sort(), [listings]);
  const cities = useMemo(() => [...new Set(listings.map((d) => d.city).filter(Boolean))].sort(), [listings]);
  const barrios = useMemo(() => [...new Set(listings.map((d) => d.neighborhood).filter(Boolean))].sort(), [listings]);
  const opts = { types, cities, barrios, estratos: ["1", "2", "3", "4", "5", "6"] };

  const { shown, excluded } = useMemo(() => rankListings(listings.filter((d) => d.business_type === biz), crit, weights), [listings, crit, biz, weights]);
  const setV = (k, v) => setCrit((c) => ({ ...c, [k]: { ...c[k], v } }));
  const setDb = (k, db) => setCrit((c) => ({ ...c, [k]: { ...c[k], db } }));
  const sources = [...new Set(listings.map((d) => d.source))];

  const activeChips = () => {
    const out = [<span key="_b" className="chip">{biz === "venta" ? "Venta" : "Arriendo"}</span>];
    for (const k of Object.keys(weights)) {
      const c = crit[k]; if (!c || c.v === "") continue;
      const t = k === "precio" ? `Precio ≤ ${fmt(+c.v)}` : k === "area" ? `Área ≥ ${c.v} m²` : k === "estrato" ? `Estrato ${c.v}` : (k === "habitaciones" || k === "banos") ? `${LBL[k]} ≥ ${c.v}` : `${LBL[k]}: ${cap(c.v)}`;
      out.push(<span key={k} className={"chip" + (c.db ? " db" : "")}>{t}{c.db ? " •obligatorio" : ""}</span>);
    }
    return out;
  };

  const showToast = (m) => { setToast(m); setTimeout(() => setToast(""), 2800); };
  const openModal = () => { if (!session) { showToast("Inicia sesión para guardar contactos"); return; } setModal(true); };
  const saveContact = async () => {
    if (!form.nombre.trim() || !form.celular.trim()) { showToast("Nombre y celular son obligatorios"); return; }
    setSaving(true);
    // owner se llena solo con auth.uid() (default + RLS) al escribir con la sesión.
    const { data: c, error } = await supabase.from("contacts")
      .insert({ nombre: form.nombre.trim(), apellido: form.apellido || null, celular: form.celular || null, email: form.email || null })
      .select().single();
    if (!error && c) await supabase.from("saved_searches").insert({ contact_id: c.id, business_type: biz, criteria: crit });
    setSaving(false);
    if (error) { showToast("Error: " + explainError(error)); return; }
    setModal(false); setForm({ nombre: "", apellido: "", celular: "", email: "" });
    showToast(`Contacto "${form.nombre}" guardado con sus criterios`);
  };

  // Cuántos criterios están puestos: se muestra en el botón flotante para que
  // en móvil se sepa que hay filtros activos sin abrir la hoja.
  const nActivos = Object.values(crit).filter((c) => c && c.v !== "").length;

  return (
    <div className="wrap"><div className="layout">
      {filtros && <div className="filters-back" onClick={() => setFiltros(false)} />}
      <aside className={"panel sticky filters" + (filtros ? " open" : "")}>
        <span className="drawer-grip" onClick={() => setFiltros(false)} />
        <div className="phead"><h2>Criterios del cliente</h2><p>Ajusta y el match se recalcula al instante</p></div>
        <div className="seg">{["venta", "arriendo"].map((b) => <button key={b} className={biz === b ? "on" : ""} onClick={() => setBiz(b)}>{b === "venta" ? "Venta" : "Arriendo"}</button>)}</div>
        <div className="crits">
          {CRIT_DEFS.map((d) => {
            const c = crit[d.k];
            return (
              <div key={d.k} className={"crit" + (d.kind === "disabled" ? " dis" : "")}>
                <div className="top">
                  <label>{d.label}</label><span className="wt">peso {weights[d.k] ?? "—"}</span><span className="grow" />
                  {d.kind !== "disabled" && <label className={"db-tog" + (c.db ? " act" : "")}><input type="checkbox" checked={c.db} onChange={(e) => setDb(d.k, e.target.checked)} />obligatorio</label>}
                </div>
                {d.kind === "select" && <select value={c.v} onChange={(e) => setV(d.k, e.target.value)}><option value="">Cualquiera</option>{opts[d.src].map((o) => <option key={o} value={o}>{cap(o)}</option>)}</select>}
                {d.kind === "number" && <input type="number" value={c.v} placeholder={d.ph} onChange={(e) => setV(d.k, e.target.value)} />}
                {d.kind === "disabled" && <div className="hint">{d.hint}</div>}
              </div>
            );
          })}
        </div>
        <div className="pfoot">
          <button className="btn" onClick={openModal}>Guardar y asociar a contacto</button>
          {/* Solo en móvil: cierra la hoja y devuelve al listado ya filtrado. */}
          <button className="btn ghost drawer-close" style={{ marginTop: "var(--sp-2)" }} onClick={() => setFiltros(false)}>
            Ver {shown.length} {shown.length === 1 ? "propiedad" : "propiedades"}
          </button>
          <p className="note">{session ? "Crea un contacto con estos criterios y sus deal breakers — se guarda en tu cuenta." : "Inicia sesión para guardar contactos con sus criterios."}</p>
        </div>
      </aside>

      <main>
        {loading ? <div className="empty">Cargando inventario en vivo…</div>
          : err ? <div className="empty">No se pudo cargar el inventario.<br />{err}</div>
          : <>
              <div className="rhead"><h2>{shown.length} propiedades</h2><span className="sub">ordenadas por afinidad · {biz}{excluded.length ? ` · ${excluded.length} excluidas por deal breaker` : ""} · {sources.length} fuentes</span></div>
              <div className="grid">{shown.length ? shown.map((s) => <Card key={s.it.dedupe_key} s={s} />) : <div className="empty">Ningún inmueble de esta operación cumple los criterios activos.</div>}</div>
            </>}
      </main>

      {modal && (
        <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) setModal(false); }}>
          <div className="modal">
            <div className="mhead"><h3>Guardar y asociar a nuevo contacto</h3><button className="mclose" onClick={() => setModal(false)}>×</button></div>
            <div className="mbody">
              <div className="frow">
                <div className="fld"><label>Nombre <span style={{ color: "var(--db)" }}>*</span></label><input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Ej. Juan" /></div>
                <div className="fld"><label>Apellido</label><input value={form.apellido} onChange={(e) => setForm({ ...form, apellido: e.target.value })} placeholder="Ej. Pérez" /></div>
              </div>
              <div className="frow">
                <div className="fld"><label>Celular <span style={{ color: "var(--db)" }}>*</span></label><input value={form.celular} onChange={(e) => setForm({ ...form, celular: e.target.value })} placeholder="Ej. 3001234567" /></div>
                <div className="fld"><label>Email</label><input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Ej. juan@mail.com" /></div>
              </div>
              <div className="critsum"><div className="t">Criterios que se asociarán</div><div className="chips">{activeChips()}</div></div>
            </div>
            <div className="mfoot"><button className="btn ghost" onClick={() => setModal(false)}>Cancelar</button><button className="btn" disabled={saving} onClick={saveContact}>{saving ? "Guardando…" : "Guardar contacto"}</button></div>
          </div>
        </div>
      )}
      {/* Solo visible en móvil (CSS). Se oculta con la hoja abierta para no
          quedar flotando encima de ella. */}
      {!filtros && !loading && !err && (
        <button className="fab-filters" onClick={() => setFiltros(true)} aria-label="Abrir criterios de búsqueda">
          Filtros{nActivos > 0 && <span className="n">{nActivos}</span>}
        </button>
      )}

      {toast && <div className="toast show">{toast}</div>}
    </div></div>
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
        <div className={"matchband " + cls}><span>{s.pct}% MATCH</span>{s.penalPts > 0 ? <span className="pen">−{s.penalPts}%</span> : null}</div>
      </div>
      <div className="cbody">
        <span className="ptype">{cap(it.property_type) || "inmueble"}</span>
        <span className="price tnum">{fmt(it.price_cop)} <small>{it.business_type === "arriendo" ? "/mes" : "COP"}</small></span>
        <span className="loc">📍 {loc}</span>
        <div className="feats tnum"><span>🛏 {it.beds ?? "—"}</span><span>🚿 {it.baths ?? "—"}</span><span>📐 {it.area_m2 ? it.area_m2 + " m²" : "—"}</span></div>
        <span className="ctitle">{it.title ? it.title.slice(0, 68) : ""}</span>
        {it.url ? <span className="clink"><a href={it.url} target="_blank" rel="noopener noreferrer">Ver original ↗</a></span> : <span className="clink" style={{ color: "var(--faint)" }}>Inventario propio</span>}
      </div>
    </article>
  );
}
