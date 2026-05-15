# List for Ed

Tasks and refactoring items for Ed to work on.

---

## 🚨 CRITICAL BUG: Team Deletion Destroys Matches

**Discovered:** 2026-04-09 during wizard 2.0 planning
**Severity:** HIGH — could destroy season data with one click
**Branch needed:** `fix-team-cascade-deletion`

**The problem:**
The `matches` table has `ON DELETE CASCADE` on both `home_team_id` and
`away_team_id` foreign keys. When a team is deleted via
`src/operator/TeamManagement.tsx` → `handleDeleteTeam`, the database
silently destroys ALL of that team's scheduled matches for the season.
This breaks other teams' weekly schedules and orphans season standings
that reference the destroyed matches.

**Current state (mitigation only — NOT a real fix):**

- Confirmation dialog message has been updated to honestly warn about
  match destruction (was previously misleading — only mentioned losing
  the team and roster)
- Inline TODO comments added to `src/operator/TeamManagement.tsx` →
  `handleDeleteTeam` function
- Cascade warning added to `memory-bank/databaseSchema.md`
- Critical entry added to `memory-bank/edsPlan.md`
- Warning callout added to `memory-bank/activeContext.md`

**Possible real fixes (Ed to choose approach):**

1. **Block deletion entirely** if the team has any matches in the season.
   Force operator to use a different workflow (replacement, regenerate
   schedule, etc.). Safest, simplest.
2. **Soft delete pattern** — add `deleted_at` column to `teams`. Mark as
   deleted instead of removing the row. Matches stay intact but team is
   hidden from active views.
3. **Team replacement workflow** — UI that swaps a deleted team with a
   replacement team in all match records before deletion happens.
4. **Combination:** soft delete + replacement workflow + hard delete only
   when there are no matches.

**Files involved when fixing:**

- `src/operator/TeamManagement.tsx` (delete handler — has TODO comments)
- Database schema: `matches` table foreign keys (cascade behavior)
- Possibly add a `deleted_at` column to `teams` if going soft-delete route
- Any queries that filter teams may need to add `WHERE deleted_at IS NULL`

**When this matters:**

- Mid-season team drops (real scenario this needs to handle)
- Operator mistakes (clicking delete on wrong team)
- Cleanup of stale/test teams that have associated matches

**Until this is fixed:**
The honest warning message prevents accidental destruction, but the
underlying cascade is still dangerous. Treat team deletion as
destructive and avoid it on real seasons until a proper fix lands.

---

## 1. Refactor PlayerNameLink Component

**Branch needed:** `refactor-player-name-link`

**Problem:** The component has a messy prop interface - passing separate pieces (`playerId`, `playerName`) while also fetching data internally. This is the worst of both worlds.

**Current props:**

- `playerId` - required
- `playerName` - required (but also fetched internally)
- `className` - optional styling
- `onSendMessage` - never used
- `onReportUser` - never used
- `onBlockUser` - never used
- `customActions` - extension point

**Solution:** Pass the whole player record instead of pieces.

**New interface:**

```tsx
interface PlayerNameLinkProps {
  player: {
    id: string;
    first_name: string;
    last_name: string;
    user_id: string | null; // null = placeholder
    email?: string | null;
    membership_paid_date?: string | null;
    starting_handicap_3v3?: number | null;
    starting_handicap_5v5?: number | null;
  };
  className?: string;
  customActions?: CustomAction[];
}
```

**Changes needed:**

