# 5v5 Substitute Flow Implementation Plan

**Status**: Planning → Implementation
**Created**: 2025-11-22
**Priority**: High - Core 5v5 feature

---

## Overview

When a 5v5 team only has 4 players available, they can select a "substitute" for one position. The OPPONENT then chooses which of the 4 actual players will play "double duty" (play in 2 positions).

**Key Principle**: The opponent has control over who plays twice, creating a strategic element.

---

## User Flow

### Step 1: Team A Enters Lineup (4 Players Available)

1. Team A has 8-person roster but only 4 players showed up
2. Team A selects 4 real players in positions 1-4
3. Team A selects "Sub (Home/Away)" in position 5
   NOTE: substitute can be selected in any position!
4. Team A clicks "Lock Lineup"

**UI State:**

- Lineup: [Player1, Player2, Player3, Player4, SUB]
- Lock button: Enabled (all 5 positions filled)
- Status: "Waiting for opponent to choose double duty player..."

### Step 2: Team B Sees Modal (Opponent Choice)

**When Team B opens lineup page, they see:**

- Modal appears automatically
- Title: "Opponent Used Substitute"
- Message: "Choose which of their players will play in 2 positions:"
- Dropdown: Lists Team A's 4 actual players with their handicaps
  - Player1 (HC: 3)
  - Player2 (HC: 2)
  - Player3 (HC: 1)
  - Player4 (HC: 0)
- Confirm button

**Team B makes strategic choice:**

- They might pick Player1 (highest handicap) to minimize opponent's total
- Or pick Player4 (lowest) to maximize opponent's total
- This creates strategic gameplay

### Step 3: Substitute Replaced, Lineup Locked

**After Team B confirms:**

1. Team A's lineup updates:
   - Position where SUB was → replaced with chosen player
   - That player now appears TWICE in the lineup
2. Team A's handicap total recalculated (player chosen appears twice)
3. Team A's lineup is LOCKED (cannot change without unlocking)

**Example:**

- Before: [Player1(HC:3), Player2(HC:2), Player3(HC:1), Player4(HC:0), SUB]
- Team B picks Player1
- After: [Player1(HC:3), Player2(HC:2), Player3(HC:1), Player4(HC:0), Player1(HC:3)]
- Total HC: 3+2+1+0+3 = 9

### Step 4: Unlock Behavior (Important!)

**If Team A unlocks their lineup:**

1. The duplicate player is REMOVED (position reverts to empty)
2. The substitute position is REMOVED (position reverts to empty)
3. Both positions become empty dropdowns
4. Team A must re-select players (including SUB again if needed)
5. Team B must re-choose double duty player when Team A re-locks

**Rationale:** Prevents Team A from gaming the system by unlocking and re-locking to force different choices.

---

## Database Schema

### Current `match_lineups` table (already supports 5v5):

```sql
- player1_id (uuid)
- player1_handicap (numeric)
- player2_id (uuid)
- player2_handicap (numeric)
- player3_id (uuid)
- player3_handicap (numeric)
- player4_id (uuid)
- player4_handicap (numeric)
- player5_id (uuid)
- player5_handicap (numeric)
- locked (boolean)
- locked_at (timestamp)
- double_duty_player_id (uuid) -- NEW FIELD NEEDED
- double_duty_position (integer) -- NEW FIELD NEEDED (which position was SUB)
```

### New Fields Explanation:

**`double_duty_player_id`**

- Stores which player was chosen to play double duty
- NULL if no substitute was used
- Used to identify duplicate when unlocking

**`double_duty_position`**

- Stores which position (1-5) had the substitute
- NULL if no substitute was used
- Used to know where to clear when unlocking

---

## Implementation Steps

### Phase 1: Database Migration

**File:** `supabase/migrations/20251122000001_add_double_duty_fields.sql`

```sql
-- Add double duty tracking fields to match_lineups table
ALTER TABLE match_lineups
  ADD COLUMN double_duty_player_id uuid REFERENCES members(id),
  ADD COLUMN double_duty_position integer CHECK (double_duty_position BETWEEN 1 AND 5);

COMMENT ON COLUMN match_lineups.double_duty_player_id IS 'Player chosen to play double duty when substitute used (5v5 only)';
COMMENT ON COLUMN match_lineups.double_duty_position IS 'Position number (1-5) where substitute was placed before opponent choice (5v5 only)';
```

