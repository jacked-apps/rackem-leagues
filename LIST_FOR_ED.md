# List for Ed

Tasks and refactoring items for Ed to work on.

---

## 📘 2026-05-30 GLOSSARY — `scoring-system` entry is a DRAFT STUB (important)

**Branch:** `feat/operator-help-phase-1-mac` (glossary definition pass)

`src/glossary/entries/scoring.tsx` now has a `scoring-system` entry, but it's
a **placeholder stub**. "Scoring System" is the umbrella term for the entire
modular structure (the top-level Module composing all 9 components, per
`docs/league-system/README.md`) — Ed flagged it as an important entry that
needs an **extensive, educational explanation**. It's intentionally left
without `reviewedByEd`, so `pnpm glossary:progress` lists it as unreviewed.

Other entries (e.g. `total-points`) already link to `#scoring-system`, so the
stub keeps those links alive until the full write-up lands.

**Same treatment for `win-calculator`** (added 2026-05-31, also a stub in
`scoring.tsx`) — and the broader decision below.

---

## 📗 2026-05-31 GLOSSARY — Modules/Systems are an instruction manual, not glossary entries

**Branch:** `feat/operator-help-phase-1-mac`

Decision (Ed): the **Module/System explainers** (win-calculator, scoring-system,
threshold-charts, points-system, team-geometry, handicap-systems,
handicap-mechanisms, match-format, pairings-generator, tiebreak-system) read
like an **instruction manual** (what each is, what it does, what it contains,
every dial) — a *different animal* from the glossary (a dictionary of quick
"what is this term" defs).

So:
- Module/system **glossary** entries stay **short** ("what it is" + link out).
  `scoring-system` and `win-calculator` are intentionally short stubs for this
  reason; Ed authors the full manual content later.
- The deep manual is its own artifact. The glossary is a flat A-Z list today
  (no sections) — a **"Modules" section/tab** (or a separate manual surface)
  is a **future feature**: needs a `category` field on entries + grouped
  rendering, or a dedicated Modules page on the Learn hub. Naming lean:
  **"Modules"** over "Module Systems."

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

## 🛠️ Tool: League Intake Agent (use when onboarding new LOs)

When you sit with a league operator (like Ozzy) and they describe a league that may or may not fit your existing modular Scoring System: use the **League Intake Agent**. It's a Claude session loaded with the modular framework docs that intakes the LO's description and maps it to the 9 Modules.

**How to run it:** see [`docs/league-system/intake-agent-howto.md`](docs/league-system/intake-agent-howto.md) for step-by-step (terminal commands, copy-paste flow, troubleshooting).

**TL;DR:** `cd ~/Programming/rackem-leagues` → `claude` → paste the prompt from `docs/league-system/intake-agent-prompt.md` → hand keyboard to the LO or describe their league yourself. Output is a structured table flagging each Module as ✓ existing variant / ⚠ new variant needed / 🔴 new Module needed.

**The prompt itself:** [`docs/league-system/intake-agent-prompt.md`](docs/league-system/intake-agent-prompt.md)

---

## 9. First-Lineup-Lock Stuck on Match Setup (Pre-Existing Intermittent) ⚠️ NEEDS-ED-CONFIRM 2026-05-17

