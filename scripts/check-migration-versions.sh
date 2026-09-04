#!/usr/bin/env bash
#
# Fail if two migrations in supabase/migrations/ share a version number.
#
# `supabase db push` records applied migrations in
# `supabase_migrations.schema_migrations`, keyed on the VERSION alone — the
# descriptive name after the first underscore is ignored. So two files like
#
#   20260818000000_onboarding_full_captain_name.sql
#   20260818000000_push_subscriptions.sql
#
# are a primary-key collision waiting to happen. The second one to apply dies
# with `duplicate key value violates unique constraint "schema_migrations_pkey"`.
#
# Git cannot catch this: the filenames differ, so the two files merge cleanly
# from separate branches with no conflict. Postgres is the first thing in the
# chain that actually compares them — which means it surfaces at DEPLOY time,
# against a live database, after review has passed.
#
# That is exactly what happened on 2026-08-26: the migration step runs before
# the S3 upload, so the failed deploy left staging serving a stale bundle for 8
# days while a fully-merged feature looked like it had never been written.
#
# Root cause is the legacy all-zeros filename convention (`YYYYMMDD000000`),
# which throws away the time half and relies on someone hand-bumping a counter
# for same-day migrations. That breaks the moment two are authored on the same
# day on different branches. New migrations use a real UTC timestamp down to
# the second (`supabase migration new` does this) — see CLAUDE.md.

set -euo pipefail

MIGRATIONS_DIR="${1:-supabase/migrations}"

if [ ! -d "$MIGRATIONS_DIR" ]; then
  echo "No migrations directory at '$MIGRATIONS_DIR' — nothing to check."
  exit 0
fi

# Version = everything before the first underscore.
duplicates="$(
  find "$MIGRATIONS_DIR" -maxdepth 1 -name '*.sql' -printf '%f\n' 2>/dev/null \
    | sed 's/_.*//' \
    | sort \
    | uniq -d
)"

if [ -z "$duplicates" ]; then
  count="$(find "$MIGRATIONS_DIR" -maxdepth 1 -name '*.sql' | wc -l)"
  echo "OK — $count migrations, all versions unique."
  exit 0
fi

echo "ERROR: duplicate migration version(s) found in $MIGRATIONS_DIR"
echo
while IFS= read -r version; do
  [ -z "$version" ] && continue
  echo "  version $version is used by:"
  find "$MIGRATIONS_DIR" -maxdepth 1 -name "${version}_*.sql" -printf '    %f\n' | sort
  echo
done <<< "$duplicates"

cat <<'EOF'
`supabase db push` keys schema_migrations on the version alone, so only ONE of
these can ever apply — the other fails with a duplicate-key error and aborts the
whole deploy before anything reaches S3.

To fix: renumber the migration that has NEVER been applied in any environment
(check the live database first — never renumber one whose version is already
recorded in schema_migrations). Use a real UTC timestamp:

    date -u +%Y%m%d%H%M%S

Renumber DOWN if later migrations depend on this one, so dependent files keep
their relative order. See CLAUDE.md → "Migration Filenames".
EOF

exit 1
