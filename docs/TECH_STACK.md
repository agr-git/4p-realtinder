# TECH_STACK.md

**Project:** Consolidated Real Estate Listings Platform (Manizales / Eje Cafetero)
**Version:** 1.0 — MVP scope
**Last updated:** 2026-07-16

---

## Summary

A scraping + consolidation pipeline that pulls property listings from 14 Colombian
real estate sites (11 server-rendered, 1 JS-rendered, 1 bot-protected, 1 custom CMS)
into a single Postgres database, exposed to realtors through a filterable dashboard.

Guiding constraint: **$0/mo infrastructure for Phase 1**, using free tiers and
already-owned resources (VPS, Apify account). Paid tools enter only in later phases
and only where free options genuinely cannot do the job.

---

## Stack by layer

### Orchestration & Scraping
| Tool | Role | Cost | Phase |
|---|---|---|---|
| **n8n (self-hosted)** | Workflow orchestration: schedule trigger, HTTP requests, HTML extraction, normalization, Postgres upsert, error alerting. Runs in Docker on our own VPS. | $0 (existing VPS) | 1 |
| **Firecrawl** | Two lanes only: (a) detail-page enrichment — full descriptions, photo URLs, amenities from individual listing pages without writing 11 site-specific parsers; (b) JS rendering for Metrocuadrado, potentially replacing the need for an Apify actor. Pay-per-page — used surgically, never for the 11 SSR list pages that parse free. | Free tier: 500 credits; then ~$16/mo | 2–3 |
| **Apify** | Held in reserve. Playwright actor for Metrocuadrado *if* Firecrawl's rendering proves insufficient. Existing account, pay-per-use. | ~$0.01–0.03/run | 2 (contingency) |
| **ScraperAPI / ScrapingBee** | Only if Properati (bot-protected) proves worth its cost after Phase 1 inventory-overlap analysis. Not committed. | ~$29/mo | 3 (decision gate) |

### Data
| Tool | Role | Cost | Phase |
|---|---|---|---|
| **Supabase (free tier)** | Postgres database — single source of truth. `listings` table with upsert-based dedup; `listing_price_history` added in Phase 3. Auto-generated REST API (PostgREST) means no custom backend is required for Phase 1. PostGIS available for Phase 4 map features. | $0 (500 MB, ample for ~2K listings) | 1 |
| **Supabase Auth** | Realtor login for the dashboard (email/password or magic link). Row-level security for future multi-client separation. | $0 (included) | 4 |

### Frontend & Deployment
| Tool | Role | Cost | Phase |
|---|---|---|---|
| **Next.js (React)** | Dashboard frontend: filterable listing table (price range, city, business type, bedrooms), later map view and saved searches. | $0 | 1 |
| **Vercel (free tier)** | Frontend hosting and CI-on-push from the GitHub repo. Environment variables hold the Supabase keys. | $0 | 1 |

### Development & Collaboration
| Tool | Role | Cost | Phase |
|---|---|---|---|
| **GitHub** | Monorepo (`/frontend`, `/n8n-workflows`, `/db`, `/docs`). Issues for phase tracking, branch-per-feature, PRs to `main`. `main` auto-deploys to Vercel. | $0 | 1 |
| **Claude Code** | Primary build agent. | Existing plan | 1 |
| **Codex** | Fallback build agent. | Existing plan | 1 |

### Operations
| Tool | Role | Cost | Phase |
|---|---|---|---|
| **Telegram bot alerts** | n8n error branch pings on non-200 responses or zero-row extractions (silent selector breakage is the #1 operational risk). Reuses existing Telegram bot infrastructure. | $0 | 1 |
| **n8n credentials vault** | Secrets on the VPS side (DB connection, Firecrawl key). Nothing sensitive ever enters the repo. | $0 | 1 |

---

## Explicit decisions & corrections

1. **Composio removed from MVP scope.** It is a tool-integration platform for agent
   actions, not an end-user auth provider. Dashboard auth = Supabase Auth. Composio
   re-enters only if a later phase adds agent-driven actions (e.g., pushing listings
   to a client CRM).
2. **No custom backend in Phase 1.** Supabase's PostgREST API covers read queries
   with filters. A dedicated API layer gets built only when logic outgrows what
   RLS + PostgREST can express.
3. **Firecrawl is scoped, not default.** The 11 SSR list pages parse for $0 via raw
   HTTP in n8n. Firecrawl credits are spent only on detail-page enrichment and JS
   rendering. Using it for list pages would be paying for what is already free.
4. **Images are hotlinked, not stored** (MVP). Known trade-off: hotlinks rot and some
   sites block them. Storage decision deferred to Phase 4 (Supabase Storage is the
   natural candidate).
5. **Properati is a decision gate, not a commitment.** Colombian portals heavily
   cross-post inventory; Phase 1 data will show how much unique inventory Properati
   would actually add before any anti-bot spend is approved.

---

## Cost trajectory

| Milestone | Monthly cost |
|---|---|
| Phase 1 (11 SSR sites, dashboard live) | **$0** |
| Phase 2 (+ Metrocuadrado, + enrichment) | ~$0–16 (Firecrawl tier dependent) |
| Phase 3 (+ Properati, if approved) | ~$30–45 |
| Full product (managed n8n, paid Supabase, multi-client) | ~$60–90 |
