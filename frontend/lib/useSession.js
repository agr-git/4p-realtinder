"use client";
import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

// undefined = cargando · null = sin sesión · objeto = sesión activa
export function useSession() {
  const [session, setSession] = useState(undefined);
  useEffect(() => {
    // Sin cliente (env vars faltantes) no hay sesión posible: se resuelve a
    // null en vez de tirar, para que la UI pueda mostrar el error de config.
    if (!supabase) { setSession(null); return; }
    supabase.auth.getSession().then(({ data }) => setSession(data.session)).catch(() => setSession(null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);
  return session;
}
