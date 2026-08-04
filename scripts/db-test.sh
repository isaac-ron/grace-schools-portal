#!/usr/bin/env bash
#
# Applies every migration to a throwaway Postgres and runs the authorization
# suite against it.
#
# This is the check that matters most in this repo. The suite asserts that one
# family cannot read another family's child's records, that marks stay invisible
# until results are released, and that the CBE bands map correctly at every
# boundary. Run it after touching anything under supabase/migrations.
#
# Requires Docker. Nothing else.

set -euo pipefail

CONTAINER="grace-portal-dbtest"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS="$ROOT/supabase/migrations"
TESTS="$ROOT/supabase/tests"

cleanup() {
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "Starting throwaway Postgres..."
cleanup
docker run -d --name "$CONTAINER" \
  -e POSTGRES_PASSWORD=test \
  -e POSTGRES_DB=postgres \
  postgres:17-alpine >/dev/null

for _ in $(seq 1 60); do
  if docker exec "$CONTAINER" pg_isready -U postgres >/dev/null 2>&1; then break; fi
  sleep 1
done

run_sql() {
  docker exec -i "$CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q
}

# Supabase provides auth.users, auth.uid() and the authenticated role in a real
# project. Stubbed here so the migrations can run on plain Postgres.
echo "Applying Supabase stubs..."
run_sql < "$TESTS/_stub_supabase.sql" >/dev/null

echo "Applying migrations..."
for file in "$MIGRATIONS"/*.sql; do
  echo "  $(basename "$file")"
  run_sql < "$file" >/dev/null
done

echo "Running authorization suite..."

# One run only. The suite seeds its own fixtures, so a second pass over the same
# database collides on unique keys and reports nothing useful.
OUTPUT=$(sed 's/set client_min_messages = warning;/set client_min_messages = notice;/' \
           "$TESTS/authorization.test.sql" \
         | docker exec -i "$CONTAINER" psql -U postgres -d postgres -q 2>&1 || true)

PASSES=$(printf '%s\n' "$OUTPUT" | grep -c "^NOTICE:  pass:" || true)

if printf '%s\n' "$OUTPUT" | grep -q "ALL TESTS PASSED"; then
  echo ""
  echo "PASS: ${PASSES} assertions"
  exit 0
fi

echo ""
printf '%s\n' "$OUTPUT" | grep -E "^(ERROR|FAIL)" || true
echo ""
echo "FAIL after ${PASSES} passing assertions."
# Keep the container alive so a failure can be inspected.
trap - EXIT
echo "Container '$CONTAINER' left running for inspection. Remove with:"
echo "  docker rm -f $CONTAINER"
exit 1
