"use client";
import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

const COLS = ["tipo", "negocio", "precio_cop", "habitaciones", "banos", "area_m2", "ciudad", "barrio", "parqueadero", "titulo", "url"];
const fmt = (n) => (n == null ? "—" : "$" + Number(n).toLocaleString("es-CO"));
const cap = (s) => (s ? String(s).replace(/-/g, " ") : "—");
const empty = { tipo: "", negocio: "venta", precio_cop: "", habitaciones: "", banos: "", area_m2: "", ciudad: "", barrio: "", parqueadero: "" };

export default function Inventario() {
  const [rows, setRows] = useState(null);
  const [form, setForm] = useState(empty);
  const [modal, setModal] = useState(false);
  const [toast, setToast] = useState("");
  const fileRef = useRef(null);
  const showToast = (m) => { setToast(m); setTimeout(() => setToast(""), 2800); };

  const load = async () => {
    const { data, error } = await supabase.from("listings").select("*").eq("source", "propio").order("created_at", { ascending: false });
    setRows(error ? [] : data || []);
  };
  useEffect(() => { load(); }, []);

  const downloadTemplate = () => {
    const csv = COLS.join(",") + "\n" + "apartamento,venta,300000000,3,2,72,manizales,palermo,si,Apto ejemplo,https://\n";
    const a = document.createElement("a");
    a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    a.download = "plantilla_inventario_realtinder.csv"; a.click();
    showToast("Plantilla descargada");
  };

  const importCsv = (file) => {
    const rd = new FileReader();
    rd.onload = async () => {
      const lines = String(rd.result).split(/\r?\n/).filter((x) => x.trim());
      if (lines.length < 2) { showToast("CSV vacío"); return; }
      const hdr = lines[0].split(",").map((s) => s.trim().toLowerCase());
      const parsed = lines.slice(1).map((ln) => { const cells = ln.split(","); const o = {}; hdr.forEach((h, i) => (o[h] = (cells[i] || "").trim())); return o; });
      await post(parsed, `${parsed.length} fila(s) del CSV`);
    };
    rd.readAsText(file);
  };

  const post = async (rowsPayload, label) => {
    const res = await fetch("/api/inventory", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows: rowsPayload }) });
    const j = await res.json().catch(() => ({}));
    if (res.ok) { showToast(`${j.inserted} inmueble(s) agregado(s)`); load(); }
    else showToast("Error: " + (j.error || res.status));
  };

  const addOne = async () => {
    if (!form.tipo && !form.precio_cop) { showToast("Al menos tipo o precio"); return; }
    await post([form], "1");
    setForm(empty); setModal(false);
  };

  return (
    <div className="wrap">
      <div className="rhead" style={{ marginTop: "var(--sp-5)" }}><h2>Inventario propio</h2><span className="sub">{rows ? `${rows.length} inmuebles tuyos` : "cargando…"}</span></div>
      <p style={{ color: "var(--muted)", margin: "4px 0 0", fontSize: "var(--fs-sm)" }}>Sube tu catálogo — se cruza con las búsquedas de tus contactos igual que el inventario scrapeado.</p>
      <div className="inv-tools">
        <button className="btn sm" onClick={downloadTemplate}>⬇ Descargar plantilla CSV</button>
        <button className="btn sm ghost" onClick={() => fileRef.current?.click()}>⬆ Importar CSV</button>
        <input ref={fileRef} type="file" accept=".csv" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) importCsv(f); e.target.value = ""; }} />
        <button className="btn sm ghost" onClick={() => setModal(true)}>＋ Agregar registro</button>
      </div>
      <div className="inv-note">Estos inmuebles se guardan en la base (source propio) y aparecen en la búsqueda junto a los scrapeados.</div>

      <div className="tablewrap"><table className="inv">
        <thead><tr><th>Tipo</th><th>Negocio</th><th>Precio</th><th>Hab.</th><th>Baños</th><th>Área m²</th><th>Ciudad</th><th>Barrio</th><th>Parq.</th></tr></thead>
        <tbody>
          {rows == null ? <tr><td colSpan={9} style={{ textAlign: "center", padding: 30, color: "var(--muted)" }}>Cargando…</td></tr>
            : rows.length === 0 ? <tr><td colSpan={9} style={{ textAlign: "center", padding: 34, color: "var(--muted)" }}>Sin inmuebles propios aún. Descarga la plantilla o usa "Agregar registro".</td></tr>
            : rows.map((r) => (
              <tr key={r.id}>
                <td>{cap(r.property_type)}</td><td>{r.business_type}</td><td className="tnum">{fmt(r.price_cop)}</td>
                <td className="tnum">{r.beds ?? "—"}</td><td className="tnum">{r.baths ?? "—"}</td><td className="tnum">{r.area_m2 ?? "—"}</td>
                <td>{cap(r.city)}</td><td>{cap(r.neighborhood)}</td><td>{r.features?.parqueadero || "—"}</td>
              </tr>
            ))}
        </tbody>
      </table></div>

      {modal && (
        <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) setModal(false); }}>
          <div className="modal">
            <div className="mhead"><h3>Agregar inmueble</h3><button className="mclose" onClick={() => setModal(false)}>×</button></div>
            <div className="mbody">
              <div className="frow"><div className="fld"><label>Tipo</label><input value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} placeholder="apartamento" /></div><div className="fld"><label>Negocio</label><select value={form.negocio} onChange={(e) => setForm({ ...form, negocio: e.target.value })}><option value="venta">venta</option><option value="arriendo">arriendo</option></select></div></div>
              <div className="frow"><div className="fld"><label>Precio (COP)</label><input type="number" value={form.precio_cop} onChange={(e) => setForm({ ...form, precio_cop: e.target.value })} /></div><div className="fld"><label>Área m²</label><input type="number" value={form.area_m2} onChange={(e) => setForm({ ...form, area_m2: e.target.value })} /></div></div>
              <div className="frow"><div className="fld"><label>Habitaciones</label><input type="number" value={form.habitaciones} onChange={(e) => setForm({ ...form, habitaciones: e.target.value })} /></div><div className="fld"><label>Baños</label><input type="number" value={form.banos} onChange={(e) => setForm({ ...form, banos: e.target.value })} /></div></div>
              <div className="frow"><div className="fld"><label>Ciudad</label><input value={form.ciudad} onChange={(e) => setForm({ ...form, ciudad: e.target.value })} placeholder="manizales" /></div><div className="fld"><label>Barrio</label><input value={form.barrio} onChange={(e) => setForm({ ...form, barrio: e.target.value })} placeholder="palermo" /></div></div>
              <div className="fld"><label>Parqueadero</label><select value={form.parqueadero} onChange={(e) => setForm({ ...form, parqueadero: e.target.value })}><option value="">—</option><option value="si">Sí</option><option value="no">No</option></select></div>
            </div>
            <div className="mfoot"><button className="btn ghost" onClick={() => setModal(false)}>Cancelar</button><button className="btn" onClick={addOne}>Agregar</button></div>
          </div>
        </div>
      )}
      {toast && <div className="toast show">{toast}</div>}
    </div>
  );
}
