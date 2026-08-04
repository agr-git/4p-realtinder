# Directiva — Restore (recrear el backend desde cero)

**Qué declara este archivo:** cómo reconstruir el proyecto Supabase de 4p-realtinder cuando el existente desaparece o queda inaccesible. `deploy.md` cubre desplegar sobre un backend vivo; esto cubre el caso en que **no hay backend**.

**Evidencia que originó esta directiva (2026-08-04):** el proyecto `mafcnszdxppuhjbhkkwn` pasó a NXDOMAIN global (`dig @8.8.8.8 mafcnszdxppuhjbhkkwn.supabase.co` → `status: NXDOMAIN`; el anterior `cohdesscrbslrbtbejkx` también). Toda la app (login incluido) devolvía `TypeError: Failed to fetch`, lo que hacía parecer que las credenciales del usuario estaban mal.

---

## 0. Diagnóstico primero — y NO confundir pausa con borrado

Resolver el host es el primer paso, pero **`NXDOMAIN` no prueba que el proyecto fue borrado**. En el plan Free, un proyecto con poca actividad durante 7 días se **pausa**, y hay reportes recurrentes de que el subdominio deja de resolver estando pausado (y a veces incluso tras reanudarlo). Un `dig` con NXDOMAIN es compatible con **pausado** y con **borrado** por igual.

```bash
dig @8.8.8.8 <ref>.supabase.co
```

| Resultado | Significa | Acción |
|---|---|---|
| Resuelve, HTTP 200 | Backend vivo | El problema está en la app o en RLS, no aquí |
| `NXDOMAIN` **o** no resuelve | **Indeterminado**: pausado o borrado | Ir al paso 0.1 — no asumir |

### 0.1 Decidir pausa vs. borrado (el dashboard es la única fuente de verdad)

