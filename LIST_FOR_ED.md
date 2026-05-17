# List for Ed

Tasks and refactoring items for Ed to work on.

---

## 🚨 2026-04-21 STAGING TEST — Multiple Critical Failures

**Discovered:** 2026-04-21 during first real-player staging test at the league event
**Severity:** HIGH — these blocked the test on the night and several are show-stoppers for real launch
**Branches needed:** multiple (see each item)

Context: first night with real players touching the staging app. Lineup
preparation, invite flows, Fargo scoring, and double-duty all failed in
different ways. Everything below needs real fixes before another live
test, and some are hard blockers for production.

### Issue 1 — Staging has no outbound email (invite flow is dead in staging)

**Branch needed:** `staging-email-transport` or staging config fix

**The problem:** the staging Supabase environment does not actually send
any email. The captain's email-invite option for placeholder players
silently goes nowhere, so captains cannot invite anyone via email on
staging. Only Device Handoff and Share Link / QR are usable. This also
means no email-confirmation tests can run on staging — it's a complete
invite/auth test gap.

**Fix direction:**
- Configure staging with a real SMTP provider (Resend, SendGrid, Postmark,
  Supabase's built-in SMTP) or at minimum route staging mail through a
  dev-inbox service like Mailtrap or Inbucket so the flow can be tested
  end-to-end.
- Decide deliberately whether staging sends real external mail or only
  captures it for inspection (usually you want the latter for safety).
- Document the setup in memory-bank so future environments inherit it.

**Until fixed:** captains cannot use the email-invite option on staging at
all. Every test has to use in-person invite methods, which does not match
the real production flow and leaves a whole code path untested.

### Issue 2 — Fargo 5v5 is routing through the 3v3 games creator

**Branch needed:** `fix-fargo-5v5-games-creation`

**The problem:** when a Fargo 5v5 match reaches game-creation, it's using
the 3v3 games creator path. Only players 1, 2, and 3 are used from each
lineup; players 4 and 5 are dropped. The resulting game list is also laid
out as a double round robin (3v3 pattern) instead of the Fargo 5v5
schedule. Players 4 and 5 never appear in any game.

**Why this matters:** Fargo 5v5 is the whole point of the modular
handicap/scoring refactor that just shipped. If dispatch is picking the
wrong creator, either the routing logic has a bug, the Fargo-5v5 creator
is missing/not wired up, or the league preference is being read wrong.

**Fix direction:**
- Confirm which creator module is actually being invoked for this league
  (log the dispatched creator key during match prep).
- Verify `leagues.handicap_type` / scoring system config is what we think
  it is for the test league.
- Check the registration/dispatch map for the 5v5 Fargo creator — it may
  be missing a case or falling through to the 3v3 default.
- Add a regression test that runs match prep for a Fargo 5v5 league and
  asserts all five players appear in the resulting match_games and the
  schedule matches the 5v5 pattern, not 3v3.

**Files likely involved:** the modular handicap/scoring dispatch added in
PR #72 (Fargo 5v5 end-to-end), anything that calls into a games creator
from match prep, and the 5v5 scoring registration.

### Issue 3 — Double duty did not work

**Branch needed:** `fix-double-duty`

**The problem:** "double duty" — a single player filling two roster slots
/ playing two games in the same match — did not function tonight. The
exact failure mode needs reproduction (was it lineup validation refusing
the duplicate player, was it the games creator generating bad games, was
it scoring refusing to accept, was it something else?).

**Fix direction:**
- Reproduce with a test lineup that has one player listed in two slots.
- Trace through lineup save → lock → games creation → scoring to see
  where the flow breaks.
- Add a test covering the double-duty case for at least one scoring
  system so the regression can be caught automatically.

**Why this matters:** double duty is a real league scenario when a team
is short. Without it, short-handed teams can't even enter a legal lineup
in the app.

### Issue 4 — Fargo start-points (beginning handicap) did not work

**Branch needed:** `fix-fargo-start-points`

**The problem:** the Fargo start-points value — the negotiated
beginning-games handicap for the weaker team — did not apply correctly
during scoring. This is the feature that was just added in the
`fargo_start_points` columns migration (captains propose/confirm a
number, then it copies to the weaker team's `home_games_to_win` or
`away_games_to_win` when both captains confirm).

**Possible failure modes to check:**
- Both-confirms detection not firing match-prep as expected.
- Start-points value not actually being copied to the correct team's
  `games_to_win` column.
- Scoring UI reading from the wrong column or ignoring the value.
- Interaction with Issue 2 — if the wrong games creator ran, start-points
  may never have been applied at all.

**Fix direction:**
- Pull the actual match row from staging (match id
  `44455346-f33f-4362-9f52-bcc1341b2c0c` — see
  `docs/events/2026-04-21-staging-test/unlock-match-lineups.sql`) and
  inspect the Fargo columns and games_to_win values.
- Trace match prep to confirm the copy from `fargo_start_points` to
  `home_games_to_win` / `away_games_to_win` actually happened.
- If it did copy, trace scoring to confirm the value is read at match
  end.

**Why this matters:** Fargo without start-points is not Fargo. This
blocks any meaningful Fargo league use.

### Cross-cutting follow-ups

- Consider a pre-launch checklist that asserts each scoring system can
  run a full happy-path match (lineup → prep → score → complete) in a
  smoke test environment before any real-player test.
- Write up each failure in `docs/solutions/` once root-caused so the
  learnings compound instead of evaporating.
- Staging needs real observability for nights like this — logs are
  easier to read after the fact than to debug in real time while
  players are waiting.

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

## ~~7. New Org Not Visible on Dashboard After LO Application~~ ✅ CLOSED 2026-05-17

> **Closed 2026-05-17** — root cause was subtler than first guessed.
> The two mutations (`useCreateOrganization`, `useUpdateMemberRole`)
> WERE calling `invalidateQueries`, but `invalidateQueries`'s default
> behavior only refetches *active* queries. The dashboard's org-list
> query is NOT mounted during the LO application flow, so the cache
> was marked stale but never actually refetched. The user navigates
> to /dashboard, the component mounts, and there's a brief window
> where the stale cache renders before the refetch completes —
> hence "doesn't appear until refresh."
>
> Fixed by switching both mutations to `invalidateQueries({...,
> refetchType: 'all' })` inside async `onSuccess` handlers that
> await the refetch. Forces inactive-query refetches AND holds the
> mutation open until the cache is genuinely fresh. The previous
> 500ms `setTimeout` hack in the LO application's `handleSubmit`
> was removed — there's no race left to paper over.
>
> Files touched: `useOrganizationMutations.ts`,
> `useMemberMutations.ts`, `LeagueOperatorApplication.tsx`.
> Original entry preserved below for reference.

### Original entry

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

---

## 16. Team-Builder UX — Lineup-Size Slots + "Add Player" for Substitutes

**Discovered:** 2026-05-03 during modular-league-system test pass
**Severity:** Enhancement — current behavior renders all max_roster_size
slots up front
**Branch:** future UX branch

**Idea:** Instead of rendering all `max_roster_size` slots at team
creation time (now up to 20 after the cap bump), show only the
`lineup_size` required slots initially with a "+ Add Player" button
to add substitutes. Cleaner empty state for teams that haven't yet
filled their substitute bench.

Affects the team-creation + team-edit forms. Most BCA-style leagues
have 5-8 active players + a few subs; a 20-slot grid up front is
visually heavy for the typical case.

**Note:** roster cap was bumped from 12 → 20 in this branch since
the user mentioned their leagues sometimes have larger rosters. DB
schema already allows up to 30.

**Files likely involved:**
- Team creation wizard / team editor
- `src/operator/TeamManagement.tsx` and the modal that opens for
  add/edit team

---

## 17. Comprehensive Warning System + LO Feedback Loop on Presets

**Discovered:** 2026-05-03 conversation
**Severity:** Future feature — far down the road
**Branch:** dedicated future product feature

**Concept:** The current combo-coherence warning system
(`src/wizards/league-v2/comboCoherence.ts`) fires warnings based on
hardcoded rules. The rules ARE careful (locked tests, calibrated
formula carve-outs, etc.), but they're written from the dev team's
imagination of what could go wrong — they don't learn from real
operator behavior.

**Two complementary pieces:**

### 17a. More comprehensive warning rules

Current warning set is small (off-preset combo, milestone-jumps + even
games, race-format + per-game-ball-counter). Real-world combos likely
surface more failure modes once leagues actually run on this code.

Plan: as operators report issues / dev team observes failure patterns,
add rules to the validator with citations to the failure that
motivated each rule. Each warning gets:
- A `code` (already implemented)
- A user-facing message (already implemented)
- A hidden-from-UI provenance note ("added 2026-XX-XX after
  League Y reported issue Z") so future devs understand WHY each
  rule exists
- An optional escape hatch: "this warning fired but my league played
  fine, dismiss it next time"

### 17b. LO feedback / rating system

Let operators report back when they use one of the Tested Preset
bundles or override warnings. Lightweight in-app surface:

- **On Tested Preset card click**: post-creation prompt at end of
  first season — "Did the BCA 3v3 preset work for your league? [yes /
  no with details]". Stars / NPS-style.
- **On warning override**: when LO sees a warning at Review step but
  saves anyway, capture context. After the league's first match (or
  first season), prompt: "We warned you about the off-preset combo
  for this league. Did it work as you expected?" If yes: that combo
  becomes a candidate to add to Tested Presets or to suppress the
  warning. If no: ask what they ended up doing (custom threshold
  table, captain overrides at lineup, switched to a different combo).
