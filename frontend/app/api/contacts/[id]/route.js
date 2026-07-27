import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

// PATCH: edita un contacto.
export async function PATCH(req, { params }) {
  const body = await req.json().catch(() => ({}));
  const patch = {};
  for (const k of ["nombre", "apellido", "celular", "email", "notas"]) {
    if (k in body) patch[k] = body[k] || null;
  }
  if (patch.nombre === null) return NextResponse.json({ error: "El nombre no puede quedar vacío" }, { status: 400 });
  const db = supabaseAdmin();
  const { data, error } = await db.from("contacts").update(patch).eq("id", params.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contact: data });
}

// DELETE: elimina un contacto (cascade borra sus búsquedas).
export async function DELETE(_req, { params }) {
  const db = supabaseAdmin();
  const { error } = await db.from("contacts").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
