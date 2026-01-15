# Plan: League Operator Manual Scoring

**Branch**: `lo-manual-scoring`
**Status**: ✅ PHASE 1 COMPLETE
**Created**: 2025-01-12
**Last Updated**: 2025-01-12

---

## Overview

Allow league operators to manually enter and edit match scores. This gives operators full control over match results without requiring player participation or mutual confirmation.

**Key Difference from Player Scoring**:
- Players: Mutual confirmation required (both teams verify)
- Operators: Unilateral control (operator enters/edits, no confirmation needed)

---

## Design Principles

### Component Architecture
- **DRY**: Reuse existing scoring components where possible
- **KISS**: Simple, focused components with clear responsibilities
- **Single Responsibility**: Each component does one thing well
- **Reusable**: Build generic components that work for both player and operator contexts

### Query/Mutation Architecture
- **Generic TanStack Queries**: Not task-specific; reusable across features
- **Separation**: Pure query functions in `/api/queries/`, hooks in `/api/hooks/`
- **Existing Patterns**: Follow `updateMatch`, `updateMatchGame` patterns from `matches.ts`

---

## Page Structure & Navigation

### Two Pages

1. **Match List Page** (NEW: `MatchListPage.tsx`)
   - Accordion view of weeks with matches
   - Navigation/selection page to find the match you want
   - Route: `/league/:leagueId/season/:seasonId/match-list`

2. **Match Data Page** (EXISTING: `MatchDataViewer.tsx` → rename to match editor)
   - The actual review/edit/entry page for a single match
   - Route: `/league/:leagueId/season/:seasonId/match/:matchId` (or similar)

### Navigation Flow
```
League Detail → "Match Data" button → Match List Page → Click match → Match Data Page
```

### Entry Point
- Button in [StatsCard.tsx](../src/components/operator/StatsCard.tsx) (lines 55-66)
- Update route from `/match-data` to `/match-list`
- Keep button label "Match Data / Verify entries" for now

---

## Current State Analysis

### What Exists

1. **MatchDataViewer** ([MatchDataViewer.tsx](../src/pages/MatchDataViewer.tsx))
   - **This is our starting point** - will be enhanced/replaced
   - Currently read-only with status filtering
   - Uses `MatchDetailCard` for each match
   - Has filtering: Completed, Awaiting Verification, In Progress, Scheduled, All

2. **MatchDetailCard** ([MatchDetailCard.tsx](../src/components/MatchDetailCard.tsx))
   - Self-contained card fetching its own data
   - Shows: teams, games won, points earned, thresholds, winner
   - Two-column layout (home/away)
   - Currently no edit capability

3. **Player Scoring UI** ([ScoreMatch.tsx](../src/player/ScoreMatch.tsx))
   - Full scoring flow with mutual confirmation
   - Real-time updates via `useMatchRealtime`
   - GamesList, ScoringDialog, ConfirmationDialog components

4. **Generic Mutations** ([matches.ts](../src/api/mutations/matches.ts))
   - `updateMatch()` - Update any match fields
   - `updateMatchGame()` - Update any game fields
   - `createMatchGames()` - Create game records

### What's Missing
- Ability to click into a match and see/edit individual games
- UI to enter game winners
- UI to enter scores from scratch (no player involvement)
- Ability to override player-entered scores

---

## Scope of Control

**Confirmed**: Full control over everything. Operator can edit ALL match data.

### Match-Level Fields (editable)
- **Lineups**: Which 5 players from each team roster are playing
- **Handicaps**: Per-player handicap values for this match
- **Thresholds**: Games to win, games to tie, games to lose (per team)
- **Match Result**: Win/loss/tie designation
- **Points Earned**: Points awarded to each team
- **Match Status**: scheduled → in_progress → completed

### Game-Level Fields (editable per game)
- **Winner**: Which team/player won the game
- **Player Assignment**: Which player from each team played this game
- **Break & Run**: Boolean flag
- **Golden Break**: Boolean flag
- **Who Breaks/Racks**: Home or away

