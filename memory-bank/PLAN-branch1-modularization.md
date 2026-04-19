# Branch 1: Modularization of Current System

**Branch Name:** `modular-handicap-config`
**Depends On:** `main`
**Goal:** Refactor existing hardcoded systems into configurable database-driven modules WITHOUT changing current behavior.

**Development Approach:** UI-First, Incremental
- Build UI first, interact with it, then create backend
- Complete one configuration type fully before moving to the next
- Dual-save to old and new fields during transition for backward compatibility

---

## Terminology

| Term | Definition |
|------|------------|
| **Lineup Size** | Number of players who play each match night (3, 4, 5, etc.) |
| **Roster Size** | Maximum players on the team (5, 7, 8, etc.) |
| **Match Format** | How games are structured (Single/Double Round Robin) |

---

## Phase 1: Team Configuration

**Goal:** Make team sizes configurable in the wizard with full backend support.

### Phase 1A: UI - Team Format Step in Wizard

Build the new team format selection UI in the league wizard.

#### Tasks

- [ ] **1A.1** Create `TeamFormatStep.tsx` as a thin orchestrator that composes smaller reusable components:
  - Selectable cards: 3v3, 4v4, 5v5, Custom (mobile-friendly tap targets)
  - Stats box dynamically showing current selection: lineup size, roster size, match format
  - Advanced Settings toggle (collapsed by default)
  - When expanded: lineup size stepper, roster size stepper, match format selection
  - Custom card auto-opens Advanced Settings when selected
  - Modifying values in Advanced Settings auto-switches selection to Custom
  - Switching to Custom carries over the previously-selected preset's values

#### Component Breakdown (KISS / DRY / Single Responsibility)

Each piece is a small, single-function, easily testable component:

| Component | Responsibility | Reusable? |
|-----------|----------------|-----------|
| `TeamFormatStep.tsx` | Orchestrator — owns state, composes children | No (step-specific) |
| `CardSelector.tsx` | Generic card-based radio selector with optional label, label InfoButton, per-option InfoButton, disabled state, and disabled toast message | **Yes — reuse anywhere** |
| `NumberStepper.tsx` | `−` value `+` control with min/max enforcement, optional label + InfoButton | **Yes — reuse anywhere** |
| `TeamFormatStatsBox.tsx` | Read-only display of current values, fixed position | No (specific to this form) |
| `InfoButton` | Existing — `?` icon with popup. Used inside CardSelector + NumberStepper. | Yes (already exists) |

**Build order:** `CardSelector` → `NumberStepper` → `TeamFormatStatsBox` → `TeamFormatStep` (compose them all).

Each leaf component should be testable in isolation: pass props, assert rendered output and callback behavior. No business logic in leaves — orchestrator owns state.

#### CardSelector API (v1 — keep it simple)

```typescript
interface CardSelectorOption<T> {
  value: T;
  title: string;
  description?: string;
  disabled?: boolean;
  disabledMessage?: string;    // Toast message when disabled card is tapped
  infoButton?: {               // Optional per-option info (?)
    title: string;
    content: React.ReactNode;
  };
}

interface CardSelectorProps<T> {
  // Question label (optional but encouraged)
  label?: string;
  labelInfoButton?: {          // Optional info button on the question itself
    title: string;
    content: React.ReactNode;
  };

  // The choices
  options: CardSelectorOption<T>[];
  value: T;
  onChange: (value: T) => void;

  // Layout
  layout?: 'horizontal' | 'vertical';
}
```

**Explicitly NOT in v1** (add later if needed): icon support, custom render props, animation config, columns count, custom styling overrides. Keep it simple, ship it, extend when there's a real need.

#### InfoButton Usage on Labels

Every question in this step gets an `InfoButton` next to its label. Content suggestions:

