# New Season From Previous — Requirements / Brainstorm

> **Date:** 2026-05-17
> **Status:** Brainstorm; needs Ed sign-off on recommended defaults before implementation
> **Estimated scope:** ~1 day code + ~0.5 day testing once decisions are locked
>
> **2026-05-17 update — separation of concerns rule (per Ed):**
> Teams are owned by captains, not operators. The operator's only
> jobs at season-creation/copy time are: (a) confirm how many teams
> are returning, (b) make sure each one has a captain. **Rosters
> are NOT operator-touchable in this flow.** They carry forward
> silently; captains adjust them post-activation via TeamEditorModal.
> This drops the "Step 3 — Rosters" wizard step entirely. Same rule
> should be applied to the first-time league-creation wizard if it
> currently asks for rosters up front (separate scope).

---

## The problem

Today, the only way to set up a season is from scratch — operator runs the league-creation wizard, configures everything, then manually creates every team and adds every player. End-of-season → start-of-next-season is the **highest-frequency operator task** and right now it's a full re-entry exercise.

Reality: a typical league re-runs every 3 months with 80–95% of the same teams and rosters returning. Re-typing all that is the #1 thing that makes operator tools feel painful.

## The goal

One-button "start the next season for this league" that:
- Carries forward teams and rosters (with edit-as-you-go)
- Generates a new schedule on the same pattern as the previous season
- Skips the league-creation step entirely (league already exists)
- Hands the operator a runnable season in under 5 minutes for the common case

## What's in scope

- New entry point from the league dashboard / operator view: **"Start Next Season"**
- A guided flow (lighter than the full league-creation wizard) that walks the operator through:
  1. New season name + dates
  2. Confirm returning teams (with edits)
  3. Confirm rosters per team (with edits)
  4. Confirm/edit schedule pattern
  5. Activate (which fires the existing Phase 1 messaging triggers — new team chats + captains chat auto-created)

## What's explicitly out of scope

- **Changing league preferences** (handicap system, format, scoring, points) between seasons. If those change, treat it as a new league. Keeps the "next season" flow clean for the 99% case.
- **Cross-league team copy** (the "Knights play Tuesday now also Thursday" case). That's a separate primitive — `copy-team` — and can be built later as a standalone feature.
- **Importing from external sources** (CSV, BCA export, etc.). Separate roadmap item.
- **Mid-season changes** (this flow is for SEASON-to-SEASON only; mid-season roster edits already work via TeamEditorModal).

---

## Open product decisions — recommended defaults

These are the load-bearing UX calls. Each has a "fast default" that handles the common case; edge cases get explicit handling.

### 1. Team carry-forward default — **OPT-OUT (recommend)**

All teams from the previous season show up checked by default. Operator unchecks teams that aren't returning. One click per dropped team instead of one click per returning team.

> *Why:* in a 12-team league with 11 returning and 1 dropping, opt-out is 1 click; opt-in is 11 clicks. The 80% case wins.

### 2. Missing captain — **block with explicit "pick a new captain" prompt (confirmed by Ed 2026-05-17)**

If a returning team's captain has been archived, deleted, or otherwise unavailable, the team's row in the confirm-teams step shows a yellow warning and won't let you proceed until you've picked a new captain. The LO is the only one who can assign captains.

> *Why (Ed):* "if captain is dropped it needs to be assigned by LO." A team without a captain is unrunnable, and captain reassignment is one of the few operator-only actions in the team domain.

### 3. Archived/missing roster players — **carry as vacant slots, show informational badge, NEVER block (confirmed by Ed 2026-05-17)**

Roster gaps are the captain's problem, not the operator's. Surface a "N vacancies" badge on the team row purely as info ("FYI, captain will need to fill these"); never block activation on it. Captain edits the roster post-activation via TeamEditorModal.

> *Why (Ed):* "teams are controlled for the most part by the captains. they change name add remove players etc." Operators shouldn't be doing the captain's job at season-creation time.

### 4. Schedule generation — **auto-copy previous pattern + edit dates (recommend)**

Read the previous season's schedule pattern (start day, start time, week count, week-of-year offsets like holiday skips) and pre-fill the schedule wizard step with the same. Operator edits the dates and confirms.

> *Why:* most leagues run the same day/time forever. Re-deriving from scratch each season is busy-work.

### 5. League preferences — **read-only display, link to "change" in league settings (recommend)**

Show the operator a summary of the league's current preferences (handicap, format, scoring, etc.) in the season-copy flow. If they want to change them, they click a link that takes them to league settings — those changes apply to all future seasons, not just this one.

> *Why:* keeps the "copy season" flow simple. Preference changes are rare and have league-wide implications, so they shouldn't be smuggled into a season-copy.

### 6. Home-venue carry-forward — **carry forward + validate (recommend)**

Each team's `home_venue_id` carries forward as-is. If a team's previous home venue is no longer assigned to the league, show a warning on that team's row and require the operator to pick a new one before activating.

> *Why:* same pattern as #2 (missing captain). Predictable rule, surfaced early.

### 7. Phase 1 messaging integration — **let the existing trigger handle it (no special-casing)**

