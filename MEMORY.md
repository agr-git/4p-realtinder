# MEMORY.md — Registro de aprendizajes del proyecto

> Aprendizajes **específicos de 4p-realtinder**. Los transversales (que le sirven a cualquier proyecto) van en `framework/MEMORY.global.md`.
>
> Este archivo es la única fuente de verdad del registro. `CLAUDE.md`, `AGENTS.md` y `GEMINI.md` lo referencian; no lo duplican.

**Formato de cada entrada:**

```
- **YYYY-MM-DD — [Tema corto]:** Descripción en 1-3 líneas. **Evidencia:** error/ejecución/fuente que lo originó. **Por qué importa:** consecuencia práctica o cómo aplicarlo.
```

**Reglas.** Toda entrada cita evidencia rastreable; sin evidencia no se registra. Lista ordenada por fecha, más recientes arriba. No registrar detalles efímeros de una sola tarea, ni cosas ya documentadas en una directiva, ni trivialidades derivables del código. Si una entrada queda obsoleta o se contradice con otra más reciente, actualízala o elimínala. Pasadas ~25 entradas, consolida las viejas o promuévelas a la directiva que corresponda (vía PR si el cambio es estructural).

---

## Registro

- **2026-08-04 — El proyecto Supabase desapareció y tumbó login e inventario a la vez:** `mafcnszdxppuhjbhkkwn` pasó a NXDOMAIN global (el anterior `cohdesscrbslrbtbejkx`, también). No es una pausa: un proyecto pausado sí resuelve DNS. **Evidencia:** `dig @8.8.8.8 mafcnszdxppuhjbhkkwn.supabase.co` → `status: NXDOMAIN`; el bundle en producción (`page-c6c74d8520f43524.js`) seguía apuntando a ese host. **Por qué importa:** ante cualquier fallo de la app, resolver el host ANTES de leer código — un solo `dig` distingue "backend borrado" de "bug". Runbook completo en `directives/restore.md`.

- **2026-08-04 — `TypeError: Failed to fetch` NO es un problema de credenciales:** con el backend caído, `signInWithPassword` devuelve exactamente ese texto, idéntico a un fallo de red, y el usuario concluye que su contraseña está mal. **Evidencia:** reporte de `juanmigrey@rtinder.com` "no puede acceder"; las credenciales eran correctas, no había servidor. **Por qué importa:** `frontend/lib/supabaseClient.js` expone `explainError()` — todo punto que muestre un error de Supabase debe pasar por ahí, nunca imprimir `error.message` crudo.

- **2026-08-04 — El SQL de auth+RLS del PR #32 nunca se commiteó como migración:** las columnas `owner`, las políticas por usuario y el usuario de prueba se aplicaron a mano contra Supabase. **Evidencia:** `git log --oneline -- supabase/` no lista `5929c6f`; `git show --stat 5929c6f` solo toca `frontend/`. **Por qué importa:** recrear el proyecto desde las migraciones daba tablas y seed pero sin scoping — el login habría vuelto a fallar por otra causa. Recuperado en `20260727020000_auth_owner_rls.sql`. **Regla:** si un PR toca el esquema y no toca `supabase/migrations/`, el Reviewer lo bloquea.

- **2026-08-04 — Los tokens guardados en `~/.config/realtinder/` caducaron los dos:** el PAT de Supabase da 401 y el token de Vercel da 403 por scope (`alejogilris-projects`; el token es personal y `limited:true`, y el `?teamId=` no lo salva). **Evidencia:** `GET /v1/projects` → 401; `GET /v9/projects/prj_6C87P78LyibBb9Ll504Wl9VACEq0` → 403 `Not authorized ... scope "alejogilris-projects"`. **Por qué importa:** el token de Vercel debe emitirse **con scope de equipo**, no personal, o el agente no puede leer ni cambiar env vars.

- **2026-08-04 — El error de `affinity_weights` se tragaba en silencio:** `page.js` solo revisaba `l.error`, nunca `w.error`; sin pesos la afinidad se calcula contra `{}` y todos los criterios muestran "peso —" con 0% de match, sin un solo mensaje. **Evidencia:** captura del incidente con "peso —" en los 9 criterios. **Por qué importa:** en el smoke test post-deploy, "peso —" en todos los criterios es señal de que `affinity_weights` no cargó, no de que falten datos.

<!-- Agrega nuevas entradas arriba de esta línea. -->
