"use client";
import { useEffect, useState } from "react";

const LBL = { tipo: "Tipo", precio: "Precio", ubicacion: "Ubicación", habitaciones: "Habitaciones", banos: "Baños", estrato: "Estrato", area: "Área" };
const fmt = (n) => "$" + Number(n).toLocaleString("es-CO");
const cap = (s) => (s ? String(s).replace(/-/g, " ") : "");

function criteriaChips(ss) {
  const chips = [];
  if (ss.business_type) chips.push(ss.business_type === "venta" ? "Venta" : "Arriendo");
  const c = ss.criteria || {};
  for (const k of Object.keys(c)) {
    const v = c[k]?.v; if (!v) continue;
    chips.push(k === "precio" ? `Precio ≤ ${fmt(+v)}` : k === "area" ? `Área ≥ ${v} m²` : k === "estrato" ? `Estrato ${v}` : (k === "habitaciones" || k === "banos") ? `${LBL[k]} ≥ ${v}` : `${LBL[k] || k}: ${cap(v)}`);
  }
  return chips;
}

export default function Contactos() {
  const [contacts, setContacts] = useState(null);
  const [edit, setEdit] = useState(null);
  const [toast, setToast] = useState("");
  const showToast = (m) => { setToast(m); setTimeout(() => setToast(""), 2600); };

  const load = async () => {
    const res = await fetch("/api/contacts");
    const j = await res.json();
    setContacts(res.ok ? j.contacts : []);
    if (!res.ok) showToast("Error: " + (j.error || res.status));
  };
  useEffect(() => { load(); }, []);

  const saveEdit = async () => {
    if (!edit.nombre?.trim()) { showToast("El nombre es obligatorio"); return; }
    const res = await fetch(`/api/contacts/${edit.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(edit) });
    if (res.ok) { setEdit(null); showToast("Contacto actualizado"); load(); } else showToast("Error al guardar");
  };
  const del = async (id) => {
    if (!confirm("¿Eliminar este contacto?")) return;
    const res = await fetch(`/api/contacts/${id}`, { method: "DELETE" });
    if (res.ok) { showToast("Contacto eliminado"); load(); } else showToast("Error al eliminar");
  };

  return (
    <div className="wrap">
      <div className="rhead" style={{ marginTop: "var(--sp-5)" }}><h2>Contactos</h2><span className="sub">{contacts ? `${contacts.length} guardados` : "cargando…"}</span></div>
      {contacts == null ? <div className="empty">Cargando…</div>
        : contacts.length === 0 ? <div className="empty">Aún no hay contactos. Desde <b>Búsqueda</b>, define criterios y usa "Guardar y asociar a contacto".</div>
        : <div className="clist">
            {contacts.map((c) => (
              <div key={c.id} className="crow">
                <div className="crow-actions">
                  <button className="iconbtn" title="Editar" onClick={() => setEdit({ id: c.id, nombre: c.nombre, apellido: c.apellido || "", celular: c.celular || "", email: c.email || "" })}>✏️</button>
                  <button className="iconbtn" title="Eliminar" onClick={() => del(c.id)}>🗑</button>
                </div>
                <div className="cn">{c.nombre} {c.apellido || ""}</div>
                <div className="cc">{[c.celular, c.email].filter(Boolean).join(" · ") || "sin contacto"}</div>
                {(c.saved_searches || []).map((ss) => (
                  <div key={ss.id} className="ss"><div className="chips">{criteriaChips(ss).map((t, i) => <span key={i} className="chip">{t}</span>)}</div></div>
                ))}
              </div>
            ))}
          </div>}

      {edit && (
        <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) setEdit(null); }}>
          <div className="modal">
            <div className="mhead"><h3>Editar contacto</h3><button className="mclose" onClick={() => setEdit(null)}>×</button></div>
            <div className="mbody">
              <div className="frow"><div className="fld"><label>Nombre *</label><input value={edit.nombre} onChange={(e) => setEdit({ ...edit, nombre: e.target.value })} /></div><div className="fld"><label>Apellido</label><input value={edit.apellido} onChange={(e) => setEdit({ ...edit, apellido: e.target.value })} /></div></div>
              <div className="frow"><div className="fld"><label>Celular</label><input value={edit.celular} onChange={(e) => setEdit({ ...edit, celular: e.target.value })} /></div><div className="fld"><label>Email</label><input value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></div></div>
            </div>
            <div className="mfoot"><button className="btn ghost" onClick={() => setEdit(null)}>Cancelar</button><button className="btn" onClick={saveEdit}>Guardar</button></div>
          </div>
        </div>
      )}
      {toast && <div className="toast show">{toast}</div>}
    </div>
  );
}
