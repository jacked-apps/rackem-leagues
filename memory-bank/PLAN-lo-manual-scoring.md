# Plan: League Operator Manual Scoring

**Branch**: `lo-manual-scoring`
**Status**: ✅ APPROVED - Phase 1: Match List Page (Match Data Page = placeholder only)
**Created**: 2025-01-12

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

### Phase 1: Match List Page (CURRENT)
1. Create `MatchListPage.tsx` - accordion of weeks/matches
2. Create components: `WeekAccordion`, `WeekAccordionHeader`, `MatchRow`
3. Update StatsCard button route to `/match-list`
4. Add route in NavRoutes
5. Create placeholder `MatchDataPage.tsx` (just header + "Coming soon")

### Phase 2: Match Data Page (FUTURE)
- Full editing capability for single match
- Lineups, thresholds, games, results sections

---

## Notes

- Phase 1 focuses on navigation/selection only
- Match Data Page is placeholder until Phase 2
- All components follow shadcn/ui patterns
- Use existing header component with back navigation
