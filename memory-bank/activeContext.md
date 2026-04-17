# Active Context

> ## 🚨 KNOWN HIGH-SEVERITY ISSUE — READ BEFORE TOUCHING TEAMS/MATCHES
>
> **Team deletion cascades destroy matches.** The `matches` table has
> `ON DELETE CASCADE` on team foreign keys. Deleting a team in
> `src/operator/TeamManagement.tsx` silently destroys all of that team's
> scheduled matches and breaks other teams' schedules.
>
> **Mitigation in place:** Honest warning dialog (see `handleDeleteTeam`).
> **Real fix:** Pending — see `memory-bank/edsPlan.md` → "CRITICAL: Team
> Deletion Cascade Issue" for details and possible approaches.
>
> Discovered: 2026-04-09 during wizard 2.0 planning.

---

## Current Work Focus

### **🎯 CURRENT: MVP Development**
**Priority**: High
**Status**: 🚀 **ACTIVE**

**Focus Areas**:
- Complete 3v3 match scoring system (Pages 1 & 2 built, Page 3 tiebreaker pending)
- League management core features
- Schedule generation and display
- Team management and roster handling

**On Hold (Post-MVP)**:
- Messaging system TanStack Query optimization (see `/archive/PRIORITY-3-ROADMAP.md`)
- Performance optimizations and refactoring

---

## Outstanding TODOs (Extracted from Archived Plans)

### **UI Improvements** (Low Priority)
**Status**: Can be done incrementally

1. **Replace Native Alerts** (partially complete)
   - Most critical alerts replaced with custom dialogs
   - Remaining instances can be found with: `grep -r "alert\(" src/`
   - Use `AlertDialog` and `ConfirmDialog` components from `/src/components/`

2. **Capitalize Input Migration** (mostly complete)
   - League wizard and key forms migrated to `CapitalizeInput` component
   - Remaining candidates: team name inputs, player registration forms
   - Component location: `@/components/ui/capitalize-input.tsx`

### **Lineup & Scoring Refactors** (Future Features)
**Status**: Planning phase - deferred until 3v3 is fully tested

1. **Lineup Page Refactor**
   - Extract reusable components for 3v3, 5v5, and tiebreaker modes
   - Create `LineupSelector` component that adapts based on roster size
   - Reference: `/archive/REFACTOR-LINEUP.md` for detailed architecture

2. **Scoring Page Refactor**
   - Extract reusable components for different match formats
   - Create `useMatchScoring` hook to centralize logic
   - Support 3v3 (18 games), tiebreaker (3 games), 5v5 (25 games)
   - Reference: `/archive/REFACTOR-SCORING.md` for detailed architecture

**Decision**: Focus on getting 3v3 match scoring fully working before refactoring for reusability

---

### **✅ COMPLETED: Player Team View & Captain Team Management** 🎉
**Implementation Date**: 2025-01-16
**Status**: ✅ **PRODUCTION READY**

**What Was Built**:
- Player-facing "My Teams" page with team cards
- Captain team editing functionality with RLS-aware roster management
- Team readiness indicators for minimum requirements
- Schedule page access control (read-only for players, editable for operators)
- Matches table database schema integration

**Key Features Implemented**:

1. **My Teams Page** ([MyTeams.tsx](../src/player/MyTeams.tsx))
   - Displays all teams the logged-in player is on
   - Shows team information grouped by league
   - Captains see "Edit Team" button on their teams
   - Uses TeamCard component for consistent display

2. **Team Card Component** ([TeamCard.tsx](../src/components/player/TeamCard.tsx))
   - Displays team name, captain, home venue, roster
   - "View Schedule" button navigates to schedule page with `?from=player` query param
   - "Score Match" button for match scorekeeping (placeholder)
   - **Team Readiness Indicator** (captains only):
     - Green checkmark: Team ready (venue + minimum roster)
     - Yellow warning: Missing requirements with specific list
     - Minimum roster: 3/5 for 5-man teams, 5/8 for 8-man teams
   - Highlights current user in roster with blue color

