#!/usr/bin/env bash
#
# Restores a nightly backup into a throwaway Postgres and counts what came back.
#
# A backup that has never been restored is a hypothesis, not a recovery plan.
# The nightly job proves a file was produced and encrypted; only this proves the
# file contains the school's records and can be read back with the passphrase
# you actually hold.
#
# Run it after any change to the backup job, and once a term regardless.
#
# Usage:
#   scripts/restore-drill.sh                    # fetch the latest artifact
#   scripts/restore-drill.sh path/to/dump.gpg   # check a file you already have
#
# Requires Docker, gpg, and (for the no-argument form) the gh CLI.

set -euo pipefail

CONTAINER="grace-portal-restore-drill"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK="$(mktemp -d)"

cleanup() {
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  # The plaintext dump lands here. It holds every child's record, so it must not
  # outlive the drill even if the script fails partway.
  rm -rf "$WORK"
}
trap cleanup EXIT

ARCHIVE="${1:-}"

if [ -z "$ARCHIVE" ]; then
  echo "Fetching the most recent successful backup..."
  RUN_ID="$(gh run list --workflow=backup.yml --status=success \
    --limit 1 --json databaseId --jq '.[0].databaseId')"
  if [ -z "$RUN_ID" ] || [ "$RUN_ID" = "null" ]; then
    echo "No successful backup run found. Nothing to drill." >&2
    exit 1
  fi
  echo "  run $RUN_ID"
  gh run download "$RUN_ID" --dir "$WORK/artifact" >/dev/null
  ARCHIVE="$(find "$WORK/artifact" -name '*.gpg' -type f | head -1)"
  if [ -z "$ARCHIVE" ]; then
    echo "That run produced no .gpg file." >&2
    exit 1
  fi
fi

echo "Archive: $(basename "$ARCHIVE") ($(wc -c < "$ARCHIVE") bytes)"
echo ""

# Read from the terminal rather than an argument, so the passphrase stays out of
# shell history and out of the process list.
read -rsp "Backup passphrase: " PASSPHRASE
echo ""
echo ""

echo "Decrypting..."
if ! gpg --batch --yes --quiet --passphrase-fd 3 --decrypt "$ARCHIVE" 3<<<"$PASSPHRASE" \
     | gunzip > "$WORK/dump.sql" 2>/dev/null; then
  echo "" >&2
  echo "FAIL: could not decrypt. Wrong passphrase, or the file is truncated." >&2
  echo "If the passphrase in Bitwarden does not open this, the backups are" >&2
  echo "unrecoverable and BACKUP_PASSPHRASE must be rotated today." >&2
  exit 1
fi
echo "  $(wc -c < "$WORK/dump.sql") bytes of SQL"

echo "Starting throwaway Postgres..."
docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
docker run -d --name "$CONTAINER" \
  -e POSTGRES_PASSWORD=drill \
  -e POSTGRES_DB=postgres \
  postgres:17-alpine >/dev/null

for _ in $(seq 1 60); do
  if docker exec "$CONTAINER" pg_isready -U postgres >/dev/null 2>&1; then break; fi
  sleep 1
done

# Supabase owns roles and extensions that plain Postgres does not have, so a
# faithful dump always produces some noise here. Errors are counted rather than
# fatal: what decides the verdict is whether the rows arrived.
echo "Restoring (Supabase-specific noise is expected)..."
RESTORE_ERRORS=$(docker exec -i "$CONTAINER" \
  psql -U postgres -d postgres -q -v ON_ERROR_STOP=0 \
  < "$WORK/dump.sql" 2>&1 | grep -c "^ERROR:" || true)
echo "  $RESTORE_ERRORS restore errors"
echo ""

# Exact counts via query_to_xml, because pg_stat_user_tables reports estimates
# that read as zero until something runs ANALYZE.
COUNTS=$(docker exec -i "$CONTAINER" psql -U postgres -d postgres -tAF' ' -q <<'SQL'
select table_schema || '.' || table_name,
       (xpath('/row/c/text()',
              query_to_xml(format('select count(*) as c from %I.%I',
                                  table_schema, table_name),
                           false, true, '')))[1]::text::bigint as rows
from information_schema.tables
where table_schema in ('public', 'auth')
  and table_type = 'BASE TABLE'
order by rows desc, 1;
SQL
)

echo "Rows restored:"
printf '%s\n' "$COUNTS" | awk 'NF { printf "  %-40s %s\n", $1, $2 }'
echo ""

TOTAL=$(printf '%s\n' "$COUNTS" | awk '{ s += $2 } END { print s+0 }')
STUDENTS=$(printf '%s\n' "$COUNTS" | awk '$1 == "public.students" { print $2 }')
STUDENTS="${STUDENTS:-0}"

if [ "$STUDENTS" -eq 0 ]; then
  echo "FAIL: the backup restored, but public.students is empty."
  echo "This file would not bring the school back. Check that SUPABASE_DB_URL"
  echo "points at production and not a scratch project."
  exit 1
fi

echo "PASS: $STUDENTS students, $TOTAL rows total, decrypted with the stored passphrase."
echo ""
echo "Compare those counts against production before trusting them. A dump that"
echo "restores cleanly but holds last term's data is still a bad backup."
