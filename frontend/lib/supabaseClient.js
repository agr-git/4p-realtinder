import { createClient } from "@supabase/supabase-js";

// Cliente de navegador. Con sesión iniciada, cada request lleva el JWT del
// usuario y RLS scopea sus datos (contacts/saved_searches/listings propios).
// Sin sesión (anon) solo ve el inventario scrapeado (público).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Guarda de configuración. Sin esto, createClient(undefined, undefined) tira
// al cargar el módulo y la app entera queda en blanco: el fallo más caro de
// diagnosticar porque no deja ni un mensaje. Evidencia: el build de Vercel no
// valida env vars de cliente, así que una var faltante solo se manifiesta en
// runtime, en el navegador del usuario.
export const configError = !url
  ? "Falta NEXT_PUBLIC_SUPABASE_URL"
  : !key
  ? "Falta NEXT_PUBLIC_SUPABASE_ANON_KEY"
  : null;

export const supabase = configError
  ? null
  : createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true },
    });

// Traduce el error de supabase-js a algo accionable.
//
// `TypeError: Failed to fetch` es lo que devuelve el navegador cuando el host
// de Supabase no resuelve o rechaza la conexión — no dice nada de la query ni
// de las credenciales. Evidencia: 2026-08-04 el proyecto mafcnszdxppuhjbhkkwn
// pasó a NXDOMAIN y TODA la app (login incluido) reportaba solo ese texto,
// haciendo parecer que las credenciales del usuario estaban mal.
export function explainError(error) {
  if (configError) return `Configuración incompleta: ${configError}. Revisa las env vars del despliegue.`;
  if (!error) return null;
  const msg = String(error.message || error);
  if (/failed to fetch|networkerror|load failed|fetch failed/i.test(msg)) {
    const host = (() => {
      try {
        return new URL(url).host;
      } catch {
        return "Supabase";
      }
    })();
    return `No hay conexión con el backend (${host}). El servicio está caído, el proyecto no existe o no hay red — no es un problema de tus credenciales.`;
  }
  return msg;
}
