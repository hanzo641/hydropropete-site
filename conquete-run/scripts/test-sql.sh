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
node "$ROOT/scripts/gen-sql-vectors.mjs" --check
if command -v pg_prove >/dev/null; then
  pg_prove --ext .sql -r "$ROOT/supabase/tests/database"
else
  fail=0
  for t in "$ROOT"/supabase/tests/database/*.sql; do
    out=$(psql -X -q -t -A -f "$t" 2>&1) || fail=1
    echo "$out" | grep -q "^not ok" && { echo "$out"; fail=1; }
  done
  [ $fail = 0 ] || exit 1
fi

# Saison de démo : le SQL généré doit s'appliquer sans erreur et produire une carte jouée.
echo "— saison de démo (Pau, 30 joueurs)"
psql -q -v ON_ERROR_STOP=1 -c "create database demo" postgres
export PGDATABASE=demo
psql -q -v ON_ERROR_STOP=1 -f "$ROOT/supabase/tests/local/bootstrap.sql" >/dev/null 2>&1 || true
psql -q -v ON_ERROR_STOP=1 -c "alter database demo set search_path = public, extensions" >/dev/null
for f in "$ROOT"/supabase/migrations/*.sql; do psql -q -v ON_ERROR_STOP=1 -f "$f" >/dev/null; done
node --experimental-strip-types --no-warnings "$ROOT/scripts/demo-season.ts" --city pau --out "$WORK/demo.sql" >/dev/null
psql -q -v ON_ERROR_STOP=1 -f "$WORK/demo.sql" >/dev/null
psql -X -q -t -A -v ON_ERROR_STOP=1 <<'SQL'
do $$
declare h int; e int; l int;
begin
  select count(*) into h from public.hex_state where owner_faction is not null;
  select count(*) into e from public.events;
  select count(*) into l from public.zone_leaderboard((select home_zone from public.profiles limit 1), 30);
  raise warning 'démo : % territoires tenus, % événements, % joueurs classés', h, e, l;
  if h < 50 or e < 10 or l < 20 then raise exception 'saison de démo incomplète'; end if;
end $$;
SQL
echo "saison de démo OK"
