# Directiva — Deploy

**Qué declara este archivo:** los targets de deploy de 4p-realtinder y el protocolo concreto de cada uno. El framework (`CLAUDE.md` §4, Etapa 4) define el protocolo genérico; aquí se concreta.

Este proyecto tiene **dos targets independientes**. Un deploy de uno no toca al otro, y ninguno de los dos puede tumbar al otro: el único contrato entre ambos es la tabla `listings` en Postgres.

---

## Target 1 — Frontend (Vercel)

**Qué despliega:** la app Next.js de `frontend/`.
**Disparo:** automático al mergear a `main` (CI-on-push de Vercel desde GitHub).
**Variables requeridas:** URL de Supabase y anon key, como env vars de Vercel. Sin ellas el build pasa pero el dashboard queda sin datos.
**Preview:** Vercel genera preview deployment por PR. **Verificarlo funcionalmente antes de mergear** — es el paso 3 del checklist del framework y aquí sí aplica.

**Smoke test post-deploy:**
1. La tabla de listings carga con filas
2. Los filtros de precio, ciudad, tipo de negocio y habitaciones devuelven resultados coherentes
3. La consola del navegador no muestra errores de PostgREST (401/403 indican problema de RLS o de key)

**Rollback:** promover el deployment anterior desde el dashboard de Vercel. Es instantáneo y no requiere revertir el commit.

---

## Target 2 — Ingestión (n8n en VPS)

**Qué despliega:** los workflows de `n8n-workflows/` y sus configs de `site-configs/`.
**Disparo:** manual. Importar el JSON en la instancia de n8n del VPS.
**Variables requeridas:** las credenciales viven en el vault de n8n, no en el JSON. Al importar un workflow hay que **reasignar las credenciales**: el export las trae vacías por diseño.

**Smoke test post-deploy:**
1. Ejecutar el workflow **una vez a mano**, fuera del horario agendado
2. Verificar que cada sitio devuelve más de 0 filas — cero filas en un sitio que históricamente devolvía es la señal #1 de selector roto
3. Correr el workflow **una segunda vez** y confirmar que el conteo de `listings` no cambia. Esa es la prueba de idempotencia; si sube, el `dedupe_key` está mal formado
4. Verificar que la alerta de Telegram dispara ante un sitio caído (forzable apuntando un config a un dominio inexistente)

**Rollback:** re-importar el JSON del commit anterior. Como el repo es la fuente de verdad y el pipeline es idempotente, revertir y re-correr es seguro: no duplica ni corrompe.

**Riesgo conocido:** el VPS no es un checkout de git. Un import manual desde la rama equivocada revierte la ingestión en silencio, sin rastro. Confirmar siempre desde qué commit se está importando.

---

## Regla común

El agente **solicita** el deploy y ejecuta el checklist; nunca despliega saltándose un paso, por trivial que parezca el cambio. Si un smoke test falla: rollback inmediato, registrar el aprendizaje con evidencia en `MEMORY.md`, y abrir un issue con el diagnóstico.
