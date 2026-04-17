# Wizard 2.0 Framework

**Branch Name:** `wizard-2-creation`
**Depends On:** `main`
**Blocks:** `modular-handicap-config` (Branch 1) — wait for this branch to merge before resuming Branch 1
**Goal:** Build a clean, reusable wizard framework with **two layers** (Wizard + WizardFlow) AND lay the foundation for a fully modular league configuration system. Wizard 2.0 is NOT a parity rebuild — it's an entirely new system that captures league settings in modular configuration tables instead of hardcoded fields. The old wizard stays for backward compatibility.

**Important context:** This app is live but has no real users yet — all data is test data. We can break things during development without worrying about backward compatibility. If real users arrive before this ships, we revisit.

---

## Why This Branch Exists

The whole point of building a new wizard is to enable a **fully modular league management system**. The old wizard is hardcoded to 3 league formats (3v3, 5v5, etc.) — that's fundamentally incompatible with what the app needs to become.

**The bigger vision:**
1. **Phase 1 (this branch):** Modularize everything. Save league settings in dedicated configuration tables, separated from the hardcoded `leagues` columns. The new wizard captures rich modular data; the old wizard stays for backward compatibility.
2. **Phase 2 (later branch):** Replace hardcoded handicap systems with dynamic ways for the system to figure out how to apply them.
3. **Phase 3 (further later branch):** Let league operators adjust those dynamic systems to fit their league's specific needs.

**Wizard 2.0 = Phase 1.** It's the foundation that everything else builds on.

---

## The Full Modular Vision (Long-Term)

This is what the system needs to become eventually. Wizard 2.0 lays the foundation; subsequent branches build on it.

### Everything must be mix-and-matchable

Currently, things are tangled together:
- 3v3 format → forces -1/+2 handicap system
- 5v5 format → forces % handicap system
- Team format dictates handicap method dictates win conditions

**The end-state goal** is that league operators can pick ANY combination of:

| Modular Concept | What It Controls | Examples |
|-----------------|------------------|----------|
| **Team format** | Lineup size, roster size, match format | 3v3 / 4v4 / 5v5 / Custom (any size) |
| **Handicap system** | How team handicaps are calculated | -1/+2 system / % system / Custom formula |
| **Player handicap type** | How individual player handicaps are determined | Starting handicap / Performance-based / Fargo / Custom |
| **Win conditions** | What defines a "win" | Games won / Points accumulated / Custom |
| **Thresholds** | Numerical targets that determine outcomes | First to X points / X games won / Custom |

A user might pick "5v5 lineup with -1/+2 handicap and points-based scoring" — a combination that doesn't exist today. The system should support that.

### Custom Formula Builder (future feature)

Eventually, "Custom" handicap systems will be a formula builder where the operator picks:
- Available stat variables (games_won, games_lost, weeks_played, etc.)
- Math operators (+, -, *, /, parentheses)
- Builds expressions like `(games_won - games_lost) / weeks_played`

This is its own future branch. Wizard 2.0 v1 just shows it as a "Coming soon" disabled card so users see where the system is headed.

### Future Rules System (separate from preferences)

There's an important distinction between **preferences** and **rules**:

- **Preferences** = settings that change app behavior (UI flows, calculations, validations). Example: "show the golden break tracking button" → controls UI directly.
- **Rules** = the rulebook content itself (BCA rulebook + house rules). Reference content for lookup and AI processing. Example: "9-ball golden break in the 2-foot side pocket doesn't count" → a house rule that lives in the rulebook, not a UI toggle.

A future "rules" system will hold the BCA rulebook + house rules in a structured form designed for AI lookup and processing. **NOT in wizard 2.0 v1 scope.** Mentioned here so we don't accidentally cram rule content into the preferences table.

### Realistic Limitations Principle

**Not all combinations will work out of the box.** When wizard 2.0 ships:
- Some combinations match wizard 1's hardcoded options → existing app code works fine (via dual-write)
- Some combinations are completely new → existing app code doesn't know how to handle them yet
- These "incompatible combinations" get stored in the database but the rendering app code can't fully use them yet

**How to handle incompatible combinations** (in future branches, not v1):
- Show a clear warning to the operator: "this combination isn't fully supported yet"
- Fall back to manual entry mode for affected screens (lineups, scoring, etc.)
- Log it so we can see what users are trying
- Iterate based on real user needs — implement support for the combinations users actually want

