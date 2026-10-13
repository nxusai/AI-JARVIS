#!/bin/bash
# Installs (or updates, or removes) a client's brain on its Mac mini.
# Run by the administrator, from inside the package folder:
#
#   sudo bash instalar.sh           install or update
#   sudo bash instalar.sh quitar    stop it and remove the service (keeps the data)
#
# What it sets up:
#   - _cerebro, a hidden user with no login and no shell: the brain runs as it
#   - /Library/Application Support/Cerebro/programa   the program (root's; the brain's user can read it, nobody else)
#   - /Library/Application Support/Cerebro/datos      keys, label sets, conversations (the brain's user only)
#   - /Library/LaunchDaemons/org.cerebro.ia.plist     starts it with the Mac, hidden, and again if it stops
set -euo pipefail

LABEL="org.cerebro.ia"
USER_NAME="_cerebro"
HOME_DIR="/Library/Application Support/Cerebro"
PROGRAM="$HOME_DIR/programa"
DATA="$HOME_DIR/datos"
PLIST="/Library/LaunchDaemons/$LABEL.plist"
HERE="$(cd "$(dirname "$0")" && pwd)"

say() { printf ' %s\n' "$*"; }
fail() { printf ' ❌ %s\n' "$*" >&2; exit 1; }

[ "$(id -u)" = "0" ] || fail "Corre esto con sudo: sudo bash instalar.sh"
[ "$(uname)" = "Darwin" ] || fail "Esto es para el Mac mini del cliente."

if [ "${1:-}" = "quitar" ]; then
  launchctl bootout "system/$LABEL" 2>/dev/null || true
  rm -f "$PLIST"
  say "✅ El cerebro está apagado y ya no arranca solo. Sus datos siguen en $DATA."
  exit 0
fi

NODE=""
for n in /opt/homebrew/bin/node /usr/local/bin/node; do [ -x "$n" ] && NODE="$n" && break; done
[ -n "$NODE" ] || fail "Falta Node.js. Instálalo desde https://nodejs.org (botón LTS) y vuelve a correr esto."
[ "$("$NODE" -p 'process.versions.node.split(".")[0]')" -ge 20 ] || fail "Node.js es muy viejo. Instala el LTS de https://nodejs.org."
NPM="$(dirname "$NODE")/npm"

# The brain's user: hidden, no password, no shell, cannot log in.
if ! dscl . -read "/Users/$USER_NAME" >/dev/null 2>&1; then
  ID=""
  for i in $(seq 401 499); do
    if ! dscl . -list /Users UniqueID | awk '{print $2}' | grep -qx "$i" && ! dscl . -list /Groups PrimaryGroupID | awk '{print $2}' | grep -qx "$i"; then ID="$i"; break; fi
  done
  [ -n "$ID" ] || fail "No encontré un número libre para el usuario del cerebro."
  dscl . -create "/Groups/$USER_NAME"
  dscl . -create "/Groups/$USER_NAME" PrimaryGroupID "$ID"
  dscl . -create "/Groups/$USER_NAME" RealName "Cerebro"
  dscl . -create "/Users/$USER_NAME"
  dscl . -create "/Users/$USER_NAME" UniqueID "$ID"
  dscl . -create "/Users/$USER_NAME" PrimaryGroupID "$ID"
  dscl . -create "/Users/$USER_NAME" UserShell /usr/bin/false
  dscl . -create "/Users/$USER_NAME" NFSHomeDirectory "$HOME_DIR"
  dscl . -create "/Users/$USER_NAME" RealName "Cerebro"
  dscl . -create "/Users/$USER_NAME" IsHidden 1
  dscl . -create "/Users/$USER_NAME" Password "*"
  say "✅ Usuario escondido del cerebro creado."
fi

# Stop the running brain while its program is replaced.
launchctl bootout "system/$LABEL" 2>/dev/null || true

rm -rf "$PROGRAM.nuevo"
mkdir -p "$PROGRAM.nuevo"
cp -R "$HERE"/. "$PROGRAM.nuevo/"
rm -f "$PROGRAM.nuevo/instalar.sh"
say "Instalando lo que el cerebro necesita (unos minutos)…"
(cd "$PROGRAM.nuevo" && "$NPM" install --omit=dev --no-audit --no-fund --loglevel=error >/dev/null) || fail "No se pudo instalar. Revisa el internet y vuelve a correr esto."
# The version before stays, to go back to if this one fails.
rm -rf "$PROGRAM.anterior"
[ -d "$PROGRAM" ] && mv "$PROGRAM" "$PROGRAM.anterior"
mv "$PROGRAM.nuevo" "$PROGRAM"

mkdir -p "$DATA" "$HOME_DIR/documentos"
chown root:wheel "$HOME_DIR"
chmod 755 "$HOME_DIR"
chown -R root:"$USER_NAME" "$PROGRAM"
chmod -R u=rwX,g=rX,o= "$PROGRAM"
[ -d "$PROGRAM.anterior" ] && chown -R root:"$USER_NAME" "$PROGRAM.anterior" && chmod -R u=rwX,g=rX,o= "$PROGRAM.anterior"
chown -R "$USER_NAME:$USER_NAME" "$DATA" "$HOME_DIR/documentos"
chmod 700 "$DATA" "$HOME_DIR/documentos"

cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE</string>
    <string>$PROGRAM/cerebro.mjs</string>
  </array>
  <key>UserName</key><string>$USER_NAME</string>
  <key>GroupName</key><string>$USER_NAME</string>
  <key>WorkingDirectory</key><string>$DATA</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>CEREBRO_HOME</key><string>$HOME_DIR</string>
    <key>HOME</key><string>$DATA</string>
    <key>PATH</key><string>$(dirname "$NODE"):/usr/bin:/bin:/usr/sbin:/sbin</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>10</integer>
  <key>Umask</key><integer>63</integer>
  <key>StandardOutPath</key><string>$DATA/registro.log</string>
  <key>StandardErrorPath</key><string>$DATA/registro.log</string>
</dict>
</plist>
PLIST
chown root:wheel "$PLIST"
chmod 644 "$PLIST"
launchctl bootstrap system "$PLIST"

say "✅ Cerebro instalado ($(cat "$PROGRAM/version.txt" 2>/dev/null || echo '?')). Arranca solo con el Mac, sin ventanas."
say "Siguiente: sudo \"$NODE\" \"$PROGRAM/llaves.mjs\""
