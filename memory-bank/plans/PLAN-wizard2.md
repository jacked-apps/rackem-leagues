# Wizard 2.0 Framework

**Branch Name:** `wizard-2-creation`
**Depends On:** `main`
**Blocks:** `modular-handicap-config` (Branch 1) — wait for this branch to merge before resuming Branch 1
**Goal:** Build a clean, reusable wizard framework and rebuild the League Creation Wizard on top of it. Zero new user-facing features — pure architectural rebuild for maintainability and future extensibility.

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

- **Wizard Shell** — reusable component handling progress bar, navigation, persistence, error display
- **Step Contract** — standard prop interface every step component implements
- **Zod schemas** — per-wizard validation and type definitions (also serves as future AI-readable layer)
- **Step Registry** — declarative list of steps with IDs, optional/conditional support
- **localStorage persistence** — debounced, keyed by wizard ID, compatible with adding/removing steps
- **League Creation Wizard rebuild** — first consumer of the framework, pure parity with existing behavior
- **Hidden dev route** — `/operator/leagues/create-v2` accessible during development
- **Side-by-side testing** — old and new wizards both work, allowing direct comparison

### Explicitly NOT in Scope

These will tempt us. Resist them. Each one alone would derail the branch.

- ❌ Schema-driven UI rendering (auto-generating forms from schemas)
- ❌ AI integration of any kind
- ❌ Migrating Season Creation Wizard (separate effort, after this branch)
- ❌ Migrating Schedule Creation Wizard stub (separate effort)
- ❌ Touching Playoffs Setup Wizard (it's not a linear wizard, leave it alone)
- ❌ Adding new fields, new validation rules, or new UX to League Creation
- ❌ Theme system, plugin system, or other "framework-y" extras
- ❌ Rewriting `WizardStepRenderer` to support both old and new patterns
- ❌ Changing the `LeagueFormData` shape or any database schema

**Mantra:** "If it's not required to ship the new league wizard at parity, it doesn't go in this branch."

---

## Architecture Overview

The framework is 4 pieces:

### 1. Wizard Shell (`WizardShell.tsx`)

Reusable component that handles all the chrome:

- Progress bar
- Back / Next / Cancel buttons
- Step transitions
- Persistence to localStorage
- Error display
- Conditional/optional step skipping

The shell is generic — it doesn't know anything about leagues, seasons, or any specific wizard. It just renders steps in order.

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

### Old wizard

- Saved to localStorage on every keystroke
- Single key for whole form
- Stored `currentStepIndex` (breaks if step list changes)

### New wizard

- **Debounced saves** (300ms) — better performance
- Keyed by wizard ID: `wizard-v2:league-creation:formData`
- Stores **`currentStepId`** (string), not index
- Schema version tag stored alongside data — if schema changes, stale data is discarded
- Cleared on successful submit, on cancel, or on manual reset
- Explicit "resume" prompt if data exists on mount (lets user choose to continue or start over)

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

- [ ] **0.1** Create folder structure: `src/components/wizard/` for framework components
- [ ] **0.2** Create folder structure: `src/wizards/league-v2/` for league wizard implementation
- [ ] **0.3** Add `zod` to dependencies if not already present
- [ ] **0.4** Stub out `WizardShell.tsx` (renders nothing, accepts props)
- [ ] **0.5** Define `WizardStepProps` and `WizardStepConfig` types
- [ ] **0.6** Create hidden dev route `/operator/leagues/create-v2`
- [ ] **0.7** Add dev-only button on operator dashboard linking to it (gated by `import.meta.env.DEV`)

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
- [ ] **4.8** Connect to `useCreateLeague` mutation on final submit

**Verification:** Walk through `/operator/leagues/create-v2` and create a league. Verify the resulting database record matches what the old wizard creates.

---

### Phase 5: Parity Testing

**Goal:** Side-by-side verification that the new wizard behaves identically.

- [ ] **5.1** Test all 3 game types
- [ ] **5.2** Test optional qualifier step (skipped vs. filled)
- [ ] **5.3** Test all team format options
- [ ] **5.4** Test all handicap options
- [ ] **5.5** Test localStorage persistence and resume
- [ ] **5.6** Test cancel/restart flow
- [ ] **5.7** Compare database records: old wizard vs. new wizard
- [ ] **5.8** Test on mobile viewport (responsive check)

**Verification:** Database records from new wizard are byte-identical to old wizard for the same inputs.

---

### Phase 6: Documentation & Handoff

**Goal:** Document the framework so future wizards can adopt it.

- [ ] **6.1** Add `@fileoverview` headers to all framework files
- [ ] **6.2** Document `WizardStepProps` interface with examples
- [ ] **6.3** Write `memory-bank/wizard-v2-framework.md` — usage guide for adding new wizards
- [ ] **6.4** Add JSDoc to all public framework APIs
- [ ] **6.5** Update `TABLE_OF_CONTENTS.md` with new files

**Verification:** A reader unfamiliar with the framework can build a new wizard step from the documentation alone.

---

## After This Branch Merges

These are NOT part of wizard-v2 — they're follow-up work in separate branches:

1. **Swap branch:** Switch the production "Create League" button from old wizard to new wizard. Remove old wizard files.
2. **`modular-handicap-config` resumes** with `TeamFormatStep` rebuilt against the new framework (much cleaner integration than what was originally planned).
3. **Future:** Migrate Season Creation Wizard to the new framework (separate branch, separate effort).
4. **Future:** Build Schedule Creation Wizard on the new framework when its time comes.
5. **Future:** AI assistant integration (only if product validates and AI is greenlit).

---

## Open Decisions to Lock In Before Building

These are intentionally not yet decided. Discuss and lock in BEFORE Phase 0.

1. **Form state library** — Plain `useState` in shell? Or `react-hook-form`? Or hand-rolled?

   - **Lean:** Hand-rolled `useState` + zod. Adding `react-hook-form` is another dependency to learn and integrate. Plain state is simpler.

2. **Validation timing** — Validate on every change, on blur, or only on Next?

   - **Lean:** On Next (least intrusive UX, simplest implementation). Show errors only after user attempts to advance.

3. **Progress bar component** — Reuse existing `WizardProgress.tsx`?

   - **Lean:** Reuse if compatible. Build new if it's tied to the old wizard.

4. **Step component file structure** — One file per step? All steps in one file?

   - **Lean:** One file per step under `src/wizards/league-v2/steps/`. Easier to find, easier to test.

5. **Cancel behavior** — Confirm dialog? Silent? Save draft?

   - **Lean:** Confirm dialog. "You'll lose your progress. Continue?" with Cancel/Discard buttons.

6. **localStorage key naming convention** — `wizard-v2:league-creation:formData`? Or simpler?
   - **Lean:** Namespaced to avoid collision with old wizard. Drop the old keys after migration.

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

1. ✅ Wizard shell renders any list of steps with full navigation
2. ✅ localStorage persistence works with debouncing and schema versioning
3. ✅ League Creation Wizard recreated on new framework with full parity
4. ✅ Hidden dev route accessible, side-by-side comparison possible
5. ✅ All existing league wizard tests pass against new wizard
6. ✅ Database records identical between old and new wizard
7. ✅ Framework documented for future wizards
8. ✅ Old wizard completely untouched and still working

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

_Last Updated: 2026-04-09_
_Status: Planning — open decisions need discussion before Phase 0 starts_
_Estimated Effort: ~2-2.5 weeks (small framework + league wizard parity rebuild)_
