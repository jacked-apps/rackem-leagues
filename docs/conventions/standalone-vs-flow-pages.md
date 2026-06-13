# Standalone-vs-Flow Pages — the "content + two covers" standard

When a surface is used **both standalone AND as a step in a flow** (a wizard, or a
hand-rolled setup chain), don't bake the flow's navigation into the page. Split it
into one reusable content piece + two thin covers:

1. **A CONTENT component** — the editing UI, with **no exit/footer/navigation
   chrome of its own**. It owns its data + saving and **never decides where "done"
   or "next" leads**. It exposes a footer slot (a `renderFooter` render-prop that
   receives the content's live data) so each context supplies its own exit.

2. **A STANDALONE EDIT page** — content + a single **"Done → back"** footer. Knows
   nothing about any flow step.

3. **A FLOW-STEP wrapper** — the **same** content + the flow's footer
   ("Continue → next"). The wrapper's form depends on the flow:
   - **`WizardFlowShell` wizard** → a step component that uses the existing
     `hideNext` / `hideBack` / `hideCancel` flags and calls the shell's `onNext()`
     (reference: `src/wizards/schedule-v2/ScheduleWizardStep.tsx`).
   - **Hand-rolled page chain** (pages stitched by `navigate()`) → its own
     route-page that renders the content + a footer that navigates to the next
     route.

The page **stops knowing about the next step** — that knowledge lives in the flow.

## Worked example — Teams (first adopter)

- `src/operator/TeamManagementContent.tsx` — the content (venues + teams editing;
  decomposed further into `team-management/` panels + logic hooks). Exposes
  `renderFooter`.
- `src/operator/TeamManagement.tsx` — the **edit page** (`/league/:id/manage-teams`),
  footer = **"Done → league."** No playoffs knowledge.
- `src/operator/SetupTeamsPage.tsx` — the **setup step**
  (`/league/:id/season/:sid/setup-teams`), footer = **"Continue → Playoffs."** Used
  by the season-setup chain (`SeasonCreationWizard` → here → `PlayoffsSetupWizard` →
  `ScheduleSetupPage`).

## Next adopter

**Matchups** should follow the identical shape (content + edit page + a standalone
route), so editing matchups stops re-opening the create-league wizard. See
`docs/plans/2026-06-12-001-refactor-teams-standalone-vs-setup-plan.md` (Deferred).
