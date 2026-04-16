# Schedule Manual Manipulation Feature Plan

## Overview

Allow League Operators (LOs) to manually edit matchups within a week after the schedule has been generated. The goal is to let LOs rearrange which teams play each other and change venues while maintaining schedule integrity (every team plays exactly once per week).

---

## Current State

### How Schedules Work Today

1. **Schedule Generation Flow:**
   - LO assigns team positions (1-N) via `ScheduleSetup.tsx`
   - System uses round-robin matchup tables to generate matches
   - Matches are bulk-inserted into the `matches` table
   - **Database trigger** auto-creates empty `match_lineups` records for each match
   - Table numbers are assigned via `assign_tables_for_season()` RPC

2. **Match Record Structure:**
   - `home_team_id` / `away_team_id` - The teams playing
   - `season_week_id` - Which week the match is scheduled
   - `scheduled_venue_id` - Where the match is played (defaults to home team's venue)
   - `match_number` - Order within the week (1, 2, 3...)
   - `assigned_table_number` - Table at the venue
   - `status` - 'scheduled', 'in_progress', 'completed', etc.

3. **Lineup Sync:**
   - When `home_team_id` or `away_team_id` changes, a database trigger automatically updates the corresponding lineup's `team_id`
   - This means we CAN safely swap teams without breaking lineups

4. **Current Limitations:**
   - No UI to edit individual matches or weeks
   - Only options are "Accept" or "Clear & Regenerate"
   - LOs cannot fix scheduling conflicts or accommodate special requests

---

## Scope & Constraints

### What LOs CAN Do

| Action | Description |
|--------|-------------|
| **Swap team matchups** | Change who plays who within a week (e.g., 1v2 & 3v4 → 1v4 & 2v3) |
| **Change venue** | Override the default venue for any match |
| **Change table number** | (Low priority) Manually set table assignment |

### What LOs CANNOT Do (By Design)

| Action | Reason |
|--------|--------|
| Add teams | Team count is fixed for the season |
| Remove teams | Would break round-robin balance |
| Add matches | Match count determined by team count |
| Remove matches | Would leave teams without opponents |
| Move matches between weeks | Out of scope for initial version |

### Key Constraint: Team Usage Rules

Within each week:
- **Every team must appear exactly once** (either as home or away)
- **No team can appear twice** in the same week
- This is enforced by the UI preventing invalid states

---

## Chosen Approach: Inline Week Editor Component

### Concept

Each week on the schedule page gets an "Edit Week" button. Clicking it transforms that week card into edit mode with dropdowns, action buttons, and the ability to revert/save/cancel.

**Key Principle:** The edit mode is its own self-contained component that replaces the display view when editing.

### UI Design

**Schedule Page - Display Mode (default):**
```
┌─────────────────────────────────────────────────────────────┐
│ Week 1 - January 15, 2025                      [Edit Week]  │
├─────────────────────────────────────────────────────────────┤
│ Team A (Home) vs Team B (Away)    @ Venue X                 │
│ Team C (Home) vs Team D (Away)    @ Venue Y                 │
│ Team E (Home) vs Team F (Away)    @ Venue X                 │
└─────────────────────────────────────────────────────────────┘
```

**Schedule Page - Edit Mode (replaces display):**
```
┌─────────────────────────────────────────────────────────────────────┐
│ Edit Week 1 - January 15, 2025                                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Match 1:  [▼ Team A]  vs  [▼ Team B]    Venue: [▼ Venue X    ]    │
│  Match 2:  [▼ Team C]  vs  [▼ Team D]    Venue: [▼ Venue Y    ]    │
│  Match 3:  [▼ Team E]  vs  [▼ Team F]    Venue: [▼ Venue X    ]    │
│                                                                     │
│  ─────────────────────────────────────────────────────────────────  │
│  Note: Each team must appear exactly once per week.                 │
│                                                                     │
│  [Revert]                                   [Cancel]  [Save]        │
└─────────────────────────────────────────────────────────────────────┘
```

### Button Behaviors

| Button | Action |
|--------|--------|
| **Save** | Updates database with changes, exits edit mode |
| **Cancel** | Discards all changes, exits edit mode |
| **Revert** | Resets to original values, stays in edit mode (start over) |

### How Team Swapping Works

**Scenario:** Week has matches: A vs B, C vs D, E vs F

LO wants: A vs D, C vs B, E vs F

**UI Behavior:**
1. LO clicks dropdown for Match 1 Away Team (currently "B")
2. Dropdown shows: B (current), C, D, E, F (available teams not in this match)
3. LO selects "D"
4. System automatically swaps: D moves to Match 1, B moves to where D was (Match 2)
5. Result: A vs D, C vs B, E vs F

**Key Insight:** Swapping teams effectively handles home/away changes too:
- Original: A (home) vs B (away)
- If LO wants B to be home: swap to make it B vs A in the dropdowns
- The first dropdown position = home team, second = away team

### Venue Selection

- Each match row has a venue dropdown
- Shows all venues in the system (reuse existing venue selector pattern)
- Defaults to home team's home venue
- Can be overridden to any venue

---

## Technical Design

### Design Principles

- **DRY** - Don't repeat yourself; reuse existing components and patterns
- **KISS** - Keep it simple; no over-engineering
- **Single Responsibility** - Each component does one thing well
- **Reusable** - Components can be used in other contexts if needed
- **Testable** - Logic is isolated and easy to unit test
- **TanStack Query First** - Use existing queries/mutations; new ones must be generic

### Component Structure

```
SeasonSchedulePage
├── WeekCard (for each week)
│   ├── isEditing = false → WeekDisplayView (read-only match list)
│   │   └── [Edit Week] button (operators only)
│   └── isEditing = true → WeekEditorView (edit mode component)
│       ├── MatchEditRow (for each match)
│       │   ├── TeamSelect (home position)
│       │   ├── TeamSelect (away position)
│       │   └── VenueSelect
│       ├── Validation messages
│       └── [Revert] [Cancel] [Save] buttons
```

### Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/components/schedule/WeekEditorView.tsx` | CREATE | Self-contained edit mode component for a week |
| `src/components/schedule/MatchEditRow.tsx` | CREATE | Single match row with team/venue dropdowns |
| `src/components/schedule/TeamSelect.tsx` | CREATE | Reusable team dropdown (single responsibility) |
| `src/components/schedule/VenueSelect.tsx` | CREATE | Reusable venue dropdown (single responsibility) |
| `src/components/schedule/useWeekEditor.ts` | CREATE | Custom hook for edit state & swap logic (testable) |
| `src/operator/SeasonSchedulePage.tsx` | MODIFY | Toggle between display/edit views per week |

### Component Responsibilities

| Component | Single Responsibility |
|-----------|----------------------|
| `WeekEditorView` | Orchestrates edit mode UI, manages save/cancel/revert |
| `MatchEditRow` | Renders one match's edit controls |
| `TeamSelect` | Dropdown for selecting a team (reusable) |
| `VenueSelect` | Dropdown for selecting a venue (reusable) |
| `useWeekEditor` | All edit state logic, swap algorithm, validation (testable in isolation) |

### State Management

**Why useState with arrays (not useReducer/localStorage):**
- Array length is fixed when entering edit mode (matches in the week)
- We're updating values within array, not adding/removing items
- useReducer is overkill - no complex state transitions
- localStorage not needed - losing edits on navigate is expected behavior

**Parent page tracks which week is editing:**
```typescript
const [editingWeekId, setEditingWeekId] = useState<string | null>(null);

// When clicking Edit on another week while one is open:
const handleEditWeek = (weekId: string) => {
  if (editingWeekId && editingWeekId !== weekId && hasUnsavedChanges) {
    // Show warning: "You have unsaved changes. Discard?"
  }
  setEditingWeekId(weekId);
};
```

**useWeekEditor hook manages edit state:**
```typescript
interface MatchEdit {
  matchId: string;
  homeTeamId: string | null;  // null = BYE
  awayTeamId: string | null;  // null = BYE
  venueId: string | null;
  isEditable: boolean;        // false if match already started/completed
}

function useWeekEditor(initialMatches: MatchEdit[]) {
  const [editedMatches, setEditedMatches] = useState<MatchEdit[]>(initialMatches);
  const originalMatches = useRef<MatchEdit[]>(initialMatches); // Never re-renders

  const handleTeamSwap = (matchId: string, position: 'home' | 'away', newTeamId: string) => {
    setEditedMatches(prev => { /* swap logic */ });
  };

  const handleVenueChange = (matchId: string, venueId: string) => {
    setEditedMatches(prev =>
      prev.map(m => m.matchId === matchId ? { ...m, venueId } : m)
    );
  };

  const handleRevert = () => setEditedMatches([...originalMatches.current]);

  const hasChanges = useMemo(() =>
    !isEqual(editedMatches, originalMatches.current),
    [editedMatches]
  );

  return { editedMatches, handleTeamSwap, handleVenueChange, handleRevert, hasChanges, isValid };
}
```

**Validation (computed from state):**
```typescript
// Get all team IDs used in the week
const usedTeamIds = editedMatches.flatMap(m => [m.homeTeamId, m.awayTeamId].filter(Boolean));

// Check for duplicates
const hasDuplicates = usedTeamIds.length !== new Set(usedTeamIds).size;

// Check all teams are used (compare against season's team list)
const allTeamsUsed = seasonTeams.every(t => usedTeamIds.includes(t.id) || t.id === 'BYE');
```

### Data Sources

**Teams:**
- Query teams by `season_id` from `teams` table
- Should have existing query - check `src/api/hooks/`

**Venues:**
- Use `league_venues` table (subset of venues allowed for this league)
- NOT all organization venues - LO can add more via league settings if needed
- Should have existing query - check `src/api/hooks/`

### Database Operations

**TanStack Query Pattern:**
- Use existing queries/mutations from `src/api/hooks` and `src/api/mutations`
- Check what already exists before creating new ones
- Any new mutations should be **generic** (not specific to this feature)
- Example: `useUpdateMatch` should accept any match fields, not just schedule-related ones

**Critical: Atomic Save (All-or-Nothing)**
- All match updates for a week MUST succeed together or all fail
- NO partial saves - would leave schedule in broken state
- Options:
  1. Create database RPC function that updates all matches in a transaction
  2. Use Supabase's bulk update if available
- If any update fails, rollback all changes and show error

**On Save:**
```typescript
// Option 1: RPC function for atomic update (preferred)
const { error } = await supabase.rpc('update_week_matches', {
  p_match_updates: changedMatches.map(m => ({
    match_id: m.matchId,
    home_team_id: m.homeTeamId,
    away_team_id: m.awayTeamId,
    scheduled_venue_id: m.venueId,
  }))
});

if (error) {
  // All changes rolled back - show error, stay in edit mode
  setError('Failed to save changes. Please try again.');
  return;
}

// Success - invalidate queries to refetch fresh data
queryClient.invalidateQueries(['seasonSchedule', seasonId]);
```

**After Save - Refetch Required:**
- MUST invalidate and refetch schedule data after successful save
- Ensures UI shows actual database state
- TanStack Query handles this via `invalidateQueries`

**Before Implementation:**
1. Check `src/api/hooks/` for existing match/team/venue queries
2. Check `src/api/mutations/matches.ts` for existing mutations
3. Reuse/extend existing code rather than duplicating
4. If creating new mutation, make it generic (accepts partial Match updates)
5. May need new RPC function for atomic multi-match update

### Dropdown Behavior

**Team Dropdown Logic:**
```typescript
// For a given match and position (home/away), show:
// 1. Current team in this position
// 2. All other teams that could be swapped here

function getAvailableTeams(
  currentMatchId: string,
  position: 'home' | 'away',
  allMatches: MatchEdit[],
  allTeams: Team[]
): Team[] {
  const currentMatch = allMatches.find(m => m.matchId === currentMatchId);
  const currentTeamId = position === 'home' ? currentMatch.homeTeamId : currentMatch.awayTeamId;

  // Teams in OTHER matches (not this one) are available for swapping
  const teamsInOtherMatches = allMatches
    .filter(m => m.matchId !== currentMatchId)
    .flatMap(m => [m.homeTeamId, m.awayTeamId]);

  // Current team + teams from other matches
  return allTeams.filter(t =>
    t.id === currentTeamId || teamsInOtherMatches.includes(t.id)
  );
}
```

**On Team Selection (swap logic):**
```typescript
function handleTeamSelect(
  matchId: string,
  position: 'home' | 'away',
  newTeamId: string
) {
  setEditedMatches(prev => {
    const updated = [...prev];
    const targetMatch = updated.find(m => m.matchId === matchId);
    const oldTeamId = position === 'home' ? targetMatch.homeTeamId : targetMatch.awayTeamId;

    // Find which match currently has the new team
    const sourceMatch = updated.find(m =>
      m.homeTeamId === newTeamId || m.awayTeamId === newTeamId
    );

    if (sourceMatch && sourceMatch.matchId !== matchId) {
      // Swap: put old team where new team was
      if (sourceMatch.homeTeamId === newTeamId) {
        sourceMatch.homeTeamId = oldTeamId;
      } else {
        sourceMatch.awayTeamId = oldTeamId;
      }
    }

    // Set new team in target position
    if (position === 'home') {
      targetMatch.homeTeamId = newTeamId;
    } else {
      targetMatch.awayTeamId = newTeamId;
    }

    return updated;
  });
}
```

---

## Validation Rules

| Rule | Behavior |
|------|----------|
| Each team appears exactly once | Enforced by swap logic - can't create duplicates |
| All season teams must be used | Enforced by swap logic - can't remove teams |
| Cannot edit completed weeks | "Edit Week" button hidden for completed weeks |
| Cannot edit in-progress matches | Disable row or show warning |

---

## Edge Cases

### BYE Teams
- If season has odd number of teams, one team has a BYE each week
- BYE appears as an option in dropdowns
- Match with BYE: `Team A vs BYE` - venue can be null

### Matches Already Started
- If any match in the week has `status !== 'scheduled'`, show warning
- Option A: Block editing the entire week
- Option B: Allow editing only scheduled matches (disable started ones)
- **Decision needed:** Which approach?

### Lineup Implications
- Database trigger handles team_id sync in lineups
- If lineup has players assigned, they stay with their team
- No special handling needed in this feature

---

## Decisions Made

1. **Started/Completed Matches:**
   - ✅ Allow editing only matches that haven't started yet
   - Started/completed matches are disabled in the editor

2. **Active Season Editing:**
   - ✅ LOs can edit future weeks of active seasons
   - Only restriction: match must have status = 'scheduled'

3. **Table Numbers:**
   - ✅ Leave as-is for now (low priority)
   - Can add manual table editing later

4. **UI Approach:**
   - ✅ Dropdowns for team swapping
   - Drag-and-drop can be added later as quality-of-life improvement

---

## Success Criteria

- [ ] "Edit Week" button appears on each week card (operators only, appropriate season status)
- [ ] Edit mode replaces display view inline (not a modal)
- [ ] Only one week can be in edit mode at a time
- [ ] Warning shown when switching weeks with unsaved changes
- [ ] LO can swap teams between matches via dropdowns
- [ ] LO can change venue for any match (from league's allowed venues)
- [ ] Swap logic maintains constraint: each team exactly once per week
- [ ] Save is atomic - all changes succeed or all fail (no partial saves)
- [ ] Save button shows loading state while saving
- [ ] Schedule page refetches and re-renders after successful save
- [ ] Revert button resets to original without exiting edit mode
- [ ] Cannot edit matches with status !== 'scheduled' (disabled in UI)
- [ ] Error handling for save failures (stay in edit mode, show error)

---

## Implementation Steps

1. Check existing queries/mutations in `src/api/hooks/` and `src/api/mutations/`
2. Create RPC function `update_week_matches` for atomic multi-match update (migration)
3. Create `useWeekEditor.ts` hook (swap logic, state management, validation)
4. Create `TeamSelect.tsx` component (reusable team dropdown)
5. Create `VenueSelect.tsx` component (reusable venue dropdown)
6. Create `MatchEditRow.tsx` component (single match row with dropdowns)
7. Create `WeekEditorView.tsx` component (orchestrates edit mode)
8. Modify `SeasonSchedulePage.tsx` (toggle between display/edit views, only one week editable at a time)
9. Wire up save with atomic RPC, invalidate queries on success
10. Test swap scenarios and edge cases (BYE teams, started matches, save failures)

---

*Created: January 6, 2025*
*Updated: January 6, 2025*
*Status: APPROVED - Ready for Implementation*