3. **Captain Team Editing** ([TeamEditorModal.tsx](../src/operator/TeamEditorModal.tsx))
   - Modal opens from TeamCard "Edit Team" button
   - **RLS-Aware Roster Management**:
     - Captain cannot delete themselves due to RLS policy
     - Different delete strategy for captain variant:
       - Fetches current roster first
       - Deletes only non-captain rows
       - Updates captain's `is_captain` flag if needed
       - Skips inserting captain (already exists)
       - Inserts only new non-captain players
     - Operator variant works normally (full delete/insert)
   - Fixed duplicate key error when captains edit teams
   - Extensive console logging for debugging

4. **Schedule Page Access Control** ([SeasonSchedulePage.tsx](../src/operator/SeasonSchedulePage.tsx))
   - **Operator Detection**: Queries database to check if user is league operator
   - **Navigation Source Detection**: Reads `?from=player` query parameter
   - **Conditional UI**:
     - Operators from league page: "Back to League", show Clear/Accept buttons
     - Players from My Teams: "Back to My Teams", hide Clear/Accept buttons
     - Operators accessing via player route: "Back to My Teams", hide Clear/Accept buttons
   - Read-only view for non-operators

5. **Matches Table Schema** ([matches.sql](../database/matches.sql))
   - Added to `rebuild_all_tables.sql` for future rebuilds
   - Stores individual match/game records for each week
   - Links teams, venues, and season weeks
   - Tracks scores and match status
   - RLS policies for operators and public viewing

**Database Integration**:
- `matches` table now included in rebuild script
- Team readiness calculation: venue existence + roster count
- Player teams query with full nested relationships
- Captain team edit data query with all necessary context

**Bug Fixed**:
- **Captain Team Edit Duplicate Key Error**:
  - Problem: RLS policy prevents captains from deleting themselves
  - Solution: Separate delete/update strategy for captain vs operator variants
  - Captain row preserved and updated instead of deleted/re-inserted

**Files Modified**:
- `/src/player/MyTeams.tsx` - Player teams list with edit functionality
- `/src/components/player/TeamCard.tsx` - Team display with readiness indicator
- `/src/operator/TeamEditorModal.tsx` - RLS-aware roster management
- `/src/operator/SeasonSchedulePage.tsx` - Access control and navigation
- `/database/rebuild_all_tables.sql` - Added matches table
- `/database/matches.sql` - Complete matches table schema
- `/src/utils/playerQueries.ts` - Player team queries
- `/src/navigation/NavRoutes.tsx` - My Teams route

**User Experience Improvements**:
- Captains see clear visual feedback on team readiness
- Specific requirements listed when team is not ready
- Players can view schedules but not modify them
- Back navigation respects user's entry point
- Edit flow works seamlessly for both operators and captains

---

### **✅ COMPLETED: League Detail Page Redesign & Schedule Generation Protection** 🎉
**Implementation Date**: 2025-01-16
**Status**: ✅ **PRODUCTION READY**

**What Was Built**:
- Complete redesign of League Detail page with at-a-glance information cards
- Schedule generation duplicate prevention with modal confirmation
- Expandable team rows showing captain and venue contact information
- Real-time schedule status display with upcoming weeks and holidays

**Key Features Implemented**:

1. **League Overview Card Redesign** ([LeagueOverviewCard.tsx](../src/components/operator/LeagueOverviewCard.tsx))
   - Removed redundant individual fields (game type, league night, etc.)
   - Now displays only current active season information
   - Shows season name, dates, team count, week count, and team format (5-Man/8-Man)
   - Removed duplicate SeasonsCard component from page
   - Compact display taking up less space

2. **Teams Card Enhancement** ([TeamsCard.tsx](../src/components/operator/TeamsCard.tsx))
   - Table layout with columns: Team Name, Captain, Venue
   - Clickable rows with chevron indicators for expansion
   - Expanded state shows:
     - Captain phone number (clickable `tel:` link)
     - Captain email (clickable `mailto:` link)
     - Venue phone number (clickable `tel:` link)
     - Venue full address (street, city, state)
   - Query enhanced to fetch captain phone, email, and venue details
   - Phone numbers formatted as (XXX) XXX-XXXX
   - Single "Manage Teams" button (removed redundant Manage Venues button)

