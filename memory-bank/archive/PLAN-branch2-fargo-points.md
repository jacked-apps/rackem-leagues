# Branch 2: Fargo Rating & Points-Based Scoring

**Branch Name:** `feature/fargo-points-system`
**Depends On:** `feature/modular-config-system` (Branch 1 must be merged first)
**Goal:** Add new capabilities using the modular configuration system from Branch 1.

---

## Git Commands Reference

```bash
# Make sure Branch 1 is merged to main first!
git checkout main
git pull

# Create and switch to the new branch
git checkout -b feature/fargo-points-system

# Check which branch you're on
git branch

# See status of your changes
git status

# Stage all changes for commit
git add .

# Stage specific files only
git add path/to/file.ts path/to/another.sql

# Commit with message
git commit -m "Your commit message here"

# Push branch to remote (first time - sets up tracking)
git push -u origin feature/fargo-points-system

# Push subsequent commits
git push

# If main has been updated while you're working:
git checkout main
git pull
git checkout feature/fargo-points-system
git merge main  # or: git rebase main

# See commit history
git log --oneline

# Compare your branch to main
git diff main..feature/fargo-points-system
```

---

## Key Development Principles

### 1. Generic Query Functions (Same as Branch 1)

Always write queries that can handle single or multiple field updates:

```typescript
// GOOD - Generic update
export async function updateMatchGame(
  id: string,
  updates: Partial<MatchGameUpdate>
) {
  return supabase
    .from('match_games')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
}

// Usage - single field
await updateMatchGame(id, { winner_points: 10 });

// Usage - multiple fields
await updateMatchGame(id, {
  winner_points: 10,
  loser_points: 3,
  loser_balls_pocketed: 3,
  break_and_run: false
});
```

### 2. Extend Existing Types, Don't Replace

```typescript
// Add to existing type, don't create new table
interface MatchGame {
  // ... existing fields ...

  // NEW fields for points-based scoring
  winner_points: number | null;
  loser_points: number | null;
  loser_balls_pocketed: number | null;
  breaker_player_id: string | null;
}
```

---

## Phase 2A: Points-Based Scoring Infrastructure

### Tasks

- [ ] **2A.1** Add columns to `match_games` table:
  - `winner_points INTEGER`
  - `loser_points INTEGER`
  - `loser_balls_pocketed INTEGER`
  - `breaker_player_id UUID`
- [ ] **2A.2** Update `MatchGame` TypeScript type
- [ ] **2A.3** Update match_games queries to include new fields
- [ ] **2A.4** Update match_games mutations to handle new fields
- [ ] **2A.5** Add helper function to calculate points from balls pocketed

### Migration File

```sql
-- database/migrations/012_add_points_to_match_games.sql

ALTER TABLE match_games ADD COLUMN IF NOT EXISTS
  winner_points INTEGER,
  loser_points INTEGER,
  loser_balls_pocketed INTEGER CHECK (loser_balls_pocketed >= 0 AND loser_balls_pocketed <= 7),
  breaker_player_id UUID REFERENCES members(id);

COMMENT ON COLUMN match_games.winner_points IS 'Points awarded to winner (NULL for games-won scoring)';
COMMENT ON COLUMN match_games.loser_points IS 'Points awarded to loser (NULL for games-won scoring)';
COMMENT ON COLUMN match_games.loser_balls_pocketed IS 'Number of balls pocketed by loser (0-7 for 8-ball)';
COMMENT ON COLUMN match_games.breaker_player_id IS 'Player who broke this game';
```

### Updated Type

```typescript
// src/types/match.ts - UPDATE existing type
interface MatchGame {
  id: string;
  match_id: string;
  game_number: number;
  home_position: number;
  away_position: number;
  winner_team_id: string | null;
  winner_player_id: string | null;
  break_and_run: boolean;
  golden_break: boolean;
  confirmed_by_home: boolean;
  confirmed_by_away: boolean;
  game_type: string;
  created_at: string;
  updated_at: string;

  // NEW fields
  winner_points: number | null;
  loser_points: number | null;
  loser_balls_pocketed: number | null;
  breaker_player_id: string | null;
}
```

