"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useSession } from "../../lib/useSession";

const LBL = { tipo: "Tipo", precio: "Precio", ubicacion: "Ubicación", barrio: "Barrio", habitaciones: "Habitaciones", banos: "Baños", estrato: "Estrato", area: "Área" };
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
  const session = useSession();
  const [contacts, setContacts] = useState(null);
  const [edit, setEdit] = useState(null);
  const [toast, setToast] = useState("");
  const showToast = (m) => { setToast(m); setTimeout(() => setToast(""), 2600); };

  const load = async () => {
    const { data, error } = await supabase.from("contacts").select("*, saved_searches(*)").order("created_at", { ascending: false });
    setContacts(error ? [] : data || []);
    if (error) showToast("Error: " + error.message);
  };
  useEffect(() => { if (session) load(); else if (session === null) setContacts([]); }, [session]);

  const saveEdit = async () => {
    if (!edit.nombre?.trim()) { showToast("El nombre es obligatorio"); return; }
    const { error } = await supabase.from("contacts").update({ nombre: edit.nombre.trim(), apellido: edit.apellido || null, celular: edit.celular || null, email: edit.email || null }).eq("id", edit.id);
    if (error) showToast("Error al guardar"); else { setEdit(null); showToast("Contacto actualizado"); load(); }
  };
  const del = async (id) => {
    if (!confirm("¿Eliminar este contacto?")) return;
    const { error } = await supabase.from("contacts").delete().eq("id", id);
    if (error) showToast("Error al eliminar"); else { showToast("Contacto eliminado"); load(); }
  };

  if (session === null) return <div className="wrap"><div className="empty" style={{ marginTop: "var(--sp-5)" }}>Inicia sesión (arriba a la derecha) para ver y gestionar tus contactos.</div></div>;

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