3. **Schedule Card Redesign** ([ScheduleCard.tsx](../src/components/operator/ScheduleCard.tsx))
   - Summary row showing:
     - Weeks completed vs total (e.g., "3/12 played")
     - Season start date (Week 1)
     - Playoffs date (or "Not scheduled")
   - Two-card layout displaying:
     - **Upcoming Weeks Card**: Next 3 weeks with dates
     - **Next Holiday Card**: Upcoming blackout date
   - Console logging added to debug week type distribution
   - Schedule status prevents "Create Schedule" button after first week is played

4. **Schedule Generation Duplicate Prevention** ([ScheduleSetup.tsx](../src/operator/ScheduleSetup.tsx))
   - Pre-check before generating schedule
   - Modal dialog if schedule already exists showing:
     - Number of existing matches
     - "Keep Existing" button (navigates to schedule view)
     - "Create New" button (deletes old schedule and generates fresh one)
   - Prevents accidental duplicate match creation
   - Uses `clearSchedule()` function to clean up before regeneration
   - Added `skipExistingCheck` parameter to generation function

5. **Team Management Venue Creation** ([TeamManagement.tsx](../src/operator/TeamManagement.tsx))
   - "New" button added to League Venues section header
   - VenueCreationModal integrated for inline venue creation
   - No navigation away from team management page
   - Venues refresh after creation

**Critical Bug Fixed**:
- **Duplicate Match Generation**: Previously, navigating back to schedule setup would create duplicate matches
- Now checks for existing matches and prompts user with clear options
- Protects data integrity throughout the schedule generation flow

**Database Query Enhancements**:
- `fetchTeamsWithDetails()` now includes captain phone, email
- `fetchTeamsWithDetails()` now includes venue phone, street_address, city, state
- Type definitions updated in [team.ts](../src/types/team.ts) for TeamWithQueryDetails

**Known Issue Identified**:
- **❗ CRITICAL: Blackout Weeks Replacing Regular Weeks**
  - Problem: When inserting blackout dates, they replace regular weeks instead of being inserted between them
  - Example: 16-week season showing only 12 regular weeks + 4 blackouts (should be 16 regular + 4 blackouts = 20 total)
  - Missing weeks: Week 4, Week 6, Week 10, Week 11 (replaced by blackouts)
  - Impact: Schedule generation creates matches for wrong number of weeks
  - Console log added showing: 12 regular, 4 blackout, 1 season_end_break, 1 playoffs = 18 total (missing 2 weeks)
  - **Next Priority**: Fix season creation logic to INSERT blackouts between regular weeks, not REPLACE them

**Files Modified**:
- `/src/components/operator/LeagueOverviewCard.tsx` - Redesigned to show only current season
- `/src/components/operator/TeamsCard.tsx` - Table layout with expandable contact info
- `/src/components/operator/ScheduleCard.tsx` - Two-card layout with summary row
- `/src/operator/ScheduleSetup.tsx` - Added duplicate prevention modal
- `/src/operator/TeamManagement.tsx` - Added venue creation integration
- `/src/operator/LeagueDetail.tsx` - Removed SeasonsCard, updated imports
- `/src/utils/scheduleGenerator.ts` - Added `skipExistingCheck` parameter and check
- `/src/utils/teamQueries.ts` - Enhanced to fetch captain and venue contact info
- `/src/types/team.ts` - Updated TeamWithQueryDetails interface

---

### **✅ COMPLETED: Schedule Display & Match Generation System** 🎉
**Implementation Date**: 2025-01-15
**Status**: ✅ **PRODUCTION READY - FULL WORKFLOW COMPLETE**

**What Was Built**:
- Complete schedule display page showing all week types (regular, playoffs, blackouts, breaks)
- Schedule generator refactored into testable single-responsibility functions
- Match generation with venue-specific table numbering
- Clear schedule functionality for regeneration
- Accept schedule button to activate season and complete league setup

**Key Features Implemented**:

1. **Schedule Display Page** ([SeasonSchedulePage.tsx](../src/operator/SeasonSchedulePage.tsx))
   - Displays ALL week types (not just regular weeks)
   - Visual styling for different week types:
     - Playoffs: Purple background
     - Breaks: Yellow background with "BREAK" badge
     - Blackouts: Normal styling (no badge per user request)
   - Venue display with "Venue TBD" for unassigned venues
   - Venue-specific table numbering (each venue counts tables independently)
   - Shows "Matchups TBD" for playoff weeks

