# List for Ed

Tasks and refactoring items for Ed to work on.

---

## 🧪 2026-08-04 — VERIFY: tiebreaker scoring fix (PR #249)

**Bug (live):** the first match to end in a games **tie** couldn't be scored —
captains confirmed the tie, then got "Both team lineups must be locked before
scoring can begin" and were kicked to My Teams. Cause: on a tie the app unlocks
both lineups and sends captains to the tiebreak **lineup** page, but the route
guard (`MatchPhaseGuard`) saw `status='in_progress'` and force-redirected them to
the **scoring** page, which demands locked lineups. Fix teaches the guard the
"tiebreaker window" via `matches.match_result='tie'` so it stops bouncing them.
Branch `fix/tiebreaker-scoring-lineup-lock`, **PR #249**.

**👉 YOU (or whoever can reproduce a tie) NEED TO DO: verify on staging.** Play a
match to a real games tie, confirm the tie on both teams, and check you land on
the **tiebreak lineup page** (not the error card). Enter + lock both tiebreak
lineups → you should reach the tiebreak scoring page → score games 19–21 →
match completes with a winner. Unit-tested at the routing layer, but a live
2-device tie was NOT run — this is the confidence check.

---

## 🧪 2026-06-30 — Schedule ⇄ Matchup decoupling: TEST A+B, then Phase C

**The two-"Week 14" bug is fixed** on branch `feat/schedule-matchup-decoupling`
(the duplicate came from *storing* the week number, written by several code
paths that disagreed). The refactor stops storing it and **derives "Week N" from
each week's date position**. Plan:
`docs/plans/2026-06-14-001-refactor-schedule-matchup-decoupling-plan.md`.

**Done + in the PR (Phases A + B):**
- A — every display surface + the operator edit-lock derive Week N from position.
- B — migration `20260621000000`: blackout labels moved to the `notes` column,
  the redundant `season_end_break` week type collapsed into `blackout`; all
  writers + the reflow/toggle chain aligned.