**Wizard 2.0 v1's job is just to capture the choices in the database.** Warning UI and manual fallback paths are future work.

In addition to enabling modularity, the rebuild also fixes real architectural problems in the old wizard:

1. **`getValue` / `setValue` closures** — steps don't receive props, they close over parent state. Untestable in isolation, hard to reason about.
2. **Closed step type union** (`'input' | 'choice' | 'radio'`) — anything more complex than a text field or radio group breaks the pattern. Complex steps like the new card-based TeamFormatStep don't fit.
3. **Three different wizard patterns exist** in the codebase (League uses a hook, Season uses a reducer, Playoffs uses card-based config) — no shared chrome, no shared persistence, no consistency.
4. **localStorage on every keystroke** — performance smell.
5. **Fragile string parsing** for combined fields like `"5_man|custom_5man"`.

Rather than fight the old wizard's limitations, build a clean modular foundation once.

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

**Modular configuration foundation (the whole point):**
- **Extend existing `preferences` table** with new modular columns (lineup_size, max_roster_size, game_generation, handicap_type, points_system, points_config, threshold_chart_id, uses_fargo). Preserve the cascade pattern (league → org → system default) and existing UI/code.
- **Bring in `threshold_charts` system** from the unmerged `lo-manual-scoring` branch (chart + chart_rows tables, 4 chart types, lookup functions, editor UI).
- **Add `fargo_rating` column to `members` table** for per-player Fargo data.
- **Loosen `team_format` CHECK constraint** to allow new format values.
- **Dual-write pattern** — wizard 2.0 writes to BOTH the existing `leagues` columns AND the extended `preferences` row. Old reading code keeps working unchanged. The new modular columns are populated for future use.
- **No app code changes for reading** — the rest of the app stays untouched. Lineup screens, scoring screens, etc. still read from the existing fields. Reading from the modular columns happens in later branches.

**First consumer:**
- **"Create New League" flow** — first flow built on the framework
- **League Creation Wizard rebuild** — captures both the existing fields AND the new modular configurations. Includes the fancy TeamFormatStep with cards, steppers, and Custom support.
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
- ❌ **Updating app reading code to use new modular tables** — lineup screens, scoring screens, etc. continue reading from the existing hardcoded fields. New tables are write-only for now.
- ❌ Theme system, plugin system, or other "framework-y" extras
- ❌ Rewriting `WizardStepRenderer` to support both old and new patterns
- ❌ **Removing or modifying existing `leagues` table columns** — changes are additive only. Old columns stay. New columns/tables get added.
- ❌ Fixing the team cascade delete bug or missing matchup edit UI (tracked separately as tech debt)
- ❌ Building the "Start New Season" flow (planned but not implemented in v1 — only the architecture supports it)
- ❌ Dynamic handicap calculation logic (Phase 2 work, future branch)
- ❌ Operator-adjustable handicap configurations (Phase 3 work, future branch)

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

### Phase 1: Modular Configuration Schema

**Goal:** Set up the database schema for modular league configuration. Strategy: **extend the existing `preferences` table** rather than create separate modular tables, and **bring in the `threshold_charts` system** from the unmerged `lo-manual-scoring` branch.

#### Why extend `preferences` instead of new tables

The existing `preferences` table on `main` is the right pattern for almost everything:
- Already has the cascade pattern (league → organization → system default)
- Already has UI components (`PreferencesCard`, `FormatSettingsSection`, `HandicapSettingsSection`, `MatchRulesSection`, etc.)
- Already has query/mutation/hooks code
- Adding columns is non-breaking
- Single source of truth instead of fragmented modular tables

The original plan was to create 5 separate modular tables. After reviewing what's already on `main` and on the `lo-manual-scoring` branch, extending `preferences` is simpler and uses existing infrastructure.

#### Tasks

- [ ] **1.1** Extend the `preferences` table with new columns:
  - `lineup_size` INTEGER (3-10, nullable, cascade)
  - `max_roster_size` INTEGER (1-20, nullable, cascade)
  - `game_generation` TEXT (double_round_robin/single_round_robin/sets/manual, nullable, cascade)
  - `games_per_set` INTEGER (only used when game_generation='sets', nullable)
  - `handicap_type` TEXT (points/percentage/skill_level/fargo/none, nullable, cascade)
  - `points_system` TEXT (differential/bca_tiered/per_game/manual, nullable, cascade)
  - `points_config` JSONB (system-specific config, nullable)
  - `threshold_chart_id` UUID FK (to threshold_charts, nullable, cascade)
  - `uses_fargo` BOOLEAN (true if league uses Fargo handicap system, nullable, cascade)

