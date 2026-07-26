-- listings — tabla núcleo del proyecto.
--
-- Es el único contrato entre la ingestión (n8n) y la presentación (Next.js):
-- el scraper solo escribe aquí, el dashboard solo lee de aquí. Ver
-- docs/ARCHITECTURE.md §1 y §3.
--
-- El pipeline entero es upsert-based sobre dedupe_key, lo que hace que
-- cualquier corrida sea repetible sin duplicar. Esa propiedad es la que
-- vuelve triviales los re-runs manuales, los backfills y la recuperación.

create table if not exists listings (
  id                bigint generated always as identity primary key,
  dedupe_key        text not null unique,        -- source + ':' + source_listing_id
  source            text not null,               -- ej. 'castrorosero'
  source_listing_id text not null,
  url               text not null,
  business_type     text not null,               -- 'venta' | 'arriendo' | 'permuta'
  property_type     text,                        -- 'apartamento' | 'casa' | 'lote' | ...
  title             text,
  price_cop         bigint,                      -- pesos enteros, normalizado
  beds              smallint,
  baths             numeric(3,1),                -- hay sitios que reportan 3.5 baños
  area_m2           numeric(10,2),
  city              text,
  neighborhood      text,
  image_url         text,                        -- hotlink (decisión de MVP)
  is_active         boolean not null default true,
  scraped_at        timestamptz not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Índice parcial: el dashboard solo consulta listings activos, así que el
-- índice no carga con los inactivos. Cubre los cuatro filtros de la Fase 1.
create index if not exists idx_listings_filter
  on listings (business_type, city, price_cop, beds)
  where is_active;

-- updated_at: `default now()` solo cubre el INSERT. Como el pipeline es
-- upsert y la mayoría de las escrituras terminan siendo UPDATE, sin este
-- trigger la columna se quedaría congelada en la fecha de creación — justo
-- lo contrario de para lo que sirve. Corrige el diseño de ARCHITECTURE.md §3.
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists listings_set_updated_at on listings;
create trigger listings_set_updated_at
  before update on listings
  for each row
  execute function set_updated_at();

-- RLS — obligatorio, no opcional.
--
-- La publishable key (antes anon key) es pública por diseño: viaja en el
-- bundle del navegador y cualquiera puede leerla del devtools. Una tabla
-- creada por SQL nace con RLS DESACTIVADO, y PostgREST la expone completa.
-- Sin lo de abajo, cualquiera con esa key podría INSERT, UPDATE y DELETE
-- sobre listings, no solo leer.
--
-- ARCHITECTURE.md §6 da por sentado que exponer la key es seguro "porque
-- los datos de Fase 1 son listings públicos de solo lectura". Esa frase
-- solo se vuelve cierta con estas políticas.
alter table listings enable row level security;

-- Lectura pública, solo de listings activos. Esto implementa a nivel de
-- base la regla de ARCHITECTURE.md §3: un listing vendido o arrendado
-- desaparece del dashboard sin ser borrado.
drop policy if exists listings_public_read on listings;
create policy listings_public_read
  on listings for select
  to anon, authenticated
  using (is_active);

-- No se crean políticas de INSERT/UPDATE/DELETE a propósito: con RLS
-- activo, su ausencia significa que nadie puede escribir con la publishable
-- key. n8n escribe con service_role, que salta RLS por definición.
