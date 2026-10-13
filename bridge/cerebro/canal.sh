#!/bin/bash
# The only door from the owner's system into a brain. It is reached over SSH
# with one key, the owner's system's own, and that key can run nothing but
# this script (a forced command, installed by instalar.sh); this script, in
# turn, does nothing but the orders below. The brain itself holds no key, no
# address and no way into the owner's system: it is only ever asked.
#
#   estado          how the brain is (its state file, and whether the service is loaded)
#   espejo          a copy of the label sets, the group's record and the state, to keep upstairs
#   registro        the last lines of its log
#   paquete         installs the signed package that comes in (the installer checks the seal)
#   datos           applies the signed data that comes in (label sets, the group, voices, the owner)
#   reiniciar       restarts it
#   apagar          stops it (it does not start again until prender)
#   prender         starts it again
#   borrar-llaves   emergency: deletes its keys and stops it
set -uo pipefail

LABEL="org.cerebro.ia"
HOME_DIR="${CEREBRO_HOME:-/Library/Application Support/Cerebro}"
PROGRAM="$HOME_DIR/programa"
DATA="$HOME_DIR/datos"
PLIST="/Library/LaunchDaemons/$LABEL.plist"
SEAL_KEY="$HOME_DIR/firma.pub"
USER_NAME="${CEREBRO_USER:-_cerebro}"
LAUNCHCTL="${CEREBRO_LAUNCHCTL:-/bin/launchctl}"

NODE=""
for n in ${CEREBRO_NODE:-} /opt/homebrew/bin/node /usr/local/bin/node; do [ -x "$n" ] && NODE="$n" && break; done

ORDER="${SSH_ORIGINAL_COMMAND:-${1:-}}"
service() { [ -x "$LAUNCHCTL" ] && "$LAUNCHCTL" "$@"; }

case "$ORDER" in
  estado)
    if service print "system/$LABEL" >/dev/null 2>&1; then LOADED=true; else LOADED=false; fi
    printf '{"servicio":%s,"estado":%s}\n' "$LOADED" "$(cat "$DATA/estado.json" 2>/dev/null || echo null)"
    ;;
  espejo)
    cd "$DATA" || exit 1
    PARTS=""
    for p in etiquetas estado.json cerebro.json; do [ -e "$p" ] && PARTS="$PARTS $p"; done
    # Never the keys, the bot's token, the conversations' sessions or the files people sent.
    if [ -z "$PARTS" ]; then tar -czf - -T /dev/null; exit 0; fi
    # shellcheck disable=SC2086
    tar -czf - --exclude 'etiquetas/recibidos' $PARTS
    ;;
  registro)
    if [ -f "$DATA/registro.log" ]; then tail -n 200 "$DATA/registro.log"; else echo "todavía no hay registro"; fi
    ;;
  paquete)
    [ -n "$NODE" ] || { echo "falta Node.js"; exit 1; }
    T="$(mktemp -d)"
    trap 'rm -rf "$T"' EXIT
    tar -xzf - -C "$T" || { echo "el paquete llegó dañado"; exit 1; }
    DIR="$(dirname "$(find "$T" -maxdepth 2 -name instalar.sh | head -1)")"
    [ -f "$DIR/instalar.sh" ] || { echo "no es un paquete del cerebro"; exit 1; }
    # No terminal here: if this brain had no key yet, the installer stops (the first install is in person).
    bash "$DIR/instalar.sh" </dev/null
    ;;
  datos)
    [ -n "$NODE" ] || { echo "falta Node.js"; exit 1; }
    T="$(mktemp -d)"
    trap 'rm -rf "$T"' EXIT
    head -c 20000000 > "$T/datos.json"
    "$NODE" "$PROGRAM/cerebro.mjs" datos "$T/datos.json" "$SEAL_KEY" || exit 1
    chown -R "$USER_NAME:$USER_NAME" "$DATA" 2>/dev/null
    service kickstart -k "system/$LABEL" >/dev/null 2>&1
    echo "aplicados; el cerebro se reinició"
    ;;
  reiniciar)
    service kickstart -k "system/$LABEL" && echo "reiniciado"
    ;;
  apagar)
    service bootout "system/$LABEL" 2>/dev/null
    echo "apagado"
    ;;
  prender)
    service bootstrap system "$PLIST" 2>/dev/null
    echo "prendido"
    ;;
  borrar-llaves)
    service bootout "system/$LABEL" 2>/dev/null
    rm -f "$DATA/llaves.json"
    [ -n "$NODE" ] && [ -f "$DATA/anasofi.json" ] && "$NODE" -e 'const f=process.argv[1];const fs=require("fs");const c=JSON.parse(fs.readFileSync(f,"utf8"));delete c.token;fs.writeFileSync(f,JSON.stringify(c,null,2)+"\n")' "$DATA/anasofi.json"
    echo "llaves borradas y cerebro apagado"
    ;;
  *)
    echo "orden no permitida"
    exit 2
    ;;
esac
