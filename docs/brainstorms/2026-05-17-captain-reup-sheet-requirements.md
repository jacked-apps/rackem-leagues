# Captain Re-Up Sheet — Requirements / Brainstorm

> **Date:** 2026-05-17
> **Status:** Brainstorm; needs Ed sign-off before plan + implementation
> **Estimated scope:** ~1.5–2 days code + 0.5 day testing once decisions are locked
> **Related:** `docs/brainstorms/2026-05-17-new-season-from-previous-requirements.md` — this is the follow-up feature that feeds pre-populated data into that wizard
> **Originally captured in:** `memory-bank/futureFeatures.md` under "League Operator Management Features" — that entry can be deleted once this brainstorm is committed

---

## The problem

Today, when an operator wants to roll a league forward into the next season, they have to chase every captain individually ("are you coming back? same captain? any roster changes?") via captains-chat, in-person, or texts. Then they aggregate the responses in their head and walk into the new-season wizard. **The wizard now exists (PR feat/new-season-from-previous), so the wizard side of "ease the transition" is solved.** The remaining friction is the data-collection step — the LO is still the human collector, the captains are still answering ad-hoc.

## The goal

Auto-collect the structured handful of facts the new-season wizard needs, directly from the captains, with the lightest-possible captain UX:

- Will your team be playing next season?
- Captain stays the same OR who's the new one?

That's it. Anything else (roster changes, "looking for new players," etc.) is the captain's job to handle later via `TeamEditorModal`.

Submitted responses pre-populate the next-season wizard's Teams step automatically. Non-responses become "team drops" by default (motivates response without pestering).

## In scope

- New `season_reup_responses` table (one row per team per season)
- Captain-facing modal triggered at the start of each of the captain's last-3-weeks match nights, with three options (Same as last season / Make changes / Not now)
- Dismissal clears when the captain's team plays its next match (DB trigger on `matches.status` change)
- Captain can also voluntarily open the re-up form from the nav drawer at any time during the re-up window
- LO-facing status card on the league page during the window
- Wizard pre-fill: new-season wizard's Teams step reads from `season_reup_responses` and pre-checks/unchecks teams + pre-sets new captains accordingly

## Out of scope (deliberately)

- **Roster changes / sub-finding** — captain's job, handled post-activation via TeamEditorModal. Re-up sheet stays minimal so captains actually fill it out.
- **Org-wide aggregated dashboard across all leagues** — single-league focus is fine. Multi-league rollup can be a polish item later if multiple leagues warrant it.
- **Email / SMS reminders** — in-app modal + hamburger access only. External delivery is a Phase 2 concern.
- **LO-edits-the-captain's-answer** — if the captain answers "not returning" but they were wrong, they (or the LO via direct chat) can fix it; we don't need an LO override UI on this entry.
- **Historical reporting** — "what % of captains re-upped each season" is interesting but not in v1.

---

## Captain-facing flow

### The modal

Triggered at the **start of the captain's match night**, once per week, only during the **last 3 weeks** of the current season. Three buttons, biggest first:

```
┌──────────────────────────────────────────────┐
│  End of the season is here.                  │
│                                              │
│  Your league operator needs to know your     │
│  plans for next season.                      │
│                                              │
│  ┌──────────────────────────────────────┐    │
│  │  ✅  Same as last season             │    │
│  │      (I'll play, I'll captain)       │    │
│  └──────────────────────────────────────┘    │
│                                              │
│       Make changes      Not now              │
└──────────────────────────────────────────────┘
```

- **Same as last season** — primary action, one tap → `returning_next_season=true, next_captain_id=NULL` → done forever
- **Make changes** — opens a small form: returning yes/no toggle + captain dropdown (current team members)
- **Not now** — sets `dismissed_at = now()`, modal closes, won't re-pop until captain's team plays its next match

### Additional access points

- **In the scoring page during the match** — small inline "📋 Re-up form" button (or banner) for captains who dismissed at the start of the night but want to handle it mid-match while they're thinking about it
- **Hamburger menu** — "Season re-up" item, only visible during the captain's re-up window, always accessible regardless of dismissal state