| Question | InfoButton Title | Content |
|----------|------------------|---------|
| Team Format (preset cards) | "What is team format?" | Explains the difference between lineup size and roster size, why presets exist |
| Lineup Size (stepper) | "What is lineup size?" | "The number of players who actually play during a match night." |
| Roster Size (stepper) | "What is roster size?" | "The maximum number of players you can have on your team. Extra players act as substitutes." |
| Match Format | "What is match format?" | Explains Single RR vs Double RR vs Individual Races |

- [ ] **1A.2** Add new fields to `LeagueFormData` type:
  - `lineupSize: number`
  - `rosterSize: number`
  - `matchFormat: 'single_round_robin' | 'double_round_robin' | 'individual_races'`

- [ ] **1A.3** Update `leagueWizardSteps.tsx` to use new `TeamFormatStep`

- [ ] **1A.4** Wire up the component in `WizardStepRenderer.tsx`

- [ ] **1A.5** Implement dual-save: save to both old `teamFormat` field AND new fields

#### UI Design

**Basic View (default):**
```
Choose your team format:

┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│   3v3    │  │   4v4    │  │   5v5    │  │  Custom  │
└──────────┘  └──────────┘  └──────────┘  └──────────┘
  (selectable cards - large tap targets, mobile-friendly)

┌─────────────────────────────────────┐
│  Lineup Size: 3                     │
│  Roster Size: 5                     │
│  Match Format: Double Round Robin   │
└─────────────────────────────────────┘
  (stats box - fixed position, no layout shift)

[▼ Advanced Settings]
```

**Advanced Settings (expanded):**
```
Lineup Size:  [ − ]   3   [ + ]    (min 3, max 6)

Roster Size:  [ − ]   5   [ + ]    (min = lineup size, max 12)

Match Format:
○ Single Round Robin (each player plays each opponent once)
○ Double Round Robin (each player plays each opponent twice)
○ Individual Races (coming soon - shows toast, disabled for now)
```

#### Behavior Rules

- **Selecting a preset card** (3v3/4v4/5v5): Sets lineup, roster, and format to preset values. Stats box updates immediately.
- **Selecting "Custom" card**: Auto-opens Advanced Settings. Initial values carry over from whichever preset was previously selected.
- **Modifying values in Advanced Settings**: If new values don't match any preset, selection auto-switches to "Custom" card. If values happen to match a preset exactly, that preset card highlights.
- **Stepper disable rules**: `−` button disabled at min, `+` button disabled at max. Roster size `−` disabled when roster size equals lineup size.
- **Individual Races selection**: Disabled for now. If enabled in future, displays "Coming soon" toast on selection.

#### Preset Mappings

| Preset | Lineup Size | Roster Size | Match Format | Legacy teamFormat |
|--------|-------------|-------------|--------------|-------------------|
| 3v3 | 3 | 5 | Double RR | 5_man |
| 4v4 | 4 | 7 | Double RR | 5_man |
| 5v5 | 5 | 8 | Single RR | 8_man |

#### Verification Checklist (Phase 1A)

- [ ] Selectable cards show 3v3, 4v4, 5v5, Custom options
- [ ] Cards have large tap targets (mobile-friendly)
- [ ] Stats box updates when selection changes
- [ ] Stats box has fixed position (no layout shift when advanced toggles)
- [ ] Advanced settings toggle works
- [ ] Selecting Custom auto-opens advanced settings
- [ ] Modifying advanced values switches selection to Custom
- [ ] Custom carries over previously-selected preset values
- [ ] Lineup stepper enforces min 3, max 6
- [ ] Roster stepper enforces min = lineup size, max 12
- [ ] Match format shows Single RR, Double RR, Individual Races
- [ ] Individual Races is disabled with "coming soon" toast
- [ ] Form data contains all new fields
- [ ] Old teamFormat field still gets populated (backward compat)
- [ ] InfoButton appears next to every question label
- [ ] InfoButton popups display correct content
- [ ] CardSelector renders correctly in horizontal and vertical layouts
- [ ] CardSelector handles disabled options with toast message
- [ ] CardSelector supports per-option info buttons
- [ ] NumberStepper enforces min/max correctly
- [ ] Each leaf component (CardSelector, NumberStepper, TeamFormatStatsBox) works in isolation
- [ ] No business logic in leaf components — only in TeamFormatStep orchestrator

