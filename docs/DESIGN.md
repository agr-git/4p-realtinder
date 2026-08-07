# DESIGN.md — Identidad visual (inspirada en Tinder)

## Fuente
- URL: https://tinder.com/ · Captura: 2026-07-27 · Evidencia: Firecrawl `branding` scrape (confianza 0.925)
- **Nota de marca:** tomamos el *lenguaje* de diseño (dirección de color y tipografía), NO logos, imágenes ni tipografías propietarias de Tinder. No implica derechos sobre activos de terceros.

## Tokens observados (Tinder hoy)
- **Colores:** primary `#DFE7F6` (azul pastel), secondary `#FBDAF6` (rosa pastel), accent/text `#5A000F` (marrón vino), fondo `#FFFFFF`.
- **Tipografía:** heading `Regola`/`Society`, body `Helvetica Neue`/`Proxima Nova` (propietarias → usamos stack de sistema).
- **Personalidad:** moderno, energía alta, público joven.

## Cómo lo adaptamos (nuestro módulo `frontend/design/tokens.css`)
La identidad icónica de Tinder es la **llama pink→coral**; la usamos como acento de marca (encaja con "RealTinder"). Los pastel + marrón vino informan los neutros cálidos y el color de deal-breaker.

| Rol | Token | Valor (claro) |
|---|---|---|
| Marca | `--brand` | `#fd3a73` (pink llama) |
| Marca 2 (gradiente) | `--brand-2` | `#ff7854` (coral) |
| Fondo | `--ground` | `#fdf6f7` (blanco cálido) |
| Tinta | `--ink` | `#291318` (casi negro cálido) |
| Deal breaker | `--db` | `#b3123a` (rojo profundo, eco del `#5A000F`) |
| Afinidad | `--match-hi/mid/lo` | verde/ámbar/pizarra (semánticos, sin cambio) |

**Regla:** los colores de afinidad son **semánticos** y se mantienen separados del acento de marca (buena práctica de data-viz). Re-skin futuro = editar `tokens.css`, sin tocar componentes.

## Responsive (móvil y tablet)

Los valores viven en `tokens.css`; `globals.css` solo tiene los cambios de layout que no se pueden expresar como token. Misma regla de siempre: **para re-skin se editan tokens, no componentes.**

### Dos ejes independientes

Se decide por separado *cuánto espacio hay* y *cómo se toca*. Mezclarlos es el error clásico:

| Eje | Consulta | Qué controla |
|---|---|---|
| Espacio | `max-width` | Columnas, gutter, ancho de sidebar y de tarjeta |
| Interacción | **`pointer: coarse`** | `--tap` (44px) y `--fs-input` (16px) |

**Por qué el táctil NO va por ancho:** un iPad Pro mide 1024px y se maneja con el dedo. Atado a `max-width`, se quedaba con controles de 28px e inputs de 12.5px — y Safari amplía la página automáticamente al enfocar cualquier campo con menos de 16px.

### Breakpoints

| Ancho | Qué cambia |
|---|---|
| > 1100px | Escritorio: sidebar 312px, tarjetas 228px |
| ≤ 1100px | Sidebar 268px, tarjetas 200px |
| ≤ 860px | Una columna. **Los resultados van primero** y los criterios pasan a hoja inferior bajo demanda. Tarjetas 215px |
| ≤ 640px | Pestañas como barra inferior fija. Tarjetas 155px (dos por fila) |
| ≤ 400px | Una tarjeta por fila, gutter mínimo |

### Decisiones que no son obvias

**Los criterios como hoja inferior.** Al colapsar a una columna, el panel de 9 criterios quedaba encima del listado: abrías la app en el teléfono y no veías un solo inmueble. Ahora los resultados van primero (vía `order`, sin alterar el orden del DOM, que sigue siendo el correcto para lectores de pantalla) y los filtros se abren con un botón flotante que muestra cuántos hay activos.

**El header pierde el desenfoque en móvil (≤640px).** No es estético: `backdrop-filter` crea un containing block y ancla a sus descendientes `position: fixed`. Con él puesto, la barra inferior de pestañas se posicionaba *dentro del header*. Se sustituye por fondo opaco. Es la misma trampa que obligó a sacar los modales fuera del header.

**`dvh` en vez de `vh`** en la hoja de filtros y en los modales: `vh` incluye la barra de direcciones del navegador móvil, y el contenido quedaba cortado con el teclado abierto.

**Sin `maximum-scale` ni `userScalable`.** Bloquear el zoom arreglaría el problema de los 16px de un plumazo, pero rompe la accesibilidad de quien necesita ampliar (WCAG 1.4.4). Se resuelve con el tamaño de fuente.

### Cómo verificarlo

```bash
cd frontend && npm run dev
# y con playwright-core (channel "chrome", sin descargar navegadores):
#   viewport + isMobile + hasTouch, afirmando scrollWidth <= clientWidth
```

No usar capturas de Chrome headless a secas: en macOS ignora `--window-size` y renderiza a 500px CSS, así que recorta la imagen y **finge desbordamientos que no existen**.

## Rerun
workflow: firecrawl-website-design-clone · source_url: https://tinder.com/ · output: docs/DESIGN.md
