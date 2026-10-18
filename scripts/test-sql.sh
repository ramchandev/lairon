#!/usr/bin/env bash
# Runs every migration, the seed and all SQL test suites against a SCRATCH Postgres 16.
#   npm run test:sql                       -> starts a throwaway Docker container
#   DATABASE_URL=postgres://… npm run test:sql   -> uses that (empty!) database; never point it at a real project
set -euo pipefail
cd "$(dirname "$0")/.."

CONTAINER=""
cleanup() { [ -n "$CONTAINER" ] && docker rm -f "$CONTAINER" >/dev/null 2>&1 || true; }
trap cleanup EXIT

if [ -n "${DATABASE_URL:-}" ]; then
  psql_run() { psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q "$@"; }
else
  CONTAINER="lairon-sql-test-$$"
  docker run -d --name "$CONTAINER" -e POSTGRES_PASSWORD=pw postgres:16 >/dev/null
  for _ in $(seq 1 40); do docker exec "$CONTAINER" pg_isready -U postgres >/dev/null 2>&1 && break; sleep 1; done
  sleep 2
  psql_run() { docker exec -i "$CONTAINER" psql -U postgres -v ON_ERROR_STOP=1 -q "$@"; }
fi

echo "› stand-ins for Supabase auth/storage"; psql_run < supabase/tests/support/supabase_stub.sql
for f in supabase/migrations/*.sql; do echo "› migration $(basename "$f")"; psql_run < "$f" >/dev/null; done
echo "› seed"; psql_run < supabase/seed.sql >/dev/null 2>&1

fail=0
for t in supabase/tests/phase*.sql; do
  out=$(psql_run < "$t" 2>&1) && echo "✓ $(basename "$t")" || { echo "✗ $(basename "$t")"; echo "$out" | grep -E "ERROR|ASSERT|EXPECTED" | head -5; fail=1; }
done
[ "$fail" -eq 0 ] && echo "All SQL suites passed." || { echo "Some SQL suites FAILED."; exit 1; }