### Modal trigger conditions (in plain English)

The modal pops when ALL of these are true on app load / route change:

1. Current user is captain of at least one team
2. That team's season has `end_date` within the next 3 weeks (`end_date - now() <= 21 days`)
3. No `season_reup_responses` row exists yet for that team + season, OR a row exists but `submitted_at IS NULL` (they haven't actually answered)
4. EITHER no `dismissed_at` set, OR the `dismissed_at` was cleared by the most recent match-start trigger (see below)

If multiple of the captain's teams qualify, the modal handles them one at a time (or in a single multi-team panel — TBD during implementation, depending on how often a single captain runs multiple teams).

---

## LO-facing flow

### Status card on the league page

During the 3-week re-up window, the league page gets a new "Re-up Status" card alongside the existing TeamsCard / ScheduleCard / etc. Shows each team and its response state:

```
Re-up Status (3 of 12 confirmed)

✅  Sharkbait              Returning, same captain
🔄  Cue Crew               Returning, new captain: Jane Doe
❌  Eight Ball Express     Not returning (will drop)
⚠️  Rack 'em Up            No response yet (will drop)
⚠️  Side Pocket            No response yet (will drop)
…
```

Click a row to see the captain's name + when they answered (or "no response" with the days-remaining count). No edit affordance — LO can't change a captain's answer here (they'd direct-message the captain to fix it).

### Wizard integration

Next-season wizard's Teams step reads from `season_reup_responses`:

- Team's row has `returning_next_season=false` → checkbox unchecked by default
- Team's row has `next_captain_id` set → captain dropdown pre-set to that member
- Team has no row → checkbox unchecked + yellow warning ("no response from captain — confirm before proceeding")

LO can override any of these in the wizard (re-up data is a strong default, not a lock).

---

## Schema

Single new table — Ed's call (a separate `season_reup_dismissals` table was rejected as overkill):

```sql
CREATE TABLE season_reup_responses (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id             UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  team_id               UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  captain_id            UUID NOT NULL REFERENCES members(id),
  returning_next_season BOOLEAN,                  -- NULL = no answer yet
  next_captain_id       UUID REFERENCES members(id), -- NULL = same captain
  submitted_at          TIMESTAMPTZ,              -- NULL = no answer yet
  dismissed_at          TIMESTAMPTZ,              -- NULL = not dismissed (or cleared by trigger)
  submitted_by_captain_id UUID REFERENCES members(id), -- audit trail
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (season_id, team_id)
);

CREATE INDEX season_reup_responses_team_id_idx ON season_reup_responses(team_id);
CREATE INDEX season_reup_responses_captain_id_idx ON season_reup_responses(captain_id);
```

