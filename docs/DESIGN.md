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

## Rerun
workflow: firecrawl-website-design-clone · source_url: https://tinder.com/ · output: docs/DESIGN.md