### Points Calculation Helper

```typescript
// src/utils/scoring/calculateGamePoints.ts

import type { ScoringSystemConfiguration } from '@/types/configurations';

interface GamePointsResult {
  winnerPoints: number;
  loserPoints: number;
}

/**
 * Calculate points for a game based on scoring configuration
 */
export function calculateGamePoints(
  scoringConfig: ScoringSystemConfiguration,
  loserBallsPocketed: number
): GamePointsResult {
  if (scoringConfig.scoring_method === 'games_won') {
    return { winnerPoints: 1, loserPoints: 0 };
  }

  // Points accumulated system
  let winnerPoints = scoringConfig.winner_points ?? 10;

  // Variable winner points (17-point system)
  if (scoringConfig.winner_points_variable) {
    const opponentBallsRemaining = (scoringConfig.loser_points_max ?? 7) - loserBallsPocketed;
    winnerPoints = (scoringConfig.winner_points ?? 10) + opponentBallsRemaining;
  }

  let loserPoints = 0;
  if (scoringConfig.loser_points_method === 'balls_pocketed') {
    loserPoints = Math.min(loserBallsPocketed, scoringConfig.loser_points_max ?? 7);
  } else if (scoringConfig.loser_points_method === 'fixed') {
    loserPoints = scoringConfig.loser_points_max ?? 0;
  }

  return { winnerPoints, loserPoints };
}
```

### Verification Checklist (Phase 2A)

- [ ] New columns added to match_games
- [ ] Existing games not affected (NULL values)
- [ ] Points calculation function works correctly
- [ ] 17-point system calculates correctly
- [ ] 10-point system calculates correctly

---

## Phase 2B: Scoring Dialog Enhancement

### Tasks

- [ ] **2B.1** Add breaker tracking to scoring flow
- [ ] **2B.2** Add balls pocketed input (0-7 buttons)
- [ ] **2B.3** Show calculated points in dialog
- [ ] **2B.4** Disable B&R/Golden Break when racker wins
- [ ] **2B.5** Add Runout option when racker wins
- [ ] **2B.6** Make dialog read achievement config from league settings

### Updated ScoringDialog Props

```typescript
interface ScoringDialogProps {
  open: boolean;
  game: {
    gameNumber: number;
    winnerPlayerName: string;
    winnerPlayerId: string;
    breakerPlayerId: string;  // NEW: who broke
    breakerPlayerName: string; // NEW: for display
  } | null;

  // Achievement states
  breakAndRun: boolean;
  goldenBreak: boolean;
  runout: boolean;  // NEW

  // Points (for points-based systems)
  loserBallsPocketed: number | null;  // NEW

  // Configuration
  scoringConfig: ScoringSystemConfiguration;  // NEW
  achievementConfig: GameAchievementConfiguration[];  // NEW

  // Handlers
  onBreakAndRunChange: (checked: boolean) => void;
  onGoldenBreakChange: (checked: boolean) => void;
  onRunoutChange: (checked: boolean) => void;  // NEW
  onBallsPocketedChange: (count: number) => void;  // NEW
  onCancel: () => void;
  onConfirm: () => void;
}
```

### Dialog UI Structure

