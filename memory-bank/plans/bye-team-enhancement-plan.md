# BYE Team Enhancement Plan

## Overview

Currently, BYE teams are handled as temporary objects during schedule generation:
1. `ScheduleSetup.tsx` creates a temporary BYE object with `id: 'BYE'`
2. `scheduleGenerator.ts` converts `'BYE'` to `null` when inserting matches

This plan outlines creating actual BYE team records in the database.

## Current Implementation

### Where BYE logic lives:
- **[ScheduleSetup.tsx:66-82](src/operator/ScheduleSetup.tsx#L66-L82)** - Creates temporary BYE team object
- **[scheduleGenerator.ts:167-179](src/utils/scheduleGenerator.ts#L167-L179)** - Converts BYE to null
- **[SeasonSchedulePage.tsx](src/operator/SeasonSchedulePage.tsx)** - Detects BYE via null team IDs
- **[WeekEditorView.tsx](src/components/schedule/WeekEditorView.tsx)** - Passes `hasByeTeam` prop
- **[TeamSelect.tsx](src/components/schedule/TeamSelect.tsx)** - Shows BYE option conditionally

### Current Data Model:
- Matches with a BYE have `home_team_id = null` or `away_team_id = null`
- BYE detection requires checking for null team IDs across matches
- No actual team record exists for BYE

## Proposed Solution

### Option A: Add `is_bye_team` Boolean Column (Recommended)

Add a boolean column to the `teams` table to mark BYE teams explicitly.

**Pros:**
- Clear, explicit identification
- Easy to query
- No ambiguity

**Cons:**
- Requires migration
- Extra column

### Option B: Use Naming Convention

Create regular team records named "BYE" without special columns.

**Pros:**
- No schema changes
- Simple

**Cons:**
- Could conflict with actual team names
- Less explicit

## Implementation Steps

### Phase 1: Database Schema

1. **Add `is_bye_team` column to teams table**
   ```sql
   ALTER TABLE teams ADD COLUMN is_bye_team BOOLEAN DEFAULT FALSE;
   ```

2. **Add index for BYE team queries**
   ```sql
   CREATE INDEX idx_teams_is_bye_team ON teams(season_id) WHERE is_bye_team = TRUE;
   ```

### Phase 2: BYE Team Creation

1. **Update `ScheduleSetup.tsx`**
   - When odd team count detected, create actual team record via Supabase
   - Set `is_bye_team = true`, `team_name = 'BYE'`
   - Use returned team ID instead of `'BYE'` string

2. **Update `scheduleGenerator.ts`**
   - Remove the `'BYE' -> null` conversion
   - Use actual BYE team ID in match records

### Phase 3: Update Queries and Components

1. **Update team queries**
   - Add option to include/exclude BYE teams
   - Default to excluding BYE from team lists

2. **Update schedule components**
   - Remove `hasByeTeam` prop detection via null IDs
   - Detect via `is_bye_team` flag on team records

3. **Update standings/stats**
   - Filter out BYE teams from standings
   - BYE matches don't count for stats

### Phase 4: Migration for Existing Data

1. **Create migration script**
   - Find matches with null team IDs
   - Create BYE team records for those seasons
   - Update matches to reference BYE team IDs

## Benefits

1. **Cleaner Data Model**
   - No null team IDs in matches table
   - All matches have valid team references

2. **Easier Late-Team Additions**
   - To add a team mid-season, swap the BYE team with the new team
   - All existing matches remain valid

3. **Better Schedule Editor UX**
   - BYE appears as a real team option
   - No special null handling in dropdowns

4. **Simpler Queries**
   - No need to handle null team IDs
   - Standard joins work for all matches

## Files to Modify

- `supabase/migrations/` - New migration for schema
- `src/operator/ScheduleSetup.tsx` - Create actual BYE team
- `src/utils/scheduleGenerator.ts` - Remove BYE -> null conversion
- `src/operator/SeasonSchedulePage.tsx` - Update BYE detection
- `src/components/schedule/TeamSelect.tsx` - Update BYE handling
- `src/components/schedule/WeekEditorView.tsx` - Update hasByeTeam logic
- `src/player/TeamSchedule.tsx` - Update BYE detection and guard lineup access
- Various query files - Add is_bye_team filtering

## Player View Impact

The `TeamSchedule.tsx` component (player's team schedule view) is also affected:

**Current behavior:**
- When opponent is null (BYE), displays "vs BYE" correctly
- However, the "Score Match" button still appears for BYE weeks
- Players can click into `/match/{id}/lineup` for a BYE match (bug)

**Required fix (regardless of BYE team enhancement):**
- Hide "Score Match" / "Continue Scoring" buttons for BYE matches
- Either check for null opponent OR (after enhancement) check `is_bye_team` flag

**With BYE team enhancement:**
- Opponent will be a real team object with `team_name = 'BYE'`
- Detection changes from `opponent === null` to `opponent?.is_bye_team === true`
- Same guard logic needed, just different detection method

## Stats & Standings Impact

The stats and standings pages must filter out BYE teams:

**Current behavior:**
- BYE matches have null team IDs, so they may not appear in standings at all
- Stats calculations may or may not include BYE matches depending on join behavior

**Required changes:**
- `src/pages/Standings.tsx` (or equivalent) - Filter out BYE teams from standings list
- `src/pages/Stats.tsx` (or equivalent) - Exclude BYE matches from stat calculations
- Any leaderboard or ranking components - Hide BYE teams

**With BYE team enhancement:**
- BYE team will appear as a real team in queries
- Must explicitly filter where `is_bye_team = false` in standings/stats queries
- Add `is_bye_team` check to any team listing that should exclude BYE

**Business rules:**
- BYE teams should never appear in standings tables
- BYE matches DO count for team standings - teams get wins/points for BYE weeks
- BYE matches should NOT affect individual player statistics (no games played)
- The team playing BYE receives an automatic win and points

**BYE Point Configuration (league-specific):**
- Point value for BYE wins varies by league type - must be configurable
- Options to consider:
  - Fixed point value (e.g., always 10 points)
  - Percentage of max possible points
  - Average of team's other match points
  - League operator configurable setting
- Need to add BYE point settings to league/season configuration

**BYE Match Completion:**
- When should BYE points be awarded?
  - Option A: Auto-complete BYE matches at start of week (or season start)
  - Option B: Auto-complete when the week's date passes
  - Option C: Operator manually marks BYE matches complete
  - Option D: System auto-completes all BYE matches during schedule generation
- Match status flow for BYE: `scheduled` -> `completed` (skip `in_progress`)
- Need to store BYE points on the match record (or calculate dynamically)

**Implementation considerations:**
- Add `bye_points_value` or similar to league/season settings
- Add `is_bye_match` computed field or detection logic
- Create background job or trigger to auto-complete BYE matches (if using auto-complete)
- Standings calculation must include BYE match points

## Considerations

- **Backward Compatibility**: Existing seasons have null team IDs. Migration script needed.
- **Team Counts**: BYE team should be excluded from team count displays.
- **Stats**: BYE matches should not affect player/team statistics.
- **Standings**: BYE teams should not appear in standings.

## Priority

Medium - This is a quality-of-life improvement that simplifies the codebase and enables future features (late team additions). Not blocking current functionality.
