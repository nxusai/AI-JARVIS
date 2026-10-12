#!/usr/bin/env bash
# Prueba la migración y el flujo completo (ruta, entregas, cobros, cierre) en un
# Postgres local, sin Docker ni Supabase. Uso: DATABASE_URL=postgres://... ./scripts/probar-db.sh
# Sin DATABASE_URL usa la base "abuelito_prueba" del Postgres local.
set -euo pipefail
cd "$(dirname "$0")/.."
DB=${DATABASE_URL:-abuelito_prueba}
if [ -z "${DATABASE_URL:-}" ]; then
  dropdb --if-exists abuelito_prueba
  createdb abuelito_prueba
fi
for f in supabase/tests/simulacion_supabase.sql supabase/migrations/*.sql supabase/seed.sql supabase/tests/flujo_completo.sql; do
  echo "== $f"
  psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$f"
done
