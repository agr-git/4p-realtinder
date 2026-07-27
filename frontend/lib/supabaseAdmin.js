import { createClient } from "@supabase/supabase-js";

// Cliente SERVIDOR: usa la secret key (bypassa RLS). SOLO en route handlers /
// server actions — nunca se importa en un componente de cliente.
export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error("Falta SUPABASE_SECRET_KEY (env de servidor)");
  return createClient(url, secret, { auth: { persistSession: false } });
}