### Design Philosophy
- **Everything editable** - operators can use our handicap system OR make up their own
- **Not overwhelming** - progressive disclosure, sensible defaults, efficient workflows
- **Smart defaults** - auto-calculate what we can, let them override if needed

---

## Decisions Made

### Data Population
- **Pre-populate from existing records**: Lineups, games, and match data should load from database if they exist
- **Works as editor AND creator**: If data exists → edit mode. If blank → create mode.
- **Conflict resolution**: Operator can see what players entered and override/correct as needed

### Confirmation Tracking
- **Show/hide player confirmations**: Toggle to see who confirmed each game (home/away player IDs)
- **LO takes ownership**: When operator makes changes, their ID replaces player confirmation
- **Audit visibility**: Can see "confirmed by Player X" or "modified by Operator Y"

### Game Flexibility
- **Add games**: Operator can add more games beyond the standard 18/25
- **Remove games**: Operator can delete games (e.g., league plays fewer games)
- **Edit all game fields**: Player assignments, breaker/racker, winner - ALL editable
- **Not locked to our game grid**: Their league might do things differently

### Match Selection
- **All matches editable**: Scheduled, in_progress, and completed matches can all be edited

---

### Existing Data State
- **Matches**: Already exist (created during season setup)
- **Lineups**: Already exist (created during season setup)
- **Games**: May or may not exist (created when players start scoring, or operator creates them)

### Audit Trail
- **Decision**: Just "last modified by" - no full change history
- Keep it simple, full history adds complexity without clear benefit for MVP

### Button Name
- **Decision**: Keep current name "Match Data / Verify entries" for now, can rename later

---

## Match List Page Design

Based on existing schedule page patterns. Accordion-based, familiar UX.

### Pre-requisites
- **Season must be active**: Disable "Match Data" button on League page if season not in progress
- Show message: "Season must be active to manage match data" if accessed without active season

### Structure

```
Match List Page
├── Header: "Match List" + [Expand All] + [Back to League]
│
├── Filters: [All] [Incomplete] [Completed]
│   - Default: All
│
├── Week Accordion (Week 1 on top, Playoffs at bottom - always in order)
│   ┌─────────────────────────────────────────────────────┐
│   │ ▶ Week 1 - Jan 1, 2025                 🟢 4/4      │
│   └─────────────────────────────────────────────────────┘
│   ┌─────────────────────────────────────────────────────┐
│   │ ▶ Week 2 - Jan 8, 2025                 🟢 4/4      │
│   └─────────────────────────────────────────────────────┘
│   ┌─────────────────────────────────────────────────────┐
│   │ ▼ Week 3 - Jan 15, 2025                🟡 2/4      │
│   ├─────────────────────────────────────────────────────┤
│   │  Ball Busters vs Chalk & Awe    10-8  [Complete] → │
│   │  Rack Attack vs Side Pocket      - -  [Scheduled]→ │
│   │  Eight Ball Mafia vs Cue Crew   12-6  [Complete] → │
│   │  Cue Crew vs Ball Busters        - -  [Scheduled]→ │
│   └─────────────────────────────────────────────────────┘
│   ┌─────────────────────────────────────────────────────┐
│   │ ▶ Week 4 - Jan 22, 2025                ⚪ 0/4      │
│   └─────────────────────────────────────────────────────┘
│   ┌─────────────────────────────────────────────────────┐
│   │ ▶ Playoffs - Mar 15, 2025              TBA         │
│   └─────────────────────────────────────────────────────┘
│
└── Click match row → Navigate to Match Data Page
```

### Week Ordering & Display
- **Week 1 always on top**, in chronological order
- **Playoffs at bottom**
- **Blackout weeks NOT shown** (no matches to display)
- **Playoff weeks show "TBA"** instead of match count

### Week Accordion Header
- Week name + date
- Match count: "2/4" or "4/4" (completed/total)
- Status indicator (based on count):
  - 🟢 Complete: 4/4 (all matches done)
  - 🟡 In Progress: 2/4 (some matches done)
  - ⚪ Scheduled: 0/4 (no matches started)
  - TBA: Playoffs (matches not yet determined)