- [ ] **1.2** Loosen the `team_format` CHECK constraint to allow new format strings (or drop the constraint entirely — values are validated by the wizard now)

- [ ] **1.3** Bring in the `threshold_charts` migrations from `lo-manual-scoring` branch:
  - Copy `supabase/migrations/20260119000000_threshold_charts.sql` (creates `threshold_charts` and `threshold_chart_rows` tables)
  - Copy `supabase/migrations/20260119000001_seed_threshold_charts.sql` (seeds the 4 default chart types)
  - Skip `20260119000002_league_format_settings.sql` — we're using `preferences` instead
  - Run on local Supabase

- [ ] **1.4** Add `fargo_rating` INTEGER column to `members` table (nullable, for per-player Fargo ratings)

- [ ] **1.5** Document the schema strategy in `memory-bank/databaseSchema.md`:
  - `preferences` table is the home for league-level settings (cascade pattern)
  - `threshold_charts` is its own system for lookup tables (chart + rows)
  - `members.fargo_rating` is per-player Fargo data
  - Note that `golden_break_counts_as_win` actually means "show the golden break tracking UI" (historical name, real behavior is "track yes/no")

- [ ] **1.6** Document the **future "rules" system** as a separate, non-v1 feature:
  - Will hold BCA rulebook + house rules in structured form
  - Designed for AI lookup and rule processing
  - NOT in wizard 2.0 v1 scope — entirely separate future feature

**Verification:** `preferences` table has all new columns. Existing leagues unaffected. `threshold_charts` system imported and queryable. `members.fargo_rating` exists. Schema strategy documented.

---

### Phase 2: Wizard Shell

**Goal:** Build the generic shell that renders steps and handles navigation within a single wizard.

- [ ] **2.1** Implement `WizardShell` (uses existing `WizardProgress` for progress bar)
- [ ] **2.2** Implement step rendering loop
- [ ] **2.3** Implement Back / Next button logic
- [ ] **2.4** Implement step ID-based current-step tracking
- [ ] **2.5** Implement skip logic for `optional` and `showIf` steps
- [ ] **2.6** Implement error display area
- [ ] **2.7** Implement Cancel button with confirmation dialog
- [ ] **2.8** Build a tiny hardcoded test wizard (2 dummy steps) to verify the shell works end-to-end

**Verification:** Test wizard with 2 dummy steps navigates forward, backward, displays errors, and renders correctly. Each component file under 100 lines.

---

### Phase 3: Persistence Layer

**Goal:** Add debounced localStorage scratch persistence with schema versioning.

- [ ] **3.1** Create `useWizardPersistence` hook
- [ ] **3.2** Implement debounced save (300ms)
- [ ] **3.3** Store `currentStepId` instead of index
- [ ] **3.4** Add schema version tag in stored data
- [ ] **3.5** Discard stale data if version mismatch on load
- [ ] **3.6** Use namespaced key convention: `wizard-v2:[flow-id]:[wizard-id]:formData`
- [ ] **3.7** Wire persistence into `WizardShell`

**Verification:** Refresh mid-wizard → typing is preserved. Add a step → existing in-progress wizard still loads to the right step. Clear schema version → stale data discarded gracefully.

---

### Phase 4: Validation Integration

**Goal:** Wire zod schemas into step validation, validating only on Next click.

- [ ] **4.1** Define `WizardStepConfig.schema` field accepting a zod schema slice
- [ ] **4.2** Run validation on Next button click
- [ ] **4.3** Pass errors down to current step via props
- [ ] **4.4** Block advancement on validation failure
- [ ] **4.5** Allow steps to define custom validators beyond schema (escape hatch for complex rules)

**Verification:** Test wizard with a required field rejects empty submission. Custom validator (e.g., "date must be in future") works.

---

### Phase 5: Reusable Step Building Blocks

**Goal:** Build the small, reusable components that wizard step UIs are composed from. These are the "leaves" that multiple wizards across the app will reuse.

