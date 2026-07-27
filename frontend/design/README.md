# Módulo de diseño — `design/tokens.css`

**Fuente única de verdad del diseño.** Todos los colores, tipografía, espaciado, radios y sombras de la app son *design tokens* (CSS custom properties) definidos aquí. Los componentes **solo referencian** `var(--token)` — nunca hardcodean valores.

## Por qué

Para que una re-skin / rebrand / ajuste de diseño sea **por referencia**: se edita este archivo y toda la app cambia, **sin tocar el código de los componentes** (no se rompe nada). El diseño es una "variable" del sistema, no está regado por el código.

## Cómo modificar el diseño

1. Edita los valores en `tokens.css` (p. ej. cambia `--brand`, `--ground`, la escala `--sp-*`, los `--match-*`).
2. Listo — la app entera se actualiza. No edites componentes para cambios de diseño.

## Reglas

- **Prohibido** hardcodear color/espaciado/radio/sombra en un componente. Si algo no tiene token, agrégalo aquí primero y refstandalonelo.
- Los tres temas (auto por `prefers-color-scheme`, y forzados con `data-theme="dark|light"`) se definen aquí redefiniendo tokens; los componentes no saben de temas.
- Umbrales del match (`--match-hi-threshold`, `--match-mid-threshold`) viven aquí para que color y lógica compartan una sola definición.

## Grupos de tokens

| Grupo | Tokens |
|---|---|
| Marca | `--brand`, `--brand-ink`, `--brand-2` |
| Neutros | `--ground`, `--surface`, `--surface-2`, `--ink`, `--muted`, `--faint`, `--line` |
| Afinidad | `--match-hi/mid/lo`, `--db`, `--match-*-threshold` |
| Tipografía | `--font-sans`, `--fs-*` |
| Espaciado | `--sp-1..6` |
| Formas | `--r-sm/r/lg/pill`, `--shadow*` |
| Layout | `--maxw`, `--sidebar-w` |
