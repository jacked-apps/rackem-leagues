# Plan: League Format Configuration System

**Branch**: TBD (future work)
**Status**: 📋 PLANNING
**Created**: 2025-01-15
**Last Updated**: 2025-01-15

---

## Overview

Create a flexible configuration system that defines how different league formats work. This enables:
1. **Automation** of scoring, thresholds, and game generation for known formats
2. **Configuration** of similar-but-different formats without code changes
3. **Manual fallback** for truly custom formats we haven't seen yet
4. **Growth over time** as we learn new operator needs and integrate their systems

---

## Problem Statement

Currently, league format logic is scattered and hardcoded:
- `5_man` and `8_man` team formats in various places
- Handicap calculations in `handicapCalculations.ts`
- Game generation logic in scoring code
- Threshold lookups hardcoded per format

This makes it impossible to support new formats without code changes.

---

## Design Goals

### Automation Spectrum

```
FULL AUTO ──────────────────────────────────────────────► FULL MANUAL
    │                    │                    │                │
    ▼                    ▼                    ▼                ▼
Our formats        Similar formats      Guided manual      Everything
(3v3, 5v5)        (configured params)   (tools provided)   manual entry
```

### Key Principles

1. **All formats are global** - anyone can use any format that exists
2. **Creator gets credit** - we track who created each format
3. **Clone and customize** - use as-is OR clone and modify
4. **Steal their systems** - when operators create new formats, they become available to everyone
5. **Future sync notifications** - when original is updated, clones can optionally sync

---

## Database Schema

### 1. league_format_configs (Main format definition)

```sql
CREATE TABLE league_format_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  name VARCHAR(100) NOT NULL,              -- "APA 3v3 Points", "My Custom League"
  description TEXT,                         -- Optional detailed description

  -- Lineage tracking
  created_by UUID REFERENCES members(id),   -- Who created this format
  cloned_from_id UUID REFERENCES league_format_configs(id),  -- NULL if original
  is_system BOOLEAN DEFAULT false,          -- true = built by us

  -- Team/Lineup Structure
  max_roster_size INT NOT NULL DEFAULT 8,   -- Max players on a team roster
  lineup_size INT NOT NULL DEFAULT 3,       -- Players in match lineup (3, 5, 6, etc)

  -- Handicap System
  handicap_type VARCHAR(20) NOT NULL DEFAULT 'points',
    -- 'points', 'percentage', 'race', 'skill_level', 'none'
  threshold_config_id UUID REFERENCES threshold_configs(id),

  -- Game Generation
  game_generation VARCHAR(20) NOT NULL DEFAULT 'double_rr',
    -- 'double_rr', 'single_rr', 'sets', 'manual'
  games_per_set INT,                        -- For 'sets' type only

  -- Points System
  points_system VARCHAR(20) NOT NULL DEFAULT 'differential',
    -- 'differential', 'bca_tiered', 'per_game', 'manual'
  points_config JSONB,                      -- Flexible config for calculations

  -- Usage tracking (for popularity/discovery)
  times_used INT DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
```

### 2. threshold_configs (Reusable threshold charts)

```sql
CREATE TABLE threshold_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,               -- "3v3 Points Thresholds"
  description TEXT,

  -- What type of threshold calculation
  threshold_type VARCHAR(20) NOT NULL,      -- 'team' or 'player'
  handicap_type VARCHAR(20) NOT NULL,       -- Must match format's handicap_type

  -- For team thresholds: what lineup size is this for
  lineup_size INT,                          -- NULL for player-based

  -- Lineage
  created_by UUID REFERENCES members(id),
  cloned_from_id UUID REFERENCES threshold_configs(id),
  is_system BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
```

### 3. threshold_entries (Individual threshold values)

```sql
CREATE TABLE threshold_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID REFERENCES threshold_configs(id) ON DELETE CASCADE NOT NULL,

  -- Lookup key (interpretation depends on threshold_type)
  -- TEAM type: handicap_value = team total difference
  -- PLAYER type: handicap_value = player's skill/handicap level
  handicap_value DECIMAL(5,2) NOT NULL,

  -- Secondary lookup for player-based (opponent's value)
  -- NULL for team-based thresholds
  opponent_handicap_value DECIMAL(5,2),

  -- Thresholds (for player-based, "favored" = higher skill player)
  favored_games_to_win INT NOT NULL,
  favored_games_to_tie INT,                 -- NULL if no ties possible
  underdog_games_to_win INT NOT NULL,
  underdog_games_to_tie INT,                -- NULL if no ties possible

  UNIQUE(config_id, handicap_value, opponent_handicap_value)
);
```

