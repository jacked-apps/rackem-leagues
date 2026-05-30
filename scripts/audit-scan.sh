#!/usr/bin/env bash
# scripts/audit-scan.sh
#
# Scans src/ for screen-consistency violations against the new theme tokens.
# Emits markdown to stdout. Pipe to docs/audits/scan-findings.md.
#
# Patterns detected:
#   1. Hardcoded colored Tailwind shades  -- (bg|text|border)-{color}-{shade}
#      where {color} is one of the saturated palette names and {shade} is 50-950.
#      Findings without a `dark:` variant on the same line are surfaced as
#      "unpaired" (most-broken in dark mode). Lines that already carry some
#      `dark:` variant are treated as "paired" and omitted from the main list.
#   2. Native HTML form elements (<button>, <input>, <select>, <label>) where
#      shadcn primitives are expected.
#
# Exclusions:
#   - src/components/ui/**   (shadcn primitives are correct by definition)
#   - **/*.test.tsx          (tests can hardcode whatever)
#   - src/officalBCARulebook/cleaned/** (auto-generated rulebook data)
#
# Also emits a cascade-priority section: shared components in src/components/
# (outside ui/) by count of imports from page-level directories. Fixing a
# high-cascade component improves many screens at once.
#
# Output is regenerated each run. Do not hand-edit docs/audits/scan-findings.md.

# Loose error handling: `grep` returning 1 (no matches) is expected
# throughout this script and should not abort. We only fail on undefined vars.
set -u

ROOT="${1:-src}"
TODAY=$(date +%Y-%m-%d)

# Saturated Tailwind palette (excludes neutral grays — those map to theme tokens).
COLORED='(yellow|amber|blue|red|green|orange|purple|pink|indigo|teal|cyan|lime|emerald|rose|fuchsia|violet|sky)'
SHADE='(50|100|200|300|400|500|600|700|800|900|950)'
COLOR_PATTERN="(bg|text|border)-${COLORED}-${SHADE}"
NATIVE_PATTERN='<(button|input|select|label)[[:space:]>]'

# Page-level dirs used to score cascade priority.
PAGE_DIRS="$ROOT/pages $ROOT/player $ROOT/operator $ROOT/profile $ROOT/login $ROOT/leagueOperator $ROOT/about $ROOT/info $ROOT/rules $ROOT/home $ROOT/newPlayer $ROOT/completeProfile $ROOT/flows $ROOT/wizards $ROOT/dashboard"

# Emit all in-scope source files.
all_src_files() {
  find "$ROOT" -type f \( -name "*.tsx" -o -name "*.jsx" \) \
    ! -path "*/components/ui/*" \
    ! -path "*/officalBCARulebook/cleaned/*" \
    ! -name "*.test.tsx" \
    ! -name "*.test.jsx" \
    | sort
}

# Header
cat <<EOF
# Screen-audit scan findings

_Generated ${TODAY} by \`scripts/audit-scan.sh\`. Regenerate with \`pnpm audit:scan\`._

**Do not hand-edit this file.** It is regenerated each run from the source tree.
Use it as input to \`docs/audits/screen-audit.md\` (the per-screen audit checklist).

EOF

# Summary counts (handy at-a-glance).
unpaired_color_files=$(
  all_src_files | while read -r f; do
    if grep -E "$COLOR_PATTERN" "$f" 2>/dev/null | grep -qvE "dark:(bg|text|border)-"; then
      echo "$f"
    fi
  done | wc -l | tr -d ' '
)
native_files=$(
  all_src_files | while read -r f; do
    if grep -qE "$NATIVE_PATTERN" "$f" 2>/dev/null; then
      echo "$f"
    fi
  done | wc -l | tr -d ' '
)

cat <<EOF
## Summary

- **Files with unpaired hardcoded colored shades:** ${unpaired_color_files}
- **Files with native HTML form elements:** ${native_files}

EOF

# Cascade priority section
cat <<'EOF'
## Cascade priority — shared components

_Components in `src/components/` (outside `ui/`) ranked by import count from
page-level directories. Fix high-cascade components first; consumers get the
fix for free. Only components with ≥3 importers are listed._

| Component | Imports |
|---|---|
EOF

find "$ROOT/components" -type f \( -name "*.tsx" -o -name "*.jsx" \) \
  ! -path "*/components/ui/*" \
  ! -name "*.test.tsx" \
  ! -name "*.test.jsx" \
  | while read -r cfile; do
      rel=$(echo "$cfile" | sed "s|^${ROOT}/components/||; s|\.tsx$||; s|\.jsx$||")
      count=0
      for dir in $PAGE_DIRS; do
        [ -d "$dir" ] || continue
        n=$(grep -rE "from ['\"]@/components/${rel}['\"]" "$dir" --include="*.tsx" --include="*.jsx" 2>/dev/null | wc -l | tr -d ' ')
        count=$((count + n))
      done
      if [ "$count" -ge 3 ]; then
        printf "%d\t%s\n" "$count" "$rel"
      fi
    done | sort -rn | awk -F'\t' '{printf "| `%s` | %d |\n", $2, $1}'

echo ""

# Hardcoded color shade findings — grouped per file
cat <<'EOF'
## Hardcoded colored shades (unpaired)

_Lines matching `(bg|text|border)-{color}-{shade}` where the same line has no
`dark:` variant. These are the most broken in dark mode. Replace with theme
tokens (`bg-success/10`, `text-info`, `border-warning/40`, `text-destructive`,
etc.) chosen by semantic meaning, not literal color match._

EOF

all_src_files | while read -r file; do
  unpaired=$(grep -En "$COLOR_PATTERN" "$file" 2>/dev/null | grep -vE "dark:(bg|text|border)-" || true)
  if [ -n "$unpaired" ]; then
    echo "### \`$file\`"
    echo ""
    echo "$unpaired" | while IFS=: read -r line content; do
      trimmed=$(echo "$content" | sed 's/^[[:space:]]*//' | cut -c1-140)
      # Escape backticks in content so the line doesn't break markdown
      safe=$(echo "$trimmed" | sed 's/`/\\`/g')
      echo "- L${line}: \`${safe}\`"
    done
    echo ""
  fi
done

# Native HTML form elements
cat <<'EOF'
## Native HTML form elements

_Should use shadcn primitives (`Button`, `Input`, `Select`, `Label`). Note:
`<button asChild>` patterns from shadcn legitimately wrap native elements —
eyeball each occurrence to confirm it's actually a violation._

EOF

all_src_files | while read -r file; do
  matches=$(grep -En "$NATIVE_PATTERN" "$file" 2>/dev/null || true)
  if [ -n "$matches" ]; then
    echo "### \`$file\`"
    echo ""
    echo "$matches" | while IFS=: read -r line content; do
      trimmed=$(echo "$content" | sed 's/^[[:space:]]*//' | cut -c1-140)
      safe=$(echo "$trimmed" | sed 's/`/\\`/g')
      echo "- L${line}: \`${safe}\`"
    done
    echo ""
  fi
done