- [ ] **5.1** Build `CardSelector` component — generic card-based radio selector with optional label, label info button, per-option info buttons, disabled state, disabled toast message. Both horizontal and vertical layouts.
- [ ] **5.2** Build `NumberStepper` component — `−` value `+` control with min/max enforcement, optional label and info button
- [ ] **5.3** Confirm `InfoButton` works with both new components (it already exists at `src/components/InfoButton.tsx`)
- [ ] **5.4** Test each component in isolation
- [ ] **5.5** Add `@fileoverview` and JSDoc to each

**Verification:** Both components render correctly in isolation. Both are under 100 lines. Both can be used independently of any wizard.

---

### Phase 6: League Wizard Steps

**Goal:** Build the steps that make up the new League Creation Wizard. The wizard is built around 3 standard presets that make setup fast for most users, with a Custom path for advanced configurations.

#### The 3 standard presets + Custom

The team format / handicap system selection is **one combined step** with 4 cards. Each preset locks in all the modular fields automatically, so the user doesn't see additional questions.

| Card | Lineup | Handicap System | Notes |
|------|--------|-----------------|-------|
| **5v5 Fargo** *(at top — BCA pitch priority)* | 5 | Fargo | Warning toast: "Fargo API not connected yet — player ratings entered manually" |
| **3v3 Standard** | 3 | -1/+2 points system | The original wizard 1 default |
| **5v5 Standard** | 5 | % system | The other wizard 1 default |
| **Custom** | (asks) | (asks) | Warning toast: "Customizing means more questions and longer setup" |

If user picks a preset → wizard knows everything it needs, just creates the league.
If user picks Custom → wizard branches into a longer flow with additional questions.

#### Tasks

- [ ] **6.1** Define `leagueWizardSchema` (zod) covering all the fields the wizard captures
- [ ] **6.2** Build `GameTypeStep` (writes to existing `leagues.game_type`)
- [ ] **6.3** Build `StartDateStep` (writes to existing `leagues.start_date`)
- [ ] **6.4** Build `QualifierStep` with conditional logic (writes to existing field)
- [ ] **6.5** Build `LeagueFormatStep` — the combined preset/custom step:
  - 4 cards via `CardSelector` (5v5 Fargo, 3v3, 5v5, Custom)
  - Fargo card on top (BCA pitch priority)
  - Fargo card shows manual-entry warning toast on selection
  - Custom card shows "longer setup" warning toast on selection
  - Picking a preset locks in all the modular values automatically
  - Picking Custom opens the Custom path (next step)
  - Info button on each card explaining the system
- [ ] **6.6** Build the Custom path steps (only shown if user picks Custom card):
  - Lineup size step (`NumberStepper`, 3-10)
  - Max roster size step (`NumberStepper`, lineup_size to 20)
  - Match format step (`CardSelector`: single RR / double RR / sets / manual + Individual Races as "Coming soon")
  - Handicap system step (`CardSelector`: points / percentage / skill_level / none + Custom Formula Builder as "Coming soon")
  - Each Custom step has info buttons explaining what it does
- [ ] **6.7** Wire all steps into the `leagueWizardSteps` registry with `showIf` logic so Custom steps only appear when Custom card is selected

**Verification:** Walk through the wizard with each preset — fast happy path, no extra questions. Walk through Custom — see all the additional questions appear. Fargo and Custom warnings show on selection. Info buttons work. Each step file under 100 lines.

---

### Phase 7: Dual-Write Mutation

**Goal:** Wire the wizard's final submit to write data to both the existing `leagues` table AND the extended `preferences` table. Also auto-pick a default `threshold_chart_id` based on the chosen handicap system.

- [ ] **7.1** Create or update `useCreateLeague` mutation to also create a `preferences` row for the new league
- [ ] **7.2** Write game type, start date, qualifier to existing `leagues` columns (unchanged behavior)
- [ ] **7.3** Write a best-fit `team_format` string to `leagues.team_format` for backward compat (e.g., Fargo and 5v5 → `'5_man'`, 3v3 → `'5_man'` since wizard 1 only had two options). Existing app code keeps working.
- [ ] **7.4** Insert a new `preferences` row with `entity_type='league'`, `entity_id=newLeague.id` and the wizard's modular field values:
  - Preset selected → all modular columns get values from the preset (lineup_size, max_roster_size, game_generation, handicap_type, points_system, uses_fargo, etc.)
  - Custom selected → modular columns get the user's customized values
  - `threshold_chart_id` auto-populated with the system default chart for the chosen handicap_type (lookup from `threshold_charts` where `is_default=true` and `entity_type='global'`)
