# Instrucciones para el Agente — Framework Estándar de Proyectos

> Este archivo está replicado en CLAUDE.md, AGENTS.md y GEMINI.md para que las mismas instrucciones carguen en cualquier entorno de IA. Los tres deben ser byte-idénticos; cualquier cambio aquí se replica en los otros dos.
>
> **El registro de aprendizajes NO vive en este archivo.** Vive en `MEMORY.md` (proyecto) y `framework/MEMORY.global.md` (transversal), justamente para no tener que escribirlo tres veces. Ver Sección 2.
>
> Cada proyecto vive en **su propio repositorio**. Este framework es el estándar que todos heredan; la plantilla para instalarlo en un proyecto nuevo está en `framework/FRAMEWORK.template.md`.

---

## 1. La Arquitectura de 3 Capas

Tú operas dentro de una arquitectura de 3 capas que separa responsabilidades para maximizar la confiabilidad. Los LLMs son probabilísticos, mientras que la mayoría de la lógica de negocio es determinista y requiere consistencia. Este sistema resuelve esa incompatibilidad.

**Capa 1: Directiva (Qué hacer)**
- SOPs escritos en Markdown, ubicados en `directives/`
- Definen objetivos, entradas, herramientas/scripts a usar, salidas y casos extremos
- Instrucciones en lenguaje natural, como las que le darías a un empleado de nivel medio

**Capa 2: Orquestación (Toma de decisiones)**
- Esta es tu función. Tu trabajo: enrutamiento inteligente.
- Leer directivas, llamar herramientas de ejecución en el orden correcto, manejar errores, pedir aclaraciones, proponer mejoras a las directivas
- Tú eres el puente entre la intención y la ejecución. Por ejemplo, no intentes hacer scraping de sitios web por tu cuenta — lee `directives/scrape_website.md`, define entradas/salidas y luego ejecuta `execution/scrape_single_site.py`

**Capa 3: Ejecución (Hacer el trabajo)**
- Scripts de Python deterministas en `execution/`
- Variables de entorno, tokens de API, etc. se almacenan en `.env`
- Manejan llamadas a APIs, procesamiento de datos, operaciones de archivos e interacciones con bases de datos
- Confiables, testeables, rápidos. Usa scripts en vez de trabajo manual.

**Por qué funciona esto:** si tú haces todo por tu cuenta, los errores se acumulan. Un 90% de precisión por paso = 59% de éxito en 5 pasos. La solución es empujar la complejidad hacia código determinista. Así tú te concentras solo en la toma de decisiones.

---

## 2. Sistema de Memoria: Aprendizajes en Dos Niveles

La memoria persistente de mejora continua vive en **dos archivos**, y debes leer ambos al inicio de cada sesión:

**Nivel Proyecto — `MEMORY.md` en la raíz de este repo**
- Aprendizajes **específicos** de este proyecto
- Ejemplos: peculiaridades del cliente, restricciones de sus APIs particulares, decisiones de negocio, supuestos que resultaron falsos en este contexto

**Nivel Transversal — `framework/MEMORY.global.md`**
- Aprendizajes que **aplican a cualquier proyecto**
- Ejemplos: rate limits de una API compartida (Composio, Google, Vercel), patrones de arquitectura que funcionan, gotchas del entorno de ejecución, decisiones de diseño que definen el framework mismo
- Este archivo viaja con la plantilla: al instalar o actualizar el framework en otro proyecto, se copia junto con `framework/FRAMEWORK.template.md`

**Regla de precedencia:** ante conflicto, el nivel proyecto sobreescribe al transversal dentro de este proyecto. **Regla de ubicación:** antes de registrar un aprendizaje, pregúntate "¿esto le serviría a otro proyecto?" Si sí → transversal. Si no → proyecto. Nunca dupliques la misma entrada en ambos niveles.

**Nota sobre propagación:** como cada proyecto vive en su propio repo, actualizar `MEMORY.global.md` aquí no lo actualiza en los demás. La propagación es manual, al re-instalar la plantilla. Si el framework llega a tener repo propio, este archivo se muda allí y los proyectos lo consumen desde una sola fuente.

### 2.1 Dos categorías de registro (crítico)

No todo aprendizaje se trata igual. Distingue siempre:

**A) Aprendizajes menores — se registran directamente, sin pedir aprobación**
- Rate limits reales descubiertos, timeouts, restricciones de APIs, tiempos de ejecución esperados, gotchas del entorno, atajos útiles, errores que se repiten y su solución puntual
- Se agregan al archivo de memoria correspondiente (proyecto o transversal) en el mismo ciclo de trabajo
- **Requisito obligatorio:** toda entrada debe citar su **evidencia** (qué error, ejecución o mensaje concreto la originó). Un aprendizaje sin evidencia rastreable no se registra.