> **Triaged 2026-05-17** — PR #100 ("rock-solid lineup → scoring transition")
> shipped retry logic in the `prep_match` RPC, but the original entry's
> root cause (realtime-visibility lag on the second team's lineup row) is
> not obviously addressed. Symptom could still reproduce. **Ed: try to
> force the original failure and confirm before closing.** Original entry
> preserved below.

### Original entry

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

## 12. One-Team Screen Flashes / Rapidly Re-renders Around Tiebreaker ⚠️ PARTIALLY-RESOLVED 2026-05-17

> **Triaged 2026-05-17** — PR #100 added `stableMatchForMutations`
> memoization to `ScoreMatch.tsx`, which removes one source of the
> flashing. The same treatment is NOT yet applied to `MatchLineup.tsx`,
> so the tiebreaker-setup flash is likely mitigated but not fully gone.
> Keeping open until either (a) the second component gets the same
> memoization, or (b) Ed confirms the symptom is invisible in normal use.
> Original entry preserved below.

### Original entry

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

## 19. Cross-Match State Bleed — Fresh Match Shows "Tiebreak Needed" ⚠️ NEEDS-ED-CONFIRM 2026-05-17

> **Triaged 2026-05-17** — PR #100 tightened realtime cache and component
> identity around match-prep, which may have collateral-fixed this. But
> the original symptom is specifically about navigation from match A →
> match B, and that path wasn't explicitly addressed. **Ed: try to
> reproduce the original repro (open abandoned match A, then navigate
> to fresh match B) and confirm before closing.** Original entry
> preserved below.

### Original entry

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
## 26. Team Chat — Allow Manual Adds of Non-Team Members (Phase 2+)

**Discovered:** 2026-05-12 during Unit 3 captain-fallback button scoping
**Severity:** LOW — enhancement, not a bug

**Idea:** Today the auto-managed team chat is locked to the team roster
(roster triggers in Unit 5 will keep membership in sync with `team_players`).
Ed asked whether a captain could manually add a non-team member to the team
chat — e.g., a player's spouse who wants to see league updates. Schema-wise
this is already possible (`conversation_participants.user_id` doesn't require
team membership), but there's no UI for it and Unit 5's roster triggers would
ignore the outsider on roster changes (which is actually the desired
behavior — manual-in, manual-out).

**Scope when picked up:**
- "Add member" UI inside the team chat conversation view, captain-only
- Distinguish "auto-managed roster member" from "manually added outsider"
  visually (e.g., small "guest" badge) so the captain knows roster triggers
  won't sweep them
- Make sure Unit 5 roster triggers only touch participants whose user_id
  matches a current team roster member — outsiders are left alone
- Add a "remove" affordance for captains on guest entries

**Deferred from:** Phase 1 Unit 3 (captain manual-fallback button) on
2026-05-12. Out of scope for that unit; logged here so it isn't lost.

---

## 27. Adversarial Failure-Isolation Test for Season-Activation Trigger

**Discovered:** 2026-05-12 while writing Unit 4 tests
**Severity:** LOW — the safety mechanism exists in code, but lacks a runtime test

**The issue:** The plan's Unit 4 calls for an adversarial test that forces
one team chat to fail and asserts the trigger's `BEGIN/EXCEPTION` blocks
isolate the failure (other chats still create, season UPDATE still
succeeds). The current schema has FK constraints strict enough that
manufacturing a synthetic per-chat failure from outside the function
requires destructive setup (deleting members cascades the roster;
bypassing FKs via `session_replication_role = replica` is too hacky for
a test fixture).

**The risk:** Low. The `BEGIN/EXCEPTION WHEN OTHERS THEN RAISE WARNING`
pattern is present in the function source, and the logic is short enough
to verify by inspection. But there's no runtime evidence that a real
failure stays isolated.

**Possible test approaches when revisiting:**
1. Add a small helper SQL function that raises an exception, called from
   a fork of `auto_create_season_conversations` wired up in the test
   only. Heavy.
2. Use a custom Postgres role with constrained INSERT privileges so the
   function fails on a specific block. Cleaner but needs RLS / role setup.
3. Refactor the function to take an injectable "force-failure-for-team"
   debug param. Adds prod surface for a test-only need.

**Where this came from:** `docs/plans/2026-05-09-001-feat-messaging-overhaul-phase-1-plan.md`,
the *Adversarial* test scenario under Unit 4. The trigger ships with
the EXCEPTION blocks; this is purely a test-coverage gap.

---

## 29. Messaging Unit 6 — Past-Member + Announcement-Read-Only RLS (deferred)

**Discovered:** 2026-05-12 while implementing Unit 6
**Severity:** MEDIUM — defense-in-depth gap until the RLS-enablement project ships

**Context:** Unit 6 of the Phase 1 messaging plan calls for both a UI
banner AND a set of Postgres RLS policies that enforce read-only at
the data layer. Per the existing project decision to defer all RLS
work to a dedicated "RLS-enablement project" (see
[[project_rls_disabled_in_dev]]), only the UI portion shipped on
2026-05-12. This entry captures what needs to land at the data layer
whenever the RLS project gets picked up, so nothing has to be
re-derived from the plan.

**The gap:** Today a sophisticated user could bypass the
`ReadOnlyBanner` by making a direct `supabase-js .insert()` call from
the browser console, posting a message into an announcements chat or
into a chat they've been removed from. The UI prevents the casual
case; the data layer doesn't prevent the determined case.

**Policies to add when RLS gets enabled** (against tables `messages`
and `conversation_participants`):

1. **`messages` SELECT policy** — past-members can read messages
   posted up to and including their `left_at` timestamp:
   ```
   EXISTS (
     SELECT 1 FROM conversation_participants cp
     WHERE cp.conversation_id = messages.conversation_id
       AND cp.user_id = get_current_member_id()
       AND (cp.left_at IS NULL OR messages.created_at <= cp.left_at)
   )
   ```
   Use `get_current_member_id()` (returns `members.id`); do NOT
   compare `members.id` to `auth.uid()` directly — the
   `auth.uid() → members.user_id` indirection is handled inside the
   helper.

2. **`messages` INSERT policy** — active participants only:
   ```
   EXISTS (
     SELECT 1 FROM conversation_participants cp
     WHERE cp.conversation_id = messages.conversation_id
       AND cp.user_id = get_current_member_id()
       AND cp.left_at IS NULL
   )
   ```

3. **Announcements INSERT gate** — only `organization_staff` may
   INSERT into a conversation whose `conversation_type='announcements'`:
   ```
   EXISTS (
     SELECT 1
     FROM conversations c
     LEFT JOIN seasons s ON s.id = c.scope_id AND c.scope_type = 'season'
     LEFT JOIN leagues l ON l.id = s.league_id
     JOIN organization_staff os
       ON os.organization_id = COALESCE(
            CASE WHEN c.scope_type = 'organization' THEN c.scope_id END,
            l.organization_id
          )
     WHERE c.id = messages.conversation_id
       AND c.conversation_type = 'announcements'
       AND os.member_id = get_current_member_id()
   )
   ```
   Combine with the active-participant INSERT policy via `OR` — or
   build it as a separate explicit policy that augments INSERT only
   for announcement conversations. The plan author's note: be careful
   the staff-only gate doesn't accidentally close the door on
   non-announcement chats (use a `conversation_type='announcements'`
   guard).

4. **`conversation_participants` UPDATE/DELETE lockdown** — only
   triggers (SECURITY DEFINER) and `service_role` may set `left_at`.
   Without this, a malicious user could push their own `left_at` into
   the future to keep reading post-removal messages, or set it to NULL
   to lift the INSERT block:
   ```
   REVOKE UPDATE (left_at), DELETE ON conversation_participants
     FROM authenticated;
   GRANT UPDATE (notification_mode, last_read_at, is_muted,
                 notifications_enabled, unread_count)
     ON conversation_participants TO authenticated;
   ```

5. **Required test scenarios** (from the plan):
   - Past-member SELECT before `left_at` succeeds; after `left_at` blocked
   - Past-member INSERT blocked
   - Active member SELECT + INSERT normal
   - Boundary: `left_at = messages.created_at` is INCLUSIVE on SELECT
   - Non-participant SELECT blocked
   - User attempts to UPDATE their own `left_at` → blocked
   - Test against a user whose `auth.uid() != any members.id` they
     ever appear in (catches the production-bug class of using
     `members.id = auth.uid()` instead of `members.user_id`)

**Migration filename slot (reserved):**
`supabase/migrations/<future_date>_messaging_phase1_past_member_rls.sql`

**Existing tests to keep passing:**
`src/__tests__/database/messaging.rls.test.ts`,
`src/__tests__/database/members.rls.test.ts`.

**Why it was deferred 2026-05-12:** Ed has historically had
poor experiences debugging Supabase RLS policies that "don't even make
sense" and pays the iteration cost upfront on every feature. The
project's working pattern is "build features RLS-off, harden with RLS
later in one dedicated pass." This entry exists so when that pass
happens, none of the design work above has to be re-derived from the
plan.

---

## 30. Optional LO-Created Org-Wide Group Chat

**Discovered:** 2026-05-12 while finalizing the messaging Phase 1 chat model
**Severity:** LOW — future feature, not Phase 1

**The idea:** Today, the four auto-created chats per season are:
captain chat, team chats, season announcements (one-way), org
announcements (one-way). There is intentionally no auto-created
back-and-forth "everyone in the org" chat — a 200-player free-for-all
is a moderation disaster.

But: an LO may someday want a deliberate, opt-in, org-wide group chat
("the league's clubhouse"). The current data model already supports it
— the existing `createGroupConversation` SECURITY DEFINER function
handles arbitrary group chats. All this feature needs is:

1. An LO-only UI button: **"Start an org-wide chat"**
2. On click, call `createGroupConversation` with `member_ids` = every
   player currently active across the org's active seasons (same query
   as `createOrgAnnouncementsChat`'s participants snapshot).
3. The new chat is a normal back-and-forth `conversations` row —
   not `auto_managed=true`, so it doesn't get re-created by any
   trigger. The LO owns its lifecycle (rename, leave, delete).
4. Probably hide the button until the LO has at least, say, 5 active
   members in the org — guard against accidental creation in an empty
   org.

**Out of scope for Phase 1.** No schema change required when this lands.

## 31. Messaging Phase 2 — Plan Doc Needs Writing

**Discovered:** 2026-05-15 while triaging post-Phase-1 next steps
**Severity:** MEDIUM — not blocking, but Phase 2 is the next significant
chunk of the messaging overhaul and there's no plan doc for it yet.

**Context:** Phase 1 of the messaging overhaul is code-complete (units
1–9 shipped; units 10–14 added 2026-05-15 for polish, pending build +
final test). Phase 2 (push notifications, per-chat tri-state controls,
quiet hours, rate-limit, pause picker, `@mention` notification
routing) is fully described in the requirements brainstorm
(`docs/brainstorms/2026-04-21-messaging-system-overhaul-requirements.md`
§ "Phase 2 — Notification subsystem") but has **no plan doc** in
`docs/plans/` yet.

**Why this matters:** Phase 2 is what makes the messaging system
actually *trustworthy* — without push, mutes, rate-limits, and pause
controls, every new message tries to interrupt the user. The
hypothesis Phase 3 is supposed to test ("captains will use this over
SMS") only really tests fairly once Phase 2 has tamed notification
behavior. So this is *important*, not just *next*.

**What's needed:**

1. Read the brainstorm's Phase 2 section as the source of truth.
2. Write a `docs/plans/<date>-001-feat-messaging-overhaul-phase-2-plan.md`
   following the structure of the Phase 1 plan (Overview / Requirements
   Trace / Scope Boundaries / Open Questions / Implementation Units
   etc.). Use `ce-plan` if appropriate, or write directly.
3. Particular open questions from the brainstorm that the plan must
   close:
   - **Dispatch worker shape** (single Edge Function subscribing to
     INSERTs vs. DB-trigger + pg_net → worker?).
   - **APNs / FCM coordination with Jack** (mobile partner) — who
     holds the push-tokens table of record, who handles stale-token
     cleanup.
   - **pg_cron vs. Supabase Scheduled Edge Function** for any
     scheduled work (also Phase 3 question).
4. Schema items deferred from Phase 1 that land in Phase 2:
   - `members.notifications_paused_until` (the pause picker UI).

**When to start:** after Phase 1 ships (units 10–14 built + tests
pass + merge).

**Files this entry should disappear from once a plan exists:** delete
this entry from `LIST_FOR_ED.md` when the plan doc is written and
committed. The plan doc + its branch will then be the working record.

## 32. Pre-existing DB-Test Drift — 5 RLS Test Files Reference Dead Columns / Stale Embeds

**Discovered:** 2026-05-15 during Phase 1 end-to-end test pass
**Severity:** MEDIUM — tests are silently broken on main; nothing in
production is wrong, but the test suite gives a false sense of
coverage on the affected tables until fixed.

**Branch suggested:** `fix-drifted-rls-tests` (a small, scoped branch
— probably 30–60 min of mechanical edits).

**Context:** When the Phase 1 messaging-overhaul work cleaned up the
vitest config to stop sweeping `.worktrees/` (commit `41c4038`), the
full `pnpm test:run` got a real signal for the first time in a while
— and surfaced 15 failures spread across 4 non-messaging test files.
None are new failures from messaging work; all are pre-existing main
bugs where a migration renamed/dropped a column (or restructured a
relationship) and the corresponding test file was never updated. The
failures were hidden previously because the worktree noise drowned
the signal.

The messaging-side equivalent of this drift was fixed inline on the
messaging branch (commit `61794ca`, file `messaging.rls.test.ts`).
The 4 files below are non-messaging and were left for a separate fix
branch per scope.

**Files + drift:**

1. `src/__tests__/database/matchLineups.rls.test.ts` (**7 failures**)
   References `lineup_position` and `player_id` on `match_lineups`,
   which were renamed by the Phase 2 modular-system rename family
   (look at the `home_to_win` / `home_to_tie` rename migration
   `20260502000002_prep_match_rpc_renamed_columns.sql` and related
   commits — the lineup column names changed in that family).
   Fix: read the current `match_lineups` schema in
   `20251130010824_baseline.sql` (+ any later ALTERs), update the
   test's `.select` / `.update` / `.insert` column names to match.

2. `src/__tests__/database/operator.rls.test.ts` (**6 failures**)
   PostgREST ambiguous-embedding error:
   `PGRST201 — Could not embed because more than one relationship
   was found for 'organizations' and 'members'`. Two FKs now connect
   the tables: `members.organization_id` (placeholder org
   attribution) AND `organizations.created_by` → `members.id` (LO
   creator). PostgREST refuses to auto-pick.
   Fix: in any `.select(\`*, members(...)\`)` style embed in the
   test, disambiguate with the explicit FK syntax PostgREST
   suggests: `members!members_organization_id_fkey(...)` or
   `members!organizations_created_by_fkey(...)` depending on
   which side the test means.

3. `src/__tests__/database/matches.rls.test.ts` (**1 failure**)
   References `match_date` column on `matches`, which doesn't exist
   (the actual column is likely `scheduled_at` or similar — check
   the baseline migration).
   Fix: one-line rename in the INSERT around test file line 216.

4. `src/__tests__/database/venues.rls.test.ts` (**1 failure**)
   References `venues.address` column, which doesn't exist on the
   current `venues` table (the venue-table-configuration migrations
   restructured this).
   Fix: read the current `venues` columns and update the test's
   embed/select.

5. `src/__tests__/database/matchGames.rls.test.ts` (**4 failures**)
   *(Added 2026-05-25 during many-eyes Phase 1 — a 5th drifted file
   beyond the original 4.)* Two drifts: (a) it `update({confirmed_by_home:
   true, confirmed_by_away: true})`, but those columns are `uuid` (the
   confirmer's member id) in the baseline — Postgres rejects `"true"` as
   a uuid; (b) the break_and_run / golden_break tests share one
   `testGameId` and don't reset it, so setting `golden_break=true` after
   `break_and_run=true` trips the `NOT(break_and_run AND golden_break)`
   CHECK. Fix: set `confirmed_by_*` to a real member uuid (or drop those
   asserts), and reset the game row between the B&R / golden-break cases.
   **Proven pre-existing** (fails identically at base commit `073c7d2`,
   before any many-eyes work).

**Why these were invisible until now (2026-05-25):** the `db` vitest
project couldn't even boot locally — `jsdom` was declared in
`package.json` + the lockfile but never materialized into `node_modules`,
so `pnpm test:run` errored the whole `db` project ("Cannot find package
'jsdom'") instead of running it. A plain `pnpm install` materialized it,
which unmasked all of these pre-existing failures (and let the new
many-eyes db-tests run). If `pnpm test:run` was "green" before, it was
because the db project was silently not executing.

**How to verify a fix:**

```
pnpm db:reset
# paste database/dev_starting_point.sql in Studio SQL editor → Run
pnpm test:run > test-output.log 2>&1
```

Expected after fix: zero failures across all 5 files.

**Note on RLS posture:** Per project memory
`project_rls_disabled_in_dev`, RLS is currently DISABLED on most
tables in dev. So these files are functioning as schema-CRUD smoke
tests today, not actual RLS enforcement tests. Fixing the column
drift now means they'll start *actually testing* what they claim to
as soon as the RLS-enablement project (LIST_FOR_ED #29) gets picked
up. This work and the RLS enablement are independent — either can
ship first.

---

## 2026-05-26 — Relax `match_games` position CHECK constraint for 6v6+

**Branch needed:** small migration PR — e.g. `chore/relax-match-games-position-check`

**Discovered:** 2026-05-26 during the Pairings Generator (Module #8)
v1 extraction. The new Module itself is lineupSize-agnostic — it
accepts any positive integer + either round-robin mode and produces
the correct slot list. Cross-combo tests confirm 6v6 SRR (36 games)
and 6v6 DRR (72 games) generate cleanly.

**The problem:** the DATABASE blocks 6v6+ even though the Module
allows it. `match_games.home_position` and `match_games.away_position`
have CHECK constraints capping the value at 5:

```
CONSTRAINT match_games_home_position_check
  CHECK ((home_position >= 1) AND (home_position <= 5))
CONSTRAINT match_games_away_position_check
  CHECK ((away_position >= 1) AND (away_position <= 5))
```

So if a league ever configures `lineup_size = 6` (or larger), the
prep_match RPC would fail at insert time with a constraint violation
the moment it tries to write the first row with `home_position = 6`.

**Fix direction:** one tiny migration that drops the two CHECK
constraints and replaces them with looser ones (e.g. `>= 1 AND <=
20`, matching the `preferences_max_roster_size_check` ceiling that
already exists). No data backfill needed; this only widens what's
acceptable for future writes.

**Status:** no plan exists yet. Not blocking anything today since no
shipping system uses 6v6+. Just sitting on the bottleneck so the
Module's lineupSize-agnosticism is realized end-to-end when an LO
eventually wants a larger lineup.

**See also:**
- `docs/plans/2026-05-25-001-refactor-pairings-generator-extraction-plan.md`
  Scope Boundaries section ("No `match_games` schema change") — this
  ticket is the explicit follow-on noted there.
- `src/systems/pairings/__tests__/pairings.test.ts` — the Module
  tests that prove 6v6 already works at the Module level.

---

## 2026-05-26 — Substitution system broken at lineup-lock (duplicate-players error)

**Branch needed:** investigation branch — e.g. `fix/lineup-sub-duplicate-players`

**Discovered:** 2026-05-26 during the Pairings Generator (Module #8)
smoke test. Trying to enter an **anonymous sub** in a lineup and lock
it now throws an error referencing "duplicate players not allowed."

**Likely NOT caused by the Pairings Generator extraction** — that
change only affected the per-row mapping at prep_match time. The
lineup-assembly path (`myLineup` build-up) and sentinel handling for
anonymous subs were left untouched. More likely fallout from an
earlier modular change (suspect: a recent DB constraint addition or
prep_match RPC change). Verification needed: try anonymous sub on an
older commit (before this branch) to confirm the bug pre-exists.

**Reproduction:**
- Open a match (any league)
- Try to lock a lineup that includes an anonymous sub placeholder
- Error appears mentioning duplicate players

**Untested as of this note:**
- The **double-duty** sub path — needs to be re-checked separately;
  unknown if it's broken too or if only the anonymous-sub path is
  affected. Recommend retesting both before opening a fix branch so
  the scope is clear.

**Severity:** HIGH if confirmed — sub workflows are core to match-night
operations. Captains MUST be able to use anonymous subs (and
double-duty) without errors.

**Fix direction (once root cause is identified):**
- Find the source of the "duplicate players not allowed" check —
  could be a UNIQUE constraint added in a recent migration, an
  app-level guard, or a CHECK constraint on `match_games`.
- Decide whether sentinel values should bypass the duplicate check,
  or whether the sentinel scheme itself needs to change to produce
  unique per-row sentinels.
- Verify the fix on both anonymous-sub and double-duty paths.

## 33. LO Team-Edit Nav — Don't Force Matchups Page After

**Discovered:** 2026-05-26 while setting up multi-confirmer test logins
for many-eyes Phase 2 manual testing.

**The issue:** When an LO edits a team (adding/removing players, swapping
roster), the app navigates them into the season's matchups page after
the save. That's an unnecessary forced detour — LOs editing rosters
don't need to land on matchups; they may want to return to the team
list, the org dashboard, or just stay on the team page they were on.

**Fix:** Either (a) stay on the team-edit page (or the team-list page) on
save, or (b) navigate back to wherever the user came FROM (the previous
route in history) — the latter is the more general "respect where the
user was" fix.

**Where to look:** the team-edit save handler / mutation. Likely in
`src/operator/TeamManagement.tsx` or similar — wherever the post-save
`navigate(...)` call lives that ends up at the matchups route.

**Severity:** LOW — UX papercut, no data risk. Just annoying when doing
roster work that doesn't need matchups context.

---

## 34. Tappable PlayerName Component — Reveal Full Name on Tap

**Discovered:** 2026-05-27 while polishing the many-eyes Phase 2 dispute
modal copy.

**The issue:** Across the app, we display player names as plain text via
`getPlayerDisplayName` / `getPlayerNicknameById`. Per
`feedback_nickname_is_mobile_primary`, nickname IS the mobile primary
display — but users sometimes need to see the full name to disambiguate
(two "Jack"s on different teams, a nickname they don't recognize, etc.).
Today there's no way to surface the full name without leaving the screen.

**The behavior we want:** any place a nickname is shown should be
tappable; tapping reveals the player's full name (first + last) in a
tooltip / popover / expanded inline element. Consistent everywhere — not
piecemeal.

**Surfaces affected (incomplete list):**
- Dispute UI (`DissentFlag.tsx`, `DisputeDetailModal.tsx`) — Phase 2.
- `GamesList.tsx` — player buttons + completed-game labels.
- `UnifiedScoreboard.tsx` — score rows.
- `ConfirmationDialog.tsx` — winner name in the prompt modal.
- The lineup chain, MyTeams cards, anywhere `getPlayerDisplayName` is
  the visible output.

**Approach (suggested):**
1. Build a shared `<PlayerName />` component (props: full Player object
   with `first_name`, `last_name`, `nickname`). Renders nickname; on
   tap/hover, shows a popover with the full name + maybe BCA# if known.
   Reuses shadcn `Popover` or `Tooltip`.
2. Adopt incrementally — start with one surface (e.g. dispute UI), then
   roll through the others one PR at a time. Each adoption is mechanical
   (replace `{getPlayerDisplayName(id)}` with
   `<PlayerName player={players.get(id)} />`).

**Severity:** MEDIUM — real UX gap (especially in larger leagues with
nickname collisions), but no data integrity risk. Best done as its own
focused branch so the component lands properly + gets adopted
consistently.

**Family:** related to `project_placeholder_badge_remaining_surfaces` —
both are "consistent player-info display across the app" cleanups.

---

## 2026-06-06 — Weekly Tip Toast ("Did You Know?" feature discovery)

**Discovered:** 2026-06-06 conversation
**Severity:** Enhancement — feature-discovery nudge, no data risk
**Branch needed:** own small branch, e.g. `feat/weekly-tip-toast`

**The idea:** a little toast on app entry that surfaces one bite-sized
"did you know?" tip about a feature people would otherwise never stumble
onto (auto-confirm a game when you trust the opponent to score; the team
group chat we auto-create and auto-add new members to; placeholder
players; vacate-and-rescore; the LMS results sheet). It hangs ~a minute,
then auto-dismisses. Classic tip-of-the-day pattern.

**The design Ed settled on (this is what makes it cheap):**

- **Everyone sees the SAME tip in a given week** — the current tip is a
  pure function of *what week it is* (week number → index into a fixed
  list), NOT a per-user random rotation. This is the key call: it means
  there is NOTHING to track per user except "have I already seen *this*
  week's tip?" — a single throwaway flag. No per-user seen-set in the DB.
- **Fixed hand-written list of ~50–100 tips.** At weekly cadence that's a
  ~1–2 year loop before any repeat, by which point it reads as fresh. The
  tip list IS the real work; the plumbing is tiny.
- **Shows once/week**, the first time the user opens the app / lands on a
  page that week, then it's done until the week rolls over.
- **Seen-flag = browser localStorage** (per-device). Tradeoff: open on
  phone then laptop and you might see that week's tip twice — harmless for
  a once-a-week nudge, so don't pay for cross-device sync here.
- **Missed a week?** Nothing to catch up — you just never saw that week's
  tip; it swings back around in ~a year. No backfill queue.

**The off-switch (comes last, but DOES need the DB):** "I don't want tips
at all" is a preference *about the user*, so it must follow them across
devices — that means a real account-level setting (a column on the user/
member preferences), NOT localStorage. Otherwise turning tips off on the
phone still shows them on the laptop, which makes the toggle feel broken.
This is the one piece that needs schema; everything else is schema-free.
Buried in settings is fine — it's a release valve, not a discovery surface.

**LO tips:** same trick, keyed to the *month* instead of the week, with
its own tip list and its own flag, shown when an LO lands on the LO
dashboard. Monthly cadence so it's not naggy for frequent operators.

**Effort:** small. A hand-written tip list + a one-line "what week is it →
which tip" rule + a per-device seen-flag + (last) one account preference
for on/off. We already have a toast system to render it. No migration
except that single on/off preference column.

**Nice-to-haves deferred:** role-aware tips (tag each tip player/captain/
LO so a plain player doesn't get a captain-only tip — we already know each
user's role); upgrade the seen-flag from localStorage to a per-user DB
record only if cross-device double-show ever actually bugs anyone.
