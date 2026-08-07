-- Auth + scoping por usuario (owner) — RECUPERACIÓN DE DERIVA DE ESQUEMA.
--
-- Este SQL se aplicó a mano contra Supabase en el PR #32 ("Auth simple con
-- Supabase: datos scoped por usuario") y NUNCA se commiteó como migración.
-- Evidencia: `git log --oneline -- supabase/` no lista el commit 5929c6f.
--
-- Consecuencia real: cuando el proyecto Supabase `mafcnszdxppuhjbhkkwn`
-- desapareció (NXDOMAIN, 2026-08-04), recrearlo desde las migraciones
-- commiteadas devolvía las tablas y el seed, pero SIN columnas owner, SIN
-- políticas por usuario y SIN usuario de prueba — el login habría seguido
-- roto, ahora por una causa distinta. Esta migración cierra ese hueco.
--
-- El usuario de prueba NO se crea aquí: los usuarios viven en el esquema
-- `auth`, que gestiona GoTrue, no las migraciones. Ver directives/restore.md
-- para el paso de creación vía Admin API.

-- 1. Columna owner en las tres tablas con datos de usuario ------------------
-- default auth.uid(): el frontend escribe CLIENT-SIDE con la sesión y nunca
-- manda owner explícito (ver frontend/app/page.js saveContact e
-- inventario/page.js toRecord). Sin el default, el insert entraría con owner
-- null y la política WITH CHECK lo rechazaría.
alter table contacts       add column if not exists owner uuid references auth.users(id) on delete cascade default auth.uid();
alter table saved_searches add column if not exists owner uuid references auth.users(id) on delete cascade default auth.uid();
alter table listings       add column if not exists owner uuid references auth.users(id) on delete cascade default auth.uid();

-- listings scrapeados: owner null = inventario público. El default de arriba
-- solo aplica a filas nuevas; el seed y n8n (service_role, auth.uid() null)
-- siguen entrando con owner null, que es lo correcto.
create index if not exists idx_contacts_owner       on contacts(owner);
create index if not exists idx_saved_searches_owner on saved_searches(owner);
create index if not exists idx_listings_owner       on listings(owner) where owner is not null;

-- 2. contacts — cada quien ve y escribe solo lo suyo -----------------------
-- Se elimina la política de lectura pública de data_model_v2.sql: dejaba el
-- CRM entero legible con la publishable key.
drop policy if exists contacts_read       on contacts;
drop policy if exists contacts_own_select on contacts;
drop policy if exists contacts_own_insert on contacts;
drop policy if exists contacts_own_update on contacts;
drop policy if exists contacts_own_delete on contacts;
create policy contacts_own_select on contacts for select to authenticated using (owner = auth.uid());
create policy contacts_own_insert on contacts for insert to authenticated with check (owner = auth.uid());
create policy contacts_own_update on contacts for update to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
create policy contacts_own_delete on contacts for delete to authenticated using (owner = auth.uid());

-- 3. saved_searches — mismo scoping ----------------------------------------
drop policy if exists saved_searches_read       on saved_searches;
drop policy if exists saved_searches_own_select on saved_searches;
drop policy if exists saved_searches_own_insert on saved_searches;
drop policy if exists saved_searches_own_update on saved_searches;
drop policy if exists saved_searches_own_delete on saved_searches;
create policy saved_searches_own_select on saved_searches for select to authenticated using (owner = auth.uid());
create policy saved_searches_own_insert on saved_searches for insert to authenticated with check (owner = auth.uid());
create policy saved_searches_own_update on saved_searches for update to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
create policy saved_searches_own_delete on saved_searches for delete to authenticated using (owner = auth.uid());

-- 4. listings — lectura pública del scrapeado + inventario propio scoped ----
-- La lectura pública se conserva (es el producto), pero ahora convive con el
-- inventario propio: un listing con owner solo lo ve su dueño.
drop policy if exists listings_public_read on listings;
drop policy if exists listings_own_insert  on listings;
drop policy if exists listings_own_update  on listings;
drop policy if exists listings_own_delete  on listings;
create policy listings_public_read on listings for select to anon, authenticated
  using (is_active and (owner is null or owner = auth.uid()));
create policy listings_own_insert on listings for insert to authenticated with check (owner = auth.uid());
create policy listings_own_update on listings for update to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
create policy listings_own_delete on listings for delete to authenticated using (owner = auth.uid());
