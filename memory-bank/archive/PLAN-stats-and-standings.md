# Stats and Standings Implementation Plan

**Status**: Planning Phase
**Created**: 2025-01-08
**Priority**: Medium - Side track from main MVP work to enable data visibility

---

## Overview

This plan covers the implementation of stats and standings pages to view data from completed matches. This is a temporary solution to track match data being entered during MVP development, before building the full in-depth stats system.

**Key Principle**: Keep it simple - read-only views of existing data, no new database tables.

---

## Page 1: Standings (Team Rankings)

### Purpose

Show team win/loss records and rankings for a season.

### Route

`/league/:leagueId/season/:seasonId/standings`

### Display Format

Simple table with columns:

- **Rank** - Calculated client-side based on ranking logic
- **Team Name** - Team display name
- **Wins** - Number of matches won (not individual games)
- **Losses** - Number of matches lost
- **Points** - Total points earned across all completed matches
- **Games** - Total individual games won (across all matches)

### Ranking Logic (Tiebreaker Rules)

Teams are ranked in this order of precedence:

1. **Match Win/Loss Record** - Most match wins = higher rank
2. **Total Points Earned** - If match records are tied, more points = higher rank
3. **Total Games Won** - If points also tied, more games won = higher rank
4. **Equal Rank** - If all 3 metrics are tied, teams share the same rank number

### Data Sources

- `matches` table - For match wins/losses and verification status
- `match_games` table - For calculating total games won and points per match

### Filtering Rules

- **Only Completed Matches**: `status = 'completed'`
- **Only Verified Matches**: Both `home_team_verified_by` AND `away_team_verified_by` are NOT NULL
- **Season-Specific**: Filter by `season_id`

### Access Control

- Accessible to both **operators** AND **players** (all authenticated members)
- No editing capabilities (read-only)

### Points Calculation

Use existing `calculatePoints()` function from `/src/types/match.ts`:

- Formula: `games_won - (games_to_tie ?? games_to_win)`
- Handicap thresholds vary per match based on team skill differential
- Must calculate per-match points, then sum across all matches for season total

### Implementation Steps

1. **Create Query Function** (`/src/api/queries/standings.ts`)

   - Fetch all completed/verified matches for season
   - Fetch all match_games for those matches
   - Calculate match wins/losses per team
   - Calculate total games won per team
   - Calculate total points per team (sum of per-match points)
   - Return aggregated standings data

2. **Create TanStack Query Hook** (`/src/api/hooks/useStandings.ts`)

   - Wrap query function for caching and state management
   - Accept `seasonId` parameter

3. **Build Standings Component** (`/src/pages/Standings.tsx`)

   - Use shadcn `Table` component
   - Client-side ranking calculation with tie-breaking logic
   - Sort by rank (highest to lowest)
   - Display loading and error states

4. **Add Route** (`/src/navigation/NavRoutes.tsx`)

   - Add to `memberRoutes` array
   - Path: `/league/:leagueId/season/:seasonId/standings`

5. **Add Navigation Links**
   - League Detail page (operators): "View Standings" button
   - Team Schedule page (players): "View Standings" link

### Technical Notes

- No new database tables or columns needed
- Pure read operations only
- Match wins ≠ game wins (important distinction)
- Points calculation requires fetching match_games AND calculating handicap thresholds per match

---

## Page 2: Top Shooter (Individual Player Rankings)

### Purpose

Show individual player performance rankings across a season.

### Route

`/league/:leagueId/season/:seasonId/top-shooters`

### Display Format

Simple table with columns:

- **Rank** - Calculated client-side (most wins = rank 1)
- **Player Name** - Player's display name (first + last, or nickname)
- **Wins** - Total individual games won
- **Losses** - Total individual games lost
- **Points** - Calculated as `wins - losses`
- **Win/Loss %** - Calculated as `(wins / (wins + losses)) * 100`

### Ranking Logic

Players ranked by:

