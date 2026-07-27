-- Data model v2: CRM (contactos + búsquedas guardadas), pesos de afinidad
-- parametrizables, y extensión de listings (estrato + amenidades). Ver issue #11.
-- RLS: lectura pública para la beta; las escrituras van server-side (service_role).

-- contactos --------------------------------------------------------------
create table if not exists contacts (
  id         bigint generated always as identity primary key,
  nombre     text not null,
  apellido   text,
  celular    text,
  email      text,
  notas      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists contacts_set_updated_at on contacts;
create trigger contacts_set_updated_at before update on contacts
  for each row execute function set_updated_at();
alter table contacts enable row level security;
drop policy if exists contacts_read on contacts;
create policy contacts_read on contacts for select to anon, authenticated using (true);

-- búsquedas guardadas por contacto (criterios + deal breakers) ------------
create table if not exists saved_searches (
  id           bigint generated always as identity primary key,
  contact_id   bigint references contacts(id) on delete cascade,
  business_type text,
  criteria     jsonb not null default '{}'::jsonb,   -- {tipo:{v,db}, precio:{v,db}, ...}
  created_at   timestamptz not null default now()
);
create index if not exists saved_searches_contact on saved_searches(contact_id);
alter table saved_searches enable row level security;
drop policy if exists saved_searches_read on saved_searches;
create policy saved_searches_read on saved_searches for select to anon, authenticated using (true);

-- pesos de afinidad (parametrizables desde UI a futuro) -------------------
create table if not exists affinity_weights (
  criterio text primary key,
  peso     smallint not null
);
insert into affinity_weights (criterio, peso) values
  ('tipo',10),('precio',9),('ubicacion',8),('habitaciones',7),
  ('banos',6),('estrato',6),('area',5),('amenidades',3)
on conflict (criterio) do update set peso = excluded.peso;
alter table affinity_weights enable row level security;
drop policy if exists affinity_weights_read on affinity_weights;
create policy affinity_weights_read on affinity_weights for select to anon, authenticated using (true);

-- extensión de listings: estrato (del barrio) + amenidades ---------------
alter table listings add column if not exists estrato  smallint;
alter table listings add column if not exists features jsonb;   -- {parqueadero:true, ...}