### 4. League table update

```sql
-- Add format reference to leagues
ALTER TABLE leagues ADD COLUMN format_config_id UUID REFERENCES league_format_configs(id);
```

---

## Threshold Types Explained

### Team-Based Thresholds (Current 3v3 Points system)

- Sum all player handicaps per team
- Calculate difference between teams
- Look up thresholds based on that difference
- One threshold set per match

**Example**: Home team total = 12, Away team total = 9
- Difference = 3 points
- Look up: at +3 diff, home needs 10 to win, 9 to tie

### Player-Based Thresholds (Race format, APA singles)

- Each player matchup has its own threshold
- Based on individual player skill levels or handicaps
- Multiple "races" per match

**Example**: Player A (skill 7) vs Player B (skill 4)
- Look up: skill 7 vs skill 4 → A needs 5 games, B needs 3 games

| Player Skill | Opponent Skill | Player Needs | Opponent Needs |
|--------------|----------------|--------------|----------------|
| 7 | 7 | 5 | 5 |
| 7 | 6 | 5 | 4 |
| 7 | 5 | 5 | 3 |
| 7 | 4 | 5 | 3 |
| 7 | 3 | 5 | 2 |
| 6 | 6 | 5 | 5 |
| ... | ... | ... | ... |

---

## Points System Types

### 1. Differential (Our 3v3 system)

```json
{ "type": "differential", "base": 0 }
```
- `+1` point per game won above threshold
- `0` points in tie range
- `-1` point per game below tie threshold

### 2. BCA Tiered (Our 5v5 system)

```json
{
  "type": "bca_tiered",
  "per_game": 0.1,
  "threshold_70_bonus": 1.5,
  "win_bonus": 3.0
}
```
- `0.1` points per game won
- Jump to `1.5` at 70% of games needed
- Jump to `3.0` at win threshold

### 3. Per Game

```json
{ "type": "per_game", "points_per_win": 1 }
```
- Fixed points per game won

### 4. Manual

```json
{ "type": "manual" }
```
- Operator/scorekeeper enters points directly
- No automatic calculation

---

## Game Generation Types

### Double Round Robin (Our 3v3)
- Each player plays each opponent twice
- 3v3 = 18 games, 4v4 = 32 games, 5v5 = 50 games
- Auto-assigns breaker/racker based on rotation

### Single Round Robin (Our 5v5)
- Each player plays each opponent once
- 3v3 = 9 games, 5v5 = 25 games
- Auto-assigns breaker/racker

### Sets
- Player 1 vs Player 1, Player 2 vs Player 2, etc.
- Each matchup plays `games_per_set` games (or race to threshold)
- `games_per_set` config determines fixed game count

### Manual
- No auto-generation
- Operator creates games one by one
- Full flexibility for unknown formats

---

## Seed Data (System Formats)

```sql
-- Our two built-in formats
INSERT INTO league_format_configs (
  name, description, is_system,
  max_roster_size, lineup_size, handicap_type,
  game_generation, points_system, points_config
) VALUES
(
  'APA-style 3v3 (Points)',
  'Standard 3-player format with points-based handicaps. Double round robin (18 games). Differential points system.',
  true,
  8, 3, 'points',
  'double_rr', 'differential', '{"base": 0}'
),
(
  'BCA 5v5 (Percentage)',
  'Standard 5-player format with percentage-based handicaps. Single round robin (25 games). BCA tiered points.',
  true,
  10, 5, 'percentage',
  'single_rr', 'bca_tiered', '{"per_game": 0.1, "threshold_70_bonus": 1.5, "win_bonus": 3.0}'
);
```

---

## League Creation Wizard Flow

### Current Flow (to be updated)

```
Step 1: League Basics (name, game type, etc.)
Step 2: Choose Format
  ├── [APA-style 3v3 (Points)] ← Default, highlighted
  ├── [BCA 5v5 (Percentage)]
  └── [Custom/Other...] → Opens Format Selection Wizard
Step 3: Continue with season setup...
```

### Format Selection Wizard (New)

