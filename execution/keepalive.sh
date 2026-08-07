#!/bin/bash
# Keep-alive de Supabase — evita la auto-pausa por inactividad del plan Free.
#
# Por qué existe: el plan Free pausa un proyecto tras ~7 días sin ACTIVIDAD DE
# BASE DE DATOS (no de tráfico web). El incidente 2026-08-04 tumbó el backend
# entero por esto — ver directives/restore.md §0.2. Un SELECT puede no contar
# como actividad suficiente, así que este script hace una ESCRITURA REAL:
# inserta una fila ficticia en `contacts` y la borra en el mismo run.
#
# Cómo autentica: NO usa el PAT de Management API ni la service_role key.
# Se loguea como el usuario de prueba vía GoTrue y escribe con ese JWT, así
# que respeta las políticas RLS (`contacts_own_insert` / `contacts_own_delete`,
# ver supabase/migrations/20260727020000_auth_owner_rls.sql). Las filas quedan
# scoped al owner del usuario de prueba y nunca tocan datos reales de otro.
#
# Credenciales: ~/.config/realtinder/keepalive.env (fuera del repo, nunca aquí).
#
# Uso manual:  bash execution/keepalive.sh
# Programado:  launchd, com.realtinder.keepalive (ver docs/keepalive.md)

set -uo pipefail

CONF="$HOME/.config/realtinder/keepalive.env"
LOG="$HOME/.config/realtinder/keepalive.log"
MARCA="keepalive"   # nombre fijo de la fila ficticia: permite barrer huérfanas

log() { printf '%s  %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$1" >> "$LOG"; }

fallo() { log "FALLO: $1"; exit 1; }

[ -f "$CONF" ] || { echo "Falta $CONF" >&2; fallo "no existe $CONF"; }
# shellcheck source=/dev/null
set -a; . "$CONF"; set +a

for v in SUPABASE_URL SUPABASE_ANON_KEY KEEPALIVE_EMAIL KEEPALIVE_PASSWORD; do
  [ -n "${!v:-}" ] || fallo "falta la variable $v en $CONF"
done

# 1. Login → JWT ------------------------------------------------------------
TOKEN=$(curl -s --max-time 30 \
  -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$KEEPALIVE_EMAIL\",\"password\":\"$KEEPALIVE_PASSWORD\"}" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin).get("access_token",""))' 2>/dev/null)

[ -n "$TOKEN" ] || fallo "login rechazado (revisa email/password o si el proyecto sigue vivo)"

AUTH=(-H "apikey: $SUPABASE_ANON_KEY" -H "Authorization: Bearer $TOKEN")

# 2. INSERT de la fila ficticia --------------------------------------------
SELLO=$(date '+%Y-%m-%d %H:%M:%S %Z')
INS=$(curl -s --max-time 30 \
  -X POST "$SUPABASE_URL/rest/v1/contacts" \
  "${AUTH[@]}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "{\"nombre\":\"$MARCA\",\"notas\":\"ping automatico anti-pausa $SELLO\"}")

ID=$(printf '%s' "$INS" | python3 -c 'import json,sys
try:
    d=json.load(sys.stdin)
    print(d[0]["id"] if isinstance(d,list) and d else "")
except Exception:
    print("")' 2>/dev/null)

[ -n "$ID" ] || fallo "insert rechazado: $(printf '%s' "$INS" | head -c 200)"

# 3. DELETE — la fila y cualquier huérfana de un run que muriera a medias ---
DEL=$(curl -s --max-time 30 -o /dev/null -w '%{http_code}' \
  -X DELETE "$SUPABASE_URL/rest/v1/contacts?nombre=eq.$MARCA" "${AUTH[@]}")

if [ "$DEL" != "204" ] && [ "$DEL" != "200" ]; then
  fallo "insert OK (id=$ID) pero el DELETE devolvio $DEL — queda fila ficticia sin borrar"
fi

# 4. Verificar que no quedó nada -------------------------------------------
RESTO=$(curl -s --max-time 30 "${AUTH[@]}" \
  "$SUPABASE_URL/rest/v1/contacts?nombre=eq.$MARCA&select=id" \
  | python3 -c 'import json,sys
try: print(len(json.load(sys.stdin)))
except Exception: print("?")' 2>/dev/null)

log "OK  insert id=$ID -> delete $DEL -> filas '$MARCA' restantes: $RESTO"
echo "Keep-alive OK: se creo el registro $ID y se elimino. Restantes: $RESTO"