- **Aggregate dashboard for the dev team**: see which presets are
  most successful, which combos people override warnings on (and
  whether those overrides worked), which custom configurations
  recur often enough to consider promoting.

**Plumbing required:**
- New table: `lo_preset_feedback` — entity_id (league), source
  (preset_used | warning_overridden), rating (1-5 or yes/no),
  free_text, created_at, member_id (the LO).
- Read API: dev-team-only view that aggregates feedback per preset /
  warning code.
- Write API: simple insert mutation triggered by post-season prompts.
- UI surfaces: feedback prompts (timed to when the LO has actual
  results to report on), an in-app messaging channel back to the
  dev team for specific issues.

**Why far down the road:** needs a critical mass of real LOs
running real leagues for the feedback to be meaningful. With one
operator (the user) running ~3 leagues today, the signal would be
too small to drive rule changes. Better to ship the modular system,
get a handful of pilot operators on it, then layer feedback
collection once there's enough volume.

**Connection to current code:**
- `src/wizards/league-v2/comboCoherence.ts` is where rules live now;
  expansion happens here
- `src/wizards/league-v2/steps/ThresholdSourceStep.tsx` already has
  the "calibrated vs manual" classification; feedback could refine
  the classifier's confidence over time

---

## 18. Unified Scoreboard — One Component for All Configs