2. **Schedule Generator Refactor** ([scheduleGenerator.ts](../src/utils/scheduleGenerator.ts))
   - Broke monolithic function into 6 single-responsibility functions:
     - `validateTeams()` - Validates teams array
     - `fetchSeasonWeeks()` - Fetches regular season weeks only
     - `buildTeamPositionMap()` - Creates position-to-team lookup
     - `generateWeekMatches()` - Generates matches for a single week
     - `generateAllMatches()` - Orchestrates match generation for entire season
     - `insertMatches()` - Inserts match records into database
   - Main `generateSchedule()` function now orchestrates these helpers
   - More testable, maintainable, and easier to debug

3. **Venue-Specific Table Numbering**
   - `calculateTableNumbers()` function computes table numbers per venue within each week
   - Example: Week 1 has 5 matches (3 at Venue A, 2 at Venue B)
     - Venue A: Tables 1, 2, 3
     - Venue B: Tables 1, 2
   - Table numbers only shown when venue is assigned

4. **Clear Schedule Functionality**
   - `clearSchedule()` function deletes all matches for a season
   - Returns count of deleted matches
   - Allows operators to regenerate schedule if needed

5. **Accept Schedule & Complete Setup**
   - "Accept Schedule & Complete Setup" button finalizes league creation
   - Updates season status from `'upcoming'` to `'active'`
   - Navigates user back to league dashboard
   - Completes the entire league generation workflow

**Navigation Flow**:
```
League Creation Wizard → Season Creation → Team Management → Schedule Setup →
Schedule Generation → Schedule Display → Accept Schedule → League Dashboard (Active)
```

**Database Integration**:
- Matches table stores all generated matchups
- Links to season_weeks, teams, and venues tables
- RLS policies ensure operators can only access their own league's matches
- Season status updated to 'active' when schedule is accepted

**Files Modified**:
- `/src/operator/SeasonSchedulePage.tsx` - Complete schedule display with accept/clear functionality
- `/src/utils/scheduleGenerator.ts` - Refactored into testable functions, added clearSchedule()
- `/src/operator/ScheduleSetupPage.tsx` - Wrapper page for schedule generation
- `/src/navigation/NavRoutes.tsx` - Added schedule routes

**Known Issues to Address Next**:
1. **Week 17 + Playoffs Duplication**: Season wizard creating both "Week 17" AND a separate "Playoffs" week
   - Should only have one playoff week
   - Need to fix season creation logic

2. **Blackout Week Names**: Week names include parenthetical warnings like "Thanksgiving (Monday 2 days before)"
   - These warnings should not be stored in the database
   - Need to clean up week name generation in season wizard

**User Experience Improvements**:
- Season schedule subtitle shows only season name (removed redundant league name)
- Playoff weeks clearly marked with purple background and "Matchups TBD" message
- Blackout weeks display cleanly without badges or red coloring
- Clear confirmation dialogs for both clearing and accepting schedule

---

### **🎯 NEXT: Fix Season Week Storage Issues**
**Priority**: High
**Focus**: Season Creation Wizard data quality issues

**Problems Identified**:
1. **Duplicate Playoff Week**
   - System creating "Week 17" (marked as regular) AND "Playoffs" week
   - Should only have 16 regular weeks + 1 playoff week for a 16-week season
   - Issue in [scheduleUtils.ts](../src/utils/scheduleUtils.ts) or wizard logic

2. **Week Name Pollution**
   - Blackout week names storing UI warnings: "Thanksgiving (Monday 2 days before)"
   - These parenthetical notes should be UI-only, not database values
   - Need to separate display text from stored data in [SeasonCreationWizard.tsx](../src/operator/SeasonCreationWizard.tsx)

**Investigation Needed**:
- Review [scheduleUtils.ts](../src/utils/scheduleUtils.ts) `generateSchedule()` function
- Check how `seasonLength` parameter is being used
- Verify week type assignment logic
- Clean up week name generation to remove conflict warnings before database insert

---

### **Previously Completed: Season Creation Database Schema & Wizard Integration** 🎉
**Implementation Date**: 2025-01-11
**Status**: ✅ **PRODUCTION READY - TESTED IN LOCAL DATABASE**

**What Was Built**:
- Complete database schema for season scheduling with normalized table structure
- Season creation wizard now saves to database (seasons + season_weeks tables)
- Unified season_weeks table storing all calendar dates (regular, blackouts, playoffs, breaks)
- Transaction-like rollback behavior if weeks insertion fails
- Successful test: Created season with 20 weeks in local Supabase

