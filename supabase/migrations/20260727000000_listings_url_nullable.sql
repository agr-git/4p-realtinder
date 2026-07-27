-- El inventario propio del agente no tiene URL de origen (no viene de un portal).
-- Se relaja la restricción NOT NULL de listings.url para permitirlo.
alter table listings alter column url drop not null;
