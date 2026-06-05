# Authorize New Players Feature

## Overview

This feature allows league operators to review and authorize new players before they can participate in lineups. The goal is to ensure operators have verified a player's starting handicap before they play, preventing handicap manipulation or errors.

## Core Concept

- **Unauthorized Player**: A player whose `starting_handicap_3v3` AND `starting_handicap_5v5` are both `NULL`
- **Authorized Player**: A player who has had their starting handicaps explicitly set (even if set to 0/40)
- **Authorization**: The act of an operator reviewing a player and setting their starting handicaps

### Auto-Authorization for Established Players

Players with 15+ games are considered "established" and can be auto-authorized:

1. When checking if a player needs authorization, first check game count
2. If player has 15+ games of ANY type (8-ball, 9-ball, or 10-ball combined):
   - Run their game history through the handicap calculator
   - Get both 3v3 and 5v5 handicap values
   - Auto-set their `starting_handicap_3v3` and `starting_handicap_5v5` to these calculated values
   - Player is now "authorized" and won't appear in the unauthorized list

This means:
- Brand new players (0-14 games) → Need manual operator authorization
- Established players (15+ games) → Auto-authorized with calculated handicaps
- The starting handicap values serve as a snapshot of their handicap at time of authorization

## Database Changes (Single Migration)

### 1. Members Table

Change default values from hardcoded defaults to NULL:

```sql
-- Change defaults to NULL (allows distinguishing "not set" from "intentionally set to default")
ALTER TABLE members ALTER COLUMN starting_handicap_3v3 DROP DEFAULT;
ALTER TABLE members ALTER COLUMN starting_handicap_3v3 SET DEFAULT NULL;

ALTER TABLE members ALTER COLUMN starting_handicap_5v5 DROP DEFAULT;
ALTER TABLE members ALTER COLUMN starting_handicap_5v5 SET DEFAULT NULL;

-- Set existing players with default values to NULL (puts them in authorization queue)
UPDATE members
SET starting_handicap_3v3 = NULL, starting_handicap_5v5 = NULL
WHERE starting_handicap_3v3 = 0 AND starting_handicap_5v5 = 40;
```

### 2. Preferences Table

Add new column for the authorization requirement setting:

```sql
-- Add column for controlling whether unauthorized players can be added to lineups
ALTER TABLE preferences
ADD COLUMN allow_unauthorized_players BOOLEAN DEFAULT true;

-- Add comment explaining the column
COMMENT ON COLUMN preferences.allow_unauthorized_players IS
'When false, players must have their starting handicaps set (authorized) before they can be added to match lineups. Cascades: league → organization → system default (true).';
```

## Preference Cascade Logic

The `preferences` table supports entity-based overrides:
- **System default**: `true` (allow unauthorized players)
- **Organization level**: Can override system default
- **League level**: Can override organization default

Example scenarios:
1. Org sets `allow_unauthorized_players = false` → All leagues require authorization
2. Org sets `false`, but casual league sets `true` → That league allows unauthorized players
3. Org leaves it `NULL` (or `true`) → System default applies, no authorization required

## UI Changes

### Phase 1: Authorize New Players List (PlayerManagement.tsx)

Add a new card/section to the Player Management page (`/manage-players/:orgId`) that displays:

- **List of unauthorized players** (starting_handicap_3v3 IS NULL AND starting_handicap_5v5 IS NULL)
- Players should be filtered to only show those on teams within the operator's organization
- Each player shows:
  - Name (clickable to select them in the main player lookup)
  - Team(s) they're on
  - Quick action to set handicaps

**Workflow:**
1. Operator sees list of players needing authorization
2. Clicks a player → auto-selects them in the PlayerCombobox
3. Sets their starting handicaps using existing UI
4. Player disappears from the "needs authorization" list

### Phase 2: Organization Settings UI

Add toggle to Organization Settings page for `allow_unauthorized_players`:
- Label: "Allow Unauthorized Players in Lineups"
- Description: "When disabled, players must have their starting handicaps set before they can be added to match lineups."
- Default: On (checked)

### Phase 3: League-Level Override (Optional)

Add same toggle to league settings, with indication of what the org default is.

### Phase 4: Lineup Enforcement

When `allow_unauthorized_players = false`:
- In lineup selection, unauthorized players should be:
  - Visually indicated (grayed out, badge, etc.)
  - Not selectable for lineup slots
  - Show tooltip explaining why they can't be selected

## Implementation Steps

### Step 1: Database Migration
- [ ] Create migration file: `supabase/migrations/YYYYMMDDHHMMSS_authorize_new_players.sql`
- [ ] Add members table column default changes
- [ ] Add UPDATE to set existing default values to NULL
- [ ] Add preferences table column
- [ ] Test migration locally with `supabase db reset`

### Step 2: API Layer
- [ ] Create `fetchUnauthorizedPlayers(operatorId)` query function
- [ ] Update preference fetching to include new column
- [ ] Add helper function `isPlayerAuthorized(player)` → checks if both handicaps are non-NULL
- [ ] Create `autoAuthorizeEstablishedPlayer(playerId)` function:
  - Fetch total game count across all game types
  - If 15+ games, calculate handicaps and update starting_handicap fields
  - Return whether player was auto-authorized

### Step 3: Unauthorized Players List UI
- [ ] Add new Card component to PlayerManagement.tsx
- [ ] Fetch and display unauthorized players (with NULL starting handicaps AND < 15 games)
- [ ] For each player, attempt auto-authorization first (if 15+ games, auto-set and remove from list)
- [ ] Add click handler to select player in combobox
- [ ] Show team information for context
- [ ] Show game count (so operator knows if player is close to 15)
- [ ] Auto-refresh list when handicaps are saved

### Step 4: Organization Settings
- [ ] Add toggle for `allow_unauthorized_players` preference
- [ ] Wire up to preferences update mutation

### Step 5: Lineup Enforcement (if preference is false)
- [ ] Fetch organization/league preference for `allow_unauthorized_players`
- [ ] In player selection components, check authorization status
- [ ] Disable/hide unauthorized players when setting requires it
- [ ] Add visual indicator and tooltip

## Testing Checklist

- [ ] New players created via registration have NULL starting handicaps
- [ ] Existing players with 0/40 are converted to NULL after migration
- [ ] Unauthorized players list shows correct players
- [ ] Players with 15+ games are auto-authorized (starting handicaps set from calculation)
- [ ] Auto-authorized players don't appear in unauthorized list
- [ ] Setting handicaps removes player from unauthorized list
- [ ] Preference toggle saves correctly at org level
- [ ] Preference toggle saves correctly at league level (with cascade)
- [ ] Lineup selection respects preference when false
- [ ] Lineup selection allows all players when preference is true

## Notes

- The handicap calculation already handles NULL values gracefully (falls back to 0/40)
- No changes needed to `calculatePlayerHandicap.ts`
- This is the first migration since go-live, so it's a good template for future migrations
