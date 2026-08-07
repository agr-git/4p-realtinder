#!/bin/bash
# Sube a Supabase el JSON que produce scrape_wasi.py.
#
# Por que hace falta una credencial privilegiada: los listings scrapeados son
# inventario PUBLICO y entran con `owner = null`. La politica RLS de escritura
# (`listings_own_insert`, ver 20260727020000_auth_owner_rls.sql) es
# `to authenticated with check (owner = auth.uid())`, asi que una sesion normal
# NO puede insertarlos: quedarian marcados como inventario privado de ese
# usuario. Se necesita la `service_role` key, que bypasea RLS.
#
# Credencial: SUPABASE_SECRET_KEY, leida de ~/.config/realtinder/secret_key
# (archivo local, chmod 600, nunca en el repo).
#
# Uso:
#   bash execution/upsert_listings.sh .tmp/listings_20260807.json
#   bash execution/upsert_listings.sh .tmp/listings_20260807.json --dry-run

set -uo pipefail

JSON="${1:-}"
DRY="${2:-}"
KEYFILE="$HOME/.config/realtinder/secret_key"
ENVFILE="$HOME/.config/realtinder/keepalive.env"
LOTE=100   # filas por request

[ -n "$JSON" ] || { echo "Uso: bash execution/upsert_listings.sh <archivo.json> [--dry-run]" >&2; exit 1; }
[ -f "$JSON" ] || { echo "ERROR: no existe $JSON" >&2; exit 1; }

# SUPABASE_URL sale del mismo env del keep-alive para no repetir configuracion
[ -f "$ENVFILE" ] || { echo "ERROR: falta $ENVFILE" >&2; exit 1; }
# shellcheck source=/dev/null
set -a; . "$ENVFILE"; set +a

TOTAL=$(python3 -c "import json,sys; print(len(json.load(open(sys.argv[1]))))" "$JSON")
echo "Archivo: $JSON  ($TOTAL filas)"

# Dos normalizaciones obligatorias antes de enviar:
#
# 1. Deduplicar por dedupe_key. Postgres lanza 21000 ("ON CONFLICT DO UPDATE
#    command cannot affect row a second time") si un mismo statement trae la
#    misma clave dos veces. Se conserva la ultima aparicion.
#
# 2. Igualar el conjunto de claves de TODAS las filas. PostgREST rechaza el
#    lote entero con 400 PGRST102 "All object keys must match" si un objeto
#    trae una clave que otro no: el scraper solo agrega `estrato` cuando lo
#    encuentra en el detalle, asi que un lote mixto revienta. Las faltantes se
#    rellenan con null, que es justo lo que significan.
python3 - "$JSON" > /tmp/listings_dedup.json <<'PY'
import json, sys
rows = json.load(open(sys.argv[1]))
uniq = {}
for r in rows:
    uniq[r["dedupe_key"]] = r
out = list(uniq.values())

todas = sorted({k for r in out for k in r})
for r in out:
    for k in todas:
        r.setdefault(k, None)

print(json.dumps(out, ensure_ascii=False))
sys.stderr.write(f"dedupe: {len(rows)} -> {len(out)} filas unicas; "
                 f"claves normalizadas a {len(todas)}\n")
PY

UNICAS=$(python3 -c "import json;print(len(json.load(open('/tmp/listings_dedup.json'))))")

if [ "$DRY" = "--dry-run" ]; then
  echo "DRY RUN: se subirian $UNICAS filas unicas. No se envio nada."
  python3 -c "
import json
rows=json.load(open('/tmp/listings_dedup.json'))
from collections import Counter
for s,n in Counter(r['source'] for r in rows).most_common(): print(f'  {s:16} {n}')
"
  exit 0
fi

if [ ! -f "$KEYFILE" ]; then
  cat >&2 <<EOF
ERROR: falta la service_role key en $KEYFILE

Obtenerla en: Supabase dashboard -> Project Settings -> API Keys -> service_role
Guardarla asi (NUNCA pegarla en un chat):

  printf '%s' '<service_role_key>' > ~/.config/realtinder/secret_key
  chmod 600 ~/.config/realtinder/secret_key

Mientras tanto el JSON scrapeado queda intacto en $JSON.
EOF
  exit 1
fi

SECRET=$(cat "$KEYFILE")

# Enviar por lotes: un POST con miles de filas se pasa de limites y ademas
# hace imposible saber que lote fallo.
OK=0; FAIL=0
for (( i=0; i<UNICAS; i+=LOTE )); do
  python3 -c "
import json,sys
rows=json.load(open('/tmp/listings_dedup.json'))
print(json.dumps(rows[$i:$i+$LOTE], ensure_ascii=False))
" > /tmp/lote.json

  CODE=$(curl -s -o /tmp/lote_resp.json -w '%{http_code}' --max-time 60 \
    -X POST "$SUPABASE_URL/rest/v1/listings?on_conflict=dedupe_key" \
    -H "apikey: $SECRET" \
    -H "Authorization: Bearer $SECRET" \
    -H "Content-Type: application/json" \
    -H "Prefer: resolution=merge-duplicates,return=minimal" \
    --data @/tmp/lote.json)

  if [ "$CODE" = "201" ] || [ "$CODE" = "200" ] || [ "$CODE" = "204" ]; then
    OK=$((OK+LOTE)); echo "  lote $i..$((i+LOTE)) -> $CODE OK"
  else
    FAIL=$((FAIL+1)); echo "  lote $i..$((i+LOTE)) -> $CODE FALLO: $(head -c 200 /tmp/lote_resp.json)"
  fi
done

rm -f /tmp/lote.json /tmp/lote_resp.json /tmp/listings_dedup.json

echo
echo "Lotes fallidos: $FAIL"
echo -n "Total en la base ahora: "
curl -s --max-time 30 -H "apikey: $SUPABASE_ANON_KEY" -H "Prefer: count=exact" -H "Range: 0-0" \
  -o /dev/null -D - "$SUPABASE_URL/rest/v1/listings?select=id" | grep -i content-range | tr -d '\r' | sed 's|.*/||'
