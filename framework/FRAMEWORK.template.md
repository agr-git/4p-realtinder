# FRAMEWORK.template.md — Plantilla de instalación

> **Esta plantilla es la fuente de verdad del framework.** `CLAUDE.md`, `AGENTS.md` y `GEMINI.md` de cada proyecto son copias del bloque "Cuerpo del framework" de este archivo. Si cambias el framework, cambias esta plantilla primero y regeneras los tres.

---

## Cómo instalar en un proyecto nuevo

1. **Copiar la carpeta `framework/`** completa al nuevo repo (`FRAMEWORK.template.md` + `MEMORY.global.md`). `MEMORY.global.md` trae los aprendizajes transversales acumulados; no lo vacíes.

2. **Generar los tres archivos de instrucciones** desde el bloque de abajo. Copiar el "Cuerpo del framework" (todo lo que va después de la línea `<!-- INICIO CUERPO -->`) a `CLAUDE.md`, y duplicarlo:
   ```bash
   cp CLAUDE.md AGENTS.md && cp CLAUDE.md GEMINI.md
   ```

3. **Crear `MEMORY.md`** en la raíz, con el encabezado apuntando al nombre del proyecto. Empieza vacío salvo el formato y las reglas.

4. **Crear el esqueleto de directorios:**
   ```bash
   mkdir -p directives/workflow execution tests .tmp
   ```

5. **Crear `directives/deploy.md`** declarando el target de deploy del proyecto (Vercel, VPS, runner agendado, o "no despliega") con sus comandos, variables de entorno y mecanismo de rollback. Sin este archivo, la Etapa 4 no tiene cómo ejecutarse.

6. **Configurar `.gitignore`.** Mínimo: `.env`, `.env.*` (con `!.env.example`), `credentials.json`, `token.json`, `.tmp/`, `tmp/`. Ojo: `tmp/` **no** cubre `.tmp/`; hay que listar ambos.

7. **Crear las etiquetas de issues** que asume la Etapa 1:
   ```bash
   gh label create feature   --color 0e8a16 --force
   gh label create refactor  --color fbca04 --force
   gh label create directiva --color 5319e7 --force
   ```
   (`bug` ya existe por defecto en GitHub.)

## Cómo verificar que quedó bien instalado

```bash
md5 -q CLAUDE.md AGENTS.md GEMINI.md | uniq | wc -l   # debe imprimir 1
test -f MEMORY.md && test -f directives/deploy.md && echo "ok"
git check-ignore -q .tmp/x && echo ".tmp ignorado"
```

## Placeholders a resolver

| Placeholder | Dónde | Qué poner |
|---|---|---|
| `{{PROYECTO}}` | encabezado de `MEMORY.md` | nombre del repo, ej. `4p-realtinder` |
| `{{TARGET_DEPLOY}}` | `directives/deploy.md` | Vercel / VPS / cron runner / no aplica |

## Mantenimiento

El framework evoluciona por PR, como todo lo demás (Sección 2.1-B). Cuando cambie:
1. Editar esta plantilla en el repo donde viva la versión de referencia.
2. Regenerar `CLAUDE.md` / `AGENTS.md` / `GEMINI.md` en ese repo.
3. Propagar a los demás proyectos copiando `framework/` y regenerando.

**Deuda conocida:** la propagación entre repos es manual y no hay verificación automática de que un proyecto corra la versión vigente. Si el número de proyectos crece, conviene versionar la plantilla (`framework/VERSION`) y añadir un check en CI que compare el hash contra la referencia.

---

<!-- INICIO CUERPO -->

# Cuerpo del framework

*(Copiar desde aquí hacia abajo a `CLAUDE.md`, `AGENTS.md` y `GEMINI.md`. El contenido vigente es idéntico al `CLAUDE.md` de este repo — mantenerlos sincronizados es el paso 2 de la instalación y el paso 2 del mantenimiento.)*

Ver [`../CLAUDE.md`](../CLAUDE.md) para el texto completo y vigente del framework: arquitectura de 3 capas, sistema de memoria en dos niveles, auditoría y trazabilidad, flujo GitHub de 4 etapas, principios de operación, ciclo de auto-corrección y organización de archivos.

> **Nota de diseño.** El cuerpo no se duplica dentro de esta plantilla a propósito: una cuarta copia del mismo texto es una cuarta fuente de divergencia, exactamente el problema que motivó sacar el registro de aprendizajes de `CLAUDE.md` (issue #1). La plantilla define el **procedimiento**; `CLAUDE.md` guarda el **texto**.
