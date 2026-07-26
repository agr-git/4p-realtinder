# ARCHITECTURE.md

**Project:** Consolidated Real Estate Listings Platform (Manizales / Eje Cafetero)
**Version:** 1.0 — MVP scope
**Last updated:** 2026-07-16

---

## 1. System overview

Three planes, deliberately decoupled so each can fail, scale, or be replaced
independently:

```
┌─────────────────────────────────────────────────────────────────┐
│  INGESTION PLANE (VPS — Docker)                                  │
│                                                                  │
│  n8n workflow (daily, 6:00 AM COT)                               │
│   Schedule Trigger                                               │
│     └─> Site Config List (11 entries, shared Wasi selector set)  │
│           └─> LOOP per site:                                     │
│                 HTTP Request ─> HTML Extract ─> Normalize        │
│           └─> Postgres Upsert (ON CONFLICT dedupe_key)           │
│           └─> Error branch ─> Telegram alert                     │
│                                                                  │
│  [Phase 2] Firecrawl calls for detail-page enrichment            │
│  [Phase 2] Metrocuadrado via Firecrawl render / Apify actor      │
└──────────────────────────┬──────────────────────────────────────┘
                           │ writes
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  DATA PLANE (Supabase — free tier)                               │
│                                                                  │
│  Postgres:                                                       │
│    listings                (core table, upsert dedup)            │
│    listing_price_history   [Phase 3]                             │
│  PostGIS extension         [Phase 4 — map filtering]             │
│  PostgREST (auto REST API) — read path for the dashboard         │
│  Supabase Auth             [Phase 4 — realtor login, RLS]        │
└──────────────────────────┬──────────────────────────────────────┘
                           │ reads (REST, filtered queries)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  PRESENTATION PLANE (Vercel — free tier)                         │
│                                                                  │
│  Next.js dashboard                                               │
│    Phase 1: filterable table (price, city, type, beds)           │
│    Phase 3: price-change indicators                              │
│    Phase 4: map view (PostGIS), saved searches, auth             │
└─────────────────────────────────────────────────────────────────┘
```

Key property: **the dashboard never talks to the scraper, and the scraper never
talks to the dashboard.** Postgres is the only contract between them. A scraper
outage means stale data, never a broken dashboard.

---

## 2. Source inventory & scraping strategy

| Group | Sites | Strategy |
|---|---|---|
| **Wasi.co template (7)** | gruporepublica, castrorosero, inmobiliarialuciaprada, inmobiliariagomezchaljubb, vopropiedadraiz, inmobiliariacima, administrabienesraices | One shared CSS selector set. Identical listing URL pattern (`/tipo-negocio-barrio-ciudad/codigo`), identical card markup. One config entry per site, same parser. |
| **Independent SSR (4)** | fincaraiz (Next.js SSR), ciencuadras (Scully), puntopropiedad (LifullConnect), pads (Astro) | One selector set each. Same n8n loop, different config entries. |
| **Custom CMS (1)** | casasyapartamentosmanizales | Older platform, own markup. Its own selector set; same n8n loop. |
| **JS-rendered (1)** | metrocuadrado | Phase 2. Firecrawl render first; Apify Playwright actor as fallback. |
| **Bot-protected (1)** | properati | Phase 3 decision gate. Managed scraping API only if unique-inventory analysis justifies the cost. |

Source count: 7 Wasi + 4 independent SSR = **11 server-rendered**, + 1 custom CMS
+ 1 JS-rendered + 1 bot-protected = **14 total**. Phase 1 covers the first 12
(11 SSR + the custom CMS); Metrocuadrado is Phase 2 and Properati is a Phase 3
decision gate. These are the numbers `TECH_STACK.md` uses.

Politeness rules (all sites): 1 run/day, ≥2s between requests, rotating
User-Agent, no parallel hammering of a single host, respect robots.txt
disallows on a per-site basis.

---

## 3. Data model (Phase 1)

```sql
create table listings (
  id                bigint generated always as identity primary key,
  dedupe_key        text not null unique,        -- source + ':' + source_listing_id
  source            text not null,               -- e.g. 'castrorosero'
  source_listing_id text not null,
  url               text not null,
  business_type     text not null,               -- 'venta' | 'arriendo' | 'permuta'
  property_type     text,                        -- 'apartamento' | 'casa' | 'lote' | ...
  title             text,
  price_cop         bigint,                      -- integer pesos, normalized
  beds              smallint,
  baths             numeric(3,1),                -- sites report 3.5 baths
  area_m2           numeric(10,2),
  city              text,
  neighborhood      text,
  image_url         text,                        -- hotlinked (MVP decision)
  is_active         boolean not null default true,
  scraped_at        timestamptz not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index idx_listings_filter
  on listings (business_type, city, price_cop, beds)
  where is_active;
```

Normalization contract (enforced in the n8n Function node, before upsert):
- `price_cop`: strip `$`, dots, "COP", "mes" → integer. USD listings flagged and
  excluded in Phase 1 (rare, adds FX complexity for no MVP value).