**Discovered:** 2026-05-03 during 5v5 Fargo + games-won test pass
**Severity:** Architectural / next-branch brainstorm
**Branch:** dedicated brainstorm + plan branch (Ed flagged this as
his next focus after the modular-league-system branch lands)

**Problem:** We currently have multiple scoreboard components —
`ThreeVThreeScoreboard`, `FiveVFiveScoreboard`, `TenSevenScoreboard`,
`TiebreakerScoreboard` — and `ScoreMatch.tsx` routes between them
based on `(handicap_type, lineup_size, isTiebreakerMode)`. Every
new combo (e.g. Fargo + games-won) potentially needs either a new
scoreboard variant or a router exception. This is the n×m matrix
problem: it doesn't scale, and surface-area bugs (wrong numbers,
mis-routed display, missing thresholds) compound with each new
preset.

The Fargo + games-won issue today was a symptom: the router
checked `handicap_type === 'fargo'` first and dispatched to the
points-mode scoreboard, even though the league uses games as the
win condition. A small guard (`&& winCondition === 'points'`) was
applied as a quick fix in `src/player/ScoreMatch.tsx` so testing
can continue. The structural fix is the unified scoreboard
described below.

**Proposed approach (Ed's framing 2026-05-03):**

Build ONE live scoreboard component that:

1. **Always tracks both games and points** — we already have both
   on the matches row (`home_games_won` / `home_points_earned` etc.
   from Phase 5 Unit 5.5 running totals). No conditional data
   gathering — every match feeds both axes.
2. **Reads the three thresholds (to-win / to-tie / to-lose) per
   side** from the matches row (`home_to_win`, `home_to_tie`,
   `home_to_lose`, and the matching `away_*` set). These are
   already populated regardless of mode — for games-mode they're
   game counts, for points-mode they're point totals. The
   thresholds are mode-neutral; the SCOREBOARD picks which axis
   they apply to.
3. **Reads `win_condition` from the resolved league preferences**
   to decide which axis (games or points) gets the "primary"
   display position — slightly larger / featured. The other axis
   stays visible but smaller.
4. **Shows both equally OR scaled by win_condition.** Either is
   acceptable; "scaled" is Ed's preference because it matches how
   players actually think about the match ("we need 11 to win" is
   a single number, the points are secondary trivia).

**Net effect:** one scoreboard handles BCA 3v3 (games), BCA 5v5
(games + points), Fargo 5v5 points-mode (points + games), Fargo
5v5 games-mode (games + points), AND every off-preset combo —
because all of them have both axes and a `win_condition` flag.

**What this kills:**
- Per-format scoreboards (consolidate to one)
- Routing exceptions in `ScoreMatch.tsx` (probably collapses to
  `isTiebreakerMode ? Tiebreaker : Unified`)
- Future "we need a new scoreboard for this combo" tickets

**What this preserves / extends:**
- Tiebreaker scoreboard stays separate (different game-set, not a
  threshold display)
- Mid-match "you've clinched" detection (currently unbuilt — see
  memory `project_mid_match_clinch_detection.md`) — a unified
  scoreboard is the natural place to surface this when built
- Player rows / lineup interactions (swap player, vacate, etc.)
  stay shared between unified scoreboard and tiebreaker

**Adjacent calculator-feature idea (Ed 2026-05-03):**
Add a configurable "benchmark" param to
`accumulate_with_milestone_jumps`. Today the milestone (where the
1.5x jump kicks in) is implicitly the tie-threshold — they're
coupled. A benchmark param would let an LO set the jump game
independently ("jump kicks in at game 10 regardless of where the
tie threshold lands"). Surfaces in the wizard's calculator-params
editor and on the unified scoreboard as the milestone-progress
cue. Sized as "small extension" once the unified-scoreboard
shape is settled — don't add this before the scoreboard work
or we'll have two display paths to update.

**Sibling concern — Scoring Modal (`ScoringDialog`) needs the same
treatment (Ed 2026-05-03):**

The win-confirmation modal has the same dispatch problem the
scoreboard had: today it gates the loser-balls-pocketed input on
`handicap_type === 'fargo'`, which over-collected for any Fargo
league whose calculator doesn't actually consume per-game ball
counts (e.g. Fargo + games-won + `accumulate_with_milestone_jumps`).
A tactical guard was applied 2026-05-03: ScoringDialog now takes
a `pointsCalculator` prop and only renders/requires the ball-count
input when `pointsCalculator === 'accumulated_per_game'`. ScoreMatch
reads the value from `match.system_snapshot.points_calculator`.

The structural fix in this branch should generalize the modal the
same way as the scoreboard: ONE dialog driven by the active
calculator's declared per-game inputs, not by `handicap_type`.

Ed's richer modal vision (2026-05-03):
- Each side (winner / loser) has its own configurable point range
  per game — e.g. winner can earn 5–20 points, loser can earn 2–12,
  driven by inputs the LO turns on/off per league.
- Two independent point-award systems running side-by-side, either
  feeding one or both teams. Examples:
    - System A: winner gets a flat point per game won.
    - System B: bonus points for break-and-run, golden break, etc.
    - Total awarded = A + B per side.
- Each tracked field is on/off at the league level. Today's flags
  (`break_and_run`, `golden_break`, `runout`, `loser_balls_pocketed`,
  `break_fouled`, `win_by_forfeit`) become a configurable set
  rather than a fixed list. New fields (innings, time, fouls per
  rack, etc.) plug in via the same mechanism.
- Modal renders only the inputs the active league/calculator
  actually consumes — no over-collection, no submit-disabled
  mystery for inputs that don't matter.

**Plumbing implications:**
- Calculator interface gains a `requiredPerGameInputs` declaration
  (or similar — exact shape is the brainstorm's job). Could be a
  static array on the calculator module, or a method that takes
  the params and returns the input list.
- `match_games` schema may need new generic columns or a JSONB
  field for "calculator-specific per-game data" so the modular
  inputs aren't pinned to today's column list.
- League-preferences gain per-flag on/off toggles for the always-
  visible / role-conditional fields (so an LO can turn off
  break-and-run tracking for a league that doesn't reward it).

**Why fold into the unified-scoreboard branch:**
- Scoreboard and modal are tightly coupled (modal collects, board
  displays). Both dispatch on `handicap_type` today; both should
  dispatch on the active calculator + win_condition.
- Doing them together means one schema migration, one set of
  calculator-interface changes, and one consistent display story
  for the BCA-pitch demo.
- Today's `accumulated_per_game` ball-count input is the only
  example of a calculator-driven per-game input — the brainstorm
  is the moment to generalize before more accumulate.

**Pattern: "handicap_type as proxy for scoring system" conflation
(Ed 2026-05-03):**

The same root issue surfaced three times in one testing session.
Each time, code that should have dispatched on the active points
calculator dispatched on `handicap_type === 'fargo'` instead —
silently activating a Fargo-flavored legacy path even when the
league's actual calculator was something else.

Instances found:

1. **Scoreboard component routing** (`src/player/ScoreMatch.tsx`
   ~line 785) — `handicap_type === 'fargo' && fargoTotals` chose
   TenSevenScoreboard for any Fargo league, even Fargo + games-won.
   Fixed 2026-05-03 by adding `&& winCondition === 'points'`.
2. **Scoring modal ball-count input** (`src/components/scoring/
   ScoringDialog.tsx`) — `handicap_type === 'fargo'` rendered the
   loser-balls-pocketed input (and gated Submit on it) regardless
   of whether the active calculator actually consumed it. Fixed
   2026-05-03 by adding a `pointsCalculator` prop and gating on
   `pointsCalculator === 'accumulated_per_game'`.
3. **Scoreboard points display** (`src/player/ScoreMatch.tsx`
   ~line 682 and ~line 827) — `handicap_type === 'fargo'` ran
   `calculateFargoMatchTotals` (the legacy 10-7 formula) regardless
   of which calculator was active. The match row's
   `home_points_earned` was correct (calculator-correct via
   `computeMatchRunningTotals`), but the scoreboard prefer-read
   the legacy `fargoTotals.homePoints`, so it displayed "10 per
   win" for an `accumulate_with_milestone_jumps` league. Fixed
   2026-05-03 by reading `match.home_points_earned` /
   `match.away_points_earned` directly in the FiveVFiveScoreboard
   branch. ThreeVThreeScoreboard branch still uses legacy
   `calculatePoints` — same fix needed when 3v3 path is
   exercised in the unified-scoreboard work.

**Structural fix in this branch:** every display-layer dispatch
(modal, scoreboard, end-of-match-recap) should read from the
match row's calculator-correct fields (`home_points_earned`,
`away_points_earned`, `home_games_won`, `away_games_won`) — those
ARE the source of truth post-Phase 5 Unit 5.5. Legacy parallel
computation paths (`calculateFargoMatchTotals`,
`calculateBCAPoints`, `calculatePoints`) should be deleted, not
kept "for compatibility." Compatibility through abstraction is
fine; compatibility through parallel paths that drift is the bug.

The mental shorthand to break: `handicap_type === 'fargo'` does
NOT mean "this league uses 10-7 scoring." It means "this league
applies handicap via Fargo ratings." The scoring system is the
calculator. They're orthogonal — by design — and any code that
treats them as synonyms is wrong.

**Open questions for the brainstorm:**
- For Fargo points-mode, do we still need to show start_points
  prominently (the "this team starts at +X" cue at lineup lock)?
  Yes probably — but as part of the unified scoreboard's points
  row, not its own component.
- Calculator-specific cues that leak onto today's scoreboards
  should be gated behind the active `points_calculator`. Examples
  found during 2026-05-03 testing:
    - The `1.5` floating on the scoreboard is the
      `multiplier_at_tie` param from `accumulate_with_milestone_jumps`
      — only meaningful for that calculator; should be hidden for
      `linear_above_threshold`, `accumulated_per_game`, and `null`.
    - The "11 in the points column" for Fargo + games-won was
      `fargoTotals.homePoints` accumulating via points-mode logic
      even though the league decides by games. Unified scoreboard
      should derive points from `match.home_points_earned`
      (already maintained by the per-game running-totals pipeline)
      and skip start-points negotiation entirely when win_condition
      is 'games'.
- Tied-match display: the threshold trio (to-win / to-tie / to-
  lose) on the unified scoreboard naturally surfaces tie territory.
  Item 13 (tied-match scoreboard should show more info) might
  fold into this work.
- What does the "primary axis" look like visually? Bigger font?
  Different background? A "TO WIN" label above just the primary
  axis? Wireframes in the brainstorm.
- Layout footprint: 3v3 has 3 player rows, 5v5 has 5. Does the
  unified scoreboard auto-flex or do we have layout variants per
  lineup_size? (Probably auto-flex — the scoreboard chrome is the
  same shape, only the player-row count differs.)

**Files likely involved (when the brainstorm becomes a plan):**
- New: `src/components/scoring/UnifiedScoreboard.tsx` (replaces
  three of the four current scoreboards)
- `src/player/ScoreMatch.tsx` routing collapses
- `src/components/scoring/ThreeVThreeScoreboard.tsx`,
  `FiveVFiveScoreboard.tsx`, `TenSevenScoreboard.tsx` — likely
  deleted
- `src/types/match.ts` — already has the threshold fields with
  mode-neutral names (`home_to_win` etc.); good foundation
- Resolved-prefs reader (`src/api/queries/leaguePreferences.ts` or
  `useResolvedLeaguePrefs`) already exposes `win_condition` and
  `lineup_size` — no schema work needed

**Why this is the right next branch:**
- The modular-league-system branch made the DATA layer mode-neutral
  (mode-neutral threshold column names, both axes always tracked).
  The DISPLAY layer is now the last place where "BCA vs Fargo vs
  10-7" is hardcoded as separate components. Aligning the display
  with the data is the natural finish line.
- Item 10 (slash format confusion), Item 13 (tied-match info), and
  the Fargo-games-won routing fix all fold into this single piece
  of work.
- BCA-pitch demo: a single unified scoreboard is a stronger demo
  than "we have four scoreboards, let me show you which one fires
  for this league."

---

## 19. Cross-Match State Bleed — Fresh Match Shows "Tiebreak Needed"

**Discovered:** 2026-05-03 during modular-league-system testing
**Severity:** Medium (refresh-recoverable, no data corruption)
**Branch:** lineup/scoring transition cleanup branch — same family
as items 12 / 14 / 15

**Symptom:** Navigated from an old (abandoned) match into a freshly
created match. Home team's view immediately showed the "tiebreak
needed" prompt on the brand-new match — zero games scored, no tie
possible. A hard refresh cleared it and the match looked normal.

**Likely cause family** (same shape as items 12 / 14 / 15):
- TanStack Query cache holding stale match data when navigation
  swapped the match ID
- Realtime subscription routing events from the previous match
  to the new match's component instance
- `MatchEndVerification` mounting with stale verification-flag
  state from the previous match (both teams "verified" → triggers
  the auto-completion path → hits the bcaResult evaluation against
  the new match's [missing] thresholds → result === 'tie' →
  tiebreak prompt)
- Or some combination — fan-out of cache invalidation around
  match navigation isn't tight enough

**Why this is its own item (not folded into 12/14/15):**
- Item 12 is mid-match flashing on a single match
- Item 14 is the live-scoring INDEX page showing stale matches
- Item 15 is a single completed match re-firing completion
- This new one is CROSS-match state bleed during navigation —
  React component / Query cache identity drift between two
  different matches the same user touched in sequence

**Repro recipe:**
1. Open match A (any state — abandoned, in-progress, etc.)
2. Navigate away (back to dashboard / match list)
3. Create + open match B (fresh, no games scored)
4. As home team: "tiebreak needed" prompt appears immediately

**Fix direction (for the cleanup branch):**
- Audit `useMatchScoring` and the React Query keys around match
  ID transitions — make sure switching matchId fully invalidates
  prior match data instead of layering new data on top
- `MatchEndVerification` should refuse to evaluate completion for
  a match it just received (defer one render, or gate on
  match.id matching the current matchId param)
- Realtime channel cleanup on unmount needs a strict per-match
  scope so messages don't leak across navigation

**Workaround until fixed:** hard refresh after navigating to a
fresh match. Confirmed effective in this session's testing.

**Related instance — second-verifier doesn't auto-nav at match
completion (2026-05-03):** both teams verified the final game; the
match completed correctly (winner persisted, status='completed'),
but the home team's screen did not auto-navigate back to the
dashboard. Away team navigated normally. Likely cause is in the
same family — three plausible angles:

1. The item-15 guard (`if (match?.status === 'completed') return;`)
   firing on the second verifier's effect after realtime
   propagated the first verifier's write. The guard was added to
   prevent re-firing on already-completed matches but plausibly
   blocks the second verifier's legitimate Step-3 navigation.
2. `completionStartedRef` stuck `true` from an interrupted prior
   attempt (any earlier transition-family bug could leave it
   stuck), so a re-evaluated effect bails silently before Step 3.
3. Effect dependency drift around `bothVerified` / match query
   identity changing under realtime updates.

**Fix direction (cleanup branch):** the navigation in Step 3
should be its own concern, separated from the DB-write guarding
in Step 2. Right now the entire `completeTheMatch` async function
is gated by both Step-2 and Step-3 protections, so a guard
intended to protect writes also blocks navigation. Splitting them
(or making the navigation idempotent — "if status===completed and
I'm on the live-scoring page, navigate to dashboard, period") fixes
the regression without re-introducing the original 409 noise.

**Workaround until fixed:** the user manually clicks back to
dashboard. Match data is already correct on the server.

---

## 20. Dark Mode Breaks Date Picker — For Jack

**Discovered:** 2026-05-04 during unified-scoreboard smoke-testing
**Severity:** Medium (functionally usable but visually broken)
**Owner:** Jack (design / styling pass)

**Symptom:** In dark mode, the date picker is essentially unusable —
the day numbers in the calendar grid are invisible against the
background. Only a single date (presumably the currently-selected or
hovered one) is visible at a time. User can't see which dates are
available, weekends, today's marker, etc.

**Suspected cause:** the calendar component's text color likely
hardcoded to a light value (or inherits a light theme color) without
a dark-mode variant defined. Background-text contrast collapses in
dark mode.

**Likely fix surface:** `src/components/ui/calendar.tsx` (the shadcn
Calendar primitive) and/or any wrapper component that uses it. Audit
the day-cell text color tokens — should use `text-foreground` /
`text-muted-foreground` (theme-aware) rather than a hardcoded
`text-gray-900` or similar.

**Adjacent dark-mode issue (also for Jack):** unified scoreboard's
player-drawer name colors. Per Ed 2026-05-04 smoke-test: "in dark
mode the away team player names in the drawer are invisible. and in
light mode the home team is invisible." Same root cause likely — a
hardcoded color that doesn't flip per theme. Worth folding into the
same dark-mode pass.

---

## 21. Match-Prep Failure Routes to "Back to Schedule" Instead of Try-Again

**Discovered:** 2026-05-04 during unified-scoreboard smoke-testing,
multi-device captain scenario.
**Severity:** Medium (recoverable but confusing UX; user can't tell
what went wrong)
**Owner:** unassigned

**Symptom:** With a third captain logged in on a phone alongside the
two team captains on other devices, the phone's prep_match attempt
landed at a "go back to schedule" error UX instead of the usual
"try again / back to lineup" recovery options. The phone never left
the lineup screen. The opposing team's captain entered scoring
normally on their device.

**Notes:**
- Likely a pre-existing edge case in the prep_match error handler,
  not a regression from the unified-scoreboard branch (the
  fire-and-forget seed-running-totals call runs *after* prep_match
  succeeds; this failure happened before that point).
- Three concurrent captain devices on the same match prep flow may
  exercise a captain-confirmation race the normal two-captain flow
  doesn't hit.

**Investigation start point:** the prep_match RPC error branch in
`src/hooks/lineup/useMatchPreparation.ts` — figure out which error
classifications route to "back to schedule" vs "try again", and
whether a successful opponent-side prep can leave the loser side in
an unrecoverable state.

---

## 22. Re-asks for Fargo Initial-Points Confirmation After Going Back to Lineup

**Discovered:** 2026-05-04 during unified-scoreboard smoke-testing,
multi-device captain scenario.
**Severity:** Medium (annoying but not data-corrupting)
**Owner:** unassigned

**Symptom:** After hitting the issue-21 prep failure and routing
back to schedule → back to lineup, the lineup page asked the user
to re-confirm the Fargo initial points credit, even though the
opposing captain had already confirmed it (and was already in the
scoring page on their device).

**Why this is wrong:** captain-confirmation is a *negotiation* on
the start-points credit between the two teams. Once both sides have
agreed and prep_match has run, the credit is locked into the match
row's `*_to_tie` columns. Re-prompting after a return-to-lineup
suggests the confirmation flag isn't being read from the match row
on lineup-page mount, or it's being cleared somewhere it shouldn't
be.

**Possible angles:**
- Lineup page reads confirmation state from local component state
  rather than from the match row.
- The match-prep cleanup that nulls `to_lose` on prep success
  (Phase 4-of-unified-scoreboard branch) accidentally cleared a
  confirmation marker it shouldn't have.
- The captain-confirmation hook isn't reading "match already
  prepped" as a cue to skip the prompt.

**Investigation start point:** the captain-confirmation flow in
`src/hooks/lineup/` — verify the initial-state derivation reads
from the match row, not just component state, and that "match
already started" short-circuits the confirmation prompt.

---

## 23. First Winner-Selection Modal Missing Loser-Points Selector (Fargo)

**Discovered:** 2026-05-04 during unified-scoreboard smoke-testing.
**Severity:** Medium-High (silent loss of loser points on game 1 of
every Fargo points-mode match unless user manually edits afterward)
**Owner:** unassigned

**Symptom:** On the very first game of a Fargo 10-7 match, the
winner-selection modal opened without the loser-balls-pocketed
selector. The second game's modal had it. No way to award the loser
their balls-pocketed points on game 1.

**Likely root cause:** `system_snapshot` is captured *lazily at the
first scoring event*, so on game 1 the snapshot is null. Any UI
element that reads the calculator from the snapshot will see "no
calculator known" on game 1 only.

The unified scoreboard got a live-prefs fallback for this in commit
`289e338` (this branch) — when the snapshot is null, it falls back
to `leaguePrefs.points_calculator`. The score-entry modal probably
needs the same fallback applied.

**Suspected fix surface:**
- The score-entry / winner-selection modal component (likely under
  `src/components/scoring/` — find the one that renders the loser-
  balls-pocketed input).
- Trace where it reads calculator info from. If it reads from
  `match.system_snapshot.points_calculator` directly, add the same
  null-fallback to live `leaguePrefs.points_calculator` that
  UnifiedScoreboard uses.

**Workaround until fixed:** vacate-and-rescore game 1 after a
second game has run (which populates the snapshot). Annoying but
recoverable.

---

## 24. Fargo Initial-Points Confirmation Only Requires One Side (Consider Removing Entirely)

**Discovered:** 2026-05-09
**Severity:** Low-Medium (working "well enough" but the design isn't
doing what it claims to do)
**Owner:** unassigned

**Symptom:** The Fargo initial start-points credit is supposed to be
a *two-team negotiation* — both captains need to confirm before the
match proceeds. In practice, only one side's confirmation is being
required (or only one side's confirmation is being read), and the
match proceeds anyway. The gating mechanism isn't actually gating.

**Proposed direction (Ed's call, 2026-05-09):** rather than chase the
bug to make confirmation work as designed, remove the confirmation
requirement entirely. Compute the start-points credit from the lineup
ratings, apply it, let the match proceed. If we ever find out the
auto-computed value is wrong, fix it as a per-match adjustment after
the fact (vacate-and-rescore-style intervention) rather than gating
every match on a confirmation prompt.

**Rationale:**
- The two-side confirmation only matters when teams actually disagree
  on the right credit. In practice, captains aren't second-guessing
  the math; they're confirming what the system already computed. The
  confirmation step is theater, not a real safety net.
- The current half-broken confirmation creates UX friction (re-prompts
  after return-to-lineup, see #22) without actually achieving the
  negotiation it's named for.
- Trusting the computed value and adjusting after-the-fact is a
  smaller surface area: one path, no race conditions between two
  devices, no captain-confirmation hook to maintain.

**What removing it would touch:**
- The captain-confirmation prompt on the lineup page.
- The `*_to_lose` scratch-state columns currently used to flag captain
  confirmations (per the `useMatchPreparation.ts` comment block, those
  columns are repurposed as scratch state for "this captain confirmed
  with player number X").
- `prep_match`'s logic that gates on confirmation flags.
- Possibly relates to and supersedes issues #21 and #22.

**When to revisit:** if a real-world case surfaces where the
auto-computed start-points value was wrong AND the captain-
confirmation step would've caught it. So far that hasn't happened.

---

## 25. Inline LO-Edit Mode in Scoring Modal (Branch B Architecture Requirement)

**Discovered:** 2026-05-09 (during Branch A modal verification).
**Severity:** Feature request — must be designed-into Branch B from
the start, not bolted on later.
**Owner:** unassigned

**The idea:** the scoring modal should support an LO-only inline edit
mode that lets a league operator hide/show specific events directly
from within the modal, without leaving the live-scoring page. Same
component is also reused as a live-preview-and-edit surface in the
operator office's preferences page. One component, two entry points,
same persistence.

### UX flow

1. While viewing the scoring modal as an LO of this match's league,
   a pencil/edit icon appears in the top-right corner of the modal
   (only visible to LOs of this specific league).
2. Tapping the pencil flips the modal into "LO edit" shape:
   instead of the normal scoring controls, the body shows a list of
   every registry event with a "hide / achievement" checkbox column:

   ```
   hide   achievement
   [ ]    Break and Run
   [ ]    Win by forfeit
   [x]    Scratch on 8        ← currently hidden for this league
   [ ]    Early 8
   ...
   ```

3. Toggling a checkbox writes to `event_preferences` immediately
   (or commits via a Save action — UX call). LO exits edit mode →
   modal returns to normal scoring shape with the new visibility set.
4. Same component, called with `mode='preview'`, is what the
   operator office's preferences page renders so the LO sees a
   live representation of "what scorers will see in the modal" while
   they configure the league.

### Why this is the right shape

- **Edit-where-you-look.** LO sees a checkbox they don't want during
  a live match → taps pencil → hides → done. No menu-diving.
- **8-on-the-break is the canonical example.** BCA = not a win;
  APA = tracked; many bar-leagues = auto-win. Same event, three
  different LO preferences. Inline edit makes this trivial.
- **Component reuse as preferences preview.** The LO office's
  preferences page would otherwise be a separate UI rendering of
  "current toggles." Sharing the modal component as the preview
  means what they see in office matches what scorers see at
  game time — no drift, no double-implementation.

### Architecture requirements for Branch B (must be designed-in)

Branch B's `game_events` registry + `event_preferences` table work
needs to reckon with this from the start, not bolt it on later:

1. **`event_preferences` schema must support per-league toggles
   that the LO can write from anywhere they have permission.**
   Org-level vs league-level is the natural granularity — both
   should be writable. (Org-level toggle = "apply to all my
   leagues"; league-level toggle = "this league only.")
2. **The scoring modal component must accept a `mode` prop**
   (`'score' | 'edit' | 'preview'`) from day one of Branch B. The
   `score` mode is what scorers see; `edit` is what LOs see when
   they tap the pencil; `preview` is the office-page render. All
   three share the same registry rendering — they differ in which
   controls are interactive and what writes happen on toggle.
3. **Authorization gating: LO of this match's league.** Pencil
   only renders when:
   - Current user has `league_operator` (or `developer`) role, AND
   - The match's league belongs to an org this LO administrates.
   An LO of a different league should NOT see the pencil on this
   match.
4. **Realtime propagation across active scorers** is preferred but
   acceptable to defer. When LO toggles "Scratch on 8" off mid-
   match, scorers' open modals can either update live (Supabase
   realtime subscription on `event_preferences`) or update on
   next-modal-open (acceptable; explicit). Pick one and document.
5. **The "preview" entry point lives on the operator office's
   preferences page** as the visual representation of which events
   are toggled. Office form for the LO to configure events should
   reuse this rendering, not build a parallel form.

### Out of scope for this item (don't conflate)

- Editing event NAMES / labels (e.g., changing "Loser balls
  pocketed" → "Points earned"). That's calculator-params territory
  (the calculator's params already have a `label` field) and is its
  own LO surface.
- Editing event APPLICABILITY rules (e.g., "show Runout when winner
  is breaker too"). That's registry-definition territory, owned by
  developers, not per-league config.

### Cross-references

- Branch A's planned scope: docs/plans/2026-05-05-001-feat-scoring-modal-plumbing-plan.md
- Branch B not yet planned. When Branch B's brainstorm/plan is written,
  this item must be a first-class requirement, not a future-considerations
  bullet.
- Related: project_lo_inline_placeholder_handling memory (similar
  edit-from-where-you-look pattern for placeholder players).
