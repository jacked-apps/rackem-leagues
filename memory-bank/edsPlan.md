============================================================
🚨 CRITICAL: Team Deletion Cascade Issue
============================================================

**Discovered:** 2026-04-09 during wizard 2.0 planning

**The problem:**
Database schema has `ON DELETE CASCADE` on `matches.home_team_id` and
`matches.away_team_id`. Deleting a team in `TeamManagement.tsx` silently
destroys ALL of that team's scheduled matches for the season, breaking
other teams' weekly schedules and any season standings/history.

**Current state (temporary mitigation in place):**
- Confirmation dialog message has been updated to honestly warn the user
  that match destruction will occur (was previously misleading — only
  mentioned losing the team and roster)
- Inline TODO comments added to `src/operator/TeamManagement.tsx`
  → `handleDeleteTeam` function

**This is NOT a real fix.** The honest warning prevents accidental
destruction, but the underlying cascade is still dangerous.

**Possible real fixes (Ed to decide):**
1. Block deletion entirely if the team has any matches in the season.
   Force operator to use a different workflow (replacement, regenerate
   schedule, etc.).
2. Soft delete pattern — mark team as `deleted_at` instead of removing
   the row. Matches stay intact but team is hidden from active views.
3. Team replacement workflow — UI that swaps a deleted team with a
   replacement team in all match records before deletion.
4. Combination: soft delete + replacement workflow + hard delete only
   when there are no matches.

**Files affected when fixing:**
- `src/operator/TeamManagement.tsx` (delete handler)
- Database schema: `matches` table foreign keys
- Possibly add a `deleted_at` column to `teams` if going soft-delete route

**Severity:** HIGH — could destroy season data with one click. Mid-season
team drops are a real scenario this needs to handle correctly.

============================================================

==== Message System ======

#

    8. optimize
        make sure components follow
        Kiss
        Dry
        small single responsibility
        reusable
        easily testable

=============COMPLETED: CAPTAINS MANAGE TEAM FLOW===============

1. ✅ players league and team pages
2. ✅ have a special button for captains to be able to manage their team/teams
3. ✅ they will need to be able to:
   change team name
   add/remove players
   change/select home venue
4. ✅ make sure changes update every where they need to. ie change of venue will change the schedule as that shows where matches are played.

ux. most members/users are players in a pool league. from the dashboard they will want to be able to get to all of the pages they might need for a league. first should be a list of the leagues they are playing in. the teams they are on. the schedule for those leagues, and the score keeping page for when they are actually playing their matches (an early version of the schedule page exists already but not the rest). in order for us to get to the captains being able to manage their team we need to build the league list (to choose which league they want to work with) and then the team page. captains will just have an visible edit button for the team, regular players will not. the flow for the edit team should already exist with the team wizard so we should be able to bite from that. there is at least some data in the database already for everything we will need for our purposes. most of the functions for the db should also be here some where. hopefully in a designated place

-- future shit 6. consistent modal
use the same modal as in other places in the code some have blacked out the background outside of the modal. i think some others you could see behind it.

5. fix login/register password attribute issue in the console
   Input elements should have autocomplete attributes (suggested: "current-password"): (More info: https://goo.gl/9p2vKq) <input type=​"password" data-slot=​"input" class=​"file:​text-foreground placeholder:​text-muted-foreground selection:​bg-primary selection:​text-primary-foreground dark:​bg-input/​30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow]​ outline-none file:​inline-flex file:​h-7 file:​border-0 file:​bg-transparent file:​text-sm file:​font-medium disabled:​pointer-events-none disabled:​cursor-not-allowed disabled:​opacity-50 md:​text-sm focus-visible:​border-ring focus-visible:​ring-ring/​50 focus-visible:​ring-[3px]​ aria-invalid:​ring-destructive/​20 dark:​aria-invalid:​ring-destructive/​40 aria-invalid:​border-destructive pr-10" id=​"password" placeholder=​"Enter your password" required value>​

6. check about email verification requirement

Medium Priority
Component Extractions - TeamCard, TeamRosterList, VenueListItem, ConfirmDialog (200+ lines saved, massive reusability gains)
Separate Create/Update Logic - Better testability

7. fix modals
   TODO add loading empty state to
   DayOfWeekWarningModal - Simple confirmation modal
   VenueLimitModal - Standard modal with form
   DeleteLeagueModal - Warning modal with confirmation
   DeleteSeasonModal - Similar pattern
   WeekOffReasonModal - Form modal
   SetupGuideModal - Content modal
   SecurityDisclaimerModal - Info modal

may need adjusting for other modals.

8. Build warnings - large chunk sizes
   - ScheduleReviewTable chunk: 1.3MB (includes date-fns library)
   - Main index chunk: 1.0MB
   - Dynamic import warnings for supabaseClient.ts and handicapCalculations.ts
   - Consider: manual chunking, lazy loading more components, or tree-shaking date-fns imports
   - NOT blocking deployment, but affects initial load performance
