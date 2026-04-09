# Wizard 2.0 Framework

**Branch Name:** `wizard-2-creation`
**Depends On:** `main`
**Blocks:** `modular-handicap-config` (Branch 1) — wait for this branch to merge before resuming Branch 1
**Goal:** Build a clean, reusable wizard framework with **two layers** (Wizard + WizardFlow) that supports both standalone wizards and multi-stage user journeys with unified progress tracking. Rebuild the League Creation experience as the first consumer. Zero new user-facing features — pure architectural rebuild for maintainability and future extensibility.

---

## Why This Branch Exists

The current League Creation Wizard has real architectural problems that will compound as we add more configurability (Branches 1–4):

1. **`getValue` / `setValue` closures** — steps don't receive props, they close over parent state. Untestable in isolation, hard to reason about.
2. **Closed step type union** (`'input' | 'choice' | 'radio'`) — anything more complex than a text field or radio group breaks the pattern. Branch 1's `TeamFormatStep` is the first thing that doesn't fit.
3. **Three different wizard patterns exist** in the codebase (League uses a hook, Season uses a reducer, Playoffs uses card-based config) — no shared chrome, no shared persistence, no consistency.
4. **localStorage on every keystroke** — performance smell.
5. **Fragile string parsing** for combined fields like `"5_man|custom_5man"`.

Rather than fight the existing wizard for the next 4 branches, build a clean foundation once. Pay ~1 extra week now to save 3+ weeks later.

---

## Scope

### In Scope (v1)

**Framework (both layers):**
- **Wizard Shell** — reusable component handling progress bar, navigation, persistence, error display
- **Step Contract** — standard prop interface every step component implements
- **Zod schemas** — per-wizard validation and type definitions (also serves as future AI-readable layer)
- **Step Registry** — declarative list of steps with IDs, optional/conditional support
- **WizardFlow Shell** — outer wrapper that composes multiple wizards into a multi-stage journey with unified progress
- **Flow Registry** — declarative list of flows (e.g., "Create New League", "Start New Season")
- **Save-per-stage persistence** — each completed stage saves to the database so users can resume cleanly from any stage
- **localStorage scratch state** — debounced, for in-progress data within a single wizard step

**First consumer:**
- **"Create New League" flow** — first flow built on the framework
- **League Creation Wizard rebuild** — first wizard inside the flow, pure parity with existing behavior
- **Placeholder stages** for Season → Schedule → Teams → Matchups inside the flow that link to existing implementations until they're rebuilt in subsequent branches

**Dev/testing:**
- **Hidden dev route** — `/operator/leagues/create-v2` accessible during development
- **Side-by-side testing** — old and new wizards both work, allowing direct comparison

### Explicitly NOT in Scope

These will tempt us. Resist them. Each one alone would derail the branch.

