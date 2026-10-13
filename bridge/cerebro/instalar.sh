#!/bin/bash
# Installs (or updates, or removes) a client's brain on its Mac mini.
# Run by the administrator, from inside the package folder:
#
#   sudo bash instalar.sh                  install or update
#   sudo bash instalar.sh quitar           stop it and remove the service (keeps the data)
#   sudo bash instalar.sh cambiar-llave    accept packages from a new signing key (when the old one was lost)
#
# Only packages signed with the owner's key are installed. The first install
# shows the key's fingerprint, to compare with `node scripts/cerebro.mjs llave`
# on the owner's Mac, and keeps the key in $HOME_DIR/firma.pub (the
# administrator's only); every update after must be signed with that key.
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
SEAL_KEY="$HOME_DIR/firma.pub"
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

[ -f "$HERE/firma.pub" ] && [ -f "$HERE/firma.sig" ] || fail "Este paquete no viene firmado. No se instala."
print_fingerprint() {
  "$NODE" -e 'const c=require("crypto");const k=c.createPublicKey(require("fs").readFileSync(process.argv[1],"utf8"));console.log(c.createHash("sha256").update(k.export({type:"spki",format:"der"})).digest("hex").slice(0,24).match(/.{4}/g).join(" "))' "$1"
}
confirm_key() {
  say "Huella de la llave de firma de este paquete:"
  say "    $(print_fingerprint "$HERE/firma.pub")"
  say "En la Mac del dueño, node scripts/cerebro.mjs llave debe mostrar exactamente la misma."
  printf ' ¿Es la misma? Escribe si y Enter: '
  read -r ANSWER
  [ "$ANSWER" = "si" ] || [ "$ANSWER" = "sí" ] || fail "No se instaló nada."
  mkdir -p "$HOME_DIR"
  cp "$HERE/firma.pub" "$SEAL_KEY"
  chown root:wheel "$SEAL_KEY"
  chmod 644 "$SEAL_KEY"
  say "✅ Llave de firma guardada. Desde ahora solo se instalan paquetes firmados con ella."
}
if [ "${1:-}" = "cambiar-llave" ]; then
  say "⚠️ Vas a cambiar la llave con la que se aceptan los paquetes."
  confirm_key
elif [ ! -f "$SEAL_KEY" ]; then
  confirm_key
fi

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

rm -rf "$PROGRAM.nuevo"
mkdir -p "$PROGRAM.nuevo"
cp -R "$HERE"/. "$PROGRAM.nuevo/"
rm -rf "$PROGRAM.nuevo/node_modules"
say "Instalando lo que el cerebro necesita (unos minutos)…"
(cd "$PROGRAM.nuevo" && "$NPM" install --omit=dev --no-audit --no-fund --loglevel=error >/dev/null) || fail "No se pudo instalar. Revisa el internet y vuelve a correr esto."
# The seal, on exactly what is about to run.
"$NODE" "$PROGRAM.nuevo/cerebro.mjs" verificar "$PROGRAM.nuevo" "$SEAL_KEY" || { rm -rf "$PROGRAM.nuevo"; fail "El sello no cuadra con la llave de este equipo. No se instaló nada; el cerebro sigue con su versión anterior."; }
# Only now, with the new version checked, the running brain stops to be replaced.
launchctl bootout "system/$LABEL" 2>/dev/null || true
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
