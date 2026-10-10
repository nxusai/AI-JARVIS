#!/usr/bin/env bash
# Prueba schema.sql en un Postgres temporal. Uso: bash tests/db/run.sh
set -euo pipefail
AQUI="$(cd "$(dirname "$0")" && pwd)"
RAIZ="$(cd "$AQUI/../.." && pwd)"
BIN="$(ls -d /usr/lib/postgresql/*/bin | sort -V | tail -1)"
DATA="$(mktemp -d)"
chmod 777 "$DATA"
COMO=""
if [ "$(id -u)" = "0" ]; then COMO="runuser -u postgres --"; chown postgres "$DATA"; fi
$COMO "$BIN/initdb" -D "$DATA/pg" -A trust -U postgres >/dev/null
$COMO "$BIN/pg_ctl" -D "$DATA/pg" -o "-p 54329 -k $DATA -c listen_addresses=''" -l "$DATA/log" -w start >/dev/null
trap '$COMO "$BIN/pg_ctl" -D "$DATA/pg" -m immediate stop >/dev/null; rm -rf "$DATA"' EXIT
export PGOPTIONS="-c client_min_messages=warning"
PSQL="psql -X -q -v ON_ERROR_STOP=1 -h $DATA -p 54329 -U postgres -d postgres"
$PSQL -f "$AQUI/supabase_stub.sql"
$PSQL -f "$RAIZ/supabase/schema.sql"
$PSQL -f "$RAIZ/supabase/schema.sql"   # se puede correr dos veces sin error
$PSQL -f "$AQUI/pruebas.sql"
echo "Pruebas de base de datos: OK"
