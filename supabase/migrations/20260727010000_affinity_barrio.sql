-- Nuevo criterio de afinidad: barrio (peso 8). Ubicación queda a nivel ciudad;
-- barrio afina dentro de la ciudad. Parametrizable desde affinity_weights.
insert into affinity_weights (criterio, peso) values ('barrio', 8)
on conflict (criterio) do update set peso = excluded.peso;
