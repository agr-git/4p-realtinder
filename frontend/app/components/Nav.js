"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useSession } from "../../lib/useSession";

const TABS = [
  { href: "/", label: "Búsqueda" },
  { href: "/contactos", label: "Contactos" },
  { href: "/inventario", label: "Inventario" },
];

export default function Nav() {
  const path = usePathname();
  const session = useSession();
  const [modal, setModal] = useState(false);
  const [info, setInfo] = useState(false);
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const login = async () => {
    setBusy(true); setErr("");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pass });
    setBusy(false);
    if (error) setErr(error.message); else { setModal(false); setEmail(""); setPass(""); }
  };
  const logout = () => supabase.auth.signOut();

  return (
    <>
      <header className="header"><div className="bar">
        <Link href="/" className="logo" style={{ textDecoration: "none", color: "inherit" }}><span className="mk" />Real<b>Tinder</b></Link>
        <nav className="tabs">{TABS.map((t) => <Link key={t.href} href={t.href} className={"tab" + (path === t.href ? " on" : "")}>{t.label}</Link>)}</nav>
        <span className="spacer" />
        <button className="infobtn" title="Sobre los datos y el match" aria-label="Información" onClick={() => setInfo(true)}>i</button>
        {session === undefined ? null : session ? (
          <span className="count">{session.user.email} · <button className="linkbtn" onClick={logout}>Salir</button></span>
        ) : (
          <button className="btn sm" onClick={() => setModal(true)}>Iniciar sesión</button>
        )}
      </div></header>

      {/* Modales FUERA del header: su backdrop-filter rompe position:fixed. */}
      {info && (
        <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) setInfo(false); }}>
          <div className="modal" style={{ maxWidth: 460 }}>
            <div className="mhead"><h3>Sobre RealTinder</h3><button className="mclose" onClick={() => setInfo(false)}>×</button></div>
            <div className="mbody" style={{ gap: "var(--sp-4)" }}>
              <section><h4 className="ih">De dónde vienen los datos</h4>Inventario <b>consolidado</b> de 5 inmobiliarias del Eje Cafetero (Manizales): <b>Castro Rosero, Lucía Prada, VO Propiedad, Administra B. y Grupo República</b>.</section>
              <section><h4 className="ih">Cómo se obtienen</h4>Scraping automático de sus portales, normalizado a un esquema común. Habitaciones, baños y área se completan desde la página de <b>detalle</b> de cada inmueble. El estrato viene del barrio (DANE, Censo 2019).</section>
              <section><h4 className="ih">Cuándo se actualizan</h4>Extracción periódica; el inventario refleja la última corrida. Cada inmueble guarda su fecha de extracción.</section>
              <section><h4 className="ih">Cómo funciona el match</h4>La <b>afinidad</b> = suma ponderada de los criterios que el inmueble cumple ÷ criterios activos. Pesos: tipo 10 · precio 9 · ubicación 8 · barrio 8 · habitaciones 7 · baños 6 · estrato 6 · área 5 · amenidades 3.<br />Un criterio marcado <b style={{ color: "var(--db)" }}>obligatorio</b> (deal breaker) <b>excluye</b> el inmueble si no se cumple. Cerca-pero-no-exacto (ej. precio algo por encima) da crédito parcial (el "−N%").</section>
            </div>
            <div className="mfoot"><button className="btn" onClick={() => setInfo(false)}>Entendido</button></div>
          </div>
        </div>
      )}

      {modal && (
        <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) setModal(false); }}>
          <div className="modal" style={{ maxWidth: 380 }}>
            <div className="mhead"><h3>Iniciar sesión</h3><button className="mclose" onClick={() => setModal(false)}>×</button></div>
            <div className="mbody">
              <div className="fld"><label>Email</label><input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" autoFocus /></div>
              <div className="fld"><label>Contraseña</label><input type="password" value={pass} onChange={(e) => setPass(e.target.value)} onKeyDown={(e) => e.key === "Enter" && login()} /></div>
              {err && <div style={{ color: "var(--db)", fontSize: "var(--fs-sm)" }}>{err}</div>}
            </div>
            <div className="mfoot"><button className="btn ghost" onClick={() => setModal(false)}>Cancelar</button><button className="btn" disabled={busy} onClick={login}>{busy ? "Entrando…" : "Entrar"}</button></div>
          </div>
        </div>
      )}
    </>
  );
}
