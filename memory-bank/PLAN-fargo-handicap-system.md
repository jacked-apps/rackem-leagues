# Plan: Fargo Rating System & Handicap System Redesign

## Overview

This document outlines the plan to add Fargo Rating support as a third handicap system, while also **redesigning the entire handicap/scoring architecture** to be more flexible and support any combination of:
- Team sizes (3v3, 4v4, 5v5, etc.)
- Handicap calculation methods (Current 3v3, BCA Standard, Fargo, Custom)
- Match formats (Round Robin, Race-to-X)
- Scoring systems (Games Won, Points-based)
- Threshold calculations (Fixed charts, Formulas, Custom)

---

## Research Findings: Fargo Rating Systems

### How Fargo Ratings Work (from official sources)

**Rating Scale:**
- Logarithmic scale (like Richter scale for earthquakes)
- 100-point gap = 2:1 win ratio (better player wins ~67% of games)
- 200-point gap = 4:1 win ratio (~80% win rate)
- 300-point gap = 8:1 win ratio (~89% win rate)
- Professional players: 700-800
- Good league players: 400-600
- Casual players: 200-400

**Sources:**
- [FargoRate Official](https://fargorate.com/)
- [Dr. Dave Pool Info - FargoRate](https://drdavepoolinfo.com/faq/rating/fargorate/)
- [CSI Pool - FargoRate Explained](https://www.playcsipool.com/fargo-ratings.html)

### Point-Based Scoring Systems Found

#### 17-Point System (Common in BCA leagues)
- **Winner gets:** 10 points + 1 point per opponent ball remaining = up to 17
- **Loser gets:** 1 point per ball pocketed = 0-7 points
- Total always equals 17

#### USAPL (USA Pool League) System
- **Winner gets:** 14 points (7 for balls + 7 for 8-ball)
- **Loser gets:** 0-7 points (1 per ball pocketed)

#### User's League System (described)
- **Winner gets:** 10 points
- **Loser gets:** 0-7 points (based on balls pocketed)
- Handicap: lower-rated team gets "start points" based on Fargo difference

### Fargo to Handicap Points Conversion - THE ACTUAL FORMULA

**Step 1: Calculate Win Probability from Rating Difference**

```
P(higher rated wins) = 1 / (1 + 2^(-D/100))
```
Where D = rating difference (higher rating - lower rating)

| Rating Diff | Higher Player Win % | Lower Player Win % |
|-------------|--------------------|--------------------|
| 0           | 50%                | 50%                |
| 50          | 58.6%              | 41.4%              |
| 100         | 66.7%              | 33.3%              |
| 150         | 73.9%              | 26.1%              |
| 200         | 80%                | 20%                |
| 300         | 88.9%              | 11.1%              |

**Step 2: Transform Ratings for Expected Game Calculation**

```
Transformed Rating = 2^(Fargo Rating / 100)
```

| Fargo | Transformed |
|-------|-------------|
| 800   | 256         |
| 700   | 128         |
| 600   | 64          |
| 500   | 32          |
| 400   | 16          |
| 300   | 8           |

**Step 3: Calculate Expected Wins**

```
Expected Wins (Player A) = (TA / (TA + TB)) × Total Games
```

**Example:**
- Player A: 575 Fargo → TA = 2^5.75 ≈ 53.8
- Player B: 525 Fargo → TB = 2^5.25 ≈ 38.1
- In 10 games:
  - A expects: (53.8 / 91.9) × 10 = **5.9 wins**
  - B expects: (38.1 / 91.9) × 10 = **4.1 wins**

**Step 4: Calculate Expected Score (for point-based systems)**

```
Expected Score = (P(Win) × Winner Points) + (P(Lose) × Expected Loser Points)
```

For 17-point system where winner gets 10-17, loser gets 0-7:
- Expected loser points varies by skill level (regression formula from Fargo data)
- Higher skilled players leave fewer balls for opponent

**Step 5: Team Handicap Calculation**

```
Team Handicap = (Team A Expected Score - Team B Expected Score) × Games Per Round
```

The difference is given to the weaker team as "start points."

**Key Options:**
- **Handicap Percentage**: Usually 100%, but can be 50%, 75%, 150% etc.
- **Per Round vs Per Match**: Can recalculate each round based on matchups
- **Max Handicap Cap**: Leagues can limit maximum handicap points

**Sources:**
- [FargoRate Behind the Curtain](https://www.fargorate.com/fargorateblog/archive/behindthecurtain/)
- [FargoRate League Calculator](https://leaguecalc.fargorate.com/)
- [17-Point System Explained](https://www.playcsipool.com/csinews/how-fargorate-improves-the-17-point-system)
- [BCA Points and Handicapping](https://playingpool.substack.com/p/bca-points-and-handicapping)

### Key Insight: Handicap Points Vary Per Round

Unlike our current fixed threshold system, Fargo-based handicaps:
- Calculate fresh each round based on WHO is playing WHOM
- Are NOT static for the entire match
- Require knowing the exact player matchups

This is a significant architectural difference from our current system.

---

## Current State Analysis

### What We Have Now

| Aspect | 3v3 (5-Man) System | 5v5 (8-Man) BCA System |
|--------|-------------------|------------------------|
| **Team Size** | Hardcoded 3v3 | Hardcoded 5v5 |
| **Player Handicap** | -2 to +2 integer | 0-100% percentage |
| **Calculation** | (wins-losses)/weeks | wins/games × 100 |
| **Match Format** | Double Round Robin (18 games) | Single Round Robin (25 games) |
| **Threshold** | Fixed lookup table (25 values) | Range-based lookup (7 ranges) |
| **Scoring** | Games won count | Games won count |
| **Team Bonus** | Yes (standings-based) | No |

### The Problem

The current implementation is **tightly coupled**:
- Handicap system is tied to team format
- Match format is hardcoded per system
- Threshold charts are embedded in code
- No way to mix/match components
- Adding Fargo requires significant refactoring anyway

---

## Current Architecture: What's Hardcoded vs Configurable

### Currently HARDCODED (In TypeScript Code)

#### 1. Team Sizes
**Location:** Throughout codebase, especially lineup components
```typescript
// Only two options exist
type TeamFormat = '5_man' | '8_man';
// Maps to: 3v3 (3 players) or 5v5 (5 players)
```
**Problem:** Can't do 4v4, can't have 10-player roster with 5v5, etc.

#### 2. Handicap Threshold Charts
**Location:** [get3v3GamesNeeded.ts](src/utils/handicap/get3v3GamesNeeded.ts), [get5v5GamesNeeded.ts](src/utils/handicap/get5v5GamesNeeded.ts)
```typescript
// 3v3: Exact lookup table (25 entries)
const HANDICAP_CHART_3V3: Record<number, HandicapThresholds> = {
  12: { games_to_win: 16, games_to_tie: 15, games_to_lose: 14 },
  // ... 25 hardcoded entries
};

// 5v5: Range-based lookup (7 ranges)
const BCA_5V5_RANGES = [
  { minDiff: 0, maxDiff: 14, higherTeamWins: 13, lowerTeamWins: 13 },
  // ... 7 hardcoded ranges
];
```
**Problem:** Can't add Fargo chart, can't let operators customize values.

#### 3. Match Format (Games per Match)
**Location:** Lineup and scoring components
```typescript
// Hardcoded calculations
// 3v3: 3 × 3 × 2 = 18 games (double round robin)
// 5v5: 5 × 5 × 1 = 25 games (single round robin)
```
**Problem:** Can't change to race-to-X, can't adjust games per matchup.

#### 4. Scoring System
**Location:** Match scoring components
```typescript
// Only tracks: game won (1) or lost (0)
// No points tracking
// No balls pocketed tracking
```
**Problem:** Can't do point-based systems (17-point, Fargo 10-point).

#### 5. Handicap Calculation Formulas
**Location:** [calculatePlayerHandicap.ts](src/utils/calculatePlayerHandicap.ts)
```typescript
// 3v3 formula: (wins - losses) / weeks_played
// 5v5 formula: wins / games_played * 100
```
**Problem:** Can't use Fargo ratings, can't use external ratings.

#### 6. Handicap Variant Ranges
**Location:** [preferences.ts](src/types/preferences.ts), database CHECK constraints
```typescript
type HandicapVariant = 'standard' | 'reduced' | 'none';
// standard: -2 to +2 (3v3) or 0-100% (5v5)
// reduced: -1 to +1 (3v3) or 0-50% (5v5)
// none: 0 only
```
**Problem:** Can't define custom ranges, ranges tied to team format.

---

### Currently CONFIGURABLE (Via Preferences)

**Location:** [preferences.ts](src/types/preferences.ts), `preferences` table

| Setting | Type | Default | Scope |
|---------|------|---------|-------|
| `handicap_variant` | 'standard' \| 'reduced' \| 'none' | 'standard' | Org → League |
| `team_handicap_variant` | 'standard' \| 'reduced' \| 'none' | 'standard' | Org → League |
| `game_history_limit` | 50-500 | 200 | Org → League |
| `team_format` | '5_man' \| '8_man' | '5_man' | Org → League |
| `golden_break_counts_as_win` | boolean | true | Org → League |
| `allow_unauthorized_players` | boolean | true | Org → League |
| `profanity_filter_enabled` | boolean | false | Org → League |

**Cascading Pattern:** League setting → Organization setting → System default

---

## Proposed Modular Architecture

### Design Philosophy

Instead of hardcoded systems, create **configurable building blocks** that can be mixed and matched. Each organization gets a "copy" of system defaults they can customize.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         SYSTEM DEFAULTS                                  │
│  (Seeded templates that cannot be modified, used as starting points)    │
├─────────────────────────────────────────────────────────────────────────┤
│  • BCA 3v3 Config        • BCA 5v5 Config        • Fargo 8-Ball Config  │
│  • 3v3 Threshold Chart   • 5v5 Threshold Chart   • Fargo Point Chart    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ (copy on first use)
┌─────────────────────────────────────────────────────────────────────────┐
│                      ORGANIZATION CONFIGURATIONS                         │
│  (Organization's customized copies - can modify freely)                  │
├─────────────────────────────────────────────────────────────────────────┤
│  • My Custom 3v3 Config  (based on BCA 3v3, tweaked values)             │
│  • My Fargo League Setup (based on Fargo template)                      │
│  • Custom Threshold Chart (modified from BCA)                           │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ (reference or override)
┌─────────────────────────────────────────────────────────────────────────┐
│                         LEAGUE SETTINGS                                  │
│  (Uses org config, can override specific values)                        │
├─────────────────────────────────────────────────────────────────────────┤
│  • Monday Night League → uses "My Custom 3v3 Config"                    │
│  • Tuesday Fargo League → uses "My Fargo League Setup"                  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### Module 1: Team Configuration

**Current State:** Hardcoded '5_man' or '8_man' with fixed player counts

**Proposed Schema:**
```sql
CREATE TABLE team_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Ownership
  is_system_default BOOLEAN DEFAULT false,     -- true = read-only template
  organization_id UUID REFERENCES organizations(id),  -- NULL for system defaults

  -- Display
  name TEXT NOT NULL,                          -- "3v3 Standard", "4v4 Custom"
  description TEXT,

  -- Team Size
  roster_size INTEGER NOT NULL DEFAULT 5,      -- Max players on team roster
  playing_size INTEGER NOT NULL DEFAULT 3,     -- Players per match night
  min_roster INTEGER NOT NULL DEFAULT 3,       -- Minimum to field a team

  -- Substitution Rules
  allow_mid_match_subs BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT valid_sizes CHECK (
    playing_size <= roster_size AND
    min_roster <= playing_size AND
    playing_size >= 2 AND playing_size <= 8
  )
);

-- System defaults (seeded, read-only)
INSERT INTO team_configurations (is_system_default, name, roster_size, playing_size, min_roster) VALUES
  (true, '3v3 Standard (5-man roster)', 5, 3, 3),
  (true, '5v5 Standard (8-man roster)', 8, 5, 5),
  (true, '4v4 Standard (6-man roster)', 6, 4, 4);
```

**TypeScript Type:**
```typescript
interface TeamConfiguration {
  id: string;
  is_system_default: boolean;
  organization_id: string | null;
  name: string;
  description: string | null;
  roster_size: number;
  playing_size: number;
  min_roster: number;
  allow_mid_match_subs: boolean;
}
```

---

### Module 2: Match Format Configuration

**Current State:** Hardcoded double round-robin (3v3) or single round-robin (5v5)

**Proposed Schema:**
```sql
CREATE TABLE match_format_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Ownership
  is_system_default BOOLEAN DEFAULT false,
  organization_id UUID REFERENCES organizations(id),

  -- Display
  name TEXT NOT NULL,                          -- "Double Round Robin", "Race to 5"
  description TEXT,

  -- Format Type
  format_type TEXT NOT NULL CHECK (format_type IN (
    'double_round_robin',  -- Each player plays each opponent twice
    'single_round_robin',  -- Each player plays each opponent once
    'race_to_x',           -- First to X games wins matchup
    'fixed_games'          -- Play exactly X total games
  )),

  -- Format Parameters (used based on format_type)
  games_per_matchup INTEGER,                   -- For round robin: 1 or 2
  race_to_games INTEGER,                       -- For race_to_x: target wins
  fixed_total_games INTEGER,                   -- For fixed_games: exact count

  -- Tiebreaker Rules
  tiebreaker_enabled BOOLEAN DEFAULT true,
  tiebreaker_format TEXT CHECK (tiebreaker_format IN ('best_of_3', 'best_of_5', 'sudden_death')),

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- System defaults
INSERT INTO match_format_configurations (is_system_default, name, format_type, games_per_matchup, tiebreaker_format) VALUES
  (true, '3v3 Double Round Robin', 'double_round_robin', 2, 'best_of_3'),
  (true, '5v5 Single Round Robin', 'single_round_robin', 1, NULL);
```

---

### Module 3: Scoring System Configuration

**Current State:** Only tracks games won/lost, no points

**Proposed Schema:**
```sql
CREATE TABLE scoring_system_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Ownership
  is_system_default BOOLEAN DEFAULT false,
  organization_id UUID REFERENCES organizations(id),

  -- Display
  name TEXT NOT NULL,                          -- "Games Won", "17-Point System"
  description TEXT,

  -- Scoring Method
  scoring_method TEXT NOT NULL CHECK (scoring_method IN (
    'games_won',           -- Current: 1 point per game won
    'points_accumulated'   -- Fargo: track points per game
  )),

  -- For points_accumulated:
  winner_points INTEGER,                       -- e.g., 10 or 14 or 17
  winner_points_variable BOOLEAN DEFAULT false,-- true = 10 + opponent balls remaining
  loser_points_method TEXT CHECK (loser_points_method IN (
    'balls_pocketed',      -- 0-7 based on balls made
    'fixed',               -- Always same value
    'none'                 -- Loser gets 0
  )),
  loser_points_max INTEGER,                    -- e.g., 7 for 8-ball

  -- Win Determination
  win_condition TEXT NOT NULL CHECK (win_condition IN (
    'games_threshold',     -- Current: first to X games
    'points_threshold',    -- First to X points
    'highest_after_games'  -- Play all games, highest wins
  )),

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- System defaults
INSERT INTO scoring_system_configurations (is_system_default, name, scoring_method, win_condition) VALUES
  (true, 'Games Won (Standard)', 'games_won', 'games_threshold'),
  (true, '17-Point System', 'points_accumulated', 'highest_after_games'),
  (true, '10-Point Fargo', 'points_accumulated', 'points_threshold');
```

---

### Module 4: Handicap Rating System Configuration

**Current State:** Formula hardcoded per team format

**Proposed Schema:**
```sql
CREATE TABLE handicap_rating_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Ownership
  is_system_default BOOLEAN DEFAULT false,
  organization_id UUID REFERENCES organizations(id),

  -- Display
  name TEXT NOT NULL,                          -- "Win/Loss Ratio", "Fargo Rating"
  description TEXT,

  -- Rating Method
  rating_method TEXT NOT NULL CHECK (rating_method IN (
    'win_loss_ratio',      -- Current 3v3: (W-L)/weeks
    'win_percentage',      -- Current 5v5: W/games * 100
    'fargo_rating',        -- External Fargo rating (manual entry)
    'manual_rating',       -- Operator assigns directly
    'none'                 -- No handicapping
  )),

  -- Rating Range
  rating_min DECIMAL NOT NULL,                 -- e.g., -2, 0, 100
  rating_max DECIMAL NOT NULL,                 -- e.g., +2, 100, 850
  rating_step DECIMAL DEFAULT 1,               -- Increment (1, 0.5, etc.)

  -- Calculation Parameters (for calculated methods)
  min_games_for_calculation INTEGER,           -- Minimum games before calculating
  default_rating DECIMAL,                      -- Starting value for new players
  games_history_limit INTEGER DEFAULT 200,     -- How many recent games to consider

  -- Display Format
  display_format TEXT DEFAULT 'integer',       -- 'integer', 'percentage', 'decimal'
  display_suffix TEXT,                         -- '%', ' pts', etc.

  -- Entry Requirements
  requires_entry_each_match BOOLEAN DEFAULT false,  -- true for Fargo

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- System defaults
INSERT INTO handicap_rating_configurations (is_system_default, name, rating_method, rating_min, rating_max, display_format) VALUES
  (true, 'Win/Loss Ratio (3v3 Standard)', 'win_loss_ratio', -2, 2, 'integer'),
  (true, 'Win Percentage (5v5 BCA)', 'win_percentage', 0, 100, 'percentage'),
  (true, 'Fargo Rating', 'fargo_rating', 100, 850, 'integer');
```

---

### Module 5: Threshold Chart Configuration

**Current State:** Hardcoded lookup tables in TypeScript

**Proposed Schema:**
```sql
CREATE TABLE threshold_chart_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Ownership
  is_system_default BOOLEAN DEFAULT false,
  organization_id UUID REFERENCES organizations(id),

  -- Display
  name TEXT NOT NULL,                          -- "BCA 3v3 Standard", "Fargo Points"
  description TEXT,

  -- Threshold Type
  threshold_type TEXT NOT NULL CHECK (threshold_type IN (
    'exact_lookup',        -- Exact handicap diff → values (3v3 style)
    'range_lookup',        -- Range of diffs → values (5v5 style)
    'formula',             -- Calculate from formula
    'fixed_target'         -- Always same target (e.g., first to 100 pts)
  )),

  -- What we're measuring
  threshold_unit TEXT NOT NULL CHECK (threshold_unit IN ('games', 'points')),

  -- For formula type
  formula_base_target INTEGER,                 -- Starting target
  formula_adjustment_per_point DECIMAL,        -- +/- per handicap point
  formula_min_target INTEGER,
  formula_max_target INTEGER,

  -- For fixed_target type
  fixed_target_value INTEGER,                  -- e.g., 100 points

  -- Tie Handling
  ties_possible BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Threshold chart entries (for exact_lookup and range_lookup types)
CREATE TABLE threshold_chart_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chart_id UUID NOT NULL REFERENCES threshold_chart_configurations(id) ON DELETE CASCADE,

  -- For exact_lookup: min=max (e.g., diff=5)
  -- For range_lookup: min and max define range (e.g., 15-40)
  handicap_diff_min INTEGER NOT NULL,
  handicap_diff_max INTEGER NOT NULL,

  -- Threshold values
  higher_team_target INTEGER NOT NULL,         -- Games/points needed by higher handicap team
  lower_team_target INTEGER NOT NULL,          -- Games/points needed by lower handicap team
  tie_threshold INTEGER,                       -- NULL if no ties

  UNIQUE(chart_id, handicap_diff_min, handicap_diff_max)
);

-- System default: 3v3 chart (migrate from hardcoded)
-- Would insert 25 entries for handicap_diff -12 to +12
-- System default: 5v5 chart (migrate from hardcoded)
-- Would insert 7 range entries
```

---

### Module 6: Game Achievements Configuration

**Current State:** Only Break & Run and Golden Break, partially configurable

**Proposed Schema:**
```sql
CREATE TABLE game_achievement_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Ownership (at organization level, applies to all their leagues)
  organization_id UUID REFERENCES organizations(id),

  -- Achievement Type
  achievement_type TEXT NOT NULL CHECK (achievement_type IN (
    'break_and_run',
    'golden_break',
    'runout',              -- Opponent broke dry, you ran table
    'win_by_forfeit',
    'loss_on_break',       -- Scratch + 8 on break = loss
    'safety_battle_win'    -- Future: won after long safety exchange
  )),

  -- Configuration
  enabled BOOLEAN DEFAULT true,                -- Track this achievement?
  counts_as_win BOOLEAN DEFAULT false,         -- Auto-win? (golden break)
  affects_points BOOLEAN DEFAULT false,        -- Different points? (forfeit = 0 for loser)

  -- Validation
  breaker_only BOOLEAN DEFAULT false,          -- Only breaker can achieve?
  racker_only BOOLEAN DEFAULT false,           -- Only racker can achieve?

  -- Display
  display_name TEXT,                           -- "8 on the Break" vs "Golden Break"

  created_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(organization_id, achievement_type)
);
```

---

### Module 7: Complete League Configuration (Ties It Together)

**Proposed Schema Updates to `leagues` table:**
```sql
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS
  -- Reference to configuration modules
  team_config_id UUID REFERENCES team_configurations(id),
  match_format_id UUID REFERENCES match_format_configurations(id),
  scoring_system_id UUID REFERENCES scoring_system_configurations(id),
  handicap_rating_id UUID REFERENCES handicap_rating_configurations(id),
  threshold_chart_id UUID REFERENCES threshold_chart_configurations(id);

-- Keep existing columns for backward compatibility during migration
-- Eventually deprecate: team_format, handicap_variant, etc.
```

---

### Updated Preferences Type

```typescript
// New comprehensive preferences
interface Preferences {
  id: string;
  entity_type: 'organization' | 'league';
  entity_id: string;

  // Module References (NULL = use org default or system default)
  team_config_id: string | null;
  match_format_id: string | null;
  scoring_system_id: string | null;
  handicap_rating_id: string | null;
  threshold_chart_id: string | null;

  // Simple Settings (keep as columns)
  golden_break_counts_as_win: boolean | null;
  allow_unauthorized_players: boolean | null;
  profanity_filter_enabled: boolean | null;
  game_history_limit: number | null;

  created_at: string;
  updated_at: string;
}
```

---

### How "Copy on Customize" Works

1. **System defaults are seeded and READ-ONLY**
   - Cannot be modified
   - Serve as templates

2. **Organization references system default initially**
   ```sql
   -- Org starts using system default
   UPDATE preferences SET team_config_id = 'system-3v3-id'
   WHERE entity_id = 'my-org-id';
   ```

3. **When operator wants to customize:**
   ```sql
   -- Copy system default to org-owned copy
   INSERT INTO team_configurations (
     organization_id, name, roster_size, playing_size, min_roster
   )
   SELECT
     'my-org-id', name || ' (Custom)', roster_size, playing_size, min_roster
   FROM team_configurations
   WHERE id = 'system-3v3-id';

   -- Update org to use new copy
   UPDATE preferences SET team_config_id = 'new-copy-id'
   WHERE entity_id = 'my-org-id';
   ```

4. **Now org can modify their copy freely**

5. **Leagues inherit from org by default**
   - League preference has NULL for team_config_id
   - Resolution: Use org's team_config_id
   - League can override with its own reference

---

### Migration Strategy: Existing Leagues

**Problem:** Existing leagues use hardcoded values. How do we migrate?

**Solution:** Create system defaults that match current behavior, auto-assign to existing leagues.

```sql
-- Step 1: Create system default configurations matching current behavior

-- Team configs matching current team_format
INSERT INTO team_configurations (id, is_system_default, name, roster_size, playing_size)
VALUES
  ('sys-3v3', true, 'BCA 3v3 Standard', 5, 3),
  ('sys-5v5', true, 'BCA 5v5 Standard', 8, 5);

-- Match formats matching current behavior
INSERT INTO match_format_configurations (id, is_system_default, name, format_type, games_per_matchup)
VALUES
  ('sys-drr', true, 'Double Round Robin (3v3)', 'double_round_robin', 2),
  ('sys-srr', true, 'Single Round Robin (5v5)', 'single_round_robin', 1);

-- Scoring (current games-won system)
INSERT INTO scoring_system_configurations (id, is_system_default, name, scoring_method, win_condition)
VALUES
  ('sys-games', true, 'Games Won Standard', 'games_won', 'games_threshold');

-- Handicap rating matching current formulas
INSERT INTO handicap_rating_configurations (id, is_system_default, name, rating_method, rating_min, rating_max)
VALUES
  ('sys-3v3-hc', true, 'Win/Loss Ratio (3v3)', 'win_loss_ratio', -2, 2),
  ('sys-5v5-hc', true, 'Win Percentage (5v5)', 'win_percentage', 0, 100);

-- Threshold charts (migrate from hardcoded TypeScript)
INSERT INTO threshold_chart_configurations (id, is_system_default, name, threshold_type, threshold_unit)
VALUES
  ('sys-3v3-chart', true, 'BCA 3v3 Chart', 'exact_lookup', 'games'),
  ('sys-5v5-chart', true, 'BCA 5v5 Chart', 'range_lookup', 'games');

-- Insert chart entries from current hardcoded values...

-- Step 2: Update existing leagues to reference appropriate configs
UPDATE leagues SET
  team_config_id = CASE WHEN team_format = '5_man' THEN 'sys-3v3' ELSE 'sys-5v5' END,
  match_format_id = CASE WHEN team_format = '5_man' THEN 'sys-drr' ELSE 'sys-srr' END,
  scoring_system_id = 'sys-games',
  handicap_rating_id = CASE WHEN team_format = '5_man' THEN 'sys-3v3-hc' ELSE 'sys-5v5-hc' END,
  threshold_chart_id = CASE WHEN team_format = '5_man' THEN 'sys-3v3-chart' ELSE 'sys-5v5-chart' END;
```

**Result:** All existing leagues continue working exactly as before, but now reference modular configurations.

---

### Summary: Modular Components

| Component | Current | Proposed | Configurable By |
|-----------|---------|----------|-----------------|
| **Team Size** | Hardcoded 3v3/5v5 | `team_configurations` table | Organization |
| **Match Format** | Hardcoded RR | `match_format_configurations` table | Organization |
| **Scoring System** | Games only | `scoring_system_configurations` table | Organization |
| **Handicap Rating** | Hardcoded formulas | `handicap_rating_configurations` table | Organization |
| **Threshold Charts** | Hardcoded TypeScript | `threshold_chart_configurations` + entries | Organization |
| **Achievements** | Partial (B&R, GB) | `game_achievement_configurations` table | Organization |

**Each organization gets:**
- Access to read-only system defaults
- Ability to create custom copies
- Leagues inherit org settings but can override

---

## Fargo Rating System Requirements

### How Fargo Works (8-Ball League Variant)

Based on user's league and research needed:

1. **Fargo Ratings**
   - Range: ~100-850 (typical pool player range)
   - Changes frequently (after each sanctioned play)
   - Must be manually entered until API access obtained
   - Stored as "last known rating" for reference

2. **Points-Based Scoring** (NOT games won)
   - Winner gets: **10 points**
   - Loser gets: **0-7 points** based on balls pocketed
   - Total points determine match winner, not game count

3. **Handicap Start Points**
   - Lower-rated team gets "start" points based on rating difference
   - Formula TBD - need to research or make configurable
   - Example: If Team A is 50 Fargo points lower, they might start with +15 points

4. **Threshold**
   - Based on total points, not games won
   - Example: First team to 100 points wins the match
   - Or: After X games, highest points wins

---

## Proposed Architecture Redesign

### Core Concept: Composable Scoring System

Instead of hardcoded systems, create **configurable building blocks**:

```
┌─────────────────────────────────────────────────────────────────┐
│                     LEAGUE CONFIGURATION                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ Team Config │  │Match Format │  │  Handicap   │             │
│  │             │  │             │  │   System    │             │
│  │ - Roster    │  │ - Structure │  │             │             │
│  │ - Playing   │  │ - Games     │  │ - Method    │             │
│  │             │  │ - Rounds    │  │ - Variant   │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│         │                │                │                     │
│         └────────────────┼────────────────┘                     │
│                          ▼                                      │
│              ┌─────────────────────┐                           │
│              │   Scoring System    │                           │
│              │                     │                           │
│              │ - Points per win    │                           │
│              │ - Points for loser  │                           │
│              │ - Threshold type    │                           │
│              │ - Threshold config  │                           │
│              └─────────────────────┘                           │
│                          │                                      │
│                          ▼                                      │
│              ┌─────────────────────┐                           │
│              │ Threshold Calculator│                           │
│              │                     │                           │
│              │ - Chart-based       │                           │
│              │ - Formula-based     │                           │
│              │ - Fixed target      │                           │
│              └─────────────────────┘                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### Component 1: Team Configuration

```typescript
interface TeamConfig {
  roster_size: number;        // Max players on team (5, 7, 8, 10, etc.)
  playing_size: number;       // Players per match (3, 4, 5, etc.)
  allow_substitutes: boolean; // Can swap players mid-match?
  min_roster: number;         // Minimum to field a team
}

// Examples:
// { roster_size: 5, playing_size: 3 }  → Current 3v3
// { roster_size: 8, playing_size: 5 }  → Current 5v5
// { roster_size: 7, playing_size: 4 }  → New 4v4 option
// { roster_size: 10, playing_size: 5 } → Larger roster 5v5
```

### Component 2: Match Format

```typescript
type MatchStructure =
  | 'double_round_robin'  // Each player plays each opponent twice
  | 'single_round_robin'  // Each player plays each opponent once
  | 'race_to_x'           // First to X wins (per matchup or total)
  | 'fixed_games';        // Play exactly X games total

interface MatchFormat {
  structure: MatchStructure;

  // For round robin:
  games_per_matchup?: number;  // 1 for single, 2 for double

  // For race_to_x:
  race_to?: number;            // e.g., 5 (first to 5 wins)
  per_matchup?: boolean;       // Race per player pair or whole match?

  // For fixed_games:
  total_games?: number;        // e.g., 18 games regardless of format

  // Calculated (derived):
  total_possible_games: number; // Auto-calculated based on above
}

// Examples:
// Double Round Robin 3v3: 3×3×2 = 18 games
// Single Round Robin 4v4: 4×4×1 = 16 games
// Race to 5 per matchup 3v3: 9 matchups × variable games
```

### Component 3: Handicap System

```typescript
type HandicapMethod =
  | 'win_loss_ratio'      // Current 3v3: (W-L)/weeks → -2 to +2
  | 'win_percentage'      // Current 5v5: W/games × 100 → 0-100%
  | 'fargo_rating'        // External rating: 100-850
  | 'manual'              // Operator assigns directly
  | 'none';               // No handicapping

interface HandicapSystem {
  method: HandicapMethod;

  // Range constraints:
  min_value: number;
  max_value: number;

  // Variant (how much handicap matters):
  variant: 'standard' | 'reduced' | 'none';

  // Calculation parameters:
  min_games_for_calc?: number;  // e.g., 18 games before calculating
  default_value?: number;       // Starting handicap for new players

  // For Fargo specifically:
  requires_entry_each_match?: boolean;  // true for Fargo

  // Team handicap bonus (standings-based):
  team_bonus_enabled: boolean;
  team_bonus_threshold?: number;  // Wins ahead per +1 bonus
}
```

### Component 4: Scoring System (NEW)

```typescript
type ScoringMethod =
  | 'games_won'           // Current: count wins
  | 'points_accumulated'  // Fargo: accumulate points
  | 'frames_won';         // Snooker-style

interface ScoringSystem {
  method: ScoringMethod;

  // For games_won:
  // (no additional config needed)

  // For points_accumulated:
  winner_points?: number;      // e.g., 10
  loser_points_method?: 'balls_pocketed' | 'fixed' | 'none';
  loser_points_max?: number;   // e.g., 7 (for 8-ball)

  // Handicap start points (for Fargo):
  handicap_affects_start?: boolean;
  start_points_formula?: string;  // TBD: how to calculate
}
```

### Component 5: Threshold System (Redesigned)

```typescript
type ThresholdType =
  | 'chart_lookup'        // Current: hardcoded lookup tables
  | 'formula'             // Calculate from handicap diff
  | 'fixed_target'        // First to X (points or games)
  | 'custom_chart';       // Operator-defined lookup table

interface ThresholdSystem {
  type: ThresholdType;

  // What we're measuring:
  unit: 'games' | 'points';

  // For chart_lookup (current systems):
  chart_id?: string;  // Reference to stored chart

  // For formula:
  formula?: {
    base_target: number;           // e.g., 10 games
    adjustment_per_handicap: number; // e.g., +1 per handicap point
    min_target: number;
    max_target: number;
  };

  // For fixed_target:
  fixed_target?: number;  // e.g., first to 100 points

  // For custom_chart:
  custom_chart?: ThresholdChartEntry[];
}

interface ThresholdChartEntry {
  handicap_diff_min: number;
  handicap_diff_max: number;
  higher_team_target: number;
  lower_team_target: number;
  tie_threshold?: number;
}
```

---

## Database Schema Changes Needed

### New Tables

```sql
-- Scoring system configurations (templates)
CREATE TABLE scoring_systems (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,               -- "BCA Standard", "Fargo 8-Ball", etc.
  description TEXT,

  -- Scoring method
  scoring_method TEXT NOT NULL,     -- 'games_won', 'points_accumulated'
  winner_points INTEGER,            -- NULL for games_won
  loser_points_method TEXT,         -- 'balls_pocketed', 'fixed', 'none'
  loser_points_max INTEGER,

  -- Whether this is a system default or custom
  is_system_default BOOLEAN DEFAULT false,
  organization_id UUID REFERENCES organizations(id),  -- NULL for defaults

  created_at TIMESTAMPTZ DEFAULT now()
);

-- Threshold charts (can be system defaults or custom)
CREATE TABLE threshold_charts (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,

  threshold_type TEXT NOT NULL,     -- 'chart', 'formula', 'fixed'
  unit TEXT NOT NULL,               -- 'games', 'points'

  -- For formula type:
  formula_base INTEGER,
  formula_adjustment DECIMAL,
  formula_min INTEGER,
  formula_max INTEGER,

  -- For fixed type:
  fixed_target INTEGER,

  -- Ownership
  is_system_default BOOLEAN DEFAULT false,
  organization_id UUID REFERENCES organizations(id),

  created_at TIMESTAMPTZ DEFAULT now()
);

-- Chart entries (for chart-based thresholds)
CREATE TABLE threshold_chart_entries (
  id UUID PRIMARY KEY,
  chart_id UUID REFERENCES threshold_charts(id) ON DELETE CASCADE,

  handicap_diff_min INTEGER NOT NULL,
  handicap_diff_max INTEGER NOT NULL,
  higher_team_target INTEGER NOT NULL,
  lower_team_target INTEGER NOT NULL,
  tie_threshold INTEGER,

  UNIQUE(chart_id, handicap_diff_min, handicap_diff_max)
);

-- Match format configurations
CREATE TABLE match_formats (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,

  structure TEXT NOT NULL,          -- 'double_round_robin', 'race_to_x', etc.
  games_per_matchup INTEGER,
  race_to INTEGER,
  race_per_matchup BOOLEAN,
  total_games INTEGER,

  is_system_default BOOLEAN DEFAULT false,
  organization_id UUID REFERENCES organizations(id),

  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Modified Tables

```sql
-- leagues table additions
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS
  roster_size INTEGER DEFAULT 8,
  playing_size INTEGER DEFAULT 5,
  scoring_system_id UUID REFERENCES scoring_systems(id),
  threshold_chart_id UUID REFERENCES threshold_charts(id),
  match_format_id UUID REFERENCES match_formats(id);

-- members table: store Fargo rating
ALTER TABLE members ADD COLUMN IF NOT EXISTS
  fargo_rating INTEGER,              -- Last known Fargo rating
  fargo_rating_updated_at TIMESTAMPTZ;

-- lineups table: store per-match Fargo ratings
ALTER TABLE lineups ADD COLUMN IF NOT EXISTS
  player1_fargo INTEGER,
  player2_fargo INTEGER,
  player3_fargo INTEGER,
  player4_fargo INTEGER,
  player5_fargo INTEGER;

-- match_games table: store points (for point-based scoring)
ALTER TABLE match_games ADD COLUMN IF NOT EXISTS
  winner_points INTEGER,
  loser_points INTEGER,
  loser_balls_pocketed INTEGER;     -- For calculating loser points
```

---

## Migration Strategy

### Phase 1: Foundation (No Breaking Changes)
1. Create new database tables for configurable systems
2. Seed with current hardcoded values as "system defaults"
3. Add new columns to existing tables (nullable)
4. Current systems continue to work unchanged

### Phase 2: Fargo Implementation
1. Add Fargo as a scoring_system record
2. Create Fargo threshold chart (or formula)
3. Add UI for Fargo rating entry in lineup
4. Add points tracking to match scoring

### Phase 3: Flexible Team Sizes
1. Make team size configurable in league wizard
2. Update lineup components to handle variable players
3. Update round robin generation for any NxN

### Phase 4: Full Configurability
1. Allow operators to create custom scoring systems
2. Allow custom threshold charts
3. League wizard offers presets + custom option

---

## Open Questions

### 1. Fargo Start Points Formula
**Need to research or define:**
- How does Fargo rating difference translate to start points?
- Is there a standard formula or is it league-specific?
- Example: Rating diff of 100 = +X start points?

### 2. Points Entry During Scoring
For Fargo point-based system:
- Who enters loser's balls pocketed? (Winner? Loser? Both confirm?)
- Is this per-game or calculated at end?
- UI consideration: adds complexity to scoring flow

### 3. Backward Compatibility
- How do existing leagues migrate?
- Can we auto-assign them to equivalent new configs?
- What if an operator wants to change mid-season?

### 4. Preset vs Custom Balance
- How many "preset" configurations should we offer?
- Should operators be able to modify presets?
- Full custom: how much flexibility vs complexity?

### 5. Match Winner Determination (Points System)
- Is it "first to X points"?
- Or "highest points after all games"?
- Can there be ties?

---

## Game Win Dialog Redesign

### Current Implementation

The existing [ScoringDialog.tsx](src/components/scoring/ScoringDialog.tsx) supports:
- Game number display
- Winner name
- Break & Run checkbox (always visible)
- Golden Break checkbox (conditional on league setting)
- Mutual exclusivity between B&R and Golden Break

### New Requirements

The game win dialog needs to become **configurable** based on league settings. New options needed:

#### Game Outcome Types

| Outcome | Description | Who Can Select | Points Impact |
|---------|-------------|----------------|---------------|
| **Normal Win** | Standard game win | Breaker or Racker | Winner: 10, Loser: balls pocketed |
| **Break & Run** | Winner broke and ran table | Breaker ONLY | Same as normal (achievement tracking) |
| **Golden Break** | Made game ball on break | Breaker ONLY | Same as normal (if enabled) |
| **Runout** | Opponent broke dry, ran table | Racker ONLY | Same as normal (achievement tracking) |
| **Win by Forfeit** | Opponent forfeited | Either | Winner: 10, Loser: 0 |
| **Loss on Break** | Scratched & made 8 on break | N/A (auto-loss) | Winner: 10, Loser: 0 |
| **Illegal Break** | Breaker lost the break | Breaker | Switch breaker, no points |

#### Critical Logic: Breaker vs Racker Validation

**Problem identified:** Currently Break & Run and Golden Break can be selected even if the racker won.

**Solution:** Track who broke each game and validate:
- If BREAKER won: Can select Break & Run, Golden Break
- If RACKER won: Can select Runout (they ran out after dry break)
- Neither can select the wrong achievement type

#### League-Configurable Options

Each league should be able to enable/disable:
- [ ] Golden Break counts as win
- [ ] Track Golden Breaks (even if not auto-win)
- [ ] Track Break & Runs
- [ ] Track Runouts
- [ ] Allow win by forfeit
- [ ] Loss on break rule (scratch + 8 on break = loss)
- [ ] Illegal break rule

#### Points Entry (for Point-Based Systems)

When scoring system is points-based, the dialog needs:
1. Confirm winner
2. **Enter loser's balls pocketed** (0-7 for 8-ball)
   - Could be number input or quick-select buttons (0-7)
   - Auto-calculates: Winner gets 10, Loser gets entered value

### Proposed Dialog Structure

```
┌─────────────────────────────────────────┐
│         Game 5 - Select Winner          │
├─────────────────────────────────────────┤
│                                         │
│  Winner: [Player Name]                  │
│  Breaker: [Player Name]                 │
│                                         │
│  ── Achievement (optional) ──           │
│  ○ Normal Win                           │
│  ○ Break & Run      [disabled if racker]│
│  ○ Golden Break     [disabled if racker]│
│  ○ Runout           [disabled if breaker]│
│  ○ Win by Forfeit                       │
│                                         │
│  ── Points (if point-based) ──          │
│  Loser's balls pocketed: [0-7]          │
│  Winner points: 10                       │
│  Loser points: [calculated]              │
│                                         │
├─────────────────────────────────────────┤
│     [Cancel]           [Confirm Win]    │
└─────────────────────────────────────────┘
```

### Break Tracking

Need to track who breaks each game. In round-robin formats:
- Break alternates based on rotation
- Can be determined from game number and matchup order

Add to `match_games` table:
```sql
breaker_player_id UUID REFERENCES members(id)
```

Or calculate from game number and rotation pattern.

---

## Implementation Phases

### Phase 0: Foundation Work (Pre-requisites)
- [ ] Add break tracking to match_games table
- [ ] Update scoring dialog with breaker/racker validation
- [ ] Add configurable achievement options to league settings
- [ ] Refactor scoring dialog to be configuration-driven

### Phase 1: Flexible Team Sizes
- [ ] Make roster_size and playing_size configurable
- [ ] Update lineup components for variable player counts
- [ ] Update round-robin generation to work with NxN
- [ ] Update threshold lookups to handle any team size

### Phase 2: Scoring System Abstraction
- [ ] Create scoring_systems table and types
- [ ] Add points tracking to match_games (winner_points, loser_points)
- [ ] Create points entry UI in scoring dialog
- [ ] Support both games-won and points-accumulated systems

### Phase 3: Fargo Rating System
- [ ] Add fargo_rating to members table
- [ ] Add per-match fargo fields to lineups table
- [ ] Create Fargo rating entry UI in lineup page
- [ ] Implement Fargo-based handicap calculation
- [ ] Create or adapt threshold system for Fargo points

### Phase 4: Threshold System Abstraction
- [ ] Create threshold_charts and threshold_chart_entries tables
- [ ] Migrate existing hardcoded charts to database
- [ ] Support formula-based thresholds
- [ ] Support fixed-target thresholds (first to X)
- [ ] Allow operator-defined custom charts

### Phase 5: Full Configurability
- [ ] League wizard updates with new options
- [ ] Preset configurations (BCA Standard, Fargo 8-Ball, Custom)
- [ ] Organization-level default configurations
- [ ] Migration path for existing leagues

---

## Discussion Points

Before proceeding, let's discuss:

### 1. **Your League's Specific Rules**

I found several Fargo point systems online, but yours sounds specific. Can you confirm:

a. **Point calculation:**
   - Winner always gets 10 points?
   - Loser gets 0-7 based on balls pocketed?
   - Or is it the 17-point system (winner gets 10 + opponent's remaining balls)?

b. **Handicap start points:**
   - How does your league determine start points from Fargo difference?
   - Do you have a chart, or is it calculated per-matchup?
   - Is the handicap per-round or per-match?

c. **Win condition:**
   - First team to X total points?
   - Or highest points after all games played?
   - What's the threshold in your league?

### 2. **Architecture Approach**

Two paths:
- **Quick path**: Add Fargo as third hardcoded system (faster, more tech debt)
- **Right path**: Build flexible architecture first (more work, enables all future combinations)

Given your goal of supporting any handicap system with any team size with any threshold system, I'd recommend the **right path** even though it's more work upfront.

### 3. **Priority Order**

Should we tackle in this order?
1. Game Win Dialog fixes (breaker validation, new achievements)
2. Flexible team sizes
3. Points-based scoring support
4. Fargo rating integration
5. Full configurability

Or different priority?

### 4. **Scope Management**

This is a large undertaking. Should we:
- Do it all at once (risky, long time before usable)
- Phase it with working checkpoints (each phase deployable)
- Start with Fargo-only MVP then expand

---

## Open Questions

1. **Fargo API Access**: You mentioned eventually getting API access. Should we design for that now (auto-fetch ratings) or focus on manual entry first?

2. **Existing Leagues**: What happens to leagues already created? Auto-migrate to equivalent new config?

3. **Mid-Season Changes**: Can an operator change scoring system mid-season? (Probably should be locked)

4. **Mobile App Impact**: Your partner's mobile app - how much of this affects mobile scoring?

---

*Last Updated: 2025-04-09*
*Status: Planning / Discussion - Awaiting User Input*