### Phase 2: Update LineupState Hook

**File:** `src/hooks/lineup/useLineupState.ts`

Add state for double duty tracking:

```typescript
const [doubleDutyPlayerId, setDoubleDutyPlayerId] = useState<string | null>(
  null
);
const [doubleDutyPosition, setDoubleDutyPosition] = useState<number | null>(
  null
);
```

### Phase 3: Opponent Choice Modal Component

**File:** `src/components/lineup/OpponentSubstituteModal.tsx`

**Props:**

```typescript
interface OpponentSubstituteModalProps {
  isOpen: boolean;
  opponentLineup: {
    player1_id: string;
    player2_id: string;
    player3_id: string;
    player4_id: string;
    player5_id: string;
    player1_handicap: number;
    player2_handicap: number;
    player3_handicap: number;
    player4_handicap: number;
    player5_handicap: number;
    double_duty_position: number; // Which position has SUB
  };
  onPlayerChosen: (playerId: string, handicap: number) => void;
  onClose: () => void;
  getPlayerDisplayName: (playerId: string) => string;
}
```

**UI:**

```tsx
<Dialog open={isOpen} onOpenChange={onClose}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Opponent Used Substitute</DialogTitle>
      <DialogDescription>
        Choose which of their players will play in 2 positions
      </DialogDescription>
    </DialogHeader>

    <Select
      onValueChange={(playerId) => {
        const position = findPositionForPlayer(playerId);
        const handicap = opponentLineup[`player${position}_handicap`];
        onPlayerChosen(playerId, handicap);
      }}
    >
      <SelectTrigger>
        <SelectValue placeholder="Select player..." />
      </SelectTrigger>
      <SelectContent>
        {/* List all 4 real players (exclude SUB position) */}
        {[1, 2, 3, 4, 5]
          .filter((pos) => pos !== opponentLineup.double_duty_position)
          .map((pos) => {
            const playerId = opponentLineup[`player${pos}_id`];
            const handicap = opponentLineup[`player${pos}_handicap`];
            return (
              <SelectItem key={playerId} value={playerId}>
                {getPlayerDisplayName(playerId)} (HC: {handicap})
              </SelectItem>
            );
          })}
      </SelectContent>
    </Select>
  </DialogContent>
</Dialog>
```

### Phase 4: Update MatchLineup.tsx Logic

**File:** `src/player/MatchLineup.tsx`

#### 4.1: Detect when opponent locked with substitute

```typescript
// Check if opponent lineup has substitute
const opponentHasSubstitute = useMemo(() => {
  if (!is5v5 || !opponentLineup) return false;

  const playerIds = [
    opponentLineup.player1_id,
    opponentLineup.player2_id,
    opponentLineup.player3_id,
    opponentLineup.player4_id,
    opponentLineup.player5_id,
  ];

  return playerIds.includes(SUB_HOME_ID) || playerIds.includes(SUB_AWAY_ID);
}, [opponentLineup, is5v5]);

// Show modal when opponent locked with sub and we haven't chosen yet
const showOpponentSubModal =
  opponentHasSubstitute &&
  opponentLineup?.locked &&
  !opponentLineup?.double_duty_player_id;
```

#### 4.2: Handle opponent's choice

```typescript
const handleOpponentSubChoice = async (playerId: string, handicap: number) => {
  if (!opponentLineup?.id || !matchId) return;

  const subPosition = opponentLineup.double_duty_position;

  // Update opponent's lineup
  await updateLineupMutation.mutateAsync({
    lineupId: opponentLineup.id,
    updates: {
      [`player${subPosition}_id`]: playerId,
      [`player${subPosition}_handicap`]: handicap,
      double_duty_player_id: playerId,
      // double_duty_position already set when they locked
    },
    matchId,
  });
};
```

#### 4.3: Handle substitute selection (your team)

```typescript
const handlePlayerChange = async (position: number, playerId: string) => {
  const isSubstitute = playerId === SUB_HOME_ID || playerId === SUB_AWAY_ID;

  if (isSubstitute && is5v5) {
    // Save substitute to lineup
    await updateLineupMutation.mutateAsync({
      lineupId: lineup.lineupId,
      updates: {
        [`player${position}_id`]: playerId,
        [`player${position}_handicap`]: 0, // Temporary, will be replaced
        double_duty_position: position, // Mark which position has SUB
      },
      matchId,
    });
  } else {
    // Normal player selection
    // ... existing logic
  }
};
```