**Database Architecture**:
- **seasons table**: Simple metadata (season_name, dates, length, status)
  - Removed holidays/championships columns - fetched on-demand
  - Each season just tracks basic info

- **season_weeks table**: Unified calendar storage
  - Each row = one calendar date
  - `week_type`: 'regular' | 'blackout' | 'playoffs' | 'season_end_break'
  - `week_completed`: Boolean for locking past weeks from editing
  - `scheduled_date`: Primary sort key (no week_number needed)
  - Blackout weeks visible to users with reason displayed

**Key Design Decisions**:
1. **One Table for All Weeks**: Regular + blackouts + playoffs all in season_weeks
   - User sees full calendar including skipped dates with reasons
   - Easy add/remove blackouts by inserting/deleting rows
   - Sortable by date, no artificial week numbering

2. **Fetch Holidays/Championships On-Demand**: Not stored in seasons table
   - Operator re-evaluates skip/play decision each edit session
   - Championships can change - always fetch latest
   - Final decision baked into season_weeks as blackout rows or absence

3. **week_completed Column**: Fast locking mechanism
   - Boolean check prevents editing past weeks
   - Updated when all matches for week are scored
   - No need to query match_results table for every week

4. **Rollback Protection**: Manual transaction-like behavior
   - If weeks insertion fails, season record is deleted
   - Either both succeed or neither exists in database
   - Console logs show rollback process

**Type Mapping Fix**:
- UI uses `type: 'week-off'` generically
- Database expects specific types: 'season_end_break' | 'blackout'
- Wizard maps: schedule week-offs → 'season_end_break', blackout week-offs → 'blackout'

**Deduplication**:
- Schedule and blackoutWeeks kept separate in UI
- Deduplicated before database insert (blackout takes precedence)
- Prevents unique constraint violations on (season_id, scheduled_date)

**Files Created/Modified**:
- `/database/seasons.sql` - Clean seasons table (no schedule/holidays/championships)
- `/database/season_weeks.sql` - Unified calendar table with week_type and week_completed
- `/database/README_DATABASE_INTEGRATION.md` - Complete integration guide for partner
- `/src/types/season.ts` - Updated Season and SeasonWeek interfaces
- `/src/operator/SeasonCreationWizard.tsx` - Full database integration with rollback
- `/memory-bank/databaseSchema.md` - Updated with new schema design

---

### **Previously Completed: Schedule Conflict Detection Refactoring** 🎉
**Implementation Date**: 2025-01-10
**Status**: ✅ **PRODUCTION READY**

**What Was Built**:
- Extracted ~180 lines of duplicated conflict detection logic into shared utilities
- Created centralized constants for magic numbers and severity ordering
- Broke complex functions into small, testable, single-purpose helpers
- Two-pass algorithm for "closest league night only" conflict detection

**DRY Violation Eliminated**:
- Before: ScheduleReview.tsx and SeasonCreationWizard.tsx had duplicate code
- After: Single source of truth in `/src/utils/conflictDetectionUtils.ts`
- Impact: Bug fixes now only needed once, testing burden halved

**Files Created/Modified**:
- `/src/constants/scheduleConflicts.ts` - CONFLICT_DETECTION_THRESHOLD_DAYS, SEVERITY_ORDER, STORAGE_KEYS
- `/src/utils/conflictDetectionUtils.ts` - 6 helper functions (detectScheduleConflicts, buildConflictList, etc.)
- `/src/components/season/ScheduleReview.tsx` - Reduced from ~140 lines to ~20 lines
- `/src/components/season/ScheduleWeekRow.tsx` - Uses getHighestSeverity() helper
- `/src/operator/SeasonCreationWizard.tsx` - Uses shared conflict detection

---

## Active Decisions and Considerations

### **🚨 CRITICAL: Matchup Tables - Use Existing Tables ONLY**
**Decision**: ALWAYS use pre-built matchup tables from `/src/data/matchupTables/`
**Rationale**:
- **NO ALGORITHMS**: Never generate matchups algorithmically
- **NO CUSTOM TABLES**: Never create or compute matchup tables
- Pre-built tables exist for 4-40 teams (every even number)
- Tables are deterministic and tested
- If season is longer than table cycle length, **wrap around** to week 1 and repeat
  - Example: 6-team table has 35 weeks. For a 40-week season, use weeks 1-35, then repeat weeks 1-5
