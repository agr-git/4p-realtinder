import { createClient } from "@supabase/supabase-js";

// Cliente de navegador (solo lectura pública bajo RLS). Usa la publishable key.
// Las escrituras van server-side con la secret key (ver route handlers, frontend 3-4/5).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(url, key, {
  auth: { persistSession: false },
});
