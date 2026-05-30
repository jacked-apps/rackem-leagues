---
title: Cross-app screen consistency audit + per-screen polish pass
type: refactor
status: active
date: 2026-05-24
origin: docs/brainstorms/2026-05-24-screen-consistency-audit-requirements.md
---

# Cross-app screen consistency audit + per-screen polish pass

## Overview

Tour every page-level route in the app and bring it up to the new brand and theming bar established in the recent IA + Simonis-blue work. Operate via a **hybrid workflow**: an auto-scan pre-populates per-screen findings (mechanical violations), and a manual 8-item rubric pass per screen catches the eyeball-only issues. **Cascade fixes** (shared components like `PageHeader`, `InfoButton`) land first so the per-screen pass is cheaper. Output is tracked in a single living checklist at `docs/audits/screen-audit.md`.

See origin doc for the WHY and the product-level decisions: `docs/brainstorms/2026-05-24-screen-consistency-audit-requirements.md`.

## Problem Statement / Motivation

Foundational work just landed: Simonis-blue `--primary`, status color tokens (`--success`, `--warning`, `--info`, `--highlight`), unified sidebar + mobile drawer chrome, theme-token themability. Concrete debt that surfaced during that work:

- **149 source files** still contain hardcoded Tailwind color shades (`bg-green-50`, `text-blue-700`, etc.) — most without dark-mode pairs, so dark mode is visibly broken on those surfaces.
- **~24 files** use native HTML `<button>` / `<input>` / `<select>` / `<label>` instead of shadcn primitives, violating the CLAUDE.md preference.
- **No CI guardrail.** `pnpm lint` is not run in CI and the project has no Tailwind-shade lint rule. This is how the drift accumulated.
- **Shared-component leverage is huge but untapped.** `PageHeader` is imported by 39 pages; `InfoButton` by 24. Fixing those once cascades everywhere.

Without a structured pass, this debt will block further design experimentation (the whole point of moving to theme tokens was to swap themes in one place). And without a checklist, screen-by-screen drift comes back the moment we add new features.

## Proposed Solution

A hybrid, two-track workflow:

1. **Track A — Mechanical (auto-scan).** A small shell script greps the codebase for the known mechanical violations and writes findings into the checklist, grouped per-file. Re-runnable; the checklist is regenerated/diffed each PR.
2. **Track B — Eyeball (manual rubric).** Per-screen pass against an 8-item rubric. Includes things the scan can't catch: spacing rhythm, active/hover states wired through the right tokens, empty/loading/error completeness, PageHeader prop correctness.

Cascade-first sequencing: the highest-import shared components (PageHeader, InfoButton, then the long tail) are fixed before Track B starts in earnest. This means many screens get partial polish for free before they're individually audited.

## Technical Considerations

### 1. Auto-scan script (`scripts/audit-scan.sh`)

**Inputs**: `src/` (or a path argument).
**Outputs**: stdout markdown that gets piped into `docs/audits/scan-findings.md`, plus an aggregated "cascade priority" section at the top.

**Patterns to detect:**

1. **Hardcoded colored shades without a `dark:` pair on the same className.**
   - Match: `(bg|text|border)-{color}-{shade}` where color ∈ `yellow|amber|blue|red|green|orange|purple|pink|indigo|teal|cyan|lime|emerald|rose|fuchsia|violet|sky` and shade ∈ `50|100|200|300|400|500|600|700|800|900|950`.
   - Filter: skip if the *same className string* contains a matching `dark:` variant. (Approximation: same line containing `dark:` is good enough for v1.)
2. **`text-red-*`** specifically — flag as "should be `text-destructive`" since destructive is a theme token.
3. **Native HTML form elements**: `<button[ >]`, `<input[ >]`, `<select[ >]`, `<label[ >]` in `.tsx`/`.jsx`. Caveat: shadcn's `<Button asChild>` patterns can wrap native elements legitimately — surface as findings; eyeball each one.
4. **`hover:bg-accent` on nav-like surfaces** — soft signal that an interactive surface hasn't adopted the Simonis-blue hover treatment. Lower-confidence flag; eyeball.

**Exclusions** (hardcoded in script):
- `src/components/ui/**` — shadcn primitives are correct by definition.
- `**/*.test.tsx`, `**/*.test.ts` — tests can hardcode whatever.
- Auto-generated rulebook data files in `src/officalBCARulebook/cleaned/**`.