---

### Phase 1B: Database - Team Configuration Table

Create the database table and seed system defaults.

#### Tasks

- [ ] **1B.1** Create migration file for `team_configurations` table
- [ ] **1B.2** Create migration file for `match_format_configurations` table
- [ ] **1B.3** Seed system defaults matching current presets
- [ ] **1B.4** Add new columns to `leagues` table:
  - `lineup_size INTEGER`
  - `roster_size INTEGER`
  - `match_format_id UUID` (FK to match_format_configurations)
  - `team_config_id UUID` (FK to team_configurations) - for future use
- [ ] **1B.5** Run migrations on local Supabase

#### Database Schema

```sql
-- team_configurations table
CREATE TABLE team_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_system_default BOOLEAN DEFAULT false,
  organization_id UUID REFERENCES organizations(id),
  name TEXT NOT NULL,
  description TEXT,
  roster_size INTEGER NOT NULL DEFAULT 5,
  lineup_size INTEGER NOT NULL DEFAULT 3,
  min_roster INTEGER NOT NULL DEFAULT 3,
  allow_mid_match_subs BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT valid_sizes CHECK (
    lineup_size <= roster_size AND
    min_roster <= lineup_size AND
    lineup_size >= 3 AND lineup_size <= 6 AND
    roster_size <= 12
  )
);

-- match_format_configurations table
CREATE TABLE match_format_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_system_default BOOLEAN DEFAULT false,
  organization_id UUID REFERENCES organizations(id),
  name TEXT NOT NULL,
  description TEXT,
  format_type TEXT NOT NULL CHECK (format_type IN (
    'single_round_robin',
    'double_round_robin',
    'individual_races'
  )),
  games_per_matchup INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### System Defaults to Seed

**Team Configurations:**
| Name | Lineup Size | Roster Size |
|------|-------------|-------------|
| 3v3 Standard (5-player roster) | 3 | 5 |
| 4v4 Standard (7-player roster) | 4 | 7 |
| 5v5 Standard (8-player roster) | 5 | 8 |

**Match Format Configurations:**
| Name | Format Type | Notes |
|------|-------------|-------|
| Single Round Robin | single_round_robin | Each player plays each opponent once |
| Double Round Robin | double_round_robin | Each player plays each opponent twice |
| Individual Races | individual_races | Coming soon - disabled in UI for now |

#### Verification Checklist (Phase 1B)

- [ ] Tables created successfully
- [ ] System defaults seeded
- [ ] Leagues table has new columns
- [ ] Can query team_configurations
- [ ] Can query match_format_configurations

---

### Phase 1C: Types & Queries

Create TypeScript types and database query functions.

#### Tasks

- [ ] **1C.1** Create `src/types/configurations/teamConfiguration.ts`
- [ ] **1C.2** Create `src/types/configurations/matchFormatConfiguration.ts`
- [ ] **1C.3** Create `src/types/configurations/index.ts` (barrel export)
- [ ] **1C.4** Create `src/api/queries/teamConfigurations.ts`
- [ ] **1C.5** Create `src/api/queries/matchFormatConfigurations.ts`
- [ ] **1C.6** Create `src/api/hooks/useTeamConfigurations.ts`
- [ ] **1C.7** Create `src/api/hooks/useMatchFormatConfigurations.ts`
- [ ] **1C.8** Update `src/types/league.ts` to include new fields

#### Verification Checklist (Phase 1C)

- [ ] Types compile without errors
- [ ] Query functions work
- [ ] Hooks fetch data correctly

---

### Phase 1D: Integration - Connect Wizard to Database

Wire the wizard UI to save to the new database tables.

#### Tasks

- [ ] **1D.1** Update `useCreateLeague` mutation to save new fields
- [ ] **1D.2** Ensure both old (`team_format`) and new fields are saved
- [ ] **1D.3** Test creating leagues with all three presets
- [ ] **1D.4** Test creating leagues with custom advanced settings

#### Verification Checklist (Phase 1D)

- [ ] Creating 3v3 league saves correct values
- [ ] Creating 4v4 league saves correct values
- [ ] Creating 5v5 league saves correct values
- [ ] Custom lineup/roster sizes save correctly
- [ ] Match format saves correctly
- [ ] Old team_format field still populated

---

### Phase 1E: Update Existing Code to Use New Fields

Make lineup components read from the new fields.

#### Tasks

- [ ] **1E.1** Identify all places that read `team_format` for player count
- [ ] **1E.2** Create helper function: `getLineupSize(league)` that reads new field with fallback
- [ ] **1E.3** Create helper function: `getRosterSize(league)` that reads new field with fallback
- [ ] **1E.4** Update lineup components to use helper functions
- [ ] **1E.5** Test 3v3, 4v4, 5v5 lineups display correctly

#### Fallback Logic

```typescript
function getLineupSize(league: League): number {
  // New field takes priority
  if (league.lineup_size) return league.lineup_size;

  // Fallback to old team_format
  return league.team_format === '8_man' ? 5 : 3;
}

