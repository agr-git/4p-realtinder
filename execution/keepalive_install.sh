#!/bin/bash
# Instalador del keep-alive diario (macOS / launchd).
#
# Por que copia el script en vez de apuntar al repo: el clon vive bajo
# ~/Downloads, que macOS protege con TCC. Un job de launchd que apunte ahi
# muere con "Operation not permitted" salvo que se le de Full Disk Access a
# launchd. ~/.config no esta protegido, asi que el instalador copia el script
# ahi. La fuente de verdad sigue siendo este repo: re-ejecutar el instalador
# tras editar keepalive.sh es lo que propaga el cambio.
#
# Uso:  bash execution/keepalive_install.sh

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST_DIR="$HOME/.config/realtinder"
DEST="$DEST_DIR/keepalive.sh"
LABEL="com.realtinder.keepalive"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"

mkdir -p "$DEST_DIR" "$HOME/Library/LaunchAgents"

if [ ! -f "$DEST_DIR/keepalive.env" ]; then
  echo "ERROR: falta $DEST_DIR/keepalive.env" >&2
  echo "Debe definir SUPABASE_URL, SUPABASE_ANON_KEY, KEEPALIVE_EMAIL, KEEPALIVE_PASSWORD" >&2
  exit 1
fi

cp "$REPO_DIR/execution/keepalive.sh" "$DEST"
chmod 755 "$DEST"
echo "-> script copiado a $DEST"

cat > "$PLIST" <<PLIST_EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$DEST</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key><integer>10</integer>
    <key>Minute</key><integer>0</integer>
  </dict>
  <key>StandardOutPath</key>
  <string>$DEST_DIR/keepalive.out.log</string>
  <key>StandardErrorPath</key>
  <string>$DEST_DIR/keepalive.err.log</string>
  <key>ProcessType</key>
  <string>Background</string>
</dict>
</plist>
PLIST_EOF

plutil -lint "$PLIST" >/dev/null
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "-> agente launchd cargado ($LABEL, diario 10:00)"

launchctl kickstart -p "gui/$(id -u)/$LABEL" >/dev/null
sleep 10
echo "-> prueba de ejecucion:"
tail -1 "$DEST_DIR/keepalive.log" 2>/dev/null || echo "   (sin log todavia)"
if [ -s "$DEST_DIR/keepalive.err.log" ]; then
  echo "-> ATENCION, hubo errores:"; cat "$DEST_DIR/keepalive.err.log"
fi
