import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

// GET: lista contactos con sus búsquedas guardadas.
export async function GET() {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("contacts")
    .select("*, saved_searches(*)")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contacts: data });
}

// POST: crea contacto (+ opcionalmente asocia una búsqueda guardada).
export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const { nombre, apellido, celular, email, notas, savedSearch } = body;
  if (!nombre || !String(nombre).trim())
    return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });

  const db = supabaseAdmin();
  const { data: contact, error } = await db
    .from("contacts")
    .insert({ nombre: nombre.trim(), apellido: apellido || null, celular: celular || null, email: email || null, notas: notas || null })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (savedSearch && (savedSearch.criteria || savedSearch.business_type)) {
    const { error: e2 } = await db.from("saved_searches").insert({
      contact_id: contact.id,
      business_type: savedSearch.business_type || null,
      criteria: savedSearch.criteria || {},
    });
    if (e2) return NextResponse.json({ error: e2.message, contact }, { status: 207 });
  }
  return NextResponse.json({ contact }, { status: 201 });
}
