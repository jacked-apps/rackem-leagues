# PLAN: Wizard v2 Cleanup — Remove Old League Creation Wizard

**Status:** Proposed
**Created:** 2026-04-17
**Context:** PR #67 (commit `2c1bf8a`) merged the new v2 "Create New League" five-stage flow into `main`, but the old single-stage wizard and its entry-point buttons were left in place. Users still land on the old wizard from most buttons; the new v2 flow is only reachable from a dev-only button and a "Continue Setup" link.

---

## Goals

1. Route every "Create League" entry point to the new v2 wizard.
2. Delete the old wizard and its dead dependencies.
3. Leave shared/unrelated code (Season wizard, forms used by other features) untouched.

## Non-Goals

- No changes to the v2 wizard itself.
- No changes to Season / Schedule / Teams / Matchups stage behavior.
- No styling or UX polish — cleanup only.

---

## Branch Strategy

**Recommendation: new branch off `main`, named `cleanup/old-wizard-removal` (or similar).**

Do **not** reuse `wizard-2-creation`:
- It was already merged in PR #67 — its history is now part of `main`.
- Reopening it would mean rebasing against its own merged work, which invites conflict noise and confuses reviewers.
- A fresh branch makes the cleanup reviewable as its own PR, separate from the feature work.

---

## Inventory Summary

### New v2 Wizard (keep, do not touch)
- `src/wizards/league-v2/` — stage 1 (League) step components + config
- `src/wizards/season-v2/`, `schedule-v2/`, `teams-v2/`, `matchups-v2/` — stages 2–5 placeholders
- `src/components/wizard/` — shared v2 framework (WizardFlowShell, WizardShell, CardSelector, etc.)
- `src/flows/createNewLeagueFlow.ts` — 5-stage orchestration
- `src/wizards/league-v2/LeagueWizardV2Page.tsx` — entry page

### Old Wizard (to remove)
- `src/operator/LeagueCreationWizard.tsx`
- `src/data/leagueWizardSteps.tsx` (older variant, zero imports)
- `src/data/leagueWizardSteps.simple.tsx` (imported only by the old wizard's hook)
- `src/hooks/useLeagueWizard.ts` (only used by old wizard — verify before delete)
- `src/constants/infoContent/leagueWizardInfoContent.tsx` (verify no other imports)

### Shared — DO NOT delete
These are used by old wizard **and** other non-wizard features:
- `src/components/forms/WizardProgress.tsx` — also used by `SeasonCreationWizard.tsx`
- `src/components/forms/WizardStepRenderer.tsx`
- `src/components/forms/QuestionStep.tsx`
- `src/components/forms/RadioChoiceStep.tsx`
- `src/components/forms/ChoiceStep.tsx`, `DualDateStep.tsx`, `DateField.tsx`
- `src/components/forms/LeaguePreview.tsx`
- `src/leagueOperator/QuestionStep.tsx`

Verify each with grep before assuming "safe to remove" — some may drop to zero refs once the old wizard is gone.

---

## Entry Points to Re-wire

| File | Line | Button | Current target | Action |
|------|------|--------|----------------|--------|
| `src/navigation/OperatorNavBar.tsx` | 43 | "➕ Create League" | `/create-league/:orgId` (old) | Change to `/create-league-v2/:orgId` |
| `src/components/operator/ActiveLeagues.tsx` | 141 | "Create Your First League" (empty state) | old | Change to v2 |
| `src/components/operator/ActiveLeagues.tsx` | 168 | "Create League (v2)" (dev-only) | v2 | **Delete** — no longer needed once main button routes to v2 |
| `src/components/operator/ActiveLeagues.tsx` | 180 | "Create New League" | old | Change to v2 |
| `src/operator/LeagueDetail.tsx` | 273 | "Continue Setup" | v2 | Already correct — no change |

Also check for any "Create League" strings elsewhere — footer, dashboard cards, sidebar, etc. Grep `create-league`, "Create League", "New League".

---

## Route Changes

In `src/navigation/NavRoutes.tsx`:
- Line 183: `create-league/:orgId` → `LeagueCreationWizard`
- Line 185: `create-league-v2/:orgId` → `LeagueWizardV2Page`

Options:
- **A.** Delete the `create-league/:orgId` route entirely and rename `create-league-v2/:orgId` → `create-league/:orgId`. Cleanest. Requires updating the four button targets to `/create-league/:orgId` (which now points to v2).
- **B.** Keep both routes for a release, remove the old one later. Adds clutter; no real upside unless we expect rollback.

**Recommendation: A.** The v2 wizard is the wizard now — the URL should reflect that.

Also remove the dev-only guard on `/create-league-v2` if the wizard is ready for all users. If not, keep the guard but flag it clearly in the PR description.

---

## Execution Order

1. Create branch `cleanup/old-wizard-removal` off `main`.
2. Re-wire the four buttons to the v2 route.
3. Delete the dev-only "Create League (v2)" button.
4. Rename route `create-league-v2` → `create-league` (after deleting the old route and old wizard component import).
5. Delete old wizard files:
   - `src/operator/LeagueCreationWizard.tsx`
   - `src/data/leagueWizardSteps.tsx`
   - `src/data/leagueWizardSteps.simple.tsx`
   - `src/hooks/useLeagueWizard.ts`
   - `src/constants/infoContent/leagueWizardInfoContent.tsx` (verify first)
6. Grep for now-orphaned imports; delete anything that drops to zero refs.
7. Update `TABLE_OF_CONTENTS.md` (required by CLAUDE.md).
8. Run `pnpm run build` + `pnpm run lint`. Fix any broken imports.
9. Manual smoke test: every "Create League" button lands on the v2 wizard.
10. Commit, push, open PR.

---

## Open Questions

1. Is the v2 wizard ready for non-dev users, or should the dev-only guard stay on?
2. Is `ScheduleCreationWizard.tsx` also dead post-v2, or still in use by something else? (Out of scope for this plan unless confirmed dead.)
3. Any external docs, onboarding guides, or tutorials that link to `/create-league/:orgId`? If yes, the URL rename needs coordination.

---

## Risks

- **Shared forms:** deleting `useLeagueWizard.ts` might remove a type or helper referenced elsewhere. Mitigation: grep each export before delete.
- **URL rename:** if anyone bookmarked `/create-league-v2/...`, they'll 404. Low risk (dev-only feature), but worth adding a redirect if we want to be safe.
- **Route-guard leakage:** if the v2 route was gated on a feature flag, removing the gate too early exposes half-finished stages 2–5. Check `LeagueWizardV2Page.tsx` for guards before flipping routes.