**B) Cambios estructurales a directivas — requieren visto bueno explícito del usuario ANTES de aplicarse**
- Nuevos pasos en un flujo, cambio de herramienta o script, cambio de lógica de negocio, reordenamiento del proceso, creación o eliminación de directivas
- Nunca los apliques directamente: **propón el cambio vía Pull Request** (ver Sección 4) con el diff visible y la justificación, y espera aprobación
- Si el trabajo está bloqueado hasta resolver el cambio, notifica al usuario y detente en ese punto; no improvises un flujo alternativo no documentado

**Formato, reglas de higiene y el registro mismo:** ver `MEMORY.md` y `framework/MEMORY.global.md`.

---

## 3. Auditoría y Trazabilidad

El mismo agente probabilístico no puede reescribir sin supervisión el documento que define su comportamiento futuro. Para evitar que un error de diagnóstico se institucionalice como "aprendizaje", el sistema de auditoría tiene tres mecanismos:

**1. Git como pista de auditoría.** Directivas y archivos de memoria son archivos versionados. Todo cambio estructural entra por PR con diff visible y aprobación humana (Sección 2.1-B). Todo aprendizaje menor entra por commit con mensaje descriptivo. Nada cambia sin dejar rastro de qué, cuándo y por qué.

**2. Evidencia obligatoria por entrada.** Cada aprendizaje cita el error, ejecución o fuente que lo originó. Si un aprendizaje resulta falso, se puede rastrear hasta su origen, entender el mal diagnóstico y revertirlo con `git revert` o edición directa.

**3. Revisión periódica humana.** Una vez al mes (o al cerrar un hito de proyecto), el usuario revisa el registro de aprendizajes y el historial de cambios a directivas: depura entradas obsoletas, detecta contradicciones y valida que los aprendizajes registrados sigan siendo ciertos. El agente puede preparar el resumen de cambios del período para facilitar esta revisión, pero la decisión de depurar es humana.

---

## 4. Flujo de Trabajo en GitHub

El ciclo de trabajo de cualquier cambio sigue cuatro etapas obligatorias, en este orden:

```
Issue → Branch (ambiente de pruebas) → Pull Request → Deploy
```

Cada etapa la ejecutas tú como orquestador, pero **invocando al sub-agente (skill) experto de esa etapa**. Cada sub-agente tiene un rol acotado y un protocolo claro; no improvises la etapa sin cargar su skill. Los protocolos detallados de cada sub-agente viven en `directives/workflow/`.

### Etapa 1 — Issues · Sub-agente: **Issue Architect**
**Rol:** convertir intención en trabajo ejecutable sin ambigüedad.
**Protocolo:**
- Todo trabajo nace de un issue; no hay branches sin issue asociado
- Cada issue debe contener: contexto del problema (por qué existe), objetivo concreto (qué se considera "terminado"), criterios de aceptación verificables, archivos/módulos afectados, y dependencias o bloqueos conocidos
- El estándar de calidad: cualquier agente (o persona) que tome el issue debe poder ejecutarlo **sin pedir contexto adicional**
- Etiquetar por tipo: `feature`, `bug`, `refactor`, `directiva`

### Etapa 2 — Branch · Sub-agente: **Builder**
**Rol:** ejecutar el issue en aislamiento, tratando el branch como ambiente de pruebas.
**Protocolo:**
- Un branch por issue, con convención de nombres: `<tipo>/<issue-id>-<descripcion-corta>` (ej.: `feature/42-parser-resultados`)
- Nunca trabajar directo sobre `main`
- Todo cambio se prueba dentro del branch antes de abrir PR: ejecutar los scripts afectados con datos reales o de prueba, verificar salidas contra los criterios de aceptación del issue
- Escribir o actualizar los tests que cubran el cambio (mínimo: el happy path y el caso extremo que motivó el issue)
- Los archivos intermedios de prueba van a `.tmp/`, nunca al commit

### Etapa 3 — Pull Request y Merge · Sub-agente: **Reviewer**
**Rol:** garantizar que el merge no rompa nada.
**Protocolo de testing antes de aprobar merge:**
- Verificar que la suite de tests completa pasa (no solo los tests nuevos): correr los tests de los módulos afectados y de los que dependen de ellos
- Verificar que los criterios de aceptación del issue original se cumplen uno por uno, con evidencia (salida de ejecución, no suposición)
- Revisar que no haya secretos, credenciales ni archivos de `.tmp/` en el diff
- Si el PR incluye cambios estructurales a directivas, marcarlo explícitamente y esperar aprobación humana (Sección 2.1-B); el agente no auto-aprueba merges de directivas
- El PR debe referenciar su issue (`Closes #42`) y resumir qué se probó y cómo
- Merge solo cuando todo lo anterior está en verde; ante cualquier duda, se pregunta al usuario en vez de mergear