### Accordion Behavior
- **One open at a time** (consistent with rest of app)
- **"Expand All" toggle** in header → opens all weeks at once
- Toggle stays active until pressed again (semi-permanent preference)
- **No auto-expand** on page load

### Match Row (inside accordion) - COMPACT, MOBILE-FIRST
- **Date** (match date if different from week)
- **Home Team vs Away Team** - each team wrapped in `TeamLink` component (expands to show players)
- **Score**: "10-8" or "- -" if not scored
- **Status badge**: Scheduled, In Progress, Needs Review, Complete
- **Wide screens only**: Venue / Table number
- Click anywhere → navigates to Match Data Page

### Filter Behavior
- **All**: Show all weeks (default)
- **Incomplete**: Hide weeks where ALL matches are completed (newest incomplete at top of visible list)
- **Completed**: Show only weeks where ALL matches are completed

### Loading & Performance
- **Lazy load** week content
- **Skeleton loaders** while fetching
- **Back navigation**: Always goes to `/league/:leagueId` (not browser back)

---

## Match Editor Page Design

Navigated to from Match Data page. Full editing capability for one match.

```
Match Editor Page (/operator/match/:matchId/edit)
├── Header: "Home Team vs Away Team" + Week + Date + Status
│
├── Section 1: LINEUPS (collapsible)
│   ├── Home Team lineup (5 slots from roster)
│   ├── Away Team lineup (5 slots from roster)
│   └── Handicaps per player (auto-calc or manual)
│
├── Section 2: THRESHOLDS (collapsible)
│   └── Games to Win/Tie/Lose per team (auto-calc or manual)
│
├── Section 3: GAMES (main section)
│   ├── Table of all games
│   ├── Each row: Game#, Home Player, Away Player, Breaker, Winner, B&R, GB
│   ├── [+ Add Game] and [Delete] buttons
│   ├── Toggle: Show confirmations
│   └── Running totals
│
├── Section 4: MATCH RESULT (collapsible)
│   └── Games Won, Points Earned, Result (auto-calc or manual)
│
└── Footer: [Save] [Cancel] [Mark Complete]
```

---

## UI Design: Not Overwhelming

### Progressive Disclosure
- **Collapsible sections** - only expand what you need
- **Smart defaults** - lineups auto-fill if players already set them
- **Auto-calculations** - thresholds and results auto-update as you score
- **Override when needed** - click to unlock and manually edit any auto-value

### Efficient Workflows

**Fast Scoring Mode** (most common):
- Lineups already set by players → collapsed
- Thresholds auto-calculated → collapsed
- Just score the 18 games → expanded
- Result auto-calculated → done

**Full Manual Mode** (paper scoresheet entry):
- Expand lineups → pick players
- Expand thresholds → enter manually OR auto-calculate
- Score games
- Expand result → verify or override

### Visual Indicators
- 🟢 Green: Completed/verified
- 🟡 Yellow: In progress / partially filled
- ⚪ Gray: Not started
- 🔒 Lock icon: Using auto-calculated value
- ✏️ Pencil icon: Manually overridden

---

## Proposed Architecture

### Components

```
src/
├── operator/
│   ├── MatchListPage.tsx                  # NEW: Accordion of weeks/matches
│   └── MatchDataPage.tsx                  # Repurpose existing MatchDataViewer.tsx
│
├── components/
│   └── operator/
│       ├── match-list/
│       │   ├── WeekAccordion.tsx          # Single week accordion item
│       │   ├── WeekAccordionHeader.tsx    # Week name, date, status count
│       │   └── MatchRow.tsx               # Single match row (clickable)
│       │
│       └── match-editor/                  # (Phase 2 - placeholder for now)
│           ├── MatchEditorHeader.tsx      # Teams, date, status control
│           ├── LineupSection.tsx          # Both team lineups + handicaps
│           ├── ThresholdsSection.tsx      # Games to win/tie/lose
│           ├── GamesSection.tsx           # Game table container + add/totals
│           ├── GameRow.tsx                # Single game row (editable)
│           ├── GameConfirmationInfo.tsx   # Shows who confirmed (toggle visibility)
│           └── MatchResultSection.tsx     # Final totals, points, result
```