**Output contract** (per file):

```markdown
### src/player/MyTeams.tsx
- L219: `bg-yellow-100` (no dark: pair)
- L229: `bg-orange-100`, `bg-blue-100` (no dark: pair)
- L298: `bg-yellow-50` (no dark: pair)
- Native elements: none
```

**Aggregated cascade priority section** (top of file): list shared components (anything in `src/components/` outside `ui/`, plus anything imported by ≥3 page-level files) with violation counts.

**npm script wiring**: add `"audit:scan": "bash scripts/audit-scan.sh > docs/audits/scan-findings.md"` to `package.json`.

### 2. Route ↔ file mapping

Maintain manually in the audit checklist. Reason: NavRoutes.tsx imports the page components by short name (`<MyTeams />`) and resolving them to file paths via static parsing is more script complexity than the one-time cost of typing them out (~58 entries, 15 min). The checklist sections double as the mapping.

**Route handling rules** (resolves edge cases from spec-flow review):

- **Redirect-only routes** (`/dashboard → /my-teams`): skip entirely; not a screen.
- **Public routes** (Home, About, Pricing, info pages): in scope; one entry each.
- **Auth routes** (Login, Register, Forgot/Reset/Confirm/Claim): in scope; one entry each.
- **Onboarding routes** (CompleteProfile, NewPlayer, BecomeLO, LOApplication): in scope; one entry each.
- **Member routes**: in scope; one entry each.
- **Operator routes**: in scope; one entry each.
- **`DevOnly` routes** (`/dev/rls-tests`, `/test/handicap-lookup`, `/admin-reports`): explicitly marked **out of scope** for v1; tracked separately with status `dev-only-deferred`.
- **Wizards**: see Wizard scoping below.
- **Routes sharing a page component** (e.g. `/rules`, `/rules/:game/:ruleId`, `/rules/house/:scope/:scopeId/:ruleId` → all consume the rules module): collapse to one audit entry on the underlying component; the entry header lists all routes that hit it.
- **Tabbed/multi-view routes** (e.g. `OperatorDashboard` with multiple inner tabs, `LeagueDetail` likewise): each visible tab is a sub-checklist within the screen entry. Use sub-sections (`#### Tab: <name>`) and 8-item rubrics per tab where the tabs render meaningfully different surfaces.
- **404 / catch-all**: add one entry; if no 404 page exists today, the audit surfaces it (deferred to follow-up since it's a new feature, not a polish).
- **Role-gated states** (loading spinner, "access denied" view from `ProtectedRoute`): explicit **out of scope** for v1; documented as a follow-up "auth state audit."

### 3. Wizard scoping

Per the repo-research agent's findings, wizards are not a uniform shape:

- **League Wizard V2** — one entry. Single `PageHeader`, single `WizardFlowShell`, composes 18 league steps + 3 schedule + 3 teams + 3 matchups = 27 steps via `createNewLeagueFlow`. Audit the shell chrome here; step-by-step audit is deferred.
- **Season Creation Wizard** — one entry. Custom reducer-driven step switching with `WizardProgress`. Audit the shell + first 2 steps as a sample; defer the rest.
- **Playoffs Setup Wizard** — one entry (effectively a single page; not multi-step).
- **Matchups V2 "wizard"** — NOT a separate route. It's a sub-stage inside `createNewLeagueFlow`. Already covered by League Wizard V2 entry.

Per-step audit is a follow-up scope item (mentioned in origin doc Scope Boundaries).

### 4. Rubric — pass/fail definitions

Origin spec gave the 8 items; this plan defines what counts as passing for each:

| # | Item | Pass = | N/A allowed when |
|---|---|---|---|
| 1 | Color tokens | No hardcoded `(bg\|text\|border)-{color}-{shade}` flagged by scan, OR every flag has been individually justified inline (e.g. semantic neutral like `bg-yellow-200` for the search-highlight `<mark>`) | n/a |
| 2 | Component primitives | No native `<button>` / `<input>` / `<select>` / `<label>` from scan, OR each instance is intentional (e.g. inside an `asChild` slot) | Screen renders no form/button surfaces |
| 3 | Active/hover states | All clickable nav-like elements use `hover:bg-primary/10`, active state `bg-primary/15`. Non-nav buttons use shadcn variants | Screen has no interactive nav elements |
| 4 | Spacing rhythm | Padding/gap classes consistent within the screen (no `gap-3` next to `gap-4` between sibling sections without intent); container width matches sibling pages in same area | n/a — always evaluable |
| 5 | Empty state | The screen renders a friendly empty UI when data is absent/empty | Screen renders no list/grid/data view |
| 6 | Loading state | Async data fetches render a skeleton or spinner | Screen does no async fetch |
| 7 | Error state | Async errors render a fallback (not a blank page or console error) | Screen does no async fetch |
| 8 | PageHeader correct | Imports `<PageHeader>`, passes correct `title`, `backTo` where contextually expected, `subtitle` where useful, `organizationId` on operator pages | Screen is intentionally chromeless (e.g. auth flows). Document the reason inline |

For each rubric item the checklist allows three states: `[x]` pass, `[ ]` pending, `[N/A]` not applicable with one-line reason.

### 5. Deferral protocol

When a finding can't be fixed in the same PR (refactor too large, behavior change risk, blocked on upstream):

```markdown
> ⚠ Deferred: <one-line reason>. Follow-up: <link to issue/plan or inline TODO line>.
```

A screen can be marked ✅ done with deferrals — but every deferral must have either a follow-up issue link or be tracked in a "Deferrals" appendix at the bottom of the audit doc. The closeout phase reviews the appendix.

### 6. Conflict resolution rules

- **Cascade-first beats highest-impact-first** only for the top 3 cascade targets (PageHeader, InfoButton, StatsNavBar). Below that, interleave with per-screen polish.
- **Multi-screen cascade PRs** update affected screens' status to `cascade-fixed, awaiting verify` (not ✅). Per-screen pass later flips to ✅ after eyeballing the consumer.
- **"No behavior changes" exception**: swapping native form elements for shadcn primitives changes keyboard/focus/event details — this is acceptable and considered an upgrade. Document the convention in the audit doc preamble.

### 7. Manual-eyeball items (rubric-adjacent)

The 8-item rubric doesn't catch everything. Surface these in a "Look-for-these" sidebar in the audit doc, so auditors keep them in peripheral vision without adding rubric items:

- Spacing/typography drift across pages in the same area
- Hover with stale colors *via a parent* (parent paints over a shadcn Button)
- Lucide icon size/stroke inconsistency
- Button hierarchy (two primary CTAs in one view)
- Card density & border-radius drift
- `PageHeader` prop misuse (stale `backTo`, missing `organizationId`)
- Loading skeleton ↔ final layout mismatch (layout shift)
- Mobile drawer parity (pages with custom headers may bypass the unified drawer)
- Toast/notification one-off styling
- Form validation messages using `text-red-600 dark:text-red-400` (has dark pair, but wrong token)
- Cascade-introduced regressions (re-verify in light AND dark after every cascade PR)

### 8. Pages flagged by the cascade analyst as bypassing `PageHeader`

Pre-known rubric-item-8 risks (eyeball priority):

- `src/pages/MatchDataViewer.tsx`, `src/pages/PlayerProfile.tsx`, `src/pages/AdminReports.tsx`
- `src/player/ScoreMatch.tsx`, `src/player/MatchLineup.tsx`
- `src/operator/OperatorWelcome.tsx`
- `src/info/EightManFormatDetails.tsx`, `FiveManFormatDetails.tsx`, `FormatComparison.tsx`
- `src/pages/HandicapLookupTest.tsx` (dev-only — out of scope)

Some of these legitimately want chromeless layouts (auth flows, info pages). The audit decides per-screen whether to add `<PageHeader>` or document the deliberate omission.

## System-Wide Impact

- **Interaction graph**: scan → checklist → cascade PRs (shared components) → consumer pages auto-update → per-screen PRs → checklist status flips. Each cascade PR ripples into N consumers, including deferred surfaces (modals, wizards) — those get "free polish" but are not re-verified in this pass.
- **Error / failure propagation**: not applicable (this is a docs + refactor pass with no runtime behavior changes other than shadcn primitive swaps).
- **State lifecycle risks**: none — no persistent data touched.
- **API surface parity**: native-form-element → shadcn primitive swaps change keyboard/focus/event semantics. Acceptable, but worth scanning tests after each form-element migration.
- **Integration test scenarios**: visual regression coverage doesn't exist. Plan to manually verify each PR in dev server, light + dark mode. Add a follow-up issue for Storybook + Chromatic if regressions appear repeatedly.

## Acceptance Criteria

### Functional

- [ ] `scripts/audit-scan.sh` exists, is executable, and produces `docs/audits/scan-findings.md` when invoked.
- [ ] `pnpm audit:scan` runs the script (added to `package.json`).
- [ ] `docs/audits/screen-audit.md` exists with: preamble (rules, conventions, exception policy), rubric definitions, manual-eyeball "Look-for-these" sidebar, cascade priority list, per-screen sections for every in-scope route from §Technical Considerations item 2.
- [ ] Each per-screen section in the checklist includes: route(s), page component file path, current scan findings, 8-item rubric checklist, status badge (pending/in-progress/cascade-fixed/done/skipped).
- [ ] Top-3 cascade targets (`PageHeader`, `InfoButton`, `StatsNavBar`) are audited and fixed first; each is its own PR.
- [ ] At least 1 pilot per-screen PR lands before scaling out (recommendation: `MyTeams` since it's the landing page for logged-in users).

### Quality gates

- [ ] After cascade PRs land, re-running `pnpm audit:scan` shows reduced violation counts in `docs/audits/scan-findings.md`.
- [ ] After full audit pass, scan shows **zero** hardcoded color shades in audited screens (excludes `src/components/ui/`, tests, and explicitly justified inline cases).
- [ ] Each audit PR description references the rows in `docs/audits/screen-audit.md` it updates (PR ↔ checklist traceability).
- [ ] Each per-screen PR includes a brief note confirming light + dark mode were both visually verified.
- [ ] Deferrals appendix at the bottom of the audit doc is non-stale (every deferral has a follow-up reference or TODO).

### Success metrics

- 100% of in-scope screens have a checklist section and a status.
- 100% of audited screens pass rubric items 1 (color tokens) and 2 (component primitives) — measurable via scan.
- ≥ 90% of audited screens pass all 8 rubric items (a few will have legitimate deferrals).
- Audit PRs are small: median ≤ 100 LOC changed, max ~300 LOC excluding cascade PRs.

## Implementation Phases

### Phase 1: Tooling & artifact scaffolding (1 PR)

- [ ] Write `scripts/audit-scan.sh` with patterns from §Technical Considerations item 1.
- [ ] Add `audit:scan` script to `package.json`.
- [ ] Run the scan; commit `docs/audits/scan-findings.md` as the initial baseline.
- [ ] Author `docs/audits/screen-audit.md` skeleton: preamble, rubric definitions, look-for-these sidebar, cascade priority list, route ↔ file mapping for all ~58 in-scope routes (status: `pending`), deferrals appendix (empty).

### Phase 2: Top cascade fixes (1 PR per cascade)

Order:

1. `PageHeader` (39 consumers) — audit its 8 rubric items, fix all findings. Also fix the bypass-pages list (decide per-screen: add header or document omission). After landing, re-run scan; update all 39 consumers' status to `cascade-fixed`.
2. `InfoButton` (24 consumers) — same pattern.
3. `StatsNavBar` (4 consumers) — same.

These three alone should clear the bulk of color-shade violations in shared chrome.

### Phase 3: Pilot per-screen audit (1 PR)

Pilot screen: **`MyTeams`** (it's the de-facto home for logged-in users; high cascade dependency on `MatchCard`-type cards; will surface workflow rough edges early).

- [ ] Run rubric on MyTeams.
- [ ] Fix findings.
- [ ] Update checklist status.
- [ ] Document any workflow tweaks discovered (e.g., adjusting rubric definitions, scan patterns).

### Phase 4: Highest-impact per-screen sweep (multiple PRs)

Order (highest-impact first per origin R4):

1. `MyMatch`, `MyTeams` (done in pilot), `TeamSchedule`, `MatchLineup`, `ScoreMatch`
2. `Messages`, `Profile`, `PlayerStats`, `SpectateMyLiveMatches`, `SpectateLiveMatches`
3. `OperatorDashboard`, `OperatorWelcome`, `PlayerManagement`, `LeagueDetail`, `LeagueSettings`
4. Other operator (Reports, OrganizationSettings, PlayoffSetup, etc.)
5. Onboarding (CompleteProfile, NewPlayer, BecomeLO, LOApplication)
6. Auth (Login, Register, Forgot/Reset, Claim, Confirm)
7. Public (Home, About, Pricing)
8. Info pages, format-comparison, stats deep-views, wizards (one entry per wizard per §Wizard scoping)

Each PR audits 1–3 closely related screens; updates the checklist.

### Phase 5: Closeout (1 PR)

- [ ] Re-run `pnpm audit:scan`; commit the final scan output.
- [ ] Verify acceptance criteria above are met.
- [ ] Review deferrals appendix; spin out follow-up issues for unresolved items.
- [ ] Decide on follow-up scope: (a) wizard sub-step audit, (b) modal audit, (c) Comprehensive rubric (a11y, copy, mobile-responsive QA), (d) Storybook + visual regression infrastructure.

## Dependencies & Risks

- **CI doesn't run lint** — if we add a lint rule later for hardcoded shades, CI must run it or the rule will be ignored. Not blocking this plan but worth noting.
- **Scan false positives** — pattern 4 (`hover:bg-accent` on nav-like surfaces) is fuzzy. Treat its findings as advisory only.
- **Cascade regressions** — fixing `PageHeader` touches 39 pages. Risk of visual regression on a page we didn't think of. Mitigation: manually click through each consumer page in dev server after the cascade PR, in both light + dark mode. Document this as a PR template step.
- **Token semantic confusion** — replacing `bg-green-50` blindly with `bg-success/10` loses nuance (sometimes green means "completed," sometimes "available," sometimes just decorative). Mitigation: when fixing color findings, pick the *semantic* token (`success` vs `info` vs `highlight` vs neutral `muted`) — not the literal color match.
- **Scope creep into deferred surfaces** — cascade fixes ripple into modals and wizards (deferred scope). They get free polish; we accept the upside but do not promise verification.
- **PR fatigue** — 58 per-screen PRs is a lot. Batch closely related screens (e.g., the 5 player-stats pages in one PR). Cap each PR at ~300 LOC excluding cascade PRs.
- **No automated dark-mode QA** — manual eyeball only. Risk of dark-mode-only regressions slipping through. Mitigation: explicit checklist item per PR; if pattern emerges, invest in Storybook + Chromatic later.

## Sources & References

### Origin

- **Origin document:** [docs/brainstorms/2026-05-24-screen-consistency-audit-requirements.md](../brainstorms/2026-05-24-screen-consistency-audit-requirements.md)
- Key decisions carried forward:
  - Hybrid workflow (auto-scan + per-screen rubric)
  - Standard 8-item rubric
  - Single markdown checklist artifact at `docs/audits/screen-audit.md`
  - Highest-impact ordering, with cascade-first override for top 3 components
  - Scope: page-level routes only; wizards as single entries; modals and wizard sub-steps deferred

### Internal references

- Theme tokens: `src/index.css:24-48, 122-153`
- Cascade target #1 (39 consumers): `src/components/PageHeader.tsx`
- Cascade target #2 (24 consumers): `src/components/InfoButton.tsx`
- Layout wrapper: `src/components/layout/MemberLayout.tsx`
- Sidebar (chrome blueprint for nav surfaces): `src/components/layout/AppSidebar.tsx`
- Mobile drawer (mirrors sidebar): `src/components/layout/AppDrawer.tsx`
- Route registry: `src/navigation/NavRoutes.tsx`
- shadcn primitives (excluded from scan): `src/components/ui/`
- Existing eslint config (does not lint Tailwind shades): `eslint.config.js`
- CI workflows (do not run lint): `.github/workflows/deploy-staging.yml`, `.github/workflows/deploy-production.yml`
- Prior IA / theme PR landed: PR #124
- Latest nav-consistency PR (Simonis-blue unification): PR #131

### Related conventions

- `CLAUDE.md` user preferences:
  - "USE SHADCN COMPONENTS FOR EVERYTHING" — informs rubric item 2
  - "Best Practices Over Convenience" — informs cascade-first principle
  - "Take smaller bites of tasks" — informs the one-screen-per-PR cadence

## Outstanding / Deferred Questions

- **Live status counts in the checklist** (e.g. "23 of 58 done") — deferred from origin doc. Recommend revisiting after Phase 4 if manual maintenance becomes annoying.
- **Linter integration** — add a `no-restricted-syntax` ESLint rule for the hardcoded-shade patterns once Phase 4 is well underway, so new code can't reintroduce drift. Track as a closeout follow-up.
- **Visual regression infra** — if Phase 2/3 surfaces dark-mode regressions, evaluate Storybook + Chromatic in closeout.