```tsx
// Simplified structure showing new elements

<Dialog>
  <DialogHeader>
    <DialogTitle>Game {game.gameNumber} - Select Winner</DialogTitle>
  </DialogHeader>

  <div className="space-y-4">
    {/* Winner Info */}
    <div>
      <p>Winner: {game.winnerPlayerName}</p>
      <p className="text-sm text-muted-foreground">
        Breaker: {game.breakerPlayerName}
      </p>
    </div>

    {/* Achievement Selection */}
    <div>
      <Label>Achievement (optional)</Label>

      {/* Break & Run - only if breaker won */}
      {isBreakAndRunEnabled && winnerIsBreaker && (
        <Checkbox checked={breakAndRun} onChange={onBreakAndRunChange}>
          Break & Run
        </Checkbox>
      )}

      {/* Golden Break - only if breaker won */}
      {isGoldenBreakEnabled && winnerIsBreaker && (
        <Checkbox checked={goldenBreak} onChange={onGoldenBreakChange}>
          {gameType === '8-ball' ? '8 on the Break' : 'Golden Break'}
        </Checkbox>
      )}

      {/* Runout - only if racker won */}
      {isRunoutEnabled && !winnerIsBreaker && (
        <Checkbox checked={runout} onChange={onRunoutChange}>
          Runout (opponent broke dry)
        </Checkbox>
      )}
    </div>

    {/* Points Entry - only for points-based systems */}
    {scoringConfig.scoring_method === 'points_accumulated' && (
      <div>
        <Label>Loser's balls pocketed</Label>
        <div className="flex gap-2">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => (
            <Button
              key={n}
              variant={loserBallsPocketed === n ? 'default' : 'outline'}
              onClick={() => onBallsPocketedChange(n)}
            >
              {n}
            </Button>
          ))}
        </div>

        {/* Show calculated points */}
        <div className="mt-2 text-sm">
          <p>Winner: {calculatedWinnerPoints} points</p>
          <p>Loser: {calculatedLoserPoints} points</p>
        </div>
      </div>
    )}
  </div>

  <DialogFooter>
    <Button variant="outline" onClick={onCancel}>Cancel</Button>
    <Button onClick={onConfirm}>Confirm</Button>
  </DialogFooter>
</Dialog>
```

### Verification Checklist (Phase 2B)

- [ ] Breaker name displays in dialog
- [ ] B&R disabled when racker wins
- [ ] Golden Break disabled when racker wins
- [ ] Runout only shows when racker wins
- [ ] Balls pocketed buttons work (0-7)
- [ ] Points calculate correctly in real-time
- [ ] Dialog works with games-won system (no points UI)
- [ ] Dialog works with points system (shows points UI)

---

## Phase 2C: Fargo Rating Support

### Tasks

- [ ] **2C.1** Add `fargo_rating` column to `members` table
- [ ] **2C.2** Add `fargo_rating_updated_at` column to `members` table
- [ ] **2C.3** Add per-match Fargo fields to `lineups` table
- [ ] **2C.4** Update `Member` type
- [ ] **2C.5** Update `Lineup` type
- [ ] **2C.6** Update member queries/mutations
- [ ] **2C.7** Update lineup queries/mutations
- [ ] **2C.8** Create Fargo rating entry UI in lineup page

### Migration Files

```sql
-- database/migrations/013_add_fargo_to_members.sql

ALTER TABLE members ADD COLUMN IF NOT EXISTS
  fargo_rating INTEGER CHECK (fargo_rating >= 100 AND fargo_rating <= 850),
  fargo_rating_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN members.fargo_rating IS 'Last known Fargo rating (100-850)';
COMMENT ON COLUMN members.fargo_rating_updated_at IS 'When Fargo rating was last updated';
```

```sql
-- database/migrations/014_add_fargo_to_lineups.sql

ALTER TABLE match_lineups ADD COLUMN IF NOT EXISTS
  player1_fargo INTEGER,
  player2_fargo INTEGER,
  player3_fargo INTEGER,
  player4_fargo INTEGER,
  player5_fargo INTEGER;

COMMENT ON COLUMN match_lineups.player1_fargo IS 'Player 1 Fargo rating at time of lineup lock';
-- ... similar for others
```

### Updated Types

```typescript
// src/types/member.ts - UPDATE
interface Member {
  // ... existing fields ...

  // NEW Fargo fields
  fargo_rating: number | null;
  fargo_rating_updated_at: string | null;
}

// src/types/match.ts - UPDATE Lineup
interface Lineup {
  // ... existing fields ...

  // NEW Fargo fields (captured at lineup lock)
  player1_fargo: number | null;
  player2_fargo: number | null;
  player3_fargo: number | null;
  player4_fargo: number | null;
  player5_fargo: number | null;
}
```