- `business_type`: map site vocabulary (arriendo/alquiler/arrendamiento → `arriendo`).
- `dedupe_key`: `{source}:{source_listing_id}` — listing IDs are stable on all
  11 sites (verified in the site audit).
- Listings missing price OR url are dropped with a counted warning, not inserted.

Staleness handling: each run stamps `scraped_at`. A listing not seen for
N consecutive runs (start with N=3) gets `is_active = false` — sold/rented
properties disappear from the dashboard without being deleted.

Phase 3 addition:

```sql
create table listing_price_history (
  id          bigint generated always as identity primary key,
  listing_id  bigint not null references listings(id),
  price_cop   bigint not null,
  observed_at timestamptz not null default now()
);
-- written by the upsert path only when incoming price != stored price
```

---

## 4. Failure modes & handling

| Failure | Detection | Response |
|---|---|---|
| Site changes markup | Extraction returns 0 rows for a site that historically returns >0 | Telegram alert with site name; other 10 sites unaffected (loop isolation) |
| Site returns non-200 | HTTP status check in loop | Telegram alert; skip site, continue loop |
| Site adds bot protection | Repeated 403/429 | Alert; site moves to the Firecrawl/managed-API lane, config-only change |
| Supabase unreachable | Postgres node error | Workflow-level error trigger → alert; run is idempotent, safe to re-run manually |
| Duplicate listings across portals (cross-posting) | Known limitation | Phase 1 dedups within-source only. Cross-source dedup (fuzzy match on price+area+neighborhood) is a Phase 5 candidate, explicitly out of MVP scope |
| Hotlinked images break | Visual, non-blocking | Accepted MVP trade-off; Supabase Storage migration is the Phase 4 fix |

Idempotency: the entire pipeline is upsert-based. Any run can be repeated
without creating duplicates. This is the property that makes manual re-runs,
backfills, and recovery trivial.

---

## 5. Repository structure

Single repository, several top-level folders — one project, not a multi-project
monorepo. **The canonical tree lives in `CLAUDE.md` §7**; it is not duplicated
here, because two trees drift. This section only documents what is specific to
this project:

- `docs/` — `TECH_STACK.md`, `ARCHITECTURE.md`, `PROJECT_BLUEPRINT.md`
- `supabase/` — `migrations/` (timestamped `.sql`, applied with `supabase db push`),
  `seed.sql`, and `config.toml`. This is the layout the Supabase CLI expects and
  it is **not configurable** — an earlier draft of this document specified
  `db/migrations/`, which the CLI cannot read.
- `n8n-workflows/` — `scrape-ssr-sites.json` (exported workflow) and
  `site-configs/` (selector maps as JSON, one per site group)
- `frontend/` — Next.js app (`app/`, `components/`, `lib/`); Vercel deploys from here
- `tests/fixtures/` — captured HTML per site group, the input for parser tests

Workflow-as-code: n8n workflows are exported to JSON and committed after every
meaningful change. The VPS instance is the runtime; the repo is the source of
truth. Selector configs live as standalone JSON so a markup fix is a config
commit, not a workflow edit.

Branching: `main` (auto-deploys to Vercel) ← PR ← `<tipo>/<issue-id>-<descripcion>`,
e.g. `feature/12-filtro-precio`. Types: `feature`, `bug`, `refactor`, `directiva`.
This is the framework convention (`CLAUDE.md` §4, Etapa 2); the issue id in the
branch name is what makes "no branch without an issue" enforceable at a glance.

Issues are labeled on two independent axes: type (`feature`/`bug`/`refactor`/
`directiva`) and phase (`phase-1` … `phase-5`).

---

## 6. Security & secrets

- **VPS side:** all credentials (Supabase connection string, Firecrawl key,
  Telegram token) live in the n8n credentials vault. Never in workflow JSON
  exports — n8n strips them on export by design; verify before each commit.
- **Frontend side:** Supabase anon key + URL as Vercel environment variables.
  The anon key is safe to expose only because Phase 1 data is read-only public
  listings; the moment auth lands (Phase 4), RLS policies gate everything.
- **Repo:** `.env.example` documents required variables; `.env*` is gitignored.
- **Supabase service_role key:** used only by n8n for writes. Never leaves the
  VPS vault, never appears in the frontend.

---

## 7. Phase map (architecture deltas only)

| Phase | Architectural change |
|---|---|
| **1 — MVP** | Everything in the diagram above except bracketed items. 11 SSR sites → Postgres → filterable dashboard. |
| **2 — Metrocuadrado + enrichment** | Firecrawl enters the ingestion plane. New n8n branch for JS rendering; enrichment sub-workflow fetches detail pages for new listings only (delta-driven, keeps credit spend minimal). |
| **3 — Price history + Properati gate** | `listing_price_history` table; upsert path gains a price-comparison step. Properati go/no-go decided on Phase 1–2 overlap data. |
| **4 — Product maturity** | Supabase Auth + RLS; PostGIS map view; image storage migration; saved searches. |
| **5 — Ops & multi-client** | Cross-source fuzzy dedup; retry/backoff strategy; schema separation for multi-realtor tenancy; selector-drift monitoring beyond zero-row alerts. |