### Component Responsibilities

**MatchEditor.tsx** (orchestrator)
- Fetches match, lineups, games data
- Manages which sections are expanded/collapsed
- Handles save/cancel/complete actions
- Passes data down to sections

**GamesSection.tsx**
- Renders table of GameRow components
- "Add Game" button → creates new game row
- "Show Confirmations" toggle → passes to GameRow
- Calculates and displays running totals

**GameRow.tsx** (single responsibility: one game)
- Inline editable: game #, home player, away player, breaker, winner
- Toggles: B&R, Golden Break
- Delete button
- Confirmation info (shown/hidden based on toggle)

**GameConfirmationInfo.tsx**
- Shows: "Home: Player X" | "Away: Player Y" | "Modified by: Operator Z"
- Timestamps if available

### Reusability
- `GameRow` - focused on single game, could be adapted for player view
- `LineupSection` - could share logic with lineup page
- All sections are independent, single-responsibility components

---

## Queries/Mutations

**Existing (reuse)**:
- `useMatchesBySeason()` - Get all matches for a season
- `useMatchById()` - Get single match details
- `useMatchGames()` - Get current game scores
- `useMatchLineups()` - Get lineups for both teams
- `updateMatch()` - Update match-level fields
- `updateMatchGame()` - Update individual game fields
- `createMatchGames()` - Create new game records

**New mutations needed**:
- `deleteMatchGame()` - Remove a game record
- `updateMatchLineup()` - Update lineup with handicaps (may exist, need to check)

**Data flow**:
1. Load: `useMatchById()` + `useMatchLineups()` + `useMatchGames()`
2. Edit in UI (local state)
3. Save: Batch of `updateMatch()`, `updateMatchGame()`, `createMatchGames()`, `deleteMatchGame()`
4. Invalidate queries to refresh

---

## Implementation Plan

### Phase 1: Match List Page ✅ COMPLETE
1. ✅ Created `MatchListPage.tsx` - accordion of weeks/matches with PageHeader
2. ✅ Created components: `WeekAccordionHeader.tsx`, `MatchRow.tsx` in `/components/operator/match-list/`
3. ✅ Updated StatsCard button route to `/match-list`
4. ✅ Added routes in NavRoutes: `/match-list` and `/match/:matchId`
5. ✅ Created placeholder `MatchDataPage.tsx` with PageHeader + "Coming soon"
6. ✅ Updated TABLE_OF_CONTENTS.md with all new files

### Phase 2: Match Data Page (NEXT)

**Goal**: Build a functional match review/edit/entry page for league operators. This is NOT the player scoring page - it's a simpler, more direct editing interface.

---

#### 2.0 Finalized Design Decisions

| Topic | Decision |
|-------|----------|
| **Match Navigation** | Numbered pills `[1][2][3][4]`, navigate on click (with unsaved warning) |
| **Lineups** | 3-6 players flexible per team, show existing if set, create/edit from roster, add/remove player slots |
| **Handicaps** | 3-way toggle `[%][Points][Custom]` generates initial value → always shown as editable input |
| **Thresholds** | Auto-generate ONLY for (3v3+Points) or (5v5+%). Otherwise manual. Always editable inputs. |
| **Game Creation** | 3 options: Single Round Robin, Double Round Robin, Custom (+X blank games). All auto-assigned games editable. |
| **Winner UI** | Radio buttons between player names (fast single tap) |
| **B&R / Golden Break** | 3-way toggle `[None][B&R][GB]`, mutually exclusive, default None |
| **Match Result** | Win/loss determination + points per team. Auto-calc when possible, always editable. |
| **Save** | Batch save (single "Save Changes" button at bottom) |
| **No locks/verification** | Operator has full control - no confirmation flows needed |

