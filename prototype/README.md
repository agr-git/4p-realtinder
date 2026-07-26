# Prototipo RealTinder — frontend de búsqueda por afinidad

`realtinder.html` es un prototipo autocontenido (un solo archivo) del frontend:
tabla/grid de inmuebles con **match por afinidad ponderada**, deal breakers,
filtro de estrato, y guardado/edición de contactos en memoria. Es la validación
visual del producto; el frontend de producción será Next.js en `frontend/`.

## Cómo se arma la demo

El archivo trae `const DATA=__DATA__;` como placeholder. Para generar la versión
con datos reales:

1. `python3 execution/scrape_wasi.py --stamp <iso> --out listings.json`
2. Enriquecer: bajar thumbnails de `image_url` (data URIs) y cruzar `neighborhood`
   con `barrios_manizales` para el `estrato` de cada inmueble.
3. Reemplazar `__DATA__` por ese JSON.

La versión publicada (Artifact) embebe las fotos como data URIs porque una página
hospedada no puede cargar imágenes remotas (CSP). El frontend Next.js real cargará
`image_url` directo y leerá de Supabase en vivo.

## Pesos de afinidad (v1, hard-coded — futuro: tabla `affinity_weights`)

tipo 10 · precio 9 · ubicación 8 · habitaciones 7 · baños 6 · estrato 6 · área 5 · amenidades 3

Deal breaker (`obligatorio`): si no se cumple, excluye el inmueble.