When the new season is activated, the existing `auto_create_season_conversations` trigger fires. New team chats and a new captains chat get auto-created for the new season. The previous season's chats stay around (past-member visibility from Phase 1 Unit 20 handles archived access).

> *Why:* the trigger is already idempotent and was specifically designed for this. Don't reinvent.

### 8. Allow copy before previous season is finished — **block with friendly message (recommend)**

If the operator clicks "Start Next Season" while the current season is still `active`, show a confirm dialog: *"This season isn't finished yet. You can either (a) wait until you mark it complete, or (b) start the next season anyway — both will run in parallel and may confuse players."* Default action is wait.

> *Why:* parallel seasons of the same league are technically possible but rare and confusing. Block-with-escape-hatch is safer than silent allow.

---

## Proposed flow (UX sketch)

```
[Operator Dashboard]
  → "Start Next Season" button on a league with at least one completed season

[Step 1: Season details]
  - New season name (prefill: "Spring 2026", "Season 5", etc.)
  - Start date (prefill: previous_end_date + 1 week)
  - End date (prefill: start_date + previous_season_length)

[Step 2: Returning teams + captains]
  - Table of teams from previous season, all checked
  - Per-row: team name (editable but optional — captain can rename later),
    captain (dropdown), home venue (dropdown if needed)
  - Yellow row warning if captain is broken (must be fixed before activation)
  - Informational "N vacancies" badge if archived players left roster gaps —
    NOT blocking; captain handles post-activation
  - Uncheck = team is NOT returning
  - Bottom: "Add new team" button (just team name + captain, like first-time setup)

[Step 3: Schedule]
  - Pre-filled with previous season's pattern (day/time/skip-weeks)
  - Operator edits dates and confirms

[Step 4: Review + Activate]
  - Summary of what's being created: N teams, K matches
  - "Activate Season" button
  - On activation: season status → 'active', auto_create_season_conversations trigger fires,
    team chats + captains chat created, ready to score
  - Captains get a welcome message in their team chat: "New season started.
    Open your team to confirm/edit your roster."
```

---

## Schema / data movement

No new tables. Pure orchestration over existing schema:

| Source (previous season) | Destination (new season) | Notes |
|---|---|---|
| `seasons` row | New `seasons` row | Same `league_id`, new dates, status='upcoming' (then 'active' on activation) |
| `teams` rows where `season_id = prev` | New `teams` rows with `season_id = new` | Carry forward `team_name`, `captain_id`, `home_venue_id`; reset `roster_size` to per-row default; new `id` |
| `team_players` rows for those teams | New `team_players` rows linked to new team IDs | Skip archived members; preserve `is_captain` flag |
| `matches` table | Regenerated via existing schedule generator | Not copied — schedule wizard step produces fresh matches |
| `conversations` (auto chats) | Created by existing trigger on season activation | No copying needed |

**Implementation likely lives in a single Postgres RPC** that takes `(previous_season_id, new_season_params)` and returns the new `season_id` + a summary of what was carried forward. Atomic — either everything copies or nothing does.

---

## Risks / edge cases

- **Concurrent operators** — two operators clicking "Start Next Season" at the same time. Block the second one with a friendly "another operator is starting this season; refresh."
- **Very large leagues** (20+ teams × 20+ roster slots) — copy needs to be transactional but shouldn't time out. The RPC approach handles this naturally.
- **Operator changes their mind mid-flow** — the new season starts in `status='upcoming'`, not `'active'`, so abandoning the flow leaves a half-configured upcoming season. Need a "Cancel Setup" affordance that deletes it cleanly.
- **A team's captain isn't a player anymore but is still a member** — captain still works (captain is a member, not a player record). Only blocks if the member is archived/deleted entirely.

---

## Open questions for Ed (please confirm before I code)

1. **Default for #1 (team carry-forward) — opt-out OK?** Or do you want opt-in?
2. **Default for #2 (missing captain) — block + prompt OK?** Or carry forward with no captain and warn?
3. **Default for #3 (missing players) — vacant slot + count OK?** Or have an explicit "replace these N players" step?
4. **Default for #4 (schedule) — copy pattern OK?** Or always re-run the schedule wizard from scratch?
5. **Default for #8 (allow during active season) — block by default OK?**
6. **Where does the "Start Next Season" button live?** My pick: on the league's operator dashboard, visible only when a `completed` season exists for that league.
7. **Should this be its own wizard route, or a multi-step modal?** My pick: full route (`/operator/start-next-season/:leagueId`) because of the multi-step flow and the eventual schedule-editing step.
8. **Anything I'm missing about how YOU run end-of-season today** — what's the manual process you'd be replacing? That'll catch any decisions I've gotten wrong.

---

## What ships after this

Once new-season-from-previous is shipped:

- **Copy-team** becomes a much smaller follow-up (probably half-day). The "carry forward + edit" pattern in step 2/3 is the same primitive, just applied across leagues instead of across seasons.
- **Operator "starting from scratch" wizard** stays the same — this doesn't replace it, just adds an alternative entry point for the common case.
- **Future:** "Copy season FROM another league" (e.g., "make my Thursday league look like my Tuesday league") is the same primitive with a different source picker. Cheap follow-up if ever requested.