---

#### 2.1 Page Layout & Structure

```
┌─────────────────────────────────────────────────────────────────┐
│ PageHeader: "Team A vs Team B"                                  │
│ Subtitle: "Week 3 • Wednesday, Jan 15, 2025"                    │
│ Status Badge: [Scheduled] / [In Progress] / [Completed]         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ┌─ Match Navigation ──────────────────────────────────────────┐ │
│ │  Week 3 Matches:  [1] [◉2] [3] [4]   ← clickable pills      │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─ Lineups ───────────────────────────────────────────────────┐ │
│ │  Handicap System: [%] [Points] [Custom]                     │ │
│ │                                                             │ │
│ │  Home Team              Away Team                           │ │
│ │  1. [Player▼] [3]       1. [Player▼] [4]                    │ │
│ │  2. [Player▼] [5]       2. [Player▼] [2]                    │ │
│ │  3. [Player▼] [4]       3. [Player▼] [6]                    │ │
│ │  [+ Add Player]         [+ Add Player]                      │ │
│ │  Team Total: 12         Team Total: 12                      │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─ Thresholds ────────────────────────────────────────────────┐ │
│ │  [Generate] (only if 3v3+Points or 5v5+%)                   │ │
│ │  Home: Win [10] | Tie [9]    Away: Win [8] | Tie [9]        │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─ Games ─────────────────────────────────────────────────────┐ │
│ │  Create: [Single RR] [Double RR] | [+] Add [__] games       │ │
│ │                                                             │ │
│ │  #  Home Player   ○ ○  Away Player   [None▼]  [🗑]          │ │
│ │  ─────────────────────────────────────────────────────────  │ │
│ │  1  [Ed▼]        (●)○  [John▼]       [None▼]  [🗑]          │ │
│ │  2  [Mike▼]       ○(●) [Sam▼]        [B&R▼]   [🗑]          │ │
│ │  3  [Tom▼]       (●)○  [Alex▼]       [None▼]  [🗑]          │ │
│ │  ...                                                        │ │
│ │                                                             │ │
│ │  Home Wins: 10    Away Wins: 8                              │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─ Match Result ──────────────────────────────────────────────┐ │
│ │  Winner: [Home Win▼] / [Away Win▼] / [Tie▼]                 │ │
│ │  Home Points: [1]    Away Points: [0]                       │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │  [Save Changes]              [Mark as Complete]             │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Section Order** (follows natural match flow):
1. Match Navigation (top)
2. Lineups + Handicaps
3. Thresholds
4. Games
5. Match Result
6. Save/Complete

---

#### 2.2 Match Navigation Bar

**Purpose**: Quick navigation between matches in the same week without going back to the list.

**Data Needed**:
- Fetch sibling matches via `season_week_id` from current match
- Query: `SELECT id, match_number FROM matches WHERE season_week_id = ? ORDER BY match_number`

**UI**:
- Horizontal row of numbered pills: `[1] [2] [3] [4]`
- Current match highlighted (filled background)
- Click navigates to `/league/:leagueId/season/:seasonId/match/:matchId`
- Shows team abbreviations on hover (tooltip): "Ball Busters vs Chalk & Awe"

**Implementation**:
- New component: `MatchNavigationBar.tsx`
- New hook or inline query: `useWeekMatches(seasonWeekId)`
- Lives in `src/components/operator/match-editor/`

---

#### 2.3 Lineups Section

**Purpose**: Set which players are playing and their handicaps.

##### 2.3.1 Handicap System Toggle

3-way toggle at top of section: `[%] [Points] [Custom]`
- **%**: Uses percentage-based handicap calculation
- **Points**: Uses points-based handicap calculation
- **Custom**: No auto-calculation, all manual entry

When % or Points selected, handicaps auto-populate from player's system handicap.
All handicaps are always editable regardless of toggle selection.

##### 2.3.2 Player Slots

- **Flexible count**: 3-6 players per team (supports various formats)
- **Default**: Start with league's default (3 for 3v3, 5 for 5v5)
- **Add/Remove**: `[+ Add Player]` and `[🗑]` buttons to adjust slots
- **Player dropdown**: Select from team roster
- **Handicap input**: Number field, always editable

##### 2.3.3 Display

```
Home Team                    Away Team
1. [Player▼] [3.5]           1. [Player▼] [4.0]
2. [Player▼] [5.0]           2. [Player▼] [2.5]
3. [Player▼] [4.0]           3. [Player▼] [6.0]
[+ Add Player]               [+ Add Player]
Team Total: 12.5             Team Total: 12.5
```

---

#### 2.4 Thresholds Section

**Purpose**: Set games-to-win and games-to-tie for each team.

##### 2.4.1 Auto-Generate Conditions

Can only auto-generate thresholds when:
- 3 players per team + Points handicap system, OR
- 5 players per team + Percentage handicap system

Otherwise: manual entry only (no Generate button shown).

##### 2.4.2 UI

```
[Generate Thresholds]  (only shown if conditions met)

