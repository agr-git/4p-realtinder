# MEMORY.global.md — Aprendizajes transversales del framework

> Aprendizajes que **le sirven a cualquier proyecto**: gotchas del entorno, rate limits de APIs compartidas, patrones de arquitectura que funcionaron, decisiones que definen el framework mismo.
>
> Este archivo viaja con la plantilla (`framework/`). Al instalar o actualizar el framework en otro proyecto, se copia junto con `FRAMEWORK.template.md`.
>
> **Limitación conocida:** en polyrepo la propagación es manual — actualizar este archivo en un repo no lo actualiza en los demás. Si el framework llega a vivir en un repo propio, este archivo se muda allí y los proyectos lo consumen desde una sola fuente.

**Formato:** ver `MEMORY.md` del proyecto. Mismas reglas: evidencia obligatoria, más recientes arriba.

---

## Registro

- **2026-07-21 — `.gitignore`: `tmp/` no cubre `.tmp/`:** Son patrones distintos; un `.gitignore` con `tmp/` deja pasar todo el contenido de `.tmp/`, que es el directorio de intermedios del framework (Sección 7). Hay que listar ambos. **Evidencia:** el `.gitignore` inicial de `4p-realtinder` (commit dbd2c95) traía solo `tmp/`; se corrigió en 2a062a4 tras contrastarlo contra la Sección 7 del framework. **Por qué importa:** los intermedios se habrían commiteado en silencio, y en un repo público eso puede significar publicar datos scrapeados con información personal.

<!-- Agrega nuevas entradas arriba de esta línea. -->
