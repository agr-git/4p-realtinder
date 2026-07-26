# Prototipos de diseño — RealTinder

Guía visual de cómo debe verse y funcionar el producto. Son **mockups direccionales**, no especificación literal: los datos de ejemplo son de relleno (aparecen barrios de Medellín y Buenos Aires; el proyecto es Manizales / Eje Cafetero) y algunos textos están imperfectos por ser renders generados. La especificación autoritativa son las **historias de usuario** (issues #12–#15) y el modelo de datos (#11).

## Cómo agregar las imágenes

Suelta los PNG en esta carpeta con estos nombres y se enlazarán abajo. (Si tienes los HTML de los prototipos, agrégalos también aquí.)

## Pantallas

1. **`01-busqueda-filtros-afinidad.png`** — Búsqueda con *Filtros Avanzados* (tipo, precio con slider min-max, ubicación, baños, habitación, área). Cada filtro tiene un toggle **"Es Deal Breaker"**. Resultados en grid con banda **"% MATCH"**; algunas cards muestran penalizaciones (ej. *"Sin Balcón (−9%)"*). → issue #12.
2. **`02-guardar-nuevo-contacto.png`** — Modal *"Guardar y Asociar a Nuevo Contacto"* (nombre*, apellido, celular*, email) disparado desde una búsqueda. → issues #12, #13.
3. **`03-asociar-contacto-existente.png`** — Modal *"Asociar a Contacto Existente"*: busca por nombre/celular/email, selección por radio. → issue #13.
4. **`04-detalle-contacto-filtros-guardados.png`** — Detalle de contacto (nombre, apellido, celular, email) + panel *"Filtros Guardados"* (cada uno con botón *Ver Listado*). → issue #13.
5. **`05-gestion-contactos.png`** — Tabla *Gestión de Contactos* (nombre, apellido, celular, email) con acciones borrar/editar/ver y botón *+ Nuevo*. → issue #13.
6. **`06-detalle-propiedad.png`** — Modal de detalle: título + precio, ubicación, baños/habitaciones/área, **carrusel de fotos (1/8)**, toggle **Disponible/No Disponible**, *Fuente:* (ej. `tufincaraiz.com`), y tabla **"Contactos Interesados"** (nombre, apellido, celular, email). → issue #15.
7. **`07-inventario.png`** — Tabla *Inventario* (tipo, precio, ubicación, baños, habitaciones, área, acciones) + botón *Subir Archivo* (import CSV). → issue #14.

## Señales de diseño que alimentan el modelo de datos (#11)

- **% MATCH** por card y penalizaciones parciales (−9%) → el motor de afinidad debe dar un puntaje por propiedad y descontar por criterios no cumplidos.
- **"Es Deal Breaker"** por filtro → cada criterio de búsqueda puede marcarse como excluyente.
- **Carrusel 1/8** → varias fotos por inmueble (hoy el esquema tiene una sola `image_url`).
- **Fuente** visible (`tufincaraiz.com`, CSV propio, Instagram) → el campo `source` se muestra al usuario.
- **Disponible/No Disponible** como toggle manual → separar del `is_active` automático del scraper.
- **Contactos Interesados** en el detalle → cruce entre `saved_searches` de contactos y la propiedad, filtrado por afinidad (>90% en las historias).
