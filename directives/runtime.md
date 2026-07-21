# Directiva — Runtime de la Capa 3

**Qué declara este archivo:** con qué se ejecuta el trabajo determinista en 4p-realtinder. El framework (`CLAUDE.md` §1) exige ejecución determinista pero no impone lenguaje; aquí se concreta.

## Runtime principal: n8n self-hosted

La ingestión corre en **n8n en Docker sobre el VPS propio**, no en scripts de Python. Un workflow diario (6:00 AM COT) recorre los sitios en loop: HTTP Request → HTML Extract → Normalize → Postgres Upsert, con rama de error hacia Telegram.

**Workflow-as-code.** El VPS es el runtime; el repo es la fuente de verdad. Todo workflow se exporta a JSON y se commitea a `n8n-workflows/` después de cada cambio con sentido. Los selector maps viven aparte, en `n8n-workflows/site-configs/`, para que arreglar un markup roto sea un commit de config y no una edición de workflow.

**Por qué n8n y no Python:** ya está corriendo en el VPS a costo cero, el pipeline es de forma ETL (schedule → fetch → transform → upsert) que es exactamente lo que n8n hace bien, y el loop por sitio con aislamiento de errores viene de fábrica. Ver `docs/TECH_STACK.md`.

## Runtimes secundarios

| Runtime | Cuándo | Alcance |
|---|---|---|
| **Firecrawl** | Fase 2–3 | Solo dos carriles: enriquecimiento de páginas de detalle, y render JS para Metrocuadrado. **Nunca** para las list pages SSR, que parsean gratis con HTTP crudo (`docs/TECH_STACK.md`, decisión 3). |
| **Apify** | Fase 2, contingencia | Actor Playwright para Metrocuadrado solo si el render de Firecrawl no alcanza. |
| **Next.js / Vercel** | Fase 1 en adelante | Capa de presentación. Lee de Supabase vía PostgREST; no ejecuta lógica de ingestión. |
| `execution/` | Si hace falta | Scripts auxiliares (aplicar migraciones, correr tests contra fixtures, utilidades de mantenimiento). Hoy no hay ninguno. |

## Secretos

Nada sensible entra al repo. En el VPS, las credenciales (connection string de Supabase, key de Firecrawl, token de Telegram) viven en el **vault de credenciales de n8n**. n8n las quita del export por diseño: **verificar antes de cada commit** de un JSON de workflow. En el frontend, la URL y la anon key de Supabase son variables de entorno de Vercel. La `service_role` key la usa solo n8n para escribir, y nunca sale del vault del VPS.

## Cómo se prueba

Ver `CLAUDE.md` §4, Etapa 2. Para este runtime: los parsers se corren contra fixtures de HTML guardado en `tests/fixtures/` (uno por grupo de sitios), verificando el contrato de normalización de `docs/ARCHITECTURE.md` §3. Un workflow de n8n no se testea unitariamente; su lógica de transformación sí.
