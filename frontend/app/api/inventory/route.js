import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

const num = (v) => { if (v == null || v === "") return null; const n = +String(v).replace(/[^\d.]/g, ""); return Number.isFinite(n) ? n : null; };
const int = (v) => { const n = num(v); return n == null ? null : Math.round(n); };

// POST: agrega 1..N inmuebles del inventario propio del agente a `listings`.
export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const rows = Array.isArray(body.rows) ? body.rows : body.row ? [body.row] : [];
  if (!rows.length) return NextResponse.json({ error: "Sin registros" }, { status: 400 });

  const stamp = new Date().toISOString();
  const recs = [];
  for (const r of rows) {
    const tipo = (r.tipo || r.property_type || "").toString().trim().toLowerCase() || null;
    const precio = int(r.precio_cop ?? r.precio ?? r.price_cop);
    if (!tipo && precio == null) continue; // fila vacía
    const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
    recs.push({
      dedupe_key: `propio:${id}`,
      source: "propio",
      source_listing_id: id,
      url: r.url || null,
      business_type: ((r.negocio || r.business_type || "venta") + "").toLowerCase(),
      property_type: tipo,
      title: r.titulo || r.title || null,
      price_cop: precio,
      beds: int(r.habitaciones ?? r.beds),
      baths: int(r.banos ?? r.baths),
      area_m2: num(r.area_m2 ?? r.area),
      city: (r.ciudad || r.city || "").toLowerCase() || null,
      neighborhood: (r.barrio || r.neighborhood || "").toLowerCase() || null,
      image_url: r.image_url || null,
      features: r.parqueadero ? { parqueadero: r.parqueadero } : null,
      scraped_at: stamp,
    });
  }
  if (!recs.length) return NextResponse.json({ error: "Ninguna fila válida (requiere tipo o precio)" }, { status: 400 });

  const db = supabaseAdmin();
  const { error, count } = await db.from("listings").insert(recs, { count: "exact" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ inserted: count ?? recs.length }, { status: 201 });
}
