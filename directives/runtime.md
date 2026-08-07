# Directiva — Runtime de la Capa 3

**Qué declara este archivo:** con qué se ejecuta el trabajo determinista en 4p-realtinder. El framework (`CLAUDE.md` §1) exige ejecución determinista pero no impone lenguaje; aquí se concreta.

> **Cambio de runtime (2026-08-07, aprobado por el usuario).** Esta directiva declaraba n8n como runtime principal y afirmaba que `execution/` no tenía ningún script. Ambas cosas dejaron de ser ciertas: la ingestión corre en Python desde `execution/scrape_wasi.py` desde el PR #33. La deriva se detectó al recuperar el backend tras el incidente del 2026-08-04 y se corrige aquí. Es la misma clase de fallo que la deriva de esquema del PR #32 — el documento dejó de describir el sistema. El historial de n8n queda al final, en "Runtime anterior".

## Runtime principal: Python en `execution/`

La ingestión corre como **scripts de Python deterministas en `execution/`**, ejecutados a mano o por un job programado. Sin dependencias externas: solo la librería estándar (`urllib`, `re`, `json`).

| Script | Qué hace |
|---|---|
| `scrape_wasi.py` | Scrapea los sitios Wasi y emite JSON al stdout o a un archivo. **No escribe en Supabase.** |
| `upsert_listings.sh` | Sube ese JSON a Supabase vía PostgREST. |
| `keepalive.sh` | Escritura diaria anti auto-pausa del plan Free (ver `docs/keepalive.md`). |
| `keepalive_install.sh` | Instala `keepalive.sh` como agente de launchd. |

**Por qué Python y no n8n:** el pipeline necesita cuatro variantes de parser, paginación con corte por página repetida y enriquecimiento desde la página de detalle de cada inmueble. Eso es lógica condicional, no un ETL lineal; expresarla en nodos de n8n la volvía ilegible y no testeable. En Python vive en un archivo que se lee de arriba abajo y se prueba contra fixtures.

**Separación deliberada scrape ↔ upsert.** `scrape_wasi.py` no toca la base: emite JSON. Así se puede correr, inspeccionar y versionar el resultado sin credenciales, y la subida es un paso aparte que sí las exige. En el incidente del 2026-08-04 esto permitió tener el scrapeo listo días antes de recuperar la credencial de escritura.

### Cómo correrlo

```bash
# 1. Scrapear (~15 min: el enriquecimiento hace un fetch por inmueble)
python3 execution/scrape_wasi.py --stamp "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" --out .tmp/listings.json

# 2. Revisar sin escribir nada
bash execution/upsert_listings.sh .tmp/listings.json --dry-run

# 3. Subir
bash execution/upsert_listings.sh .tmp/listings.json
```

### Reglas de escritura a Supabase

- **Upsert siempre con `?on_conflict=dedupe_key`.** Sin eso, PostgREST resuelve el conflicto contra la PK (`id`) y el segundo POST de un listing ya visto devuelve 409 sin actualizar `scraped_at`.
- **Deduplicar por `dedupe_key` antes de enviar.** Postgres lanza `21000` si un mismo statement trae la clave repetida.
- **Igualar el conjunto de claves de todas las filas del lote.** PostgREST rechaza el lote entero con `400 PGRST102` "All object keys must match" si un objeto trae una clave que otro no. El scraper solo agrega `estrato` cuando lo encuentra, así que un lote mixto revienta.
- **Subir en lotes** (100 filas). Un POST único hace imposible saber qué lote falló.
- **La escritura del scrapeo exige la `service_role` key**, no una sesión de usuario: los listings públicos entran con `owner = null` y la política `listings_own_insert` solo admite `owner = auth.uid()`.
- **Usar `curl`, no python-urllib, contra `api.supabase.com`**: el WAF de Cloudflare bloquea el user-agent de urllib con `403 code 1010`. Contra `<ref>.supabase.co` (PostgREST) urllib funciona bien.
- **Evitar el CLI de `supabase`**: `db query`/`db push` se cuelgan pidiendo la contraseña al Keychain de macOS, que no se puede responder sin terminal interactiva.

### Límite conocido

`PAGE_CAP = 8` trunca el inventario a 96 inmuebles por operación y por sitio, cuando hay contenido real hasta la página 100+. Ver **issue #38** — subirlo es una decisión de escala pendiente, no un bug del código.

## Runtimes secundarios

| Runtime | Cuándo | Alcance |
|---|---|---|
| **launchd** (macOS) | En marcha | Job diario del keep-alive. El script debe vivir fuera de `~/Downloads`/`~/Documents`/`~/Desktop`: launchd no puede ejecutar ahí por TCC. Ver `docs/keepalive.md`. |
| **Firecrawl** | Fase 2–3 | Solo dos carriles: enriquecimiento de páginas de detalle, y render JS para Metrocuadrado. **Nunca** para las list pages SSR, que parsean gratis con HTTP crudo (`docs/TECH_STACK.md`, decisión 3). |
| **Apify** | Fase 2, contingencia | Actor Playwright para Metrocuadrado solo si el render de Firecrawl no alcanza. |
| **Next.js / Vercel** | Fase 1 en adelante | Capa de presentación. Lee de Supabase vía PostgREST y escribe client-side con la sesión del usuario (RLS); no ejecuta lógica de ingestión. |

## Secretos

Nada sensible entra al repo. Las credenciales del agente viven en `~/.config/realtinder/`, con `chmod 600`:

| Archivo | Para qué |
|---|---|
| `secret_key` | `service_role` de Supabase — subir el scrapeo |
| `keepalive.env` | URL, anon key y usuario de prueba del keep-alive |
| `pat` | PAT de Management API — aplicar migraciones/DDL |
| `vercel_token` | API de Vercel (necesita **scope de equipo**, no personal) |

En el frontend, la URL y la anon key son variables de entorno de Vercel; al ser `NEXT_PUBLIC_*` se hornean en el bundle en build time, así que cambiarlas exige **redesplegar**.

**Toda credencial pegada en un chat se considera comprometida y se rota.** La `service_role` en particular bypasea RLS por completo.

## Cómo se prueba

Ver `CLAUDE.md` §4, Etapa 2. Para este runtime: los parsers se corren contra fixtures de HTML guardado en `tests/fixtures/`, verificando el contrato de normalización de `docs/ARCHITECTURE.md` §3.

```bash
python3 tests/test_parsers.py
```

Un fixture es una captura real de la página, commiteada al repo. El caso que justifica la regla: `parse_search_dt` extraía 1 de las 12 fichas de la página y nadie lo notó durante semanas, porque devolvía 8 y no 0 — y `check_completeness` solo alerta cuando un campo está al 0%. **Toda variante de parser debe tener su fixture y su test afirmando el número de fichas esperado, no solo `> 0`.**

## Runtime anterior: n8n self-hosted (histórico)

Hasta el PR #33 la directiva declaraba n8n en Docker sobre el VPS (`n8n-main` en `hostinger-vps`) como runtime de ingestión, con un workflow diario a las 6:00 AM COT y workflows versionados como JSON en `n8n-workflows/`. Nunca llegó a ser el camino real de ingestión de los sitios Wasi.

n8n sigue vivo en el VPS y sigue siendo el candidato natural para dos cosas: **programar** la ingestión sin depender del portátil (hoy el keep-alive depende de que el Mac esté encendido) y las notificaciones a Telegram. Si se retoma, la escritura se hace con un nodo HTTP Request + Header Auth (`apikey` = service key), **no** con el nodo nativo de Supabase, que espera un JWT.