function getRosterSize(league: League): number {
  // New field takes priority
  if (league.roster_size) return league.roster_size;

  // Fallback to old team_format
  return league.team_format === '8_man' ? 8 : 5;
}
```

#### Verification Checklist (Phase 1E)

- [ ] Existing 3v3 leagues still work (fallback)
- [ ] Existing 5v5 leagues still work (fallback)
- [ ] New leagues with lineup_size field work
- [ ] 4v4 leagues work correctly

---

### Phase 1 Complete Checklist

Before moving to Phase 2:

- [ ] Wizard shows new team format UI
- [ ] Advanced settings allow customization
- [ ] Database tables exist with system defaults
- [ ] New leagues save to new fields
- [ ] Old leagues still work via fallback
- [ ] Lineup components use new fields

---

## Phase 2: Match Format Configuration

**Goal:** Make match format (round robin type) configurable and stored properly.

*(Details to be expanded after Phase 1 is complete)*

### High-Level Tasks

- [ ] Connect match format selection to database
- [ ] Update round robin generation to use config
- [ ] Calculate total games from lineup size + format

---

## Phase 3: Handicap Rating Configuration

**Goal:** Make handicap calculation method configurable.

*(Details to be expanded after Phase 2 is complete)*

### High-Level Tasks

- [ ] Add handicap system selection to wizard
- [ ] Create handicap_rating_configurations table
- [ ] Update handicap calculation to read from config

---

## Phase 4: Threshold Chart Configuration

**Goal:** Move hardcoded threshold charts to database.

*(Details to be expanded after Phase 3 is complete)*

### High-Level Tasks

- [ ] Create threshold_chart_configurations table
- [ ] Create threshold_chart_entries table
- [ ] Migrate hardcoded values to database
- [ ] Update threshold lookup to use database

---

## Phase 5: Testing & Cleanup

**Goal:** Verify all existing functionality works, remove old code.

*(Details to be expanded after Phase 4 is complete)*

### High-Level Tasks

- [ ] Full regression testing
- [ ] Remove dual-save (old fields)
- [ ] Update documentation

---

## Git Commands Reference

```bash
# Check which branch you're on
git branch

# See status of your changes
git status

# Stage all changes for commit
git add .

# Commit with message
git commit -m "Your commit message here"

# Push branch to remote
git push

# See commit history
git log --oneline
```

---

## Key Development Principles

### 1. UI First
Build and test the UI before creating backend support.

### 2. Dual Save During Transition
Save to both old and new fields until migration is complete.

### 3. Fallback Logic
New code reads new fields first, falls back to old fields.

### 4. One Thing at a Time
Complete one configuration type fully before starting the next.

### 5. Generic Query Functions
Write reusable query functions that handle any update scenario.

---

*Last Updated: 2025-04-09*
*Status: Phase 1A - Ready to Start*
