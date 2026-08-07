# Keep-alive de Supabase (anti auto-pausa)

**Qué resuelve:** el plan Free de Supabase pausa un proyecto tras ~7 días sin **actividad de base de datos**. Tráfico web al frontend no cuenta: si nadie escribe o lee la BD, el proyecto se pausa igual. Eso fue exactamente el incidente del 2026-08-04, que tumbó login e inventario durante días (`directives/restore.md`).

**Cómo lo evita:** un job diario que hace una **escritura real** — inserta una fila ficticia en `contacts` y la borra en el mismo run. Se eligió escritura (y no un simple `SELECT`) porque un ping de lectura no garantiza contar como actividad para el criterio de pausa.

---

## Piezas

| Archivo | Dónde vive | Qué es |
|---|---|---|
| `execution/keepalive.sh` | repo (versionado) | El script. **Fuente de verdad.** |
| `execution/keepalive_install.sh` | repo (versionado) | Copia el script a `~/.config/` y carga el agente de launchd. |
| `~/.config/realtinder/keepalive.env` | local, `chmod 600` | Credenciales. **Nunca en el repo.** |
| `~/.config/realtinder/keepalive.sh` | local | Copia ejecutable que corre launchd. |
| `~/Library/LaunchAgents/com.realtinder.keepalive.plist` | local | El agente: diario a las 10:00. |
| `~/.config/realtinder/keepalive.log` | local | Historial de corridas. |

### Por qué el script se copia en vez de ejecutarse desde el repo

El clon vive bajo `~/Downloads`, que macOS protege con TCC. Un job de launchd apuntando ahí muere con `Operation not permitted` — sin importar los permisos del archivo — salvo que se le conceda Full Disk Access a launchd. `~/.config` no está protegido, así que el instalador copia el script ahí.

**Consecuencia operativa:** editar `execution/keepalive.sh` NO cambia lo que corre. Hay que re-ejecutar el instalador.

---

## Autenticación (y por qué no usa el PAT)

El script **no** usa el PAT de Management API ni la `service_role` key. Se loguea como el usuario de prueba por GoTrue y escribe con ese JWT, así que pasa por las políticas RLS normales (`contacts_own_insert` / `contacts_own_delete`, en `supabase/migrations/20260727020000_auth_owner_rls.sql`).

Ventajas: no hace falta credencial privilegiada, las filas quedan scoped al owner del usuario de prueba y no pueden tocar datos de nadie más, y si el keep-alive corre significa que **el login también funciona** — es un smoke test gratis del camino crítico.

---

## Instalar / reinstalar

```bash
cd "/Users/alejogil/Downloads/AI/4P | Realtinder/4p-realtinder"
bash execution/keepalive_install.sh
```

Antes debe existir `~/.config/realtinder/keepalive.env` con:

```bash
SUPABASE_URL='https://<ref>.supabase.co'
SUPABASE_ANON_KEY='<publishable key>'
KEEPALIVE_EMAIL='juanmigrey@rtinder.com'
KEEPALIVE_PASSWORD='<password del usuario de prueba>'
```

El instalador es idempotente: descarga el agente viejo, lo vuelve a cargar y dispara una corrida de prueba.

---

## Comprobar que sigue vivo

```bash
# Ultimas corridas (debe haber una por dia)
tail -5 ~/.config/realtinder/keepalive.log

# El agente esta cargado?  (segunda columna 0 = ultima corrida sin error)
launchctl list | grep realtinder

# Forzar una corrida ahora
launchctl kickstart -p gui/$(id -u)/com.realtinder.keepalive

# Errores del propio launchd (deberia estar vacio)
cat ~/.config/realtinder/keepalive.err.log
```

Una línea `OK` en el log tiene esta forma:

```
2026-08-07 14:01:40  OK  insert id=7 -> delete 204 -> filas 'keepalive' restantes: 0
```

`restantes: 0` es la parte importante — confirma que no quedó basura en `contacts`.

---

## Limitación conocida

Si el Mac está apagado, no corre. launchd recupera la corrida perdida al volver a encender, así que solo importa si el equipo pasa **más de 7 días seguidos** apagado. Si eso va a pasar, la alternativa robusta es mover el job al VPS (`hostinger-vps`, donde ya vive n8n): mismo script, cron diario, sin depender del portátil.

## Desinstalar

```bash
launchctl bootout gui/$(id -u)/com.realtinder.keepalive
rm ~/Library/LaunchAgents/com.realtinder.keepalive.plist
```