1. **Most Wins** - Primary ranking metric
2. **Tiebreaker (if needed)**: Win/Loss % (higher % = higher rank)
3. **Equal Rank**: If both are tied, players share the same rank number

### Data Sources

- `match_games` table - Individual game results
- `members` table - Player names
- `matches` table - To filter only completed/verified matches

### Filtering Rules

- **Only Completed/Verified Matches**: Same as Standings page
- **Only Confirmed Games**: Both `confirmed_by_home` AND `confirmed_by_away` = true
- **Season-Specific**: Filter games by matches in the season

### Access Control

- Accessible to both **operators** AND **players** (all authenticated members)
- No editing capabilities (read-only)

### Implementation Steps

1. **Create Query Function** (`/src/api/queries/playerStats.ts`)

   - Fetch all match_games for completed/verified matches in season
   - Group by player (both home_player_id and away_player_id)
   - Count wins (where winner_player_id = player)
   - Count losses (where player participated but didn't win)
   - Calculate points and win/loss percentage
   - Return player stats array

2. **Create TanStack Query Hook** (`/src/api/hooks/usePlayerStats.ts`)

   - Wrap query function
   - Accept `seasonId` parameter

3. **Build Top Shooters Component** (`/src/pages/TopShooters.tsx`)

   - Use shadcn `Table` component
   - Client-side ranking calculation
   - Sort by wins (descending)
   - Format win/loss % as percentage with 1 decimal place

4. **Add Route** (`/src/navigation/NavRoutes.tsx`)

   - Add to `memberRoutes` array
   - Path: `/league/:leagueId/season/:seasonId/top-shooters`

5. **Add Navigation Links**
   - From Standings page (tab or link)
   - From League Detail page

### Technical Notes

- Player can appear in games as either home_player_id OR away_player_id
- Must handle both columns when counting player participation
- Win/Loss % should handle division by zero (no games played = 0% or "N/A")
- Use existing `getPlayerStats()` function from `/src/types/match.ts` as reference

---

## Page 3: Team Stats (Detailed Team Performance)

### Purpose

Combined view showing team-level standings with player-level performance breakdown, grouped by team. This is essentially a combination of Standings + Top Shooters data, organized hierarchically.

### Route

`/league/:leagueId/season/:seasonId/team-stats`

### Display Format

Grouped table with two row types:

#### Team Header Row (per team)

- **Rank** - Team standing rank (same as Standings page)
- **Team Name** - Team display name
- **Wins** - Match wins
- **Losses** - Match losses
- **Points** - Total points earned
- _(Optional)_ Weeks Completed - Number of matches played by this team

#### Player Detail Rows (under each team)

Indented/styled differently to show hierarchy:

- **Player Name** - Player's display name
- **Games Won** - Individual games won
- **Games Lost** - Individual games lost
- **Weeks Played** - Number of matches this player participated in
- **H.C.** - Current handicap (from latest match lineup)
- **Cumulative Section** (separate column group):
  - **Lifetime Wins** - Career wins (all-time, across all seasons)
  - **Lifetime Losses** - Career losses (all-time)
  - **Lifetime Weeks** - Career matches played (all-time)

### Layout Example

```
RANK  TEAM NAME           WIN  LOSS  POINTS
1     BANK N SPANK        7    9     -9

      Player Name         W    L    Weeks  H.C.    Cumulative (W  L  Weeks)
      RUBEN ARVIZO        43   29   12     1       162  130  49
      TOMMY ENDRES        27   33   10     -1      88   127  36
      SEBASTIAN MEDINA    27   27   9      1       133  94   38
      SUB                 10   8    3      -       -    -    -

2     JUMP CUE            6    10    -10

      SANDRA RIVES        9    33   7      -2      42   112  26
      TERRY REAGAN        20   40   10     -2      85   143  38
      ...
```

### Data Sources

#### For Team Header Rows

- `matches` table - Match wins/losses and points (same as Standings page)
- Count of completed matches per team

#### For Player Detail Rows (Season Stats)

- `match_games` table - Individual game results for this season
- `match_lineups` table - Player participation in matches (for "Weeks Played")
- Latest `match_lineups` record per player - Current handicap value

#### For Cumulative (Lifetime Stats)

- `match_games` table - ALL games across ALL seasons (no season filter)
- `match_lineups` table - ALL match participation across ALL seasons
- Filter by player_id only, not by season_id

### Filtering Rules

- **Season Stats**: Only completed/verified matches in current season
- **Cumulative Stats**: ALL completed/verified matches ever (lifetime)
- **Only Confirmed Games**: Both teams confirmed
- **SUB Rows**: Handle substitute players (may not have member_id)

### Access Control

- Accessible to **all authenticated members** (players and operators)
- Everyone can view all teams and all players
- No editing capabilities (read-only)

### Handicap Display

- Show current handicap from most recent match lineup
- Format: positive numbers (no +), negative numbers with minus sign
- If player hasn't played recently, show last known handicap or "-"

### Grouping & Styling

- Teams ordered by rank (same as Standings)
- Players within team ordered by total games played (descending) or alphabetically
- Visual hierarchy:
  - Team rows: Bold, larger text, background color
  - Player rows: Indented, normal text, alternating row colors for readability
  - SUB rows: Italicized or grayed out

### Implementation Steps

1. **Extend Query Functions** (`/src/api/queries/teamStats.ts`)

   - **Team-level query**: Reuse standings query logic
   - **Player season stats query**:
     - Join match_games to matches (filter by season)
     - Group by player_id and team_id
     - Count wins, losses, matches played
     - Get latest handicap from match_lineups
   - **Player lifetime stats query**:
     - Same as season stats but NO season filter
     - Group by player_id only (may span multiple teams)
   - Combine all three into single hierarchical data structure

2. **Create TanStack Query Hook** (`/src/api/hooks/useTeamStats.ts`)

   - Fetch team standings data
   - Fetch player season stats per team
   - Fetch player lifetime stats
   - Merge into hierarchical structure
   - Accept `seasonId` parameter

3. **Build Team Stats Component** (`/src/pages/TeamStats.tsx`)

   - Use shadcn `Table` component with custom row rendering
   - Map over teams, render team header row
   - For each team, map over players, render player detail rows
   - Handle SUB players (may not have full member records)
   - Separate column groups: Season Stats | Cumulative Stats
   - Add visual hierarchy styling (bold teams, indented players)

4. **Add Route** (`/src/navigation/NavRoutes.tsx`)

   - Add to `memberRoutes` array
   - Path: `/league/:leagueId/season/:seasonId/team-stats`

5. **Add Navigation Links**
   - From Standings page
   - From Top Shooters page
   - From League Detail page

### Technical Notes

- **Cumulative Stats Scope**: Lifetime (all seasons), not just current season
- **Weeks Played**: Count distinct match_id from match_lineups where player participated
- **Current Handicap**: Latest match_lineups.player1_handicap (or player2/player3) for this player
- **SUB Handling**: Substitute players may not have permanent member_id, show as "SUB" with aggregated stats
- **Performance**: This is the most data-heavy query of the three pages
  - Consider pagination if player list gets very long
  - Or lazy-load cumulative stats on player row expand

### Data Structure (TypeScript Interface)

```typescript
interface TeamStatsRow {
  rank: number;
  teamId: string;
  teamName: string;
  matchWins: number;
  matchLosses: number;
  points: number;
  weeksCompleted: number;
  players: PlayerStatsRow[];
}

interface PlayerStatsRow {
  playerId: string | null; // null for SUB
  playerName: string;
  gamesWon: number; // Season
  gamesLost: number; // Season
  weeksPlayed: number; // Season
  currentHandicap: number | null;
  lifetimeWins: number; // Cumulative
  lifetimeLosses: number; // Cumulative
  lifetimeWeeks: number; // Cumulative
}
```

---

## Shared Components & Utilities

### Components to Create

- `StatsTable` - Reusable table component for stats display (if tables look similar)
- `RankBadge` - Visual rank indicator (1st, 2nd, 3rd with styling)
- `StatsNavigation` - Tab/link navigation between Standings, Top Shooters, Team Stats

### Utilities to Create

- `rankingUtils.ts` - Shared ranking calculation logic with tie-breaking
- `statsCalculations.ts` - Shared stats aggregation functions

### Types to Define

- `TeamStanding` - Type for team standings data
- `PlayerStanding` - Type for player standings data
- `TeamStatDetail` - Type for team stats detail (once defined)

---

## Database Schema Notes

**No new tables or columns needed** - all data exists in:

- `matches` - Match-level results and verification status
- `match_games` - Individual game results
- `teams` - Team information
- `members` - Player information

**Key Fields Used:**

- `matches.status` - Filter for 'completed'
- `matches.home_team_verified_by` - Home team verification
- `matches.away_team_verified_by` - Away team verification
- `match_games.winner_team_id` - Team that won the game
- `match_games.winner_player_id` - Player that won the game
- `match_games.confirmed_by_home` - Home confirmation
- `match_games.confirmed_by_away` - Away confirmation

---

## Future Enhancements (NOT in this scope)

- **Individual Player Stats Page** - Deep dive into single player with filtering options (NOT MVP)
- Match history detail view (click match to see game-by-game breakdown)
- Player profile pages with career stats
- Head-to-head team records
- Playoff bracket visualization
- Export stats to CSV/PDF
- Historical season comparisons
- Advanced analytics (trends, predictions, etc.)

---

## Implementation Order

1. **Phase 1: Standings Page** (simplest, establishes patterns)
2. **Phase 2: Top Shooters Page** (similar to standings, different data)
3. **Phase 3: Team Stats Page** (most complex, hierarchical data structure)

**Rationale**: Build simplest first to establish query patterns, component structure, and routing. Learn from Phase 1 & 2 before tackling more complex Team Stats page with its hierarchical grouping and lifetime stats.

---

## Navigation Structure

All three pages should be accessible from multiple entry points:

### From Operator Dashboard / League Detail

- Add "Stats & Standings" card or section with links to all three pages
- Or use tabbed interface to switch between Standings / Top Shooters / Team Stats

### From Player "My Teams" / Team Schedule

- "View Standings" link
- "View Stats" link (goes to Team Stats page)
- "Top Shooters" link

### Between Stats Pages

- Add navigation tabs or breadcrumb links at top of each page:
  ```
  [ Standings ] [ Top Shooters ] [ Team Stats ]
  ```
- Clicking tab navigates to that page while preserving league/season context

---

## Decisions Made

1. **Team Stats Page - Player Ordering Within Team** ✅

   - Captain always displayed first
   - Remaining players ordered by team_players table order
   - Use existing team roster structure from database

2. **SUB Player Handling** ✅

   - **No SUB tracking for MVP**
   - Games won by substitutes count toward team's match totals
   - Substitute stats not displayed on these pages
   - Future enhancement: Could add "Substitutes Used: X times" counter per team

3. **Handicap Source** ✅

   - Use existing handicap calculation helper function
   - Calculate current handicap from recent game performance
   - This ensures handicaps are always current and accurate

4. **Performance Optimization** ✅
   - Start with fetch all data upfront (simpler implementation)
   - Monitor performance during testing
   - Optimize later if needed (lazy loading, pagination, etc.)

---

## Next Steps

- [x] Complete plan for all three pages
- [x] Review and approve decisions
- [ ] Begin implementation Phase 1 (Standings)
- [ ] Begin implementation Phase 2 (Top Shooters)
- [ ] Begin implementation Phase 3 (Team Stats)