Home: Win [10] | Tie [9]    Away: Win [8] | Tie [9]
```

All inputs always editable. Generate button populates initial values.

---

#### 2.5 Games Section

**This is the core of Phase 2** - the ability to enter/edit game results.

##### 2.5.1 Game Creation Options

Three ways to create games:

1. **Single Round Robin**: Auto-generates games where each player plays each opponent once
   - 3v3 = 9 games, 4v4 = 16 games, 5v5 = 25 games
   - Auto-assigns players and breaker/racker based on standard rotation

2. **Double Round Robin**: Each player plays each opponent twice
   - 3v3 = 18 games, 5v5 = 50 games (though we cap at 25 typically)
   - Auto-assigns players and breaker/racker

3. **Custom (+X games)**: Add blank games manually
   - `[+]` button with number input: "Add [__] games"
   - Creates blank games (no players assigned, no breaker set)
   - Operator fills in all details

**All games are fully editable** regardless of how they were created.

##### 2.5.2 Game Row Component (OperatorGameRow.tsx)

Each row contains:

| Column | Type | Notes |
|--------|------|-------|
| # | Display | Game number |
| Home Player | Dropdown | Select from home lineup |
| Winner | Radio buttons | `○ ○` between player columns - tap to select winner |
| Away Player | Dropdown | Select from away lineup |
| B&R/GB | 3-way toggle | `[None][B&R][GB]` - mutually exclusive |
| Delete | Button | `[🗑]` removes the game |

##### 2.5.3 Game Row Layout

```
#  Home Player   ○ ○  Away Player   [None▼]  [🗑]
───────────────────────────────────────────────────
1  [Ed▼]        (●)○  [John▼]       [None▼]  [🗑]
2  [Mike▼]       ○(●) [Sam▼]        [B&R▼]   [🗑]
3  [Tom▼]       (●)○  [Alex▼]       [None▼]  [🗑]
```

- Radio buttons: Left = home wins, Right = away wins
- Filled circle (●) shows selected winner
- Empty circles (○) for unscored or non-winner

##### 2.5.4 Running Totals

Display at bottom of games section:
```
Home Wins: 10    Away Wins: 8
```

##### 2.5.5 Key Differences from Player Scoring

- NO confirmation dialogs
- NO real-time subscriptions
- NO mutual verification
- Direct editing → local state → batch save
- Full control over all fields

---

#### 2.6 Match Result Section

**Purpose**: Determine winner and assign points.

##### 2.6.1 Winner Determination

Dropdown: `[Home Win] [Away Win] [Tie]`
- Can auto-calculate from game win counts vs thresholds
- Always editable

##### 2.6.2 Points Assignment

```
Home Points: [1]    Away Points: [0]
```

- Number inputs, always editable
- Typical: Winner gets 1, loser gets 0 (but operator can set any values)

---

#### 2.7 Development Approach: UI First, Schema Last

**Philosophy**: Build the UI with local state first, let actual usage inform the database schema.

**Why this approach**:
- Writing schema first is prone to changes as we discover real needs
- UI reveals what data structures actually work
- Can "pretend" to save to database while developing
- Schema becomes obvious once UI is stable

**Development phases**:
1. **Phase A**: Build UI with local state (useReducer or useState)
2. **Phase B**: Mock save operations (console.log, localStorage)
3. **Phase C**: Identify what needs to persist vs what's derived
4. **Phase D**: Write database schema based on actual needs
5. **Phase E**: Replace local state with real database calls

**Format Config Integration**:
- The `league_format_configs` system (see PLAN-league-format-configs.md) will eventually drive this page
- For now, we'll use local state to simulate format config values
- This helps us validate the format config schema design

---

#### 2.8 State Management & Save Flow

**Local State Approach** (simpler than real-time):
1. Page loads → fetch existing data (match, lineups, games) if any
2. User edits → updates local state
3. User clicks "Save Changes" → batch update to database (or mock for now)
4. Show success/error toast
5. Refetch data to confirm

**Data to track in state**:
```typescript
interface MatchEditorState {
  // Format config (will come from league later)
  formatConfig: {
    lineupSize: number;           // 3, 5, 6 players
    handicapType: 'points' | 'percentage' | 'custom';
    gameGeneration: 'double_rr' | 'single_rr' | 'sets' | 'manual';
    pointsSystem: 'differential' | 'bca_tiered' | 'per_game' | 'manual';
  };