- [ ] **7.5** Test that creating a league via wizard 2.0 produces:
  - A `leagues` row with backward-compat fields populated
  - A `preferences` row with all the new modular fields populated
  - The existing app renders the league correctly (lineup screens, scoring, etc.)

**Verification:** Create a league via wizard 2.0 with a 3v3 preset. `leagues.team_format = '5_man'`. `preferences` row has `lineup_size=3`, `handicap_type='points'`, etc. The existing app renders it as a 3-player lineup. Create a Fargo league. `preferences.uses_fargo=true`. Create a Custom 4v4 setup. `preferences` row reflects the custom choices.

---

### Phase 8: WizardFlow Shell

**Goal:** Build the outer flow container that composes wizards and placeholders into a multi-stage journey.

- [ ] **8.1** Implement `WizardFlowShell` with single unified progress bar
- [ ] **8.2** Implement stage rendering for `kind: 'wizard'` stages (renders inline `WizardShell`)
- [ ] **8.3** Implement stage rendering for `kind: 'placeholder'` stages (renders a "Continue to [thing]" button that navigates to a legacy route)
- [ ] **8.4** Implement stage completion detection (queries database)
- [ ] **8.5** Implement resume logic — open at the first incomplete stage
- [ ] **8.6** Implement Cancel button at flow level (notes that committed stages are kept)
- [ ] **8.7** Build a tiny test flow with 1 wizard stage + 1 placeholder stage to verify end-to-end

**Verification:** Test flow renders progress bar across two stages. Completing the wizard stage advances progress. Returning from a placeholder stage detects completion and advances. Each component under 100 lines.

---

### Phase 9: Create New League Flow

**Goal:** Wire the League Wizard into the full "Create New League" flow with placeholders for the other 4 stages.

- [ ] **9.1** Define `createNewLeagueFlow` registry with 5 stages:
  - Stage 1: League Wizard (built on new framework)
  - Stage 2: Season placeholder → links to existing `/operator/seasons/create`
  - Stage 3: Schedule placeholder → links to existing schedule setup
  - Stage 4: Teams placeholder → links to existing TeamManagement
  - Stage 5: Matchups placeholder → links to existing matchup creation
- [ ] **9.2** Implement stage completion detection for each stage
- [ ] **9.3** Replace the dev-only button with one that opens the full flow
- [ ] **9.4** Test end-to-end: start flow → complete league stage → see 20% → open season placeholder → return → see 40% → continue through all stages

**Verification:** A user can complete an entire league setup via the flow. Progress bar accurately tracks completion across all 5 stages, even though only Stage 1 uses the new framework.

---

### Phase 10: Testing

**Goal:** Verify the entire system works end-to-end.

- [ ] **10.1** Test all 3 game types in standalone wizard
- [ ] **10.2** Test optional qualifier step (skipped vs. filled)
- [ ] **10.3** Test all 3 preset team formats (3v3, 4v4, 5v5)
- [ ] **10.4** Test Custom team format with various lineup/roster combinations
- [ ] **10.5** Test that Individual Races shows the "Coming soon" toast and is disabled
- [ ] **10.6** Verify wizard 2 leagues populate BOTH `leagues.team_format` AND `leagues.team_format_config_id`
- [ ] **10.7** Verify the existing app renders wizard 2 leagues correctly (lineup screens, scoring, etc.)
- [ ] **10.8** Test localStorage scratch persistence and resume mid-step
- [ ] **10.9** Test cancel/restart at wizard level
- [ ] **10.10** Test cancel/restart at flow level (committed stages kept)
- [ ] **10.11** Test flow resume across browser sessions
- [ ] **10.12** Test placeholder stage round-trip (open placeholder → use legacy page → return → progress updates)
- [ ] **10.13** Test on mobile viewport (cards, steppers, info buttons all touch-friendly)
- [ ] **10.14** Verify all info buttons show correct content

**Verification:** Wizard 2 leagues work in the existing app. Modular data is captured correctly. Flow tracks progress across wizard and placeholder stages.