### Lineup Page Fargo Entry

When league uses Fargo rating system, lineup page needs:

```tsx
// In lineup player selection, show Fargo input

{ratingConfig.rating_method === 'fargo_rating' && (
  <div className="flex items-center gap-2">
    <Label>Fargo Rating</Label>
    <Input
      type="number"
      min={100}
      max={850}
      value={player.fargo_rating ?? ''}
      onChange={(e) => onFargoChange(player.id, parseInt(e.target.value))}
      placeholder="Enter Fargo"
    />
    {player.fargo_rating && (
      <span className="text-xs text-muted-foreground">
        Last updated: {formatDate(player.fargo_rating_updated_at)}
      </span>
    )}
  </div>
)}
```

### Verification Checklist (Phase 2C)

- [ ] Fargo rating can be entered for players
- [ ] Fargo rating stored in members table
- [ ] Fargo rating captured in lineup at lock time
- [ ] Fargo rating displays in lineup UI
- [ ] Validation enforces 100-850 range
- [ ] Leagues not using Fargo don't show Fargo UI

---

## Phase 2D: Fargo Handicap Calculation

### Tasks

- [ ] **2D.1** Implement Fargo win probability formula
- [ ] **2D.2** Implement expected score calculation
- [ ] **2D.3** Implement team handicap points calculation
- [ ] **2D.4** Create Fargo threshold configuration in database
- [ ] **2D.5** Update lineup lock to calculate Fargo-based handicap
- [ ] **2D.6** Display handicap start points in match scoring

### Fargo Calculation Functions

```typescript
// src/utils/handicap/fargoCalculations.ts

/**
 * Calculate win probability from Fargo rating difference
 * Formula: P = 1 / (1 + 2^(-D/100))
 */
export function calculateFargoWinProbability(
  higherRating: number,
  lowerRating: number
): number {
  const diff = higherRating - lowerRating;
  return 1 / (1 + Math.pow(2, -diff / 100));
}

/**
 * Transform Fargo rating for calculations
 * Formula: 2^(rating/100)
 */
export function transformFargoRating(rating: number): number {
  return Math.pow(2, rating / 100);
}

/**
 * Calculate expected wins for a player
 */
export function calculateExpectedWins(
  playerRating: number,
  opponentRating: number,
  totalGames: number
): number {
  const playerTransformed = transformFargoRating(playerRating);
  const opponentTransformed = transformFargoRating(opponentRating);
  const total = playerTransformed + opponentTransformed;

  return (playerTransformed / total) * totalGames;
}

/**
 * Calculate expected score for points-based system
 */
export function calculateExpectedScore(
  playerRating: number,
  opponentRating: number,
  scoringConfig: ScoringSystemConfiguration
): number {
  const winProb = calculateFargoWinProbability(playerRating, opponentRating);
  const loseProb = 1 - winProb;

  const winnerPoints = scoringConfig.winner_points ?? 10;
  // Simplified: assume average loser points is ~4 for 8-ball
  const avgLoserPoints = (scoringConfig.loser_points_max ?? 7) / 2;

  return (winProb * winnerPoints) + (loseProb * avgLoserPoints);
}

/**
 * Calculate team handicap points for Fargo system
 */
export function calculateFargoTeamHandicap(
  team1Ratings: number[],
  team2Ratings: number[],
  scoringConfig: ScoringSystemConfiguration,
  gamesPerRound: number
): number {
  // Average team ratings
  const team1Avg = team1Ratings.reduce((a, b) => a + b, 0) / team1Ratings.length;
  const team2Avg = team2Ratings.reduce((a, b) => a + b, 0) / team2Ratings.length;

  // Calculate expected scores
  const team1Expected = calculateExpectedScore(team1Avg, team2Avg, scoringConfig);
  const team2Expected = calculateExpectedScore(team2Avg, team1Avg, scoringConfig);

  // Difference × games = handicap points
  const diff = team1Expected - team2Expected;
  return Math.floor(diff * gamesPerRound);
}
```

