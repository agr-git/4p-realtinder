// Motor de afinidad. Los PESOS vienen de la tabla affinity_weights (parametrizables),
// no hardcodeados. degree() da el grado de cumplimiento 0..1 por criterio.

// Grado de cumplimiento de un criterio para un inmueble.
export function degree(k, val, it) {
  if (val === "" || val == null) return null; // criterio inactivo
  if (k === "tipo") return it.property_type === val ? 1 : 0;
  if (k === "ubicacion") return it.city === val ? 1 : it.neighborhood === val ? 1 : 0;
  if (k === "precio") {
    const max = +val;
    if (!it.price_cop) return 0;
    if (it.price_cop <= max) return 1;
    const over = (it.price_cop - max) / max;
    return over <= 0.2 ? Math.max(0, 1 - (over / 0.2) * 0.9) : 0; // crédito parcial hasta 20% sobre
  }
  if (k === "habitaciones") { if (it.beds == null) return 0; const m = +val; return it.beds >= m ? 1 : it.beds === m - 1 ? 0.5 : 0; }
  if (k === "banos") { if (it.baths == null) return 0; const m = +val; return it.baths >= m ? 1 : it.baths === m - 1 ? 0.5 : 0; }
  if (k === "estrato") { if (it.estrato == null) return 0; const d = Math.abs(it.estrato - +val); return d === 0 ? 1 : d === 1 ? 0.5 : 0; }
  if (k === "area") { if (it.area_m2 == null) return 0; const m = +val; return it.area_m2 >= m ? 1 : it.area_m2 >= m * 0.85 ? 0.6 : 0; }
  return null;
}

// Puntúa un inmueble contra los criterios activos. `crit` = {k: {v, db}}. `weights` = {k: peso}.
export function scoreItem(it, crit, weights) {
  let num = 0, den = 0, excluded = false, penal = 0;
  for (const k of Object.keys(weights)) {
    const c = crit[k];
    if (!c || c.v === "") continue;
    const g = degree(k, c.v, it);
    if (g === null) continue;
    const w = weights[k];
    den += w; num += w * g;
    if (c.db && g < 1) excluded = true;       // deal breaker no cumplido -> excluir
    if (g < 1) penal += w * (1 - g);
  }
  return {
    pct: den ? Math.round((num / den) * 100) : 0,
    excluded,
    penalPts: den ? Math.round((penal / den) * 100) : 0,
  };
}

// Ordena/filtra un pool por afinidad. Devuelve {shown, excluded}.
export function rankListings(pool, crit, weights) {
  const scored = pool.map((it) => ({ it, ...scoreItem(it, crit, weights) }));
  return {
    shown: scored.filter((s) => !s.excluded).sort((a, b) => b.pct - a.pct),
    excluded: scored.filter((s) => s.excluded).sort((a, b) => b.pct - a.pct),
  };
}