---

### Phase 11: Documentation & Handoff

**Goal:** Document the framework so future wizards and modular tables can adopt the patterns.

- [ ] **11.1** Add `@fileoverview` headers to all framework files
- [ ] **11.2** Document `WizardStepProps`, `WizardFlowConfig`, `FlowStage`, and the modular config table pattern
- [ ] **11.3** Write `memory-bank/wizard-v2-framework.md` — usage guide for adding new wizards, flows, and modular tables
- [ ] **11.4** Document the "swap a placeholder stage for a real wizard" pattern (how subsequent branches integrate)
- [ ] **11.5** Document the dual-write pattern so future modular tables follow it
- [ ] **11.6** Add JSDoc to all public framework APIs
- [ ] **11.7** Update `TABLE_OF_CONTENTS.md` with new files

**Verification:** A reader unfamiliar with the framework can build a new wizard step from the documentation alone, AND can swap a placeholder stage for a new wizard following the documented pattern.

---

## After This Branch Merges

These are NOT part of wizard-v2 — they're follow-up work in separate branches:

1. **Swap branch:** Switch the production "Create League" button from old wizard to new wizard. Remove old wizard files.
2. **`modular-handicap-config` resumes** with `TeamFormatStep` rebuilt against the new framework (much cleaner integration than what was originally planned).
3. **Future:** Migrate Season Creation Wizard to the new framework (separate branch). Steps planned:
   - Start date (Calendar)
   - Season length (NumberStepper, 10-52 weeks — replaces the current radio choice)
   - Playoff weeks (NumberStepper, 0-4 — this is where playoffs belong, right after season length)
   - BCA Championship dates
   - APA Championship dates
   - Review
   Note: Blackout/holiday weeks are handled by the Schedule Manager, not the season wizard.
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

### ✅ 6. Validation timing — **On Next button click**

Confirmed. Run zod validation only when the user clicks Next. If errors, display them and block advancement. Don't validate on every keystroke or on blur in v1.

**Reasoning:** Most wizard inputs are constrained controls (radios, cards, dropdowns, steppers) where invalid data is hard to enter in the first place. Most steps are single questions or short bursts, so the "wall of errors" risk is low. Simplest to implement, least nagging UX. If real users struggle with this later, upgrade to hybrid (validate on Next initially, then on change after first error) — that's a small follow-up, not a rewrite.

**Note:** This applies to step-level validation (zod schema check inside a wizard). Stage-level transitions (between flow stages) are validated implicitly by whether the database save succeeds.

### ✅ 7. Progress bar component — **Reuse existing `WizardProgress.tsx`**

Confirmed. Reuse `src/components/forms/WizardProgress.tsx` as-is. It's already a pure presentation component (takes `currentStep` and `totalSteps`, renders progress bar + counter, no coupling to old wizard internals). Works for both layers:
- **WizardFlow layer:** pass `currentStage` and `totalStages` for the unified flow progress bar
- **Wizard layer (standalone only):** pass `currentStep` and `totalSteps` when a wizard runs outside a flow

Style customization via existing `progressBarColor` and `className` props if needed. No fork, no rebuild.

### ✅ 8. Step file structure — **One file per step**

Confirmed. Each step lives in its own file under `src/wizards/league-v2/steps/`. Tests live alongside as `*.test.tsx`. Easier to find, test, review, and replace individually.

### ✅ 9. File size limit — **Under 100 lines per file**

Confirmed as a project-wide preference. All new wizard 2.0 components (shells, steps, hooks, utilities) should stay under 100 lines. If a component grows past 100 lines, split it into smaller pieces. Planning docs are exempt.

### ✅ 10. Cancel behavior — **Confirm dialog, never destroys committed data**

Confirmed. Cancel works at three levels:

