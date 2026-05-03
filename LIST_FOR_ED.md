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
    user_id: string | null;  // null = placeholder
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

---

## 7. New Org Not Visible on Dashboard After LO Application

**Discovered:** 2026-05-02 during modular-league-system test pass
**Severity:** Low — has a workaround (refresh the page)
**Branch:** future bugfix branch

**Problem:** After completing the League Operator application form, the
flow redirects to the dashboard. The just-created org doesn't appear in
the org list until the page is manually refreshed.

**Likely cause:** Cache isn't invalidated after the create-org mutation
finishes — TanStack Query's stale data wins until next refetch.

**Likely fix:** In whichever mutation handles "complete LO application
+ create org" (probably `createOrganization` or `becomeOperator`),
add `queryClient.invalidateQueries({ queryKey: ['organizations'] })`
(or whatever key the dashboard's org-list query uses) on success.

**Files likely involved:** the LO application submit handler + the
dashboard's org-list query.

---

## 8. Org Dashboard Loads Scrolled Below the Top

**Discovered:** 2026-05-02 during modular-league-system test pass
**Severity:** Low (cosmetic)
**Branch:** future bugfix branch

**Problem:** When navigating to an org's operator dashboard, the page
loads scrolled partway down — the user has to scroll up to see the
header / top of the screen.

**Likely cause:** Some on-mount effect (focus, scrollIntoView, default
section anchor) is jumping past the top, OR a previous page's scroll
position is being restored without resetting.

**Likely fix:** Add `window.scrollTo(0, 0)` on the operator dashboard
component mount, OR audit any `useEffect` that calls `scrollIntoView`
or sets `element.scrollTop`.

**Files likely involved:** `src/operator/OperatorDashboard.tsx` (or
wherever the org dashboard lives) — check for scroll-related effects
on mount.

---

## 9. First-Lineup-Lock Stuck on Match Setup (Pre-Existing Intermittent)

**Discovered:** before 2026-04-01 (long-running)
**Re-confirmed:** 2026-05-02 during modular-league-system test pass
**Severity:** Medium — has a workaround ("Try Again" succeeds)
**Branch:** future bugfix branch — investigation needed

**Problem:** When the FIRST team (typically home team in 3v3 default
configs) locks their lineup, the screen gets stuck on "Match Setup."
Clicking the "Try Again" button succeeds on the retry. Has happened
across many sessions before this branch — not caused by the modular-
league-system work.

**What we know:**
- The `prep_match` RPC has retry logic baked in (3 attempts with
  exponential backoff — see
  `supabase/migrations/20260424000000_prep_match_rpc.sql`).
- "Try Again" works → the underlying RPC eventually succeeds, so it's
  not a permanent failure (auth, schema mismatch, missing data).
- Pattern looks like a race condition: away team's lineup row may not
  yet exist / be queryable from the home team's auth context when
  home locks first.

**Investigation hints for the bugfix branch:**
- Check `useMatchPreparation.ts` — the home-team-runs-prep-match
  branch + the await-realtime-on-away-side branch.
- Check `match_lineups` row creation timing — the
  `trigger_auto_create_match_lineups` should produce both lineup rows
  on match insert. Confirm both are visible to the home-team auth
  user when the lock-lineup mutation fires.
- Add structured logging at each prep_match attempt (current logs are
  there but not capturing all the timing context that would help).
- Capture the exact error from the FAILED attempts (the toast just
  says "Try Again" — the original error gets swallowed).

**Files likely involved:**
`src/hooks/lineup/useMatchPreparation.ts`,
`supabase/migrations/20260424000000_prep_match_rpc.sql`,
the `trigger_auto_create_match_lineups` definition.

**Repro data points (correlate FIRST-locker, not home/away role):**
- 2026-05-02 run #1 — home locked FIRST → got stuck on Match Setup,
  "Try Again" succeeded.
- 2026-05-02 run #2 — home locked SECOND → no issue, both went in
  cleanly.
- 2026-05-02 run #3 (post supabase restart) — home locked FIRST →
  prep failed again, "Try Again" succeeded. Reproduces consistently
  on first-locker.

The pattern strengthens the race-condition hypothesis: it's the team
that locks FIRST that hits the failed prep_match attempt, regardless
of home/away role. The team locking SECOND finds the lineup state
fully populated and prep_match runs cleanly. The first locker may be
racing the realtime visibility of their own commit OR the auth-context
visibility of the second team's lineup row.

---

## 10. Scoreboard Number Layout Confusing — Threshold Duplicated

**Discovered:** 2026-05-02 during modular-league-system test pass
**Severity:** Low (cosmetic / UX)
**Branch:** future bugfix branch — UI tweak only

**Problem:** The scoreboard currently displays threshold info as
`{threshold}/{games left needed to win}` — e.g. `11/8` for a team
needing 11 wins that has 8 to go. The threshold (`11`) is also shown
on its own ABOVE this number. Reading the slash-separated pair as
"out of" is the natural user instinct ("11 out of 8"?), which makes
the display read backwards from the LO's expectation.

**Proposed fix:** Switch to `{games won}/{threshold}` — e.g. `3/11`
for a team that's won 3 games and needs 11 to win the match. Drops
the redundant threshold-above + reads naturally as "3 out of 11."

Alternative: drop the slash format entirely and just show the
single most-relevant number ("8 to go") with the threshold as a
subtitle.

**Files likely involved:**
- `src/components/scoring/ThreeVThreeScoreboard.tsx`
- `src/components/scoring/FiveVFiveScoreboard.tsx`
- `src/components/scoring/TenSevenScoreboard.tsx`
- Any shared score-display component they pull from

---

## 11. Architectural Decision — Where Should the Live Scoreboard Read From?

**Discovered:** 2026-05-02 during modular-league-system test pass
**Severity:** Architectural — discuss with Jack before deciding
**Branch:** discussion first; decision could be a follow-up branch

**Context:**
Phase 5 Unit 5.5 of the modular-league-system v2 plan introduced
"match record is the source of truth" — `home_games_won` /
`away_games_won` / `home_points_earned` / `away_points_earned`
columns get updated per-game by `updateMatchRunningTotals` after
every confirmed scoring mutation.

The plan spec only refactored TWO consumers to read from the match
row:
  - `MatchEndVerification` (final-screen scoreboard)
  - `useSpectateMatch` (third-party spectator view)

The LIVE player-scoring view (`useMatchScoring` → `ScoreMatch.tsx`)
was NOT switched. It still does an in-memory recompute from
`match_games` rows via `getTeamStats` / `calculatePoints`. The two
should agree (the writer keeps the match row in sync), but only
because they're computed from the same underlying data — not because
the live view actually reads the match row.

**Tension:**
- Pro current setup: live scoreboard is correct by construction
  (counting rows you can see). If the writer is silent, the match
  row is wrong but the player-witnessed scoreboard is right.
- Con current setup: if the writer breaks, the live ticker LOOKS
  fine but the match row is wrong — only surfaces at the
  post-completion audit. Bit me 2026-05-02 when the calculator
  registry was empty at runtime: live scoreboard kept ticking,
  match row stayed at 0/0/0/0, audit flagged the divergence at
  match-end.

**What's done about the writer reliability:**
- Calculator registry now self-registers at module load (commit
  `042978c`). The empty-registry bug is fixed.
- prep_match RPC also flips status to 'in_progress' so the matches
  row reflects the right state during play (commit `80c53f6`).

**Question to discuss with Jack:**
- Keep live scoring on the in-memory recompute (option 2 — current
  state)? "Match row is finalization truth, live ticker is derived
  in real-time and the writer keeps them aligned."
- OR finish the architectural refactor — switch `useMatchScoring`
  to read from the match row too (option 1)? "One source of truth
  end-to-end."

Option 2 is what's shipped now. Option 1 is meaningful work
(~1 hour, touches the live-scoring hot path) and adds latency
between scoring write → DB round-trip → re-render. Audit divergence
in dev caught the writer bug; same audit will catch any future
writer bugs in prod, so option 2 + monitor `app_logs` may be
enough.

---

## 12. One-Team Screen Flashes / Rapidly Re-renders Around Tiebreaker

**Discovered:** 2026-05-02 during modular-league-system test pass
**Severity:** Medium — has a workaround (browser refresh)
**Branch:** future bugfix branch — investigation needed
**Status:** Partial fix landed in modular-league-system branch
(`stableMatchForMutations` in ScoreMatch.tsx, commit `825e90f`).
Deeper investigation (MatchLineup.tsx + WebSocket container health)
deliberately deferred from the 2026-05-02 test pass to a dedicated
bugfix branch. Refresh remains a working manual workaround.

**Problem:** During the tiebreaker flow, one team's screen flashes
and re-renders rapidly. Two distinct moments observed:

1. **Tiebreaker SETUP (first observation 2026-05-02 run):** away team
   (Smitty) screen flashed at the moment of tiebreaker game creation
   (right after both teams verified the regular games and 9-9 tie was
   detected, while the system was creating games 19/20/21 + unlocking
   lineups). Browser refresh stabilized.

2. **Tiebreaker LINEUP page (second observation, same date, run 2):**
   home team on phone, lineup page flashed locked/not-locked while
   player slot dropdowns were unselectable. The OTHER team's incognito
   Chrome window worked normally — could enter players, lock, unlock at
   will. Refresh on the phone resolved it.

The asymmetry (only one team's device flashes; the other works fine) +
refresh-as-workaround tells us: **bad client React state on one device,
not a server-side loop.** Some hook is stuck in a stale-subscription /
stale-effect cycle that gets reset on a fresh page load.

**Partial fix applied during the same test pass:**
`ScoreMatch.tsx` was passing the full `match` object to mutations.
After Phase 5 Unit 5.5 added per-game writes to the matches row, every
confirmation triggered a refetch → new `match` identity → callback
identities changed → realtime hooks resubscribed → re-render cascade.
Memoized `stableMatchForMutations` in commit `825e90f` to break that
chain on the scoring page.

**That fix didn't cover the lineup page.** `MatchLineup.tsx` +
`useMatchPreparation` have their own realtime subscriptions and prop-
threading patterns. Same family of bug expected to need similar
treatment (memoize the props passed to lineup-page hooks, or audit
the effect deps).

**Hypothesis (still):** Realtime subscription bouncing — some prop
identity change (likely from a realtime-driven query refetch) cycles
through the hook deps → resubscribes → replays event → re-renders.

**Console evidence from setup observation:**
- Repeated `[linear_above_threshold] params failed zod validation`
  warnings (cosmetic only — calculator falls back to default
  multiplier=1)
- Stack traces showing `confirmOpponentScore` → `updateMatchRunningTotals`
  firing repeatedly
- `[useMatchRealtime] Cleaning up` — realtime channel teardowns

**Console evidence at the time:**
- Repeated `[linear_above_threshold] params failed zod validation`
  warnings (cosmetic only — calculator falls back to default
  multiplier=1)
- Stack traces showing `confirmOpponentScore` → `updateMatchRunningTotals`
  firing repeatedly
- `[useMatchRealtime] Cleaning up` — realtime channel teardowns

**Investigation hints:**
- Check the polling logic in `useMatchPreparation.ts` (the away-team
  branch that watches for tiebreaker games to appear)
- Check `useMatchRealtime` for any cycle where a subscription update
  triggers a re-subscribe
- The MatchEndVerification's tied-match polling block (lines ~395-440)
  has retry-after-delay logic that could re-fire if cancellation isn't
  clean

**Files likely involved:**
- `src/hooks/lineup/useMatchPreparation.ts`
- `src/realtime/useMatchRealtime.ts`
- `src/components/scoring/MatchEndVerification.tsx`

---

## 13. Tied-Match Scoreboard Should Show More Info

**Discovered:** 2026-05-02 during modular-league-system test pass
**Severity:** Low (UX enhancement)
**Branch:** future bugfix branch — UI enhancement

**Problem:** During the tiebreaker round (games 19/20/21 in 3v3 DRR),
the scoreboard could surface more useful context. Right now it just
shows the regular game count (which stays at 9-9 since tiebreaker
games are excluded by design — Phase 5 Unit 5.5 locked invariant).

**Suggestions to consider:**
- Show "TIEBREAKER" badge / banner clearly so users know this is the
  short-race round, not a continuation of regular games
- Show tiebreaker game progress separately (e.g. "Tiebreaker: 1-0,
  best of 3")
- Show who's winning the tiebreaker round (since regular standings
  stay tied)
- Possibly show race-to-N target for the short-race format

**Files likely involved:**
- `src/components/scoring/ThreeVThreeScoreboard.tsx`
- `src/components/scoring/MatchEndVerification.tsx` (the
  TIEBREAKER REQUIRED banner could carry into the tiebreaker scoring
  view too)
- Any scoreboard-display helpers

---

## 14. Live-Scoring Page Doesn't Clear Completed Matches

**Discovered:** 2026-05-02 during modular-league-system test pass
**Severity:** Medium — visible UX bug (stale data showing)
**Branch:** future bugfix branch — likely query invalidation gap

**Problem:** After a tied match was fully resolved (regular games + 3
tiebreaker games + final completion), the LIVE scoring page kept
showing the completed match — including the "TIEBREAKER REQUIRED"
banner and the tied scoreboard — even though the match had been
moved to status='completed' in the DB.

The stale view cleared when the user finished a SECOND match (a
non-tied one), suggesting some invalidation path fires on completion
of the OTHER match but not on the originally-completed tied match.

**Hypothesis:** Query-invalidation gap. The "live matches" list (or
its underlying TanStack Query cache) isn't being invalidated when a
match transitions to status='completed'. The fact that another
completion later cleared it suggests there IS an invalidation that
fires somewhere — but it might be coupled to the user's act of
completing the new match (e.g. fired from MatchEndVerification's
mutation onSuccess) rather than from the tie's tiebreaker resolution
flow specifically.

**Investigation hints:**
- Check the query key the live-scoring list uses
  (`getLiveMatchesForLeague` / `getLiveMatchesForMember` —
  `src/api/queries/matches.ts`)
- Trace the post-completion invalidation in MatchEndVerification —
  does it fire for tiebreaker-resolved completions vs regular
  completions equivalently?
- Check whether the tiebreaker's auto-completion path (when winner
  emerges from 3 short-race games) goes through the same code that
  invalidates queries on a normal completion

**Pre-existing or new?** Likely pre-existing — our modular-league
work touched MatchEndVerification's completion update + per-game
running totals, but didn't touch the "what live matches do I have"
query layer.

**Files likely involved:**
- `src/api/queries/matches.ts` (the live-matches queries)
- `src/components/scoring/MatchEndVerification.tsx` (where
  completion mutates run; check whether tiebreaker-resolution path
  invalidates the same queries as regular completion)
- Whatever component renders the live-scoring landing page

---

## 15. MatchEndVerification Re-fires Completion on Already-Completed Match

**Discovered:** 2026-05-02 during modular-league-system test pass
**Severity:** Low — DB uniqueness constraint catches the duplicate, but
console noise + potential side effects
**Branch:** future bugfix branch — small guard fix

**Problem:** When MatchEndVerification re-mounts (re-render, navigation,
focus change) on a match where `status='completed'` already, the
completion useEffect re-runs because `bothVerified=true` is still
true (verification flags persist on the match row).

The mutation chain re-fires:
1. updateMatchMutation (idempotent, just rewrites the same values)
2. createGamesMutation (NOT idempotent — fails with 409 because
   tiebreaker games 19/20/21 already exist):

```
POST /rest/v1/match_games... 409 (Conflict)
[ERROR] Failed to complete match
{"error":"Failed to create match games: duplicate key value violates
  unique constraint \"match_games_match_id_game_number_key\""}
```

**Pre-existing:** the completion useEffect has always lacked a guard
against re-firing on completed matches. This bug isn't caused by the
modular-league-system work, but the realtime subscription cycling
(item 12 + WebSocket health issues) causes more re-mounts than
normal, which surfaces this latent bug more often.

**Likely fix:** add `if (match?.status === 'completed') return;` near
the top of the completeTheMatch useEffect, before the `bothVerified`
check. Or: keep `completionStartedRef.current` from being reset when
the match is already completed (don't run the
`!bothVerified && completionStartedRef.current = false` reset block
if status is 'completed').

**Files likely involved:**
- `src/components/scoring/MatchEndVerification.tsx` (the auto-complete
  useEffect at line ~221)
