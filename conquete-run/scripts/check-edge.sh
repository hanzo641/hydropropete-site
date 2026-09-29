#!/usr/bin/env bash
# Vérifie les types des Edge Functions avec Deno (installé via npm) et que la copie du core est à jour.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
node "$ROOT/scripts/sync-core-to-edge.mjs" --check
cd "$ROOT/supabase/functions"
for f in */index.ts; do
  case "$f" in _shared/*) continue ;; esac
  npx --prefix "$ROOT" deno check --config deno.json "$f"
done
