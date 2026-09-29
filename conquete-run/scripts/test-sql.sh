#!/usr/bin/env bash
# Tests SQL (pgTAP) sur un Postgres local jetable avec PostGIS + pgTAP.
# Reproduit les éléments Supabase nécessaires (schéma auth, rôles, publication realtime)
# via supabase/tests/local/bootstrap.sql. Avec la CLI Supabase, préférez : supabase test db
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
WORK="$(mktemp -d /tmp/conquete-pg.XXXXXX)"
PORT="${PGPORT_TEST:-54329}"
RUNAS=()
if [ "$(id -u)" = "0" ]; then chown -R postgres "$WORK"; RUNAS=(runuser -u postgres --); fi
cleanup() { "${RUNAS[@]}" "$PGBIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$WORK"; }
trap cleanup EXIT
"${RUNAS[@]}" "$PGBIN/initdb" -D "$WORK/data" -U postgres -A trust >/dev/null
"${RUNAS[@]}" "$PGBIN/pg_ctl" -D "$WORK/data" -o "-p $PORT -k $WORK -c listen_addresses='' -c wal_level=logical" -l "$WORK/log" -w start >/dev/null
export PGHOST="$WORK" PGPORT="$PORT" PGUSER=postgres PGOPTIONS='-c client_min_messages=warning'
psql -q -v ON_ERROR_STOP=1 -c "create database test" postgres
export PGDATABASE=test
psql -q -v ON_ERROR_STOP=1 -f "$ROOT/supabase/tests/local/bootstrap.sql" >/dev/null
for f in "$ROOT"/supabase/migrations/*.sql; do
  psql -q -v ON_ERROR_STOP=1 -f "$f" >/dev/null || { echo "échec migration $f"; exit 1; }
done
psql -q -v ON_ERROR_STOP=1 -f "$ROOT/supabase/seed.sql" >/dev/null
if command -v pg_prove >/dev/null; then
  pg_prove --ext .sql -r "$ROOT/supabase/tests/database"
else
  fail=0
  for t in "$ROOT"/supabase/tests/database/*.sql; do
    out=$(psql -X -q -t -A -f "$t" 2>&1) || fail=1
    echo "$out" | grep -q "^not ok" && { echo "$out"; fail=1; }
  done
  exit $fail
fi