### Verification Checklist (Phase 2D)

- [ ] Win probability calculates correctly (test 100 diff = 66.7%)
- [ ] Expected wins match examples from research
- [ ] Team handicap calculates correctly
- [ ] Handicap displays in match scoring
- [ ] Lower-rated team shows positive start points

---

## Phase 2E: Match Scoring with Points

### Tasks

- [ ] **2E.1** Track accumulated points during match
- [ ] **2E.2** Display running point totals
- [ ] **2E.3** Apply handicap start points to lower team
- [ ] **2E.4** Determine match winner based on scoring config
- [ ] **2E.5** Handle points threshold vs highest after games

### Match Scoring State

```typescript
interface MatchScoringState {
  // Existing
  homeGamesWon: number;
  awayGamesWon: number;

  // NEW for points-based
  homePointsTotal: number;
  awayPointsTotal: number;
  homeStartPoints: number;  // Handicap start (usually 0)
  awayStartPoints: number;  // Handicap start (for lower team)
}

// Calculate totals including handicap
const homeTotal = homePointsTotal + homeStartPoints;
const awayTotal = awayPointsTotal + awayStartPoints;
```

### Win Determination

```typescript
function determineMatchWinner(
  state: MatchScoringState,
  scoringConfig: ScoringSystemConfiguration,
  thresholdConfig: ThresholdChartConfiguration
): 'home' | 'away' | 'tie' | null {
  const { homeGamesWon, awayGamesWon, homePointsTotal, awayPointsTotal } = state;

  switch (scoringConfig.win_condition) {
    case 'games_threshold':
      // Current system - first to X games
      if (homeGamesWon >= threshold.gamesNeeded) return 'home';
      if (awayGamesWon >= threshold.gamesNeeded) return 'away';
      return null;

    case 'points_threshold':
      // First to X points
      const target = thresholdConfig.fixed_target_value!;
      if (homePointsTotal >= target) return 'home';
      if (awayPointsTotal >= target) return 'away';
      return null;

    case 'highest_after_games':
      // Play all games, highest points wins
      if (!allGamesPlayed) return null;
      if (homePointsTotal > awayPointsTotal) return 'home';
      if (awayPointsTotal > homePointsTotal) return 'away';
      return 'tie';
  }
}
```

### Verification Checklist (Phase 2E)

- [ ] Points accumulate correctly
- [ ] Handicap start points applied
- [ ] Running totals display correctly
- [ ] Points threshold win works
- [ ] Highest after games win works
- [ ] Games-won system still works

---

## Phase 2F: System Default Configurations

### Tasks

- [ ] **2F.1** Add "10-Point Fargo" scoring system default
- [ ] **2F.2** Add "17-Point BCA" scoring system default
- [ ] **2F.3** Add "Fargo Rating" handicap rating default
- [ ] **2F.4** Add Fargo threshold configuration
- [ ] **2F.5** Create "Fargo 8-Ball League" preset bundle

### Seed Data

```sql
-- database/migrations/015_seed_fargo_configurations.sql

-- 10-Point Fargo scoring system
INSERT INTO scoring_system_configurations (
  id, is_system_default, name, description,
  scoring_method, winner_points, winner_points_variable,
  loser_points_method, loser_points_max, win_condition
) VALUES (
  'sys-fargo-10pt',
  true,
  '10-Point Fargo',
  'Winner gets 10 points, loser gets 0-7 based on balls pocketed',
  'points_accumulated',
  10,
  false,
  'balls_pocketed',
  7,
  'points_threshold'
);

-- 17-Point BCA scoring system
INSERT INTO scoring_system_configurations (
  id, is_system_default, name, description,
  scoring_method, winner_points, winner_points_variable,
  loser_points_method, loser_points_max, win_condition
) VALUES (
  'sys-bca-17pt',
  true,
  '17-Point BCA',
  'Winner gets 10 + opponent balls remaining, loser gets balls pocketed',
  'points_accumulated',
  10,
  true,  -- Variable: 10 + remaining balls
  'balls_pocketed',
  7,
  'highest_after_games'
);

-- Fargo threshold (fixed target: first to 100 points)
INSERT INTO threshold_chart_configurations (
  id, is_system_default, name, description,
  threshold_type, threshold_unit, fixed_target_value
) VALUES (
  'sys-fargo-threshold',
  true,
  'Fargo Points Target',
  'First team to 100 points wins (with handicap)',
  'fixed_target',
  'points',
  100
);
```

