---
date: 2026-05-24
topic: screen-consistency-audit
---

# Screen Consistency & Ease-of-Use Audit

## Problem Frame

Foundational work just landed: Simonis-blue primary, status color tokens (success/warning/info/highlight), unified sidebar + mobile drawer chrome, logo, theme-token themability. Now the rest of the app is visibly inconsistent against that new foundation — auto-scans show **149 files still using hardcoded color shades** and **~24 files using native HTML form elements** instead of shadcn primitives. The goal is to systematically tour every page-level screen and bring it up to the new bar before adding more features on top.

## Requirements

- **R1. Auto-scan pre-populates per-screen findings.** Before any manual review, scan the codebase for known mechanical violations and emit each finding (file path + line + violation type) into the screen's section of the checklist. Violation categories:
  - Hardcoded color shades (`bg-X-N` / `text-X-N` / `border-X-N` where X is a Tailwind color and N ∈ 50–900) without dark-mode pairing
  - Native HTML form elements (`<button>`, `<input>`, `<select>`, `<label>`) that should be shadcn primitives
  - `text-red-*` instead of `text-destructive`
  - Missing `dark:` variants on colored backgrounds

- **R2. Per-screen manual rubric — 8 items.**
  1. Color tokens (no hardcoded shades; dark-mode safe)
  2. Component primitives (shadcn for buttons, inputs, labels, selects, cards)
  3. Active/hover states use Simonis blue treatment for nav-like elements
  4. Spacing/layout rhythm (consistent gaps, padding, container widths)
  5. Empty state present where applicable
  6. Loading state present
  7. Error state present
  8. PageHeader correct (title, backTo, subtitle, organizationId where applicable)

- **R3. Single tracking artifact** at `docs/audits/screen-audit.md`. Structure:
  - Rubric at top (definitive checklist)
  - Optional global findings (shared-component issues that cascade)
  - One section per screen with: route + component path, rubric checklist, auto-scan findings inline, status (pending / in progress / done)

- **R4. Screen ordering — highest-impact first.** Player-core screens (My Match, My Teams, Profile, Messages, Live, Score Match, Team Schedule, Stats) lead. Operator dashboards next. Auth/onboarding next. Public/marketing and stats-detail pages last.

- **R5. Cascade first, polish second.** When auto-scan or manual review surfaces an issue in a shared component (e.g. `MatchCard`, `ConflictBadge`, `AlertDialog`), fix the shared component first — its consumers get the fix for free and the per-screen pass becomes faster.

- **R6. "Done" definition per screen.** All 8 rubric items checked and either resolved or explicitly deferred (with a note). Auto-scan findings either fixed or explicitly deferred. Screen status flipped to ✅ in the tracking file.

## Success Criteria

- Zero hardcoded color shades in audited screens (excluding `src/components/ui/` shadcn primitives and tests)
- Every audited screen has empty / loading / error states or an explicit note explaining why one doesn't apply
- Every audited screen renders cleanly in light AND dark mode
- The tracking file at `docs/audits/screen-audit.md` accurately reflects which screens are done and which remain
- Subsequent screen-by-screen PRs are small and focused — one screen (or one shared-component cascade) per PR

## Scope Boundaries

- **In scope:** Page-level routes from `src/navigation/NavRoutes.tsx` (~58 routes).
- **Deferred to a follow-up:** Wizard sub-steps (Season Creation Wizard, League Wizard V2, Playoffs Setup Wizard, Matchups V2 Wizard). Each wizard is audited as a single entry in this pass; per-step audit can happen later.
- **Deferred to a follow-up:** Modals (DeleteLeagueModal, ReportUserModal, NewMessageModal, etc.). Important but distinct UX surfaces; bundle into a "modal audit" after the route audit completes.
- **Out of scope:** New features, behavior changes, route restructuring, copy rewrites beyond fixing inconsistencies. This is a polish pass, not a redesign.
- **Out of scope:** Accessibility deep-dive, copy/terminology consistency, mobile responsiveness exhaustive QA — these are in the "Comprehensive" rubric tier and can be a follow-up audit if Standard reveals systemic gaps.

## Key Decisions

- **Hybrid workflow shape**: auto-scan pre-populates findings, then screen-by-screen manual rubric pass. Mechanical wins land fast; UX polish stays per-screen.
- **Standard rubric (8 items)** chosen over Tight (5) or Comprehensive (12). Standard balances breadth with per-screen turnaround time.
- **Single markdown checklist** at `docs/audits/screen-audit.md` rather than per-screen files or GitHub issues. Skimmable, commits cleanly, low ceremony for a solo workflow.
- **Highest-impact ordering** for screen sequence: polish lands where most users see it first.
- **Cascade-first principle**: shared-component fixes propagate to many screens — chase those first to reduce per-screen work.

## Dependencies / Assumptions

- The theme tokens added in `src/index.css` (`--success`, `--warning`, `--info`, `--highlight`, plus Simonis-blue `--primary`) are the canonical color system going forward. The audit migrates everything to those tokens; we will NOT keep dark-mode-pair compatibility shims for hardcoded shades.
- `src/components/ui/*` (shadcn primitives) are correct by definition and excluded from the scan.
- Test files (`*.test.tsx`) are excluded from the scan.
- "Per-screen" means one entry per route in `NavRoutes.tsx`. Detail routes that share a component (e.g. `/rules/:game/:ruleId` and `/rules/house/...`) collapse to a single audit entry on the underlying component.

## Outstanding Questions

### Resolve Before Planning

_None — all product decisions are settled._

### Deferred to Planning

- [Affects R1][Technical] Exact regex / grep patterns for each violation category in the auto-scan. Drafts are in `CLAUDE.md` and prior conversations; a small bash script in `scripts/audit-scan.sh` would standardize re-runs.
- [Affects R5][Technical] Identify the top 10 highest-cascade shared components by counting consumer pages. The auto-scan can surface this when it runs.
- [Affects R3][Technical] Decide whether the markdown checklist should embed live counts (e.g. "23 of 58 screens done") via a small script, or stay manually maintained.

## Next Steps

→ `/ce:plan` for structured implementation planning (auto-scan script + initial checklist generation + first-screen pilot).