1. Update `PlayerNameLink` to accept `player` prop instead of `playerId`/`playerName`
2. Remove unused callback props (`onSendMessage`, `onReportUser`, `onBlockUser`)
3. Remove internal fetch for `playerBasicData` (already have it from prop)
4. Remove internal fetch for `playerOperatorData` (already have it from prop)
5. Keep `isBlocked` fetch (that's user-specific, not player data)
6. Update all call sites to pass `player={player}` instead of `playerId={player.id} playerName={...}`

**Note on existing hooks:**

- `useMemberById(playerId)` already exists in `src/api/hooks/useCurrentMember.ts:166`
- It uses `queryKeys.members.detail(memberId)` and fetches the full member record
- Currently the component has TWO custom inline fetches (lines 93-108 and 118-131) that should just use the existing hook
- But if we pass the whole player record, we don't need ANY fetch - the parent already has the data

**Files to update:**

- `src/components/PlayerNameLink.tsx` - main component
- All files that use `<PlayerNameLink>` (search for usages)

---

## 2. Consolidate ALL Queries - Return Full Records

**Branch needed:** `consolidate-queries`

**Problem:** We have multiple query functions for the same entities that each fetch different subsets of fields. This leads to:

- Code duplication across queries
- Inconsistent data shapes in different parts of the app
- Need to add fields to multiple places when requirements change (like we just did with `user_id` for members)
- Components making multiple fetches to get different pieces of the same record
- Query cache fragmentation (same entity cached multiple times with different shapes)

**This applies to ALL our entities, not just members:**

- Members/Players
- Teams
- Leagues
- Seasons
- Matches
- Venues
- Organizations
- etc.

**Current anti-pattern (example with members):**

- `fetchPlayerDetails()` in `players.ts` - fetches specific fields for operator page
- `useMemberById()` in `useCurrentMember.ts` - fetches different fields
- Various inline fetches in components
- Each query has its own field list that drifts out of sync

**Solution:** For each entity type, create ONE canonical query that returns the full record every time.

**Proposed approach:**

1. For each entity, create a single `use[Entity](id)` hook that returns the complete record
2. Define canonical types with ALL fields for each entity
3. All components use these hooks - they just use the fields they need
4. Queries are cached by entity ID, so multiple components share the cache

**Benefits:**

- DRY - one query function per entity, one type per entity
- Consistent data shape everywhere
- Adding a new field = one place to update
- Better cache utilization (one cached record vs multiple partial records)
- Components never need to refetch because "this query doesn't have that field"
- Easier to reason about data flow

**Pattern to follow:**

```tsx
// One type per entity with ALL fields
interface Member { /* all fields */ }
interface Team { /* all fields */ }
interface League { /* all fields */ }
interface Season { /* all fields */ }
// etc.

// One hook per entity
const { data: member } = useMember(memberId);
const { data: team } = useTeam(teamId);
const { data: league } = useLeague(leagueId);
// etc.

// Components just use what they need
<div>{member.first_name}</div>
<div>{team.team_name}</div>
```

**Files to audit and consolidate:**

- `src/api/queries/*.ts` - all query files
- `src/api/hooks/*.ts` - all hook files
- Inline fetches scattered in components

**Priority order:**

1. Members (most fragmented currently)
2. Teams
3. Leagues/Seasons
4. Everything else

**Mutation strategy - always stay up to date:**

Every mutation should either:

1. **Optimistic updates** - Update the cache immediately, rollback on error
2. **Invalidate & refetch** - Invalidate the relevant query keys so data is refetched

Never leave stale data in the UI after a mutation. Pick the approach based on UX needs:

- Use optimistic for instant feedback (toggling, simple updates)
- Use invalidate for complex updates where server response matters

```tsx
// Option 1: Optimistic update
const mutation = useMutation({
  mutationFn: updateMember,
  onMutate: async (newData) => {
    await queryClient.cancelQueries({ queryKey: ['member', id] });
    const previous = queryClient.getQueryData(['member', id]);
    queryClient.setQueryData(['member', id], newData);
    return { previous };
  },
  onError: (err, newData, context) => {
    queryClient.setQueryData(['member', id], context.previous);
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['member', id] });
  },
});

// Option 2: Invalidate & refetch (simpler, always correct)
const mutation = useMutation({
  mutationFn: updateMember,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['member', id] });
    // Also invalidate any lists that include this entity
    queryClient.invalidateQueries({ queryKey: ['members'] });
  },
});
```

**Current problem areas:**

- Some mutations don't invalidate queries at all
- Some invalidate partial query keys but miss related queries
- No consistent pattern across the codebase

---

## Future Items

(Add more items here as needed)

---

## 3. Automated Championship Date Reminders

**Branch needed:** `championship-date-reminders`
**Discovered:** 2026-04-16

**Problem:** BCA and APA national championship dates need to be entered into
the `championship_date_options` table each year. Easy to forget, and missing
dates means the schedule wizard can't flag conflicts for those weeks.

**Solution:** Supabase Edge Function on a cron schedule that checks if
upcoming year's dates are missing and sends reminder emails to devs.

**Reuse existing infrastructure:**

- Resend is already set up (see `supabase/functions/send-invite/index.ts`)
- `RESEND_API_KEY` env var already configured
- Email send pattern can be copied directly

**Implementation:**

1. Create `supabase/functions/check-championship-dates/index.ts`
2. Function queries `championship_date_options` for upcoming year
3. If missing → call Resend API to send reminder
4. Schedule via Supabase cron (monthly Sept-Nov for BCA, Jan-Apr for APA)

**Recipients:** Either env var (`DEV_NOTIFICATION_EMAILS`) or new
`dev_notification_recipients` table.

**Effort:** ~50 lines of code. Hardest part is configuring the cron in Supabase.

**Reference:** See `memory-bank/plans/TODO-championship-date-reminders.md`
for full details.

---

## 4. Better Dashboard Button on Home Page

**Discovered:** 2026-04-17

**Problem:** The home page needs a more prominent / better-designed button
to navigate to the operator dashboard. Current one is easy to miss.

**Fix:** Redesign the dashboard navigation on the home page to be more
visible and obvious.

---

## 5. Refactor TeamManagement.tsx (too big)

**Branch needed:** `refactor-team-management`
**Discovered:** 2026-04-16

**Problem:** `src/operator/TeamManagement.tsx` is ~800 lines. Hard to navigate,
hard to test, violates the project's "under 100 lines" preference. Does a lot:
venue assignment, team creation/editing, roster management, team importing,
bulk actions, table number assignments.

**Goal:** Break it down into smaller, focused components.

**Suggested splits:**

- `VenueAssignmentSection.tsx` — assigning venues to the league
- `TeamList.tsx` — displaying teams, expansion state
- `TeamEditorModal.tsx` — already exists, keep
- `TeamImportSection.tsx` — copy from previous season
- `useTeamManagementActions.ts` — extract handlers into a hook
- `TeamManagement.tsx` — orchestrator, under 100 lines

**Effort:** Medium. Mostly extraction, no logic changes.

---

## 6. Wizard: Placeholder Captain Not Auto-Assigned + Dropdown Stale

**Discovered:** 2026-04-19
**Severity:** Low — has a workaround (refresh the page)

**Problem:** In the league/season creation wizard, when creating a placeholder
player on the fly to set as team captain:

1. The PP is created successfully, but it is NOT assigned as the team captain
   like it should be.
2. The newly created PP does not appear in the captain dropdown until the
   page is refreshed (cache isn't invalidated after the create mutation).

**Workaround:** Refresh the page after creating the PP, then manually select
them from the dropdown as captain.

**Likely fix:**

- After `createPlaceholderMember()` mutation succeeds, invalidate the relevant
  members/captains query keys so the dropdown refetches.
- Wire the auto-captain-assignment: on PP create success inside the captain
  flow, also call the "set captain" mutation with the new PP's id.

**Files likely involved:** _(truncated in restoration — you filled these in originally; add them back when you revisit this item)_