#### 4.4: Handle unlock with substitute

```typescript
const handleUnlock = async () => {
  if (!lineup.lineupId || !matchId) return;

  const updates: any = {
    locked: false,
    locked_at: null,
  };

  // If lineup had double duty player, clear both positions
  if (lineup.doubleDutyPlayerId && lineup.doubleDutyPosition) {
    // Clear the substitute position
    updates[`player${lineup.doubleDutyPosition}_id`] = null;
    updates[`player${lineup.doubleDutyPosition}_handicap`] = null;

    // Find the other position with the duplicate player
    const duplicatePosition = findDuplicatePosition(
      lineup.doubleDutyPlayerId,
      lineup.doubleDutyPosition
    );

    if (duplicatePosition) {
      updates[`player${duplicatePosition}_id`] = null;
      updates[`player${duplicatePosition}_handicap`] = null;
    }

    // Clear double duty tracking
    updates.double_duty_player_id = null;
    updates.double_duty_position = null;
  }

  await updateLineupMutation.mutateAsync({
    lineupId: lineup.lineupId,
    updates,
    matchId,
  });
};
```

### Phase 5: Update HandicapSummary Component

**File:** `src/components/lineup/HandicapSummary.tsx`

Handle duplicate player in total calculation:

```typescript
// Calculate team total (handles duplicate player)
const teamTotal = useMemo(() => {
  const handicaps = [
    lineup.player1Handicap,
    lineup.player2Handicap,
    lineup.player3Handicap,
    lineup.player4Handicap,
    lineup.player5Handicap,
  ].filter((h) => h !== null);

  return handicaps.reduce((sum, h) => sum + h, 0);
}, [lineup]);

// Note: If player appears twice, their handicap is counted twice
// Example: [3, 2, 1, 0, 3] = 9 total
```

---

## Testing Checklist

### Substitute Selection

- [ ] Can select substitute in any position (1-5)
- [ ] Can lock lineup with substitute selected
- [ ] Substitute selection saves `double_duty_position` to database
- [ ] Cannot lock lineup without all 5 positions filled

### Opponent Choice Modal

- [ ] Modal appears for opponent when lineup locked with substitute
- [ ] Modal shows 4 real players (excludes substitute position)
- [ ] Modal shows player names and handicaps correctly
- [ ] Clicking player updates opponent's lineup
- [ ] Substitute position replaced with chosen player
- [ ] `double_duty_player_id` saved to database

### Handicap Calculation

- [ ] Team total includes duplicate player handicap twice
- [ ] Handicap diff calculated correctly
- [ ] Thresholds calculated correctly with duplicate

### Unlock Behavior

- [ ] Unlocking clears both positions (SUB position + duplicate position)
- [ ] `double_duty_player_id` and `double_duty_position` cleared
- [ ] Re-locking requires full lineup selection again
- [ ] Opponent must re-choose double duty player

### Real-time Sync

- [ ] Opponent sees lineup update when choice made
- [ ] Team sees modal when opponent locks with sub
- [ ] Both teams see correct handicap totals

---

## Edge Cases

### 1. Both teams use substitute

- Each team independently chooses opponent's double duty player
- Both lineups tracked separately with `double_duty_player_id`

### 2. Unlock during opponent's choice

- If Team A unlocks while Team B is choosing, close modal for Team B
- Team A must re-lock and Team B must re-choose

### 3. Substitute in position 1 vs position 5

- Logic works the same regardless of which position has substitute
- `double_duty_position` tracks this

### 4. Player who plays double duty leaves mid-match

- This is a social issue, not a technical one
- Would require forfeit or lineup adjustment (future feature)

---

## Future Enhancements (Out of Scope)

- Allow team to suggest which player should play double duty (opponent still decides)
- Show visual indicator on lineup when player plays twice
- Track double duty stats separately
- Prevent unlocking after match starts (social agreement only for MVP)

---

## Success Criteria

✅ Team can select substitute in 5v5 lineup
✅ Opponent sees modal to choose double duty player
✅ Chosen player appears twice in lineup
✅ Handicap total calculated correctly with duplicate
✅ Unlocking clears both positions and requires re-choice
✅ Real-time sync works for both teams
✅ Database tracks `double_duty_player_id` and `double_duty_position`