  // Lineups
  homeLineup: {
    players: Array<{
      playerId: string | null;
      playerName: string;
      handicap: number;
    }>;
    teamTotal: number;
  };
  awayLineup: {
    players: Array<{
      playerId: string | null;
      playerName: string;
      handicap: number;
    }>;
    teamTotal: number;
  };

  // Thresholds
  thresholds: {
    homeWin: number | null;
    homeTie: number | null;
    awayWin: number | null;
    awayTie: number | null;
  };

  // Games
  games: Array<{
    gameNumber: number;
    homePlayerId: string | null;
    awayPlayerId: string | null;
    winnerId: string | null;      // playerId of winner
    winnerTeamId: string | null;
    breakAndRun: boolean;
    goldenBreak: boolean;
  }>;

  // Match Result
  result: {
    homeGamesWon: number;
    awayGamesWon: number;
    homePoints: number | null;
    awayPoints: number | null;
    winner: 'home' | 'away' | 'tie' | null;
  };

  // Track changes
  isDirty: boolean;
}
```

**Save operation** (mock for now):
1. Log state to console
2. Optionally persist to localStorage for testing
3. Later: Batch database updates

---

#### 2.8 Mark as Complete

**Purpose**: Finalize the match and lock it.

**Behavior**:
1. Validates all required data is present
2. Calculates final scores if not overridden
3. Sets `match.status = 'completed'`
4. Sets `match.completed_at = now()`
5. Optionally locks editing (or shows warning for future edits)

**UI**:
- Confirmation dialog: "Mark this match as complete? All 18 games have been scored."
- If games missing: "Warning: Only 15 of 18 games scored. Continue anyway?"

---

#### 2.9 Component Structure

```
src/components/operator/match-editor/
├── MatchNavigationBar.tsx      # Week match pills [1][2][3][4]
├── LineupsSection.tsx          # Handicap toggle + player slots + handicaps
├── ThresholdsSection.tsx       # Generate button + editable inputs
├── GamesSection.tsx            # Game creation + game list
├── OperatorGameRow.tsx         # Single game row (players, winner radios, B&R/GB toggle, delete)
├── MatchResultSection.tsx      # Winner dropdown + points inputs
└── MatchEditorFooter.tsx       # Save/Complete buttons
```

**Page file**:
```
src/operator/MatchDataPage.tsx  # Orchestrates all sections, manages local state
```

---

#### 2.10 New Queries/Mutations Needed

**New**:
- `deleteMatchGame()` - Remove a game record (for extra games)
- `useWeekMatches(seasonWeekId)` - Fetch sibling matches for navigation

**Existing (reuse)**:
- `useMatchById()` - Match with team/venue details
- `useMatchLineups()` - Both team lineups
- `useMatchGames()` - All game records
- `updateMatch()` - Update match fields
- `updateMatchGame()` - Update game fields
- `createMatchGames()` - Create game records

---

#### 2.11 Implementation Order

**Phase 2.1**: Page Shell & Navigation ✅ COMPLETE
1. ✅ Update `MatchDataPage.tsx` - remove venue/ID cards, set up section layout
2. ✅ Create `MatchNavigationBar.tsx` - week match pills with navigation
3. ✅ Create `useWeekMatches()` hook for sibling match data
4. ✅ Create placeholder sections (LineupsSection, ThresholdsSection, GamesSection, MatchResultSection, MatchEditorFooter)

**Phase 2.2**: State Management Setup ✅ COMPLETE
5. ✅ Create `useMatchEditorState` hook (useReducer) for all page state
6. ✅ Define state shape for format config, lineups, thresholds, games, result
7. ✅ Wire state to MatchDataPage and pass down to sections
8. ✅ Add debug state viewer in development mode

**Phase 2.3**: Lineups + Thresholds Section (CURRENT - combined, they save together)
9. Build `LineupsSection.tsx` - format config controls + player management
   - Lineup size selector (3-6 players)
   - Handicap type toggle (%, Points, Custom)
   - Player dropdowns from team roster
   - Editable handicap inputs
   - Add/remove player slots
   - Team totals display
9. Build `ThresholdsSection.tsx` with editable inputs
   - Generate button (only for supported format+handicap combos)
   - Manual threshold entry for other formats
10. Connect lineups → thresholds (handicap totals drive threshold generation)

**Phase 2.4**: Games Section
11. Build `GamesSection.tsx` - creation buttons + game list
12. Create `OperatorGameRow.tsx` - player dropdowns, winner radios, B&R/GB toggle, delete
13. Implement game generation methods:
    - Single Round Robin
    - Double Round Robin
    - Custom "Add X games"
14. Running totals display (auto-calc from game winners)

**Phase 2.5**: Match Result Section
15. Build `MatchResultSection.tsx`
16. Auto-calculate winner from game wins vs thresholds
17. Manual override for winner and points

**Phase 2.6**: Mock Save & Testing
18. Implement mock save (console.log, localStorage)
19. Test full flow with local state only
20. Validate state shape covers all use cases

**Phase 2.7**: Database Integration (LAST)
21. Finalize database schema based on working UI
22. Wire up real save operations
23. Implement "Mark Complete" with validation
24. Add unsaved changes warning on navigation

---

## Notes

- Phase 1 focuses on navigation/selection only ✅
- Phase 2 is the full editing capability
- All components follow shadcn/ui patterns
- Use existing header component with back navigation
- **Keep it simpler than player scoring** - no real-time, no confirmations
- Batch save approach (not auto-save) for predictable behavior
- **Everything is editable** - operator has full control
- **Flexibility first** - support 3-6 players, various handicap systems, custom game creation

## Future Features (Related)

- **Scorekeeper Threshold Permissions**: Allow scorekeepers to set/adjust thresholds when they have LO permissions. See [futureFeatures.md](./futureFeatures.md) for details.

---

## Key Design Principles

1. **Follows natural match flow**: Lineups → Thresholds → Games → Result
2. **Everything editable**: Auto-generated values are starting points, not locked
3. **Flexible player counts**: 3-6 players per team to support various formats
4. **Three handicap modes**: %, Points, Custom - all with editable inputs
5. **Three game creation modes**: Single RR, Double RR, Custom blanks
6. **Simple winner selection**: Radio buttons between player names
7. **Mutually exclusive achievements**: B&R/GB as 3-way toggle
8. **Batch save**: All changes saved at once for predictable behavior
9. **No locks/verification**: Operator has full control, no confirmation flows
