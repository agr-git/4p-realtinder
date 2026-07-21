# MEMORY.global.md — Aprendizajes transversales del framework

> Aprendizajes que **le sirven a cualquier proyecto**: gotchas del entorno, rate limits de APIs compartidas, patrones de arquitectura que funcionaron, decisiones que definen el framework mismo.
>
> Este archivo viaja con la plantilla (`framework/`). Al instalar o actualizar el framework en otro proyecto, se copia junto con `FRAMEWORK.template.md`.
>
> **Limitación conocida:** en polyrepo la propagación es manual — actualizar este archivo en un repo no lo actualiza en los demás. Si el framework llega a vivir en un repo propio, este archivo se muda allí y los proyectos lo consumen desde una sola fuente.

**Formato:** ver `MEMORY.md` del proyecto. Mismas reglas: evidencia obligatoria, más recientes arriba.

---

## Registro

- **2026-07-21 — n8n en Docker: el volumen del host debe ser `1000:1000` o crashea en bucle:** Un directorio de volumen recién creado con `mkdir` queda de `root:root`, pero n8n corre como `node` (uid 1000) y no puede escribir `/home/node/.n8n/config` → `EACCES: permission denied` → reinicio infinito. **Evidencia:** al crear `n8n-main` en hostinger-vps, el contenedor reportó versión pero entró en `Restarting`; los logs mostraban `EACCES ... open '/home/node/.n8n/config'`; el volumen estaba en `0:0` mientras el de `n8n-staging` estaba en `1000:1000`. Se corrigió con `chown -R 1000:1000 /opt/n8n-main/data`. **Por qué importa:** al montar un contenedor n8n nuevo, `chown -R 1000:1000` el volumen ANTES de `docker compose up`. Aplica a cualquier imagen que corra como usuario no-root sobre un bind-mount.

- **2026-07-21 — Migrar credenciales entre instancias n8n exige la MISMA `N8N_ENCRYPTION_KEY`:** Las credenciales se exportan cifradas con la key de la instancia origen; si la instancia destino tiene otra key, importan pero quedan indescifrables. **Evidencia:** migración de 6 credenciales de `n8n-staging` a `n8n-main`; se leyó la `encryptionKey` del `config` de staging y se fijó explícita en el compose del nuevo contenedor, evitando re-teclear secretos. **Por qué importa:** para consolidar/mover n8n sin reconfigurar credenciales, fija `N8N_ENCRYPTION_KEY` = la del origen; nunca dependas de la auto-generada (se pierde si el volumen se borra).

- **2026-07-21 — `.gitignore`: `tmp/` no cubre `.tmp/`:** Son patrones distintos; un `.gitignore` con `tmp/` deja pasar todo el contenido de `.tmp/`, que es el directorio de intermedios del framework (Sección 7). Hay que listar ambos. **Evidencia:** el `.gitignore` inicial de `4p-realtinder` (commit dbd2c95) traía solo `tmp/`; se corrigió en 2a062a4 tras contrastarlo contra la Sección 7 del framework. **Por qué importa:** los intermedios se habrían commiteado en silencio, y en un repo público eso puede significar publicar datos scrapeados con información personal.

<!-- Agrega nuevas entradas arriba de esta línea. -->