```
Custom Format Selection
├── Step 1: Browse Existing Formats
│   ├── Search/filter by name, handicap type, lineup size
│   ├── Sort by popularity (times_used), newest, alphabetical
│   ├── Each shows: Name, Description, Creator, # leagues using
│   └── [Create New Format] button
│
├── Step 2a: Use Existing Format
│   ├── [Use As-Is] → Done, return to main wizard
│   └── [Customize] → Clone and go to editor
│
└── Step 2b: Create New Format (or edit clone)
    ├── Basic Info: Name, Description
    ├── Team Structure: Roster size, Lineup size
    ├── Handicap System: Type, Threshold chart (select/create)
    ├── Game Generation: Method, games per set if applicable
    ├── Points System: Type, config options
    └── [Save Format] → Return to main wizard
```

---

## How This Helps Match Data Page

With format config attached to the league, the Match Data Page can:

| Section | Config Used | Behavior |
|---------|-------------|----------|
| **Lineups** | `lineup_size` | Know how many player slots to show |
| **Handicaps** | `handicap_type` | Show correct input type (%, points, skill) |
| **Thresholds** | `threshold_config_id` | Auto-generate if chart exists, else manual |
| **Games** | `game_generation` | Auto-generate based on method, or manual |
| **Points** | `points_system`, `points_config` | Auto-calculate or manual entry |

---

## Integration with Player Scoring (ScoreMatch.tsx)

The existing player scoring page should read from format config:

1. **Game count**: Derived from `lineup_size` + `game_generation`
2. **Threshold display**: Look up from `threshold_config_id`
3. **Points calculation**: Use `points_system` + `points_config`
4. **Golden break rules**: Already on league, could move to config

This allows player scoring to work for any configured format, not just hardcoded ones.

---

## Migration Plan

### Phase 1: Database Schema
1. Create `league_format_configs` table
2. Create `threshold_configs` table
3. Create `threshold_entries` table
4. Add `format_config_id` to `leagues` table

### Phase 2: Seed System Formats
1. Insert APA 3v3 Points format
2. Insert BCA 5v5 Percentage format
3. Insert threshold charts for both (from current hardcoded data)

### Phase 3: Migrate Existing Leagues
1. Auto-assign existing leagues to appropriate system format based on:
   - `team_format` = '5_man' → APA 3v3
   - `team_format` = '8_man' → BCA 5v5
2. Keep existing fields for backwards compatibility during transition

### Phase 4: Update UI
1. League Creation Wizard: Add format selection step
2. Format Selection Wizard: Build browsing/creation UI
3. Match Data Page: Read from format config instead of hardcoded logic

### Phase 5: Update Player Scoring
1. Refactor ScoreMatch.tsx to use format config
2. Remove hardcoded format logic
3. Test with both system formats

---

## Future Enhancements

### Sync Notifications
- When original format is updated, notify users of clones
- "The format you cloned from has been updated. Review changes?"
- Option to sync specific fields or ignore

### Format Marketplace
- Browse popular formats created by other operators
- Filter by game type, lineup size, region
- "Featured" formats curated by us

### Format Analytics
- Track which formats are most used
- Identify common customizations
- Proactively build system formats for popular custom configs

### Fargo Rating Integration
- Add 'fargo' as handicap type
- API integration to fetch player Fargo ratings
- Fargo-specific threshold charts

### Format Versioning
- Track changes to formats over time
- Leagues can pin to specific version or auto-update
- Changelog per format

---

## Open Questions

1. **Threshold chart UI**: How should operators create/edit threshold entries? Table input? CSV import? Visual chart builder?

2. **Points config UI**: For custom points systems, what's the best way to configure without knowing all possibilities?

3. **Format sharing**: Should there be any approval process for formats to become "public"? Or all formats auto-public?

4. **Deprecation**: If a system format changes, how do we handle leagues using the old version?

---

## Related Files

- [PLAN-lo-manual-scoring.md](./PLAN-lo-manual-scoring.md) - Match Data Page that will use this config
- [handicapCalculations.ts](../src/utils/handicapCalculations.ts) - Current hardcoded threshold logic
- [ScoreMatch.tsx](../src/player/ScoreMatch.tsx) - Player scoring page to update

---

## Notes

- This is foundational infrastructure that enables many future features
- Start simple (our two formats), expand as we learn operator needs
- Manual fallback is always available - no operator blocked by missing config
- "Steal their systems" philosophy means our library grows with usage