One row per team per season. Absence of row = no response yet (modal hasn't even been seen). Lifecycle:

| Event | Effect on row |
|---|---|
| Modal pops for the first time, captain dismisses | INSERT row with `dismissed_at = now()` |
| Captain plays next match | `dismissed_at = NULL` (via trigger) |
| Captain hits "Same as last season" | UPDATE: `submitted_at = now(), returning_next_season = true, next_captain_id = NULL, dismissed_at = NULL` |
| Captain hits "Make changes" and saves | UPDATE: same as above, with `returning_next_season` + `next_captain_id` from the form |
| Wizard reads → team's row missing or `submitted_at IS NULL` | Treat as "not returning" (team drops) |

## Match-start trigger (clears dismissals)

When ANY match transitions to status `'in_progress'`, clear the `dismissed_at` for both teams in that match. Cheap, scoped:

```sql
CREATE OR REPLACE FUNCTION clear_reup_dismissals_on_match_start()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE season_reup_responses
  SET dismissed_at = NULL,
      updated_at   = NOW()
  WHERE submitted_at IS NULL
    AND dismissed_at IS NOT NULL
    AND team_id IN (NEW.home_team_id, NEW.away_team_id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_match_start_clears_reup_dismissals
AFTER UPDATE OF status ON matches
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM 'in_progress' AND NEW.status = 'in_progress')
EXECUTE FUNCTION clear_reup_dismissals_on_match_start();
```

The trigger is intentionally NOT scoped to "only during the re-up window" — the WHERE clause already filters to rows that exist (which only exist when the captain has seen the modal, which only happens during the window). Cheap no-op for matches outside the window.

---

## Edge cases

- **Captain has multiple teams** — they get the modal for each team. Implementation can show one combined modal with one row per team, OR show them serially. Pick whichever feels less annoying during implementation; default to combined.
- **Captain's team withdraws mid-season** — team's `status` is no longer `'active'`; the modal trigger skips it. Existing row (if any) just sits there; gets dropped at wizard time anyway.
- **Captain answered "returning" but their team got disbanded by LO** — captain's answer is irrelevant; the wizard's team-list reads from `teams` joined with the response, so disbanded teams don't appear regardless.
- **Captain answered, then changed their mind** — they can re-open the form (hamburger menu) and re-submit; UPDATE replaces the previous answer. Audit trail via `updated_at`.
- **Two captains for one team (rare, edge case in the data model)** — `captain_id` on the row reflects the team's current captain at modal-show time. If captaincy changes during the window, the new captain sees the form too; whoever answers last wins. Rare enough to not over-design.
- **Captain never plays another match** (sick all 3 weeks) — they never get the modal. Team drops by default. The captain can still get to the form via the hamburger menu IF they open the app, but if they truly never open the app during the window, the wizard takes the no-response default.
- **Captain plays after the season's `end_date`** (e.g., make-up week) — the modal trigger's "season ends within 21 days" check uses ABS so even a past end_date still qualifies them; modal still shows. Tweak the condition to `(end_date - now() <= 21 days AND now() <= end_date + 7 days)` to include the immediate after-season grace period.

---

## Proposed implementation slice

Splitting the feature into small shippable units (similar to the messaging Phase 1 plan):

| Unit | Title | Notes |
|---|---|---|
| 1 | Schema + match-start trigger | One migration. Adds `season_reup_responses` table + the dismissal-clearing trigger. |
| 2 | Captain form (modal + page) | Renders the 3-option modal + a dedicated "Re-up form" page reachable from the hamburger. Both write to the same mutation. |
| 3 | Modal trigger logic | App-level hook (`useCaptainReupPrompt`) that checks on app-load / route-change and pops the modal when conditions match. |
| 4 | Scoring-page inline button | Small UI element on the scoring page for captains during their last-3-weeks matches. Same modal. |
| 5 | LO status card on league page | New `LeagueReupStatusCard` component, rendered on `LeagueDetail` during the window. |
| 6 | Wizard pre-fill integration | `NewSeasonStageDetection` reads `season_reup_responses` and pre-fills team state in the Teams stage. |

## What ships after this

- Reminder escalation (email / SMS) for captains who go all 3 weeks without opening the app
- LO override UI for cases where the LO genuinely needs to set a captain's answer manually
- Multi-league re-up dashboard (rolled-up view across all of an LO's leagues)
- Historical re-up reporting ("which captains were reliable responders last 4 seasons")

## Open questions for Ed

1. **Modal vs. multi-team panel** — if a captain has multiple teams in the re-up window, show one modal per team or one combined? My pick: combined panel with one row per team, single submit button. Less annoying.
2. **The 3-week window** — is "last 3 weeks of regular season" right, or should it include playoffs? I.e., does the modal show during week 14-15 of a 16-week season (regular) only, OR include the 2 playoff weeks after? My pick: regular weeks only — playoffs are a distraction.
3. **Where exactly does the hamburger menu item live?** Top-level "Season re-up" item, or nested under "My Teams" → submenu? My pick: top-level, only visible during the re-up window so it auto-disappears.
4. **Scoring-page button placement** — inline next to the scoreboard, or in the page header? My pick: page header area, low-chrome (icon + small label).