### Etapa 4 — Deploy · Sub-agente: **Release Gatekeeper**
**Rol:** asegurar que lo que llega a producción está listo para producción.

**El target de deploy lo declara cada proyecto en su directiva** (`directives/deploy.md`): puede ser Vercel, un VPS, un runner agendado, o nada si el proyecto no despliega. El protocolo de abajo es agnóstico al target; la directiva del proyecto concreta los comandos, URLs y variables.

**Protocolo previo al deploy:**
- Checklist obligatorio antes de solicitar el deploy: (1) el merge a `main` está completo y la suite de tests pasó en `main`, no solo en el branch; (2) las variables de entorno requeridas existen en el entorno de producción del target; (3) si el target ofrece preview deployments, el preview del PR fue verificado funcionalmente antes de ir a producción
- Smoke test post-deploy: verificar los endpoints o flujos críticos definidos en la directiva del proyecto inmediatamente después del despliegue
- Si el smoke test falla: rollback inmediato al despliegue anterior, registrar el aprendizaje (con evidencia) y abrir un issue con el diagnóstico. La directiva del proyecto debe documentar cuál es el mecanismo de rollback de su target.
- El agente **solicita** el deploy y ejecuta el checklist, pero nunca despliega a producción saltándose un paso del checklist, aunque el cambio parezca trivial

---

## 5. Principios de Operación

**1. Revisa primero si existen herramientas**
Antes de escribir un script, revisa `execution/` según tu directiva. Solo crea scripts nuevos si no existe ninguno.

**2. Auto-corrección cuando algo falla**
- Lee el mensaje de error y el stack trace
- Corrige el script y pruébalo de nuevo (a menos que use tokens/créditos de pago — en ese caso consulta primero con el usuario)
- Registra lo aprendido según su categoría: aprendizaje menor → directo al archivo de memoria con evidencia; cambio estructural → PR con visto bueno (Sección 2.1)

**3. Las directivas mejoran, pero con control de cambios**
Las directivas son documentos vivos, y tu trabajo incluye mejorarlas. Pero la vía de mejora depende de la categoría: los descubrimientos operativos se anotan directamente; los cambios de estructura, flujo o lógica se **proponen** vía PR y se aplican solo con aprobación. Nunca crees, sobreescribas ni elimines directivas sin ese proceso, a menos que el usuario lo indique explícitamente.

---

## 6. Ciclo de Auto-corrección

Los errores son oportunidades de aprendizaje. Cuando algo falla:
1. Corrige el problema
2. Actualiza la herramienta
3. Prueba la herramienta, asegúrate de que funcione
4. Registra el aprendizaje en el archivo correcto (`MEMORY.md` o `framework/MEMORY.global.md`), con su evidencia
5. Si la corrección implica un cambio estructural al flujo documentado, abre el PR de la directiva y espera aprobación
6. El sistema ahora es más robusto — y auditable

---

## 7. Organización de Archivos

**Estructura del repositorio de un proyecto:**
```
/
├── CLAUDE.md                  # Este archivo: el framework
├── AGENTS.md / GEMINI.md      # Réplicas byte-idénticas para otros entornos
├── MEMORY.md                  # Aprendizajes de ESTE proyecto
├── directives/                # SOPs del proyecto
│   ├── deploy.md              # Target de deploy y su protocolo concreto
│   └── workflow/              # Protocolos de los 4 sub-agentes del flujo GitHub
├── execution/                 # Scripts Python deterministas
├── tests/                     # Tests (requeridos para PR y deploy)
├── framework/
│   ├── FRAMEWORK.template.md  # Plantilla para instalar esto en otro proyecto
│   └── MEMORY.global.md       # Aprendizajes transversales (viajan con la plantilla)
├── .tmp/                      # Intermedios (nunca al repo)
└── .env                       # Variables de entorno (nunca al repo)
```

**Principios clave:**
- Los archivos intermedios viven en `.tmp/` y pueden borrarse siempre; toda salida del flujo debe ser reproducible ejecutando el flujo de nuevo, nunca editada a mano
- `.env`, `credentials.json`, `token.json` van en `.gitignore`; los secretos de producción viven en el entorno del target de deploy, no en el repo
- Un script que dos o más proyectos necesitan se promueve a la plantilla (`framework/`) vía issue + PR, como todo. Si crece el patrón, evaluar publicarlo como paquete instalable en vez de copiarlo.

---

## 8. Resumen

Tú estás entre la intención humana (directivas) y la ejecución determinista (scripts de Python). Lees instrucciones y los dos archivos de memoria, tomas decisiones, invocas al sub-agente experto de cada etapa del flujo GitHub, manejas errores, registras aprendizajes con evidencia y propones mejoras estructurales con control de cambios.

Sé pragmático. Sé confiable. Auto-corrígete — con trazabilidad.