**👉 YOU NEED TO DO: verify A+B on staging.** Log in, open a league's schedule
(operator schedule page, the manage/dates page, and a team's schedule) and
confirm: weeks read **consecutive Week 1…N with no duplicate**, blackouts show
their label, the season-length lengthen/shorten still works. The Lucky Cue
9-ball Summer 2026 season is the one that had two "Week 14"s.

**HELD for a follow-up PR — Phase C (drop the `week_name` column).** This is the
final cleanup (remove the now-dead column + its ~110 references). The plan
**deliberately sequences it AFTER A+B are staging-verified** — once the column
is gone there's no fallback if a reader was missed. So: **once you've verified
A+B above, tell Claude to do Phase C.** Until then the column stays (harmless —
nothing reads it).

---

## 📋 2026-06-13 — league-page wiring + playoff/seed session follow-ups

Shipped this session (PRs awaiting Jack): #229 playoff review page (merged),
#233 league-page card order + button wiring + "Matchups" title/URL rename,
#234 seed makes playoff matchups start empty. Lingering:

1. **Rename the dates page to "Schedule" (DEFERRED — do after season-length lands).**
   `SeasonScheduleManager` is the dates/blackouts page but is still titled
   **"Manage Schedule"** at **`/manage-schedule`**. It should be **"Schedule"** at
   **`/schedule`** (now free — the matchups page moved to `/matchups`). Held back
   because the **season-length recovery is editing that exact file**
   (`SeasonScheduleManager.tsx`) — renaming now would collide. Once it lands: rename
   the route in `NavRoutes.tsx`, the regex in `BottomTabBar.tsx:27`, the nav in
   `ScheduleCard.tsx:177`, and the page title (`SeasonScheduleManager.tsx:409`).

2. **Re-land the Change Season Length feature (#211 got stranded).** PR #211 was
   stacked on `fix/blackout-reflow` and merged into *that* branch — but it had
   already gone to main (via #209) first, so #211 never reached main. The feature
   is fully built on commit `b0741a87` (dialog `ChangeSeasonLengthDialog.tsx` +
   gated early-season button on `SeasonScheduleManager` + plan/brainstorm docs).
   Needs cherry-picking onto a fresh branch off main + conflict resolution + a clean
   PR. *(Other computer was on this.)* Once in, its button is reachable via the
   Schedule card → dates page.

3. **Stale `supabase/seed.sql` (709KB).** `config.toml`'s `sql_paths` points at it,
   but it references the dropped `team_format` column → won't load (seeding is
   disabled, so `db reset` skips it anyway). You restore from
   `database/dev_starting_point.sql` instead, which is current. Either regenerate
   `seed.sql` from a migrated DB (`supabase db dump --local --data-only`) or delete
   it, and decide whether seeding stays disabled.

4. **Seed gaps (optional).** Clean-DB tests reveal: (a) the seed has **no scored
   games** (`match_games` = 0) → `appendConfirmation` + `gameConfirmations.schema`
   tests can't find a fixture; (b) **no finished-season fixture** → can't actually
   watch the playoff auto-populate (all seed seasons are 1/16 weeks). Add a played
   match with games + a complete-season fixture if you want those green / to test
   the playoff automation end-to-end.

5. **Onboarding self-add join-request bug (REAL — likely what Jack saw, not
   playoffs).** On a clean DB, `request-team-join` + `approve-surface-roster` DB
   tests fail: `null value in column "team_id" of relation "team_join_requests"
   violates not-null constraint`. A league-scoped "self-add" request inserts no
   `team_id`, but the column is NOT NULL. Schema-vs-code mismatch in the onboarding
   cascade — needs whoever owns onboarding. Either make `team_id` nullable or have
   the RPC not write a team-less row.

6. **Optional label sweep.** The "View Schedule" buttons on `PlayerProfile` and the
   `LeagueDetail` next-season panel now open the **Matchups** page (URL updated, they
   work). I left those labels — some are player-facing where "schedule" reads fine.
   Sweep to "Matchups" if you want full consistency.

---

## 🌅 PICK UP HERE — night of 2026-06-09 (bye-team firefight + the day's fixes)

Most of the 2026-06-09 bye-team firefight shipped: auto-forfeit sweep, the
"Add Team" gate when a bye exists, the "populate the bye" fill action
(`TeamEditorModal` flips bye→active; `TeamCard` shows a **Fill** button), and
blackout auto-shift on already-active schedules (`scheduleReflowApply.ts`). Still open:

1. **Finish the bye-detection migration** — two spots still detect a bye via
   `home_team_id === null || away_team_id === null` instead of `status === 'bye'`:
   `src/operator/SeasonSchedulePage.tsx` (~line 147) and
   `src/wizards/matchups-v2/steps/ReviewStep.tsx` (~line 107). Migrate both.
2. **Remove-the-bye action** — there's a **Fill** button on a bye row but no
   **Remove**. Add a delete affordance (delete → regenerate matchups at the new
   even count).

**Paused (separate):** Player-picker consolidation brainstorm — parked at Site 2 of 8;
mid-walkthrough, no doc written yet.

---

## 🚪 Gated — awaiting staging review + un-gate

Features merged to `main` but NOT yet live for users (see **Feature Gating
Workflow** in `CLAUDE.md`). Reviewed on staging, then un-gated — and removed
from this list when un-gated.

- **Scoring Workshop** — still in active development; it had shipped to production
  **un-gated** by accident. Now gated by `!isProduction` in two places:
  the dashboard card (`src/operator/OperatorDashboard.tsx`) AND the routes
  (`src/navigation/NavRoutes.tsx` — `operator/scoring-workshop[/...]`). Verify on
  staging it still shows there; un-gate (remove both `!isProduction` guards) when
  it's ready for users.

- **Message Push Notifications (client side, Units 1–6)** — branch
  `feat/message-push-notifications`. The subscribe flow + UI are done, but nothing
  SENDS a push yet (the dispatcher edge function + DB trigger are Units 7–8, a
  separate follow-up PR). Gated by the `PUSH_NOTIFICATIONS_ENABLED` flag in
  `src/config/featureFlags.ts` (on in dev, OFF in production unless
  `VITE_PUSH_NOTIFICATIONS=true`). Both user-facing entry points are gated with it:
  the first-run onboarding prompt (`src/pages/Messages.tsx` → `showPushOnboarding`)
  AND the Settings toggle (`src/components/messages/MessageSettingsModal.tsx` →
  Notifications section; falls back to "Coming soon" when off).
  Units 7–8 (dispatcher + trigger) are done too — PR #255, stacked on this one.
  **Staging is auto-enabled on merge:** `deploy-staging.yml` now sets
  `VITE_PUSH_NOTIFICATIONS=true`, bakes in the public key, and deploys the edge
  function. The only manual staging step is the **one-time secret setup** (GitHub
  `staging` env `VITE_VAPID_PUBLIC_KEY`; Supabase function secrets; one
  `push_dispatch_config` SQL UPDATE) — see the "Staging setup (one-time)" section
  in `docs/ops/push-notifications-secrets.md`. After that, test on a phone via the
  staging HTTPS URL (iOS: Add to Home Screen first).
  **Do NOT un-gate production** until a real end-to-end push is verified on staging —
  then set `VITE_PUSH_NOTIFICATIONS=true` for the production build + the prod Supabase
  secrets + `push_dispatch_config`, and remove this entry.
_(LO Manual Scoring + Match Review/Correction and the LMS Results Sheet were
un-gated and went LIVE in production 2026-06-21 — see `feat`/`fix` un-gate
commit. The half-gated bug that prompted it: the "Score a Match" button +
printer icon were ungated while their routes were `!isProduction`, so they
404'd in production.)_

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

## 🚨 2026-04-21 STAGING TEST — remaining failure (staging email)

**Discovered:** 2026-04-21 during first real-player staging test at the league event

> **Update 2026-06-12:** Issues 2–4 are **fixed** and removed — Fargo 5v5 now routes to the
> real 5v5 games creator (all 5 players, single round robin; `src/systems/fargo5v5.ts` + pairings
> tests), double-duty is guarded/resolved before prep, and Fargo start-points are computed from
> frozen ratings (`computeMatchPrepPayload.ts`, tested). Only **Issue 1 (staging has no outbound
> email)** remains — and it's an environment/config matter, not app code (the `send-invite` edge
> function uses Resend and degrades gracefully when `RESEND_API_KEY` is unset).

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

---

## 38. "Verify Scores" Button Is Available to Every Scoreboard Viewer (should be the two match teams only)

**Discovered:** 2026-06-14 (Ed, reviewing the live scoring page)
**Severity:** MEDIUM — wrong-actor can finalize a match's verification; no
data corruption, but it lets a non-participant verify scores they have no
standing to verify.

**The problem:** At the end of a match the live scoring page swaps its header
for `MatchEndVerification.tsx`, which renders a **"Verify Scores"** button.
That button is `disabled={userTeamVerified || isVerifying}`
(`src/components/scoring/MatchEndVerification.tsx:715-728`) — it is **never
gated on whether the current user is actually on one of the two teams in this
match.** So any player who can open the live scoreboard (spectator, a player
from a different match/league, a guest) sees a live, clickable Verify button.
The component's own docstring claims *"Verify Scores button (enabled only for
user's team)"* (line 11) — so the intent was always to gate it; the code just
never did.

**Why it reads as "part of the scoreboard":** the verify UI lives *inside*
the scoreboard/end-of-match header component, so it inherits the scoreboard's
audience. The fix is to gate the actor, not necessarily to relocate the UI.

**Fix direction:** add a "is the current user a participant in THIS match"
check (on one of the two teams' rosters / captains) and only render or enable
Verify for them. Consistent with [[feedback_gate_ui_relax_rls]] — gate the
button in the UI; don't add server-side identity guards. Note the nuance:
"anyone on the scoring page is a scorekeeper" still holds for *entering
scores*; **verification** is the narrower act that should belong to the two
teams playing.

**Files:** `src/components/scoring/MatchEndVerification.tsx` (button + the
`userTeamVerified` / `onVerify` wiring), and wherever it's mounted
(`src/player/ScoreMatch.tsx`).

---

## 39. Dark-Mode Button Contrast on the Scoring Page (text barely visible)

**Discovered:** 2026-06-14 (Ed, reviewing the live scoring page)
**Severity:** MEDIUM — accessibility/readability; some scoring-page buttons
have text that's barely legible in dark mode. Ed did an earlier contrast pass
but some spots were missed.

**The problem:** On the scoring page, certain buttons render with poor
text-on-background contrast in dark mode (text nearly invisible). Likely the
same class of bug as [[feedback_dark_mode_fixed_bg_text_colors]] — a
fixed-color background paired with a theme-variable text color (or vice
versa), so the pairing inverts and washes out under the dark theme.

**Fix direction:** sweep every button on the scoring surface and check its
foreground/background pairing in **both** light and dark mode. Anywhere a
fixed background (e.g. `bg-*-50`, a status color) is used, pair it with a
**fixed** readable text color rather than `text-foreground` /
`text-muted-foreground` (which flip with the theme). Keep
[[user_colorblind]] in mind — state must not be conveyed by color alone, so
while fixing contrast, confirm any color-coded button also carries a
text/icon label.

**Files likely involved (scoring surface):**
`src/components/scoring/UnifiedScoreboard.tsx`,
`src/components/scoring/ThreeVThreeScoreboard.tsx`,
`src/components/scoring/GamesList.tsx`,
`src/components/scoring/MatchEndVerification.tsx`,
`src/player/ScoreMatch.tsx` — plus any shared scoring button helpers.

