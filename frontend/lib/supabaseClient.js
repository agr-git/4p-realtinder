import { createClient } from "@supabase/supabase-js";

// Cliente de navegador. Con sesión iniciada, cada request lleva el JWT del
// usuario y RLS scopea sus datos (contacts/saved_searches/listings propios).
// Sin sesión (anon) solo ve el inventario scrapeado (público).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true },
});