- ❌ Schema-driven UI rendering (auto-generating forms from schemas)
- ❌ AI integration of any kind
- ❌ **Rebuilding** Season, Schedule, Team, or Matchup wizards on the new framework (they remain as-is and are linked to from the flow as placeholder stages — full rebuilds happen in subsequent branches)
- ❌ Touching Playoffs Setup Wizard (it's not a linear wizard, leave it alone)
- ❌ Adding new fields, new validation rules, or new UX to League Creation
- ❌ Theme system, plugin system, or other "framework-y" extras
- ❌ Rewriting `WizardStepRenderer` to support both old and new patterns
- ❌ Changing the `LeagueFormData` shape or any database schema
- ❌ Fixing the team cascade delete bug or missing matchup edit UI (tracked separately as tech debt)
- ❌ Building the "Start New Season" flow (planned but not implemented in v1 — only the architecture supports it)

**Mantra:** "If it's not required to ship the new league wizard at parity, it doesn't go in this branch."

---

## Two-Layer Architecture

The framework has two layers that work together:

### Layer 1: Wizard
A single multi-step form. Has its own steps, validation, navigation, and internal state. Examples: League Wizard, Season Wizard, Schedule Wizard, Team Wizard, Matchup Wizard.

A Wizard can run **standalone** (e.g., "edit team setup") or **inside a Flow** (as one stage of a larger journey).

### Layer 2: WizardFlow
A sequence of Wizards composed together to accomplish a larger user goal. Has its own progress bar that reflects progress across the entire journey, not just the current wizard.

**Examples of flows:**

| Flow | Purpose | Wizards in sequence |
|------|---------|---------------------|
| **Create New League** | First-time league setup | League → Season → Schedule → Teams → Matchups (5 stages) |
| **Start New Season** | Recurring season setup for existing league | Season → Schedule → Teams (edit mode) → Matchups (4 stages) |

The same Season Wizard is used in both flows. It just receives different starting context (no league context vs. existing league context).

### Why two layers?

- **Wizards are reusable building blocks.** Same wizard, different flow contexts.
- **Flows model real user goals.** A user thinks "I'm setting up a new league," not "I'm using the league wizard, then I'll separately use the season wizard."
- **Progress is meaningful.** Single status bar shows "% of this whole goal," not "% of one wizard out of five."
- **Save-per-stage works naturally.** Each completed stage commits its data, so users can pause anywhere and resume cleanly.
- **Standalone editing still works.** You can launch any wizard outside a flow to edit existing data.

---

## Architecture Overview (Wizard Layer Internals)

The Wizard layer is 4 pieces:

### 1. Wizard Shell (`WizardShell.tsx`)

Reusable component that handles all the chrome inside a single wizard:

- Step transitions (within the wizard)
- Back / Next buttons
- Step-level error display
- Conditional/optional step skipping
- Per-wizard scratch state in localStorage (debounced)

The shell is generic — it doesn't know anything about leagues, seasons, or any specific wizard. It just renders steps in order. When the wizard completes, it reports its result to the WizardFlow shell (or to whatever launched it standalone).

### 2. Step Contract

Every step component receives a standard set of props:

```typescript
interface WizardStepProps<TValue, TFormData> {
  // Current value for this step's slice of form data
  value: TValue;

  // Update this step's value
  onChange: (value: TValue) => void;

  // Validation errors for this step (from zod or custom validators)
  errors: string[];

  // Read-only access to the full form data (for steps that depend on earlier choices)
  formData: TFormData;

  // Programmatic step advancement (rarely used by step itself; mostly for shell)
  onNext: () => void;
}
```

Steps are plain React components. No closures. No magic. Easy to test in isolation.

### 3. Zod Schemas

Each wizard defines its data shape and validation rules in one place:

```typescript
const leagueWizardSchema = z.object({
  gameType: z.enum(['8-ball', '9-ball', '10-ball']),
  startDate: z.string().date(),
  lineupSize: z.number().min(3).max(6),
  // ... etc
});

type LeagueWizardData = z.infer<typeof leagueWizardSchema>;
```

Benefits:

- Single source of truth for the data shape
- Validation derived from the schema (not hand-rolled per step)
- TypeScript types derived for free
- AI-readable layer for the future (no extra work needed)

### 4. Step Registry

Each wizard provides a declarative list of steps:

```typescript
const leagueWizardSteps: WizardStepConfig<LeagueWizardData>[] = [
  {
    id: 'game-type',
    title: 'Choose your game type',
    component: GameTypeStep,
    schema: leagueWizardSchema.pick({ gameType: true }),
  },
  {
    id: 'start-date',
    title: 'When does the league start?',
    component: StartDateStep,
    schema: leagueWizardSchema.pick({ startDate: true }),
  },
  {
    id: 'team-format',
    title: 'Team format',
    component: TeamFormatStep,
    schema: leagueWizardSchema.pick({
      lineupSize: true,
      rosterSize: true,
      matchFormat: true,
    }),
  },
  // ... etc
];
```

**Key design decisions:**

- Steps are referenced by **string ID**, not array index
- localStorage stores `currentStepId`, not `currentStepIndex`
- Adding/removing/reordering steps doesn't break in-progress wizards
- Optional steps: `optional: true`
- Conditional steps: `showIf: (formData) => boolean`

---

## WizardFlow Layer Internals

The WizardFlow layer is 3 pieces:

### 1. Flow Shell (`WizardFlowShell.tsx`)

The outer container that wraps multiple wizards:

- Renders the unified progress bar (one bar across all stages)
- Tracks which stage is currently active
- Renders the current stage's wizard inside itself
- Handles transitions between stages
- Persists flow-level state (which stages are complete, what data each stage produced)
- Knows how to resume an in-progress flow on mount

The flow shell does NOT know about the inner workings of any specific wizard. It just hosts them and tracks progress.

### 2. Flow Stage Contract

Each stage in a flow is one of:

```typescript
type FlowStage =
  | { kind: 'wizard'; id: string; title: string; wizard: WizardConfig }
  | { kind: 'placeholder'; id: string; title: string; legacyRoute: string };
```

- **Wizard stages** are stages built on the new framework. The flow shell renders them inline.
- **Placeholder stages** are stages where the new wizard hasn't been built yet. The flow shell shows a "Continue to [thing]" button that navigates to the existing legacy implementation. When the user returns, the flow detects whether the stage is complete (by checking the database) and advances.

This is how we ship the flow architecture in v1 without rebuilding all 5 wizards.

### 3. Flow Registry

Each flow is declared as a list of stages:

```typescript
const createNewLeagueFlow: WizardFlowConfig = {
  id: 'create-new-league',
  title: 'Create New League',
  stages: [
    { kind: 'wizard', id: 'league', title: 'League', wizard: leagueWizardConfig },
    { kind: 'placeholder', id: 'season', title: 'Season', legacyRoute: '/operator/seasons/create' },
    { kind: 'placeholder', id: 'schedule', title: 'Schedule', legacyRoute: '/operator/schedule/create' },
    { kind: 'placeholder', id: 'teams', title: 'Teams', legacyRoute: '/operator/teams' },
    { kind: 'placeholder', id: 'matchups', title: 'Matchups', legacyRoute: '/operator/matchups/create' },
  ],
};
```

In v1, only the league stage is a real Wizard. The other 4 are placeholders pointing to existing pages. As subsequent branches rebuild Season, Schedule, Teams, and Matchups wizards on the new framework, they get swapped from `placeholder` to `wizard` in the flow registry. No other code changes required.

### Save-per-stage persistence

Unlike pure localStorage persistence (which is fragile and per-browser), each completed stage commits its data to the database. The flow shell tracks completion by querying the database on mount:

- Stage 1 complete? → check if a league row exists for this flow instance
- Stage 2 complete? → check if a season row exists
- etc.

When a user opens "Create New League" from the dashboard:
- If no in-progress flow exists → start fresh from stage 1
- If an in-progress flow exists → resume at the first incomplete stage

**Benefits:**
- Resume works across devices (data is in DB, not browser)
- Partial data is real data (not localStorage scratch)
- The dashboard can show "in progress" indicators with accurate stage info
- localStorage is only used for in-step scratch (e.g., "user has typed half a name")

---

## Step Contract Details

### Why prop-based instead of closures?

**Old pattern (broken):**

```typescript
{
  id: 'game-type',
  getValue: () => formData.gameType,           // closes over formData
  setValue: (v) => updateFormData('gameType', v), // closes over updateFormData
}
```

**New pattern (clean):**

```tsx
<GameTypeStep
  value={formData.gameType}
  onChange={(v) => updateField('gameType', v)}
  errors={errorsForStep('game-type')}
  formData={formData}
  onNext={advanceStep}
/>
```

**Benefits:**

- Step component can be unit tested with plain props
- Step is a normal React component (no special test setup)
- Type-safe by inspection
- No closure recreation on every render
- Easy to share steps between wizards if needed

---

## Persistence Strategy

The new framework uses a **two-tier persistence model**:

### Tier 1: Save-per-stage (database) — for Flow progress

When a user completes a stage in a flow, that stage's data commits to the database. This is the source of truth for "where is the user in this flow."

- Stage 1 (League) complete → league row exists in `leagues` table
- Stage 2 (Season) complete → season row exists in `seasons` table
- Stage 3 (Schedule) complete → schedule rows exist
- etc.

When a user opens a flow:
- The flow shell queries the database to determine which stages are complete
- Resumes at the first incomplete stage
- Shows accurate progress in the bar
- Works across devices (data is in DB, not browser-local)

The dashboard can show "in progress" indicators based on these queries.

### Tier 2: localStorage scratch — for in-step typing

While a user is mid-step within a wizard (e.g., typing a league name), their unsaved input is debounced (300ms) into localStorage so a refresh doesn't lose it.

- **Debounced saves** (300ms) — performance-friendly
- Keyed by wizard + flow + step: `wizard-v2:create-new-league:league:formData`
- Stores `currentStepId` (string), not index, so adding/removing steps doesn't break in-progress wizards
- Schema version tag stored alongside data — stale data discarded on schema mismatch
- Cleared when the step's data successfully commits to the database (Tier 1 save)
- Cleared on cancel, on manual reset, or on flow completion

### Old wizard (for comparison)

- Saved to localStorage on every keystroke
- Single key for whole form
- Stored `currentStepIndex` (breaks if step list changes)
- No database-backed resume
- No multi-device support

---

## Branch & Migration Strategy

### Branch creation

```bash
git checkout main
git pull
git checkout -b wizard-v2
```

This branch is **independent** of `modular-handicap-config`. Branch 1 work pauses until wizard-v2 merges to main, then Branch 1 rebases (or restarts) on the new wizard.

### Side-by-side strategy

While building, both wizards exist:

| Wizard            | Route                         | Status                         |
| ----------------- | ----------------------------- | ------------------------------ |
| Old league wizard | `/operator/leagues/create`    | Production, untouched          |
| New league wizard | `/operator/leagues/create-v2` | Dev-only, hidden in production |

**The new route is gated:**

- In dev: a button on the operator dashboard ("Create League (v2)") routes to it
- In prod builds: the route exists but no button surfaces it
- Once parity is verified, swap the dashboard button to point at v2 and remove the old wizard in a follow-up

### "Done" criteria for the swap

Before swapping production from old → new wizard:

- [ ] All existing wizard steps recreated in v2 with parity behavior
- [ ] All existing validation rules enforced in v2
- [ ] localStorage persistence works (test: refresh mid-wizard)
- [ ] Resume-from-saved-state works
- [ ] Successful submission creates a league identical to the old wizard
- [ ] Manual side-by-side testing of all 3 game types
- [ ] No regressions in league records created from v2 vs. old

Once swap is complete (separate follow-up branch after wizard-v2 merges):

- Remove old wizard files
- Remove `useLeagueWizard` hook (if not used elsewhere — verify first)
- Remove old `WizardStepRenderer` (if not used by Season Wizard — verify first)

---

## Phases

### Phase 0: Foundation Setup

**Goal:** Get the framework files in place with empty implementations.

- [ ] **0.1** Create folder structure: `src/components/wizard/` for framework components (both layers)
- [ ] **0.2** Create folder structure: `src/wizards/league-v2/` for league wizard implementation
- [ ] **0.3** Create folder structure: `src/flows/` for flow registries
- [ ] **0.4** Add `zod` to dependencies if not already present
- [ ] **0.5** Stub out `WizardShell.tsx` (renders nothing, accepts props)
- [ ] **0.6** Stub out `WizardFlowShell.tsx` (renders nothing, accepts props)
- [ ] **0.7** Define `WizardStepProps`, `WizardStepConfig`, `FlowStage`, and `WizardFlowConfig` types
- [ ] **0.8** Create hidden dev route `/operator/leagues/create-v2`
- [ ] **0.9** Add dev-only button on operator dashboard linking to it (gated by `import.meta.env.DEV`)

**Verification:** Visit `/operator/leagues/create-v2` in dev — see an empty page with the title "League Creation Wizard v2".

---

### Phase 1: Wizard Shell

**Goal:** Build the generic shell that renders steps and handles navigation.

- [ ] **1.1** Implement `WizardShell` with progress bar (use existing `WizardProgress` if it's reusable, otherwise build new)
- [ ] **1.2** Implement step rendering loop (renders the current step's component)
- [ ] **1.3** Implement Back / Next button logic
- [ ] **1.4** Implement step ID-based current-step tracking
- [ ] **1.5** Implement skip logic for `optional` and `showIf` steps
- [ ] **1.6** Implement error display area
- [ ] **1.7** Implement Cancel button (with confirmation)
- [ ] **1.8** Build a tiny hardcoded test wizard (2 dummy steps) to verify the shell works end-to-end

**Verification:** Test wizard with 2 dummy steps navigates forward, backward, displays errors, and renders correctly.

---

### Phase 2: Persistence Layer

**Goal:** Add debounced localStorage persistence with schema versioning.

- [ ] **2.1** Create `useWizardPersistence` hook
- [ ] **2.2** Implement debounced save (300ms)
- [ ] **2.3** Store `currentStepId` instead of index
- [ ] **2.4** Add schema version tag in stored data
- [ ] **2.5** Discard stale data if version mismatch on load
- [ ] **2.6** Implement explicit "resume" prompt UI
- [ ] **2.7** Wire persistence into `WizardShell`

**Verification:** Refresh mid-wizard → resume works. Add a step → existing in-progress wizard still loads to the right step. Clear schema version → data discarded gracefully.

---

### Phase 3: Validation Integration

**Goal:** Wire zod schemas into step validation.

- [ ] **3.1** Define `WizardStepConfig.schema` field accepting a zod schema
- [ ] **3.2** Run validation on Next button click
- [ ] **3.3** Pass errors down to current step via props
- [ ] **3.4** Block advancement on validation failure
- [ ] **3.5** Allow steps to define custom validators beyond schema (escape hatch for complex rules)

**Verification:** Test wizard with a required field rejects empty submission. Custom validator (e.g., "date must be in future") works.

---

### Phase 4: League Wizard Schema & Steps

**Goal:** Recreate the existing League Creation Wizard on the new framework.

- [ ] **4.1** Define `leagueWizardSchema` (zod) covering all current league fields
- [ ] **4.2** Build `GameTypeStep` (parity with existing)
- [ ] **4.3** Build `StartDateStep` (parity with existing)
- [ ] **4.4** Build `QualifierStep` (parity with existing, including conditional logic)
- [ ] **4.5** Build `TeamFormatStep` placeholder (can be the OLD version of team format for now — Branch 1 will replace this)
- [ ] **4.6** Build `HandicapStep` (parity with existing)
- [ ] **4.7** Wire all steps into the `leagueWizardSteps` registry
- [ ] **4.8** Connect to `useCreateLeague` mutation on final submit (commits Stage 1 to database)

**Verification:** Walk through `/operator/leagues/create-v2` and create a league via the standalone wizard. Verify the resulting database record matches what the old wizard creates.

---

### Phase 5: WizardFlow Shell

**Goal:** Build the outer flow container that composes wizards into a multi-stage journey.

- [ ] **5.1** Implement `WizardFlowShell` with single unified progress bar
- [ ] **5.2** Implement stage rendering (renders a `kind: 'wizard'` stage as an inline `WizardShell`)
- [ ] **5.3** Implement placeholder stage rendering (renders a "Continue to [thing]" button that navigates to a legacy route)
- [ ] **5.4** Implement stage completion detection (queries database to determine which stages are complete)
- [ ] **5.5** Implement resume logic — open at the first incomplete stage
- [ ] **5.6** Implement Cancel button at flow level (with confirmation about what gets discarded)
- [ ] **5.7** Build a tiny test flow with 1 wizard stage + 1 placeholder stage to verify end-to-end

**Verification:** Open the test flow → see progress bar with two stages → complete the wizard stage → progress advances to 50% → click placeholder → navigate to legacy route → return → flow detects completion and advances to 100%.

---

### Phase 6: Create New League Flow

**Goal:** Wire the League Wizard into the "Create New League" flow with placeholders for the other 4 stages.

- [ ] **6.1** Define `createNewLeagueFlow` registry with 5 stages
  - Stage 1: League Wizard (from Phase 4)
  - Stage 2: Season placeholder → links to existing `/operator/seasons/create`
  - Stage 3: Schedule placeholder → links to existing schedule setup
  - Stage 4: Teams placeholder → links to existing TeamManagement
  - Stage 5: Matchups placeholder → links to existing matchup creation
- [ ] **6.2** Implement stage completion detection for each stage:
  - Stage 1 complete = league row exists
  - Stage 2 complete = season row exists for the league
  - Stage 3 complete = schedule rows exist for the season
  - Stage 4 complete = teams exist for the season
  - Stage 5 complete = matches exist for the season
- [ ] **6.3** Replace the dev-only `/operator/leagues/create-v2` button with one that opens the full flow
- [ ] **6.4** Test end-to-end: start the flow → complete league stage → see progress 20% → open season placeholder → return → see progress 40% → continue through all stages

**Verification:** A user can complete an entire league setup via the flow, with the progress bar accurately tracking completion across all 5 stages, even though only Stage 1 is built on the new framework.

---

### Phase 7: Parity Testing

**Goal:** Side-by-side verification that the new wizard behaves identically.

- [ ] **7.1** Test all 3 game types in standalone wizard
- [ ] **7.2** Test optional qualifier step (skipped vs. filled)
- [ ] **7.3** Test all team format options
- [ ] **7.4** Test all handicap options
- [ ] **7.5** Test localStorage scratch persistence and resume mid-step
- [ ] **7.6** Test cancel/restart at wizard level
- [ ] **7.7** Test cancel/restart at flow level
- [ ] **7.8** Test flow resume — start flow, exit, return, verify it picks up at right stage
- [ ] **7.9** Compare database records: old wizard vs. new wizard
- [ ] **7.10** Test on mobile viewport (responsive check)
- [ ] **7.11** Test placeholder stage round-trip (open placeholder → use legacy page → return → progress updates)

**Verification:** Database records from new wizard are byte-identical to old wizard for the same inputs. Flow progress accurately reflects stage completion across both wizard and placeholder stages.

---

### Phase 8: Documentation & Handoff

**Goal:** Document the framework so future wizards can adopt it.

- [ ] **8.1** Add `@fileoverview` headers to all framework files
- [ ] **8.2** Document `WizardStepProps`, `WizardFlowConfig`, and `FlowStage` interfaces with examples
- [ ] **8.3** Write `memory-bank/wizard-v2-framework.md` — usage guide for adding new wizards and flows
- [ ] **8.4** Document the "swap a placeholder stage for a real wizard" pattern (this is how Branch 1+ will integrate)
- [ ] **8.5** Add JSDoc to all public framework APIs
- [ ] **8.6** Update `TABLE_OF_CONTENTS.md` with new files

**Verification:** A reader unfamiliar with the framework can build a new wizard step from the documentation alone, AND can swap a placeholder stage for a new wizard following the documented pattern.

---

## After This Branch Merges

These are NOT part of wizard-v2 — they're follow-up work in separate branches:

1. **Swap branch:** Switch the production "Create League" button from old wizard to new wizard. Remove old wizard files.
2. **`modular-handicap-config` resumes** with `TeamFormatStep` rebuilt against the new framework (much cleaner integration than what was originally planned).
3. **Future:** Migrate Season Creation Wizard to the new framework (separate branch, separate effort).
4. **Future:** Build Schedule Creation Wizard on the new framework when its time comes.
5. **Future:** AI assistant integration (only if product validates and AI is greenlit).

---

## Decisions Made

These have been discussed and locked in.

### ✅ 1. Form state library — **Plain `useState` + custom hook**

Confirmed. Past attempt to use `react-hook-form` caused problems. We don't need its features for forms this size, and the prior pain is real-world evidence against it. Hand-roll a simple `useWizardForm` hook backed by `useState`. Zod handles validation.

### ✅ 2. Progress bar style — **Single bar (per flow)**

Single status bar per flow. The bar shows progress through the current flow (e.g., 5 stages for "Create New League" = 20% per stage). Each flow has its own bar that's relative to its own stages. Not a universal "% of all possible setup work" bar.

### ✅ 3. Two-layer architecture — **Wizard + WizardFlow**

Confirmed. Wizards are reusable building blocks composed by Flows. Same Wizard can run standalone OR as a stage inside a Flow. See the "Two-Layer Architecture" section above.

### ✅ 4. Save-per-stage persistence — **Database-backed with localStorage scratch**

Confirmed. Each completed stage commits to the database. localStorage is only used for in-step typing scratch. See "Persistence Strategy" section above.

### ✅ 5. Placeholder stages for v1 — **Link to existing implementations**

Confirmed. The v1 "Create New League" flow has only the League Wizard built on the new framework. The Season, Schedule, Teams, and Matchups stages are placeholders that link to existing pages. Subsequent branches replace placeholders one at a time.

---

## Open Decisions to Lock In Before Building

These still need to be discussed and locked in BEFORE Phase 0.

1. **Validation timing** — Validate on every change, on blur, or only on Next?

   - **Lean:** On Next (least intrusive UX, simplest implementation). Show errors only after user attempts to advance.

2. **Progress bar component** — Reuse existing `WizardProgress.tsx`?

   - **Lean:** Reuse if compatible. Build new if it's tied to the old wizard.

3. **Step component file structure** — One file per step? All steps in one file?

   - **Lean:** One file per step under `src/wizards/league-v2/steps/`. Easier to find, easier to test.

4. **Cancel behavior** — Confirm dialog? Silent? Save draft?

   - **Lean:** Confirm dialog. "You'll lose your progress. Continue?" with Cancel/Discard buttons. But this gets more complex with save-per-stage — does cancel discard the current stage's data, or just the in-step scratch?

5. **localStorage key naming convention** — `wizard-v2:league-creation:formData`? Or simpler?

   - **Lean:** Namespaced to avoid collision with old wizard. Drop the old keys after migration.

6. **In-progress flow detection on dashboard** — How does the user find and resume an in-progress flow? List view? Per-league indicator? Banner notification?

   - **Open question.** Needs UX discussion.

7. **Mid-season team drops** — Common scenario or edge case? How should it be handled?

   - **Open question.** Affects Team wizard design but not in v1 scope. Document and defer.

---

## Key Development Principles

### 1. Pure Parity First

No new features. No improved UX. No "while we're at it." Just rebuild what exists, cleaner.

### 2. KISS / DRY / Single Responsibility

Each component does one thing. Frameworks are extracted from real usage, not designed in the abstract.

### 3. Testable in Isolation

Every leaf component (step, shell, persistence hook) has a clear prop boundary and can be unit tested without mounting the whole wizard.

### 4. Don't Touch What Works

The old wizard stays running until parity is verified. Zero risk to existing users.

### 5. Resist Scope Creep

The "NOT in scope" list above is sacred. If something not on the in-scope list seems necessary, document it as a follow-up — don't add it here.

### 6. Schema as Contract

The zod schema is the source of truth for what data exists and what's valid. Steps consume slices of the schema. The AI integration (if it ever happens) consumes the same schema.

---

## Success Criteria for Wizard v2

Before merging to main:

**Framework:**
1. ✅ Wizard shell renders any list of steps with full navigation
2. ✅ WizardFlow shell renders multiple stages with unified progress bar
3. ✅ Save-per-stage works — completed stages commit to database
4. ✅ localStorage scratch persistence works with debouncing and schema versioning
5. ✅ Stage completion auto-detected from database on flow load
6. ✅ Resume works — opening a flow lands at the first incomplete stage
7. ✅ Both wizard stages and placeholder stages work in flows
8. ✅ Framework documented (Wizard layer + WizardFlow layer + how to swap placeholders)

**League Wizard:**
9. ✅ League Creation Wizard recreated on new framework with full parity
10. ✅ Database records identical between old and new wizard
11. ✅ Hidden dev route accessible, side-by-side comparison possible

**"Create New League" Flow:**
12. ✅ Flow with 1 wizard stage + 4 placeholder stages works end-to-end
13. ✅ Progress bar accurately reflects stage completion across all 5 stages
14. ✅ Placeholder stages link to correct legacy routes
15. ✅ Returning from a placeholder stage advances the flow

**Safety:**
16. ✅ Old wizard completely untouched and still working
17. ✅ No regressions in any existing wizard or page

---

## Tech Debt Discovered During Planning

These issues were uncovered while planning wizard 2.0. They are **NOT in scope
for this branch** — they're pre-existing problems that should be tracked
separately. Captured here so they don't get lost.

### 🚨 CRITICAL: Team Deletion Cascade Destruction
- **Where:** `src/operator/TeamManagement.tsx` → `handleDeleteTeam`
- **Problem:** DB schema has `ON DELETE CASCADE` on `matches.home_team_id` and
  `matches.away_team_id`. Deleting a team destroys all of that team's scheduled
  matches, breaking other teams' weekly schedules.
- **Mitigation in place:** Honest warning message added to confirmation dialog.
  TODO comments added to code, `databaseSchema.md`, and `edsPlan.md`.
- **Real fix needed:** Soft delete, replacement workflow, or block deletion when
  matches exist. See `edsPlan.md` for full details.
- **Severity:** HIGH

### Missing Matchup Edit UI
- **Where:** No file exists. There is no UI anywhere to edit matchups after
  generation.
- **Problem:** If an operator needs to swap two teams' matchups for a given
  week (rescheduling, manual fix), the only path is to clear the entire
  schedule and regenerate it.
- **Severity:** MEDIUM — workaround exists (regenerate), but it's clunky and
  destroys data that should be preserved.

### Schedule Date Lock (NOT a bug)
- Verified during planning: schedule dates are intentionally locked because
  they're computed from `start_date + (week_number × 7 days)`. Matches reference
  week IDs, not dates. This is by design and works correctly.
- **No action needed.** Documented here for future reference so we don't
  re-investigate this.

---

## Git Commands Reference

```bash
# Branch already created: wizard-2-creation
# Confirm you're on it
git branch --show-current

# See status of changes
git status

# Stage specific files
git add path/to/file.tsx

# Commit
git commit -m "Your message"

# Push and set tracking (first push)
git push -u origin wizard-2-creation

# Subsequent pushes
git push
```

---

_Last Updated: 2026-04-09 (added two-layer architecture: Wizard + WizardFlow, save-per-stage persistence, locked decisions, expanded phases)_
_Status: Planning — 7 open decisions remaining before Phase 0 starts_
_Estimated Effort: ~3-3.5 weeks (framework with both layers + league wizard parity rebuild + Create New League flow with placeholders)_
