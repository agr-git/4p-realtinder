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
        {session === undefined ? null : session ? (
          <span className="count">{session.user.email} · <button className="linkbtn" onClick={logout}>Salir</button></span>
        ) : (
          <button className="btn sm" onClick={() => setModal(true)}>Iniciar sesión</button>
        )}
      </div></header>

      {/* Modal FUERA del header: el backdrop-filter del header rompe position:fixed. */}
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