- Use `getMatchupTable(teamCount)` from `/src/utils/matchupTables.ts`
- Table format: `[[1,2], [3,4], [5,6]]` where numbers are team positions

**IMPORTANT**: This is a hard requirement. Do not suggest or implement algorithmic matchup generation under any circumstances.

### **Unified Calendar vs Separate Tables**
**Decision**: One unified season_weeks table for all week types
**Rationale**:
- User wants to see full calendar including blackouts
- Simplifies display logic (one query, sort by date)
- Easy add/remove blackouts (just insert/delete rows)
- Same structure for all week types (flexible, queryable)

### **Store Championships or Fetch On-Demand?**
**Decision**: Fetch on-demand, don't store in seasons table
**Rationale**:
- Championship dates subject to change (operator needs latest data)
- Operator re-evaluates skip/play decision during each edit session
- Final decision baked into season_weeks (blackout or absence)
- Keeps seasons table simple and focused

### **Week Numbering Strategy**
**Decision**: No week_number column, sort by scheduled_date
**Rationale**:
- Date is natural sort key
- No artificial week numbering to maintain
- Blackout weeks have dates but no week numbers
- Simpler schema, easier queries

### **Week Completion Tracking**
**Decision**: Boolean column on season_weeks table
**Rationale**:
- Fast check for locking past weeks (no join to match_results)
- Set to true when all matches scored
- UI disables editing for completed weeks
- Prevents accidental changes to finished weeks

### **Venue-Specific Table Numbering**
**Decision**: Calculate table numbers per venue within each week
**Rationale**:
- Multiple venues can host matches simultaneously
- Each venue needs independent table numbering (Table 1, Table 2, etc.)
- Calculated on display, not stored in database
- More flexible for venue changes

---

## TODOs for Jack

### Player Information Card - Grid Layout Fix
**File**: `src/operator/PlayerManagement.tsx` (line ~408)
**Issue**: The 2-column grid for player info fields (Name, Nickname, Phone, Email, etc.) has too aggressive a breakpoint. Currently using `min-[320px]:grid-cols-2` but it still wraps to 1 column when there's visually enough space for 2.
**Goal**: Make it stay 2 columns longer on narrow screens, but still wrap to 1 column when content would be truncated/hidden.
**Current CSS**: `grid grid-cols-1 min-[320px]:grid-cols-2 gap-x-2 gap-y-3`
**Notes**:
- Ed wants max 2 columns, min 1 column
- The gap is already tight (8px horizontal)
- May need CSS container queries or a different approach

---

## Current Status Summary

✅ **Database Schema**: Complete, tested, production-ready
✅ **Season Creation Wizard**: Full database integration working
✅ **Conflict Detection**: Refactored, tested, DRY principle applied
✅ **Schedule Generation**: Refactored into testable functions
✅ **Schedule Display**: Complete with all week types, venue-specific tables
✅ **Match Generation**: Working with proper team position mapping
✅ **Clear Schedule**: Allows regeneration of matches
✅ **Accept Schedule**: Activates season and completes league setup
✅ **League Creation Flow**: End-to-end workflow complete
🔄 **Season Week Storage**: Next - fix duplicate playoff week and clean week names
🔜 **Mobile App**: Partner will mirror database operations for scorekeeping

---

## Parked Branches (Don't Forget!)

### `mid-dec-cleanup` branch
**Status**: Committed locally, NOT pushed
**Contains**: Wide variety of cleanup changes
**Why parked**: Waiting for another PR to merge first - will likely have conflicts
**Action needed**: After other PR merges, come back to this branch and handle conflicts

---

## Planned Features (Not Yet Started)

### Placeholder Players Feature
**Status**: Planning complete, implementation not started
**Plan document**: [PLAN-placeholder-players.md](./PLAN-placeholder-players.md)
**Summary**: Allow creating "placeholder" players who can be on teams and have games scored without being registered users. When the real person registers, they can be connected via invite link or operator merge.
**First step when ready**: Database migration to make phone/email/address/zip/dob nullable on members table