1. **Mid-step cancel** (user is typing in a question) — confirm dialog: "Cancel and lose progress?" → Yes wipes the unsaved typing for this step. No keeps them on the step.
2. **Mid-wizard cancel** (user is partway through a wizard's questions, no stage committed yet) — same confirm dialog, wipes all the in-progress answers for this wizard. No database changes because nothing was committed yet.
3. **Mid-flow cancel** (user already completed an earlier stage like League creation, now in a later stage) — confirm dialog notes that already-saved stages stay saved. Cancel just exits the flow. The user can resume later from the dashboard. **Cancel never deletes committed data.**

To delete a committed stage (like a created league), the user must use that stage's dedicated delete button, which has its own warnings (e.g., the team cascade warning we just added).

### ✅ 11. localStorage key naming — **`wizard-v2:[flow-id]:[wizard-id]:formData`**

Confirmed. Descriptive namespaced keys, e.g., `wizard-v2:create-new-league:league:formData`. Benefits:
- `wizard-v2:` prefix avoids collision with old wizard keys
- Includes flow + wizard ID so it's obvious what each key belongs to in dev tools
- Easy to grep and clean up old keys after migration is complete
- Descriptive enough to debug without context

---

## Open Decisions to Lock In Before Building

These still need to be discussed and locked in BEFORE Phase 0.

1. **In-progress flow detection on dashboard** — How does the user find and resume an in-progress flow? List view? Per-league indicator? Banner notification?

   - **Open question.** Needs UX discussion.

2. **Mid-season team drops** — Common scenario or edge case? How should it be handled?

   - **Open question.** Affects Team wizard design but not in v1 scope. Document and defer.

---

## Key Development Principles

### 1. Modular Foundation, Not Parity Rebuild

Wizard 2.0 is NOT a clean rebuild of the old wizard. It's an entirely new system that produces leagues with modular configuration data. The old wizard stays for backward compatibility — but we're building the foundation for a fully modular league management system, not copying the existing one.

**Dual-write pattern:** Wizard 2.0 writes to both the new modular tables AND the existing hardcoded fields. Old reading code keeps working. New tables accumulate data for future use.

### 2. Maximum Modular Reach, Even When Build Doesn't Match Yet

Every modular concept gets a database table from day one, even if the wizard only has UI for some of them. Future branches add UI for the rest without schema changes. The modular design is the destination — visible "Coming soon" placeholders in the UI signal where the system is going.

**Pattern for "Coming soon" cards:** Same as the Individual Races match format option in TeamFormatStep. The card is visible, disabled, shows a toast on click. Reminds users (and us) of the future direction.

### 3. Ship Modular Foundation, Accept Incompatible Combinations

Not all modular combinations will work out of the box. Wizard 2.0 v1 just stores the choices — it doesn't validate that the rendering app code can actually handle every combination.

- **Compatible combinations** (matching wizard 1's hardcoded options): work in the existing app via dual-write
- **Incompatible combinations** (new combinations we don't have rendering logic for): stored in the database but flagged for future support
- **Warning UI and manual fallback** for incompatible combinations: NOT in this branch. Future work driven by real user needs.

**The point:** Don't artificially restrict what users can choose just because the rendering code can't handle every combination yet. Capture their intent in the database. Iterate on rendering support based on what users actually try.

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

_Last Updated: 2026-04-09 (Phase 0 complete; reordered phases to UI-first per user preference — schema work deferred until after wizard UI is built so we know exactly what fields to save)_
_Status: Phase 0 ✅ complete. Currently entering Phase 1 (Wizard Shell). Schema work (originally Phase 1) is now Phase 8, AFTER the UI is built._
_Estimated Effort: ~4-5 weeks (framework + new wizard with 3 presets + Custom path + Create New League flow with placeholders + schema/mutations)_
_Risk Note: App is live but has no real users yet — all test data. We can break things during development without backward compatibility concerns. Reassess if real users arrive before this ships._
_Schema Strategy: Extend existing `preferences` table (cascade pattern) instead of creating separate modular tables. Bring in `threshold_charts` system from `lo-manual-scoring` branch as-is. Add `fargo_rating` to `members`. Loosen `team_format` CHECK constraint. **Schema work happens AFTER UI work** — user prefers to discover the data shape by building the UI first and holding answers in state until the wizard is functional._
_Reordered Phases (UI-first): Phase 0 Foundation ✅ → Phase 1 Wizard Shell → Phase 2 Persistence (localStorage) → Phase 3 Validation → Phase 4 Building Blocks → Phase 5 League Wizard Steps (captures to state) → Phase 6 WizardFlow Shell → Phase 7 Create New League Flow → Phase 8 Modular Schema (now we know what to save) → Phase 9 Dual-Write Mutation → Phase 10 Testing → Phase 11 Documentation._