Entrar a [supabase.com/dashboard](https://supabase.com/dashboard) con la cuenta dueña (`am.sanduchas@gmail.com`) y mirar:

- **Aparece con estado "Paused"** → NO hace falta este documento. Botón *Restore/Resume*: el proyecto vuelve a su estado anterior **con los datos intactos**. Hay 1 año de ventana para reanudarlo. Solo faltará repuntar la URL/key en Vercel si el ref cambió (paso 6).
- **No aparece por ningún lado** → fue borrado. Seguir con el restore completo desde el paso 1.

**Corroborar en el correo de la cuenta:** Supabase avisa por email ~1 semana **antes** de pausar y manda una confirmación **cuando** pausa. Esos dos correos fechan el evento y confirman que fue una pausa automática, no una acción de alguien.

`TypeError: Failed to fetch` en el navegador **nunca** es un problema de credenciales: es que el host no responde. `frontend/lib/supabaseClient.js` (`explainError`) ya traduce esto en la UI.

### 0.2 Prevención

La causa es inactividad de base de datos, no de tráfico web. Un ping programado a `/rest/v1/` unas pocas veces al día (cron de n8n en `hostinger-vps`, que ya existe) evita la pausa.

---

## 1. Crear el proyecto Supabase

Lo hace **una persona**, no el agente (crear cuentas y proyectos requiere autenticación interactiva). Anotar el nuevo `ref`, la URL y la publishable key.

Región: `us-west-2` (la que tenía el proyecto anterior).

---

## 2. Renovar las credenciales locales del agente

Ambos tokens quedaron inservibles en el incidente. Reponerlos:

```bash
# PAT de Supabase (Management API). Los PATs pegados en el chat se revocan.
printf '%s' '<nuevo-pat>' > ~/.config/realtinder/pat

# Token de Vercel — DEBE tener scope del equipo, no personal.
# El token viejo daba 403: scope "alejogilris-projects", token limited:true.
printf '%s' '<nuevo-token-con-scope-de-equipo>' > ~/.config/realtinder/vercel_token
```

Verificación (debe dar 200, no 401/403):

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://api.supabase.com/v1/projects \
  -H "Authorization: Bearer $(cat ~/.config/realtinder/pat)"
```

---

## 3. Aplicar el esquema

Las migraciones de `supabase/migrations/` son la fuente de verdad y se aplican **en orden de timestamp**. Vía Management API con `curl` — nunca con python-urllib (el WAF de Cloudflare lo bloquea con 403 code 1010) ni con el CLI de `supabase` (se cuelga en el Keychain de macOS).

```bash
REF=<nuevo-ref>
PAT=$(cat ~/.config/realtinder/pat)
for f in supabase/migrations/*.sql; do
  echo "→ $f"
  python3 -c "import json,sys;print(json.dumps({'query':open(sys.argv[1]).read()}))" "$f" \
  | curl -s -X POST "https://api.supabase.com/v1/projects/$REF/database/query" \
      -H "Authorization: Bearer $PAT" -H "Content-Type: application/json" --data @-
  echo
done
```

`20260722191021_barrios_manizales.sql` requiere PostGIS: `create extension if not exists postgis;` antes, si el proyecto nuevo no la trae.

**`20260727020000_auth_owner_rls.sql` es obligatorio.** Contiene el scoping por usuario que en su día se aplicó a mano y no quedó versionado (ver cabecera del archivo). Sin él las tablas existen, el seed carga, y el login parece funcionar — pero no hay columnas `owner` ni políticas por usuario, y las escrituras del frontend fallan.

---

## 4. Recrear el usuario de prueba

Los usuarios viven en el esquema `auth`, que gestiona GoTrue: **no** salen de las migraciones. Se crean con la Admin API usando la **service/secret key** (no la publishable):

```bash
curl -s -X POST "https://<nuevo-ref>.supabase.co/auth/v1/admin/users" \
  -H "apikey: $SUPABASE_SECRET_KEY" \
  -H "Authorization: Bearer $SUPABASE_SECRET_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"juanmigrey@rtinder.com","password":"<password>","email_confirm":true}'
```

`email_confirm: true` es lo que evita el paso de verificación por correo; sin él el login falla con "Email not confirmed" y parece un problema de contraseña.

---

## 5. Repoblar el inventario

El seed commiteado (`20260722181453_seed_wasi_listings.sql`, 280 inmuebles ya enriquecidos desde detalle) entra en el paso 3. Para refrescar contra los portales:

```bash
python3 execution/scrape_wasi.py
```

El pipeline es upsert sobre `dedupe_key`, así que re-correrlo es seguro: no duplica. Ver `directives/runtime.md`.

---

## 6. Repuntar el frontend

Actualizar en Vercel (proyecto `prj_6C87P78LyibBb9Ll504Wl9VACEq0`, scope de equipo `alejogilris-projects`) **y** en `frontend/.env.example`:

- `NEXT_PUBLIC_SUPABASE_URL` → la URL del proyecto nuevo
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` → la publishable key nueva

Las env vars `NEXT_PUBLIC_*` se **hornean en el bundle en build time**: cambiarlas en Vercel no basta, hay que **redesplegar**. Confirmar que el bundle desplegado apunta al ref correcto:

```bash
curl -s https://4p-realtinder.vercel.app/ \
  | grep -o '/_next/static/chunks/app/page-[a-z0-9]*\.js' | head -1 \
  | xargs -I{} curl -s "https://4p-realtinder.vercel.app{}" \
  | grep -o 'https://[a-z0-9]\{15,\}\.supabase\.co' | sort -u
```

---

## 7. Smoke test

1. `https://4p-realtinder.vercel.app/` lista inmuebles y **los badges de peso muestran números, no "—"** (un "—" en todos significa que `affinity_weights` no cargó; desde este fix eso ya se reporta como error en vez de fallar en silencio)
2. Login con `juanmigrey@rtinder.com` entra y el header muestra el email
3. Contactos: crear uno y confirmar que aparece; cerrar sesión y confirmar que anon **no** lo ve (prueba de RLS)
4. Inventario: agregar un inmueble propio y confirmar que sale en Búsqueda solo con la sesión abierta

---

## Regla permanente que sale de este incidente

**Todo cambio de esquema aplicado a Supabase debe existir como archivo en `supabase/migrations/` en el mismo PR.** El PR #32 aplicó auth+RLS a mano y no lo versionó; el hueco quedó invisible durante meses y solo se manifestó cuando hizo falta reconstruir. Si un PR toca el esquema y no toca `supabase/migrations/`, el Reviewer lo bloquea.