### Verification Checklist (Phase 2F)

- [ ] Fargo scoring systems seeded
- [ ] Fargo threshold seeded
- [ ] All system defaults appear in available configs
- [ ] Presets can be selected in league wizard

---

## Phase 2G: Testing & Documentation

### Tasks

- [ ] **2G.1** Test games-won system still works
- [ ] **2G.2** Test 10-point Fargo system end-to-end
- [ ] **2G.3** Test 17-point BCA system end-to-end
- [ ] **2G.4** Test Fargo rating entry and storage
- [ ] **2G.5** Test handicap calculation accuracy
- [ ] **2G.6** Test breaker validation in scoring dialog
- [ ] **2G.7** Update user documentation
- [ ] **2G.8** Update memory bank with new patterns

### Test Scenarios

1. **Create Fargo league** - Select Fargo rating + 10-point scoring
2. **Enter Fargo ratings** - Set ratings for all players
3. **Lock lineup** - Verify handicap calculates correctly
4. **Score games** - Enter balls pocketed, verify points
5. **Complete match** - Verify winner based on points
6. **Achievements** - B&R only for breaker, Runout only for racker

### Verification Checklist (Phase 2G)

- [ ] All existing functionality unchanged
- [ ] New Fargo functionality works end-to-end
- [ ] Points systems calculate correctly
- [ ] Handicap start points apply correctly
- [ ] Achievement validation works

---

## Success Criteria for Branch 2

Before merging to main:

1. ✅ Points-based scoring works with all three systems (10-pt, 14-pt, 17-pt)
2. ✅ Fargo ratings can be entered and stored
3. ✅ Fargo handicap calculates correctly
4. ✅ Breaker/racker validation works in scoring dialog
5. ✅ Achievement options respect configuration
6. ✅ Match winner determined correctly for all win conditions
7. ✅ All existing games-won functionality unchanged
8. ✅ System defaults for Fargo are seeded

---

## Commit Strategy

Recommended commits for this branch:

```bash
# Phase 2A commits
git commit -m "Add points columns to match_games table"
git commit -m "Add points calculation utility functions"

# Phase 2B commits
git commit -m "Add breaker tracking to scoring dialog"
git commit -m "Add balls pocketed entry UI"
git commit -m "Add achievement validation based on breaker/racker"

# Phase 2C commits
git commit -m "Add Fargo rating fields to members table"
git commit -m "Add Fargo fields to lineup table"
git commit -m "Add Fargo rating entry UI in lineup page"

# Phase 2D commits
git commit -m "Implement Fargo handicap calculation functions"

# Phase 2E commits
git commit -m "Add points tracking to match scoring"
git commit -m "Implement points-based win determination"

# Phase 2F commits
git commit -m "Seed Fargo system default configurations"

# Phase 2G commits
git commit -m "Complete testing and documentation"
```

---

## Future Enhancements (Not in this branch)

- Fargo API integration (auto-fetch ratings)
- Additional achievement types (safety battle, etc.)
- Per-round handicap recalculation
- Custom scoring formulas
- Tournament bracket support with Fargo seeding

---

*Last Updated: 2025-04-09*
*Status: Waiting for Branch 1*
*Estimated Effort: Medium*
