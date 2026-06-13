---
title: "feat: Playoff Review Page (review-first finals surface + honor configured pairing)"
type: feat
status: active
date: 2026-06-12
origin: docs/brainstorms/2026-06-12-playoff-review-page-requirements.md
---

# Playoff Review Page

## Overview

Rewrite the dashboard Playoffs page (`src/operator/PlayoffSetup.tsx`, route
`/league/:leagueId/season/:seasonId/playoffs`) from a "configure-the-format
question" into a **review-first finals page**. The League Operator (LO) opens it
and sees *where their playoff actually is* by lifecycle state; the playoff setup
is one preset chosen once (in the season-creation wizard) and merely shown /
optionally tweaked here. When the regular season finishes, the bracket fills in
**using that configured setup** and locks.

**This page never shows actual team names or standings.** It deals only in
**places** (1st, 2nd, 3rd…). Its job is to set the *place-based rule* (which place
plays which place) so the app can pull the right teams from the standings and fill
the match records at season end. Real teams would only churn mid-season and belong
on the schedule once set — so no standings table, no real-team bracket, no live
preview here. The page renders **place-slots only**.

Two functional fixes ride along because the page is meaningless without them:
1. **Honor the configured pairing.** Today the match fill-in ignores the
   configured matchup style and force-uses seeded (1st-plays-last). It must use
   what's set up.
2. **Trustworthy "populated" signal.** Today nothing reliably knows whether the
   playoff matchups are committed; the page state and the dashboard card both read
   the wrong signal.

True hands-off auto-populate (server-side, fires when the last match is scored) is
what Ed ultimately wants but is a separate, bigger backend build — see
**Deferred to Separate Tasks**. This plan delivers a page that *reflects* state
correctly and fills in via an on-load/manual path in the interim.

## Problem Frame

Playoffs are the **finals** — they happen after every regular-season match is
played and standings are final. The current page (`PlayoffSetup.tsx`) leads with
the format/template controls the LO already answered at season creation, treats
the settled "no playoffs" state as a red error, and — critically — its pairing
control only changes a *preview picture*, never the real matches. See origin:
`docs/brainstorms/2026-06-12-playoff-review-page-requirements.md`.

App-wide north star (origin §Guiding principle): **set it once, it runs itself,
every season reuses the same setup.** The page must never force re-setup and
should fill in on its own.

## Requirements Trace

- **R1** — Review-first layout driven by lifecycle state (`no-playoffs` /
  `set-up` / `locked`), **showing place-slots only — never team names or
  standings.** (origin R1, as corrected in conversation)
- **R2** — The playoff *setup* (including how places are paired) is **one preset
  per season**, shown clearly and editable here until populated. There is **no
  separate pairing picker** — it's the configured matchup style. (origin R2/R5,
  as corrected in conversation)
- **R3 (core fix)** — Match records **populate using the configured matchup
  style**, not hardcoded seeded. (conversation-mandated; supersedes the origin's
  "don't touch bracket-generation" boundary for *style selection only*)
- **R4** — "Matchups populated" is read from a **trustworthy signal** (playoff-week
  matches have non-null team IDs), on load; the dashboard card uses the same
  signal. (origin Technical notes 1)
- **R5** — Once populated, the bracket + setup **lock**; redo via a deliberate
  **reset** that **nulls team IDs** (never deletes rows). (origin R4 + Technical
  notes 2)
- **R6** — No-playoff-week = "this league doesn't run playoffs" calm terminal
  state, not an error. (origin R1, lifecycle 1)
- **R7** — In-place rewrite reusing existing cards; narrow `useBlocker` to
  edit-open-and-dirty. (origin R6)

## Scope Boundaries

- **Not** touching `src/operator/PlayoffsSetupWizard.tsx` (season-creation step).
- **Not** changing the standings/seeding *math* (`fetchSeasonStandings`,
  `sortStandings`, how seeds derive from standings). R3 only changes **which
  pairing function** is applied (seeded vs ranked vs random), reusing logic that
  already exists. *(This deliberately narrows the origin doc's broader "don't
  redesign bracket-generation" boundary — a planning-time clarification: honoring
  the configured style was mandated in conversation; the seeding math itself stays
  untouched.)*
- **Not** adding a new route — reuse `/playoffs`.
- **Not** redesigning the config field UI inside the reused cards
  (`PlayoffTemplateSelector`, `PlayoffSettingsCard`).
- **Not** building multi-week bracket *progression* ('bracket' style for week 2+).
  The initial fill-in is the single `playoffs` week; 'bracket' style is existing
  /separate behavior and falls back safely (see Unit 3).

### Deferred to Separate Tasks

- **True server-side auto-populate** (Ed chose this as the ultimate target): a
  backend trigger that generates + populates the bracket the instant the last
  regular-season match is scored, with **no page load required**. This needs the
  bracket/seeding logic to run server-side (DB function or edge function) — a
  non-trivial port of `src/utils/playoffGenerator.ts`. **Its own brainstorm +
  plan.** Until it lands, Phase-1's on-load auto-populate gives the "automatic"
  feel whenever any operator opens the page or dashboard after the season ends.
- **Honor each league's `standings_sort` for seeding** (rides with the broader
  modular-standings work, NOT this PR). The playoff seeds via
  `sortStandings(standings)` with the **default** priority
  (`match_wins → games_won → points_earned`). That's deliberate and correct *for
  now*: the standings **display** (`useStandings`) also uses the same default, so
  the playoff seeds exactly the way standings render today — they agree. The
  per-league `standings_sort` preference is dormant plumbing (a column + wizard
  input + resolved config) that **nothing reads back to sort yet**. When the
  modular-standings work wires `standings_sort` into `useStandings`, wire
  `generatePlayoffBracket` in the **same change** (pass the resolved priority into
  `sortStandings`) so "1st place" stays identical in both surfaces. Wiring only
  the playoff would make it *diverge* from the standings page — don't.

## Context & Research

### Relevant Code and Patterns

- `src/operator/PlayoffSetup.tsx` — the page (in-place rewrite target). Loads
  resolved config into `usePlayoffSettingsReducer`, fetches playoff week +
  `checkRegularSeasonComplete` + `generatePlayoffBracket` on mount, renders
  `PlayoffMatchRulesCard` → Season Status → `PlayoffTemplateSelector` →
  `PlayoffSettingsCard` → bracket cards → standings → footer actions. Local
  `StandingsTable` + `ExcludedTeamsNotice` live here.
- `src/utils/playoffGenerator.ts`:
  - `getPlayoffWeek(seasonId)` — `.maybeSingle()` on `week_type='playoffs'`
    (one playoff week row per season today); returns null silently when none.
  - `checkRegularSeasonComplete(seasonId)` — counts `status='completed'` vs total
    regular-week matches; `isComplete` is false when total is 0.
  - `generatePlayoffBracket(seasonId, weekId)` — **hardcodes
    `generatePlayoffPairs(teamCount)` (seeded only)**; ignores configured style.
  - `populatePlayoffMatches(bracket)` — **UPDATEs** placeholder rows
    (`.is('home_team_id', null)`) with team IDs; fails "No placeholder matches
    found" if none exist (i.e. after a delete).
  - `clearPlayoffMatches(...)` — **DELETEs** all playoff-week rows (unsafe for the
    reset-then-repopulate loop — breaks `populatePlayoffMatches`).
- `src/hooks/playoff/usePlayoffSettingsReducer.ts`:
  - `weekMatchupStyles: MatchupStyle[]` (`'seeded'|'ranked'|'random'|'bracket'`),
    week-1 default `'seeded'`.
  - `generateMatchupPairs(bracketSize, style)` — **a preview helper**: returns real
    seed pairs for `'seeded'`/`'ranked'`, but *negative placeholder* pairs for
    `'random'` and *encoded* pairs for `'bracket'` (display only). Used only by
    `PlayoffBracketCard` / `PlayoffBracketPreviewCard`.
- `src/components/operator/PlayoffsCard.tsx` — dashboard entry; its
  `playoffMatchesExist` reads a **raw match count** (`> 0` all season → mislabels
  placeholders as "Bracket created"). Drives subtitle + "View Bracket"/"Setup".
- `src/api/hooks/usePlayoffConfigurations.ts` — `useResolvedPlayoffConfig(leagueId)`
  resolves league → org → global (the "inherit, don't re-ask" mechanism).

### Institutional Learnings

- **Scoring/derived logic must never throw** (memory: scoring engine never
  breaks). The pairing-selection fix (Unit 3) must fall back to seeded on any
  unknown/unsupported style rather than error.
- **"Works, not perfect" v1 standard** (memory): sensible defaults + runnable
  output for any combination; seeded/ranked deterministic, random = a fair
  shuffle, bracket falls back.
- **All app data is disposable** (memory): no backfill plumbing needed for the
  signal change; truncate/rebuild dev data freely.

## Key Technical Decisions

- **One state machine, re-derived (not load-once), three states.** A single
  derived `playoffState` — `no-playoffs` (no playoff week) | `set-up` (week exists,
  matchups not populated — editable place-rule) | `locked` (matchups populated) —
  drives the layout. Season-complete is **not** a state; it only feeds a status
  line + the interim populate trigger. Computed on load **and re-derived after
  populate and after reset** — the page stays on `/playoffs` through both
  transitions (`set-up → locked` on populate, `locked → set-up` on reset), so it
  must recompute in-place, not rely on a navigation/remount.
- **"Populated" = non-null team IDs on the playoff week's matches** — a new helper,
  not row count, not the stale `matchesExist`. Single `playoffs` week (the one
  `getPlayoffWeek` returns) gates the lock (multi-week progression deferred).
- **Reset = null the team IDs** (new `resetPlayoffMatchups`), preserving rows so
  `populatePlayoffMatches` can re-fill. Never `clearPlayoffMatches` for this path
  (after Unit 4, `clearPlayoffMatches` has no remaining caller — grep and remove,
  or it stays as a known-unsafe-for-reset helper).
- **Honor the configured style at generation** by passing the **resolved** week-1
  `MatchupStyle` into `generatePlayoffBracket` and selecting the real pairing
  function; seeded/ranked deterministic, random shuffles, unknown/'bracket' →
  seeded fallback (never throw). **Read the style from
  `resolvedConfig.week_matchup_styles[0]` directly (or gate generation on the
  config being loaded), NOT from reducer state** — the reducer defaults to
  `['seeded']` and its hydration races the generate call, which would silently
  force seeded and defeat this fix.
- **Auto-populate (interim) = on-load**, only when `state === 'set-up'` AND the
  **season is complete**, the config is loaded, AND a **one-shot ref guard**
  (mirroring the existing `hasLoadedInitialConfig` ref) has not already fired — the
  state check alone does NOT close the async window (the populated signal stays
  false until the DB write lands + re-derive), so a re-render/StrictMode
  double-invoke could double-fire (and reshuffle a `random` draw). Plus a manual
  "Set matchups now" override **that stays gated on season-complete** (never
  populate off partial standings). True server-side auto is deferred.
- **Format edit is a tucked-away secondary surface** (collapsed section leaning).
  Exact shape is Ed's-taste, adjustable after build (origin Open Questions).

## Open Questions

### Resolved During Planning

- *How "automatic"?* → **Both, phased.** On-load auto now (this plan); true
  server-side auto deferred to its own task (Ed's chosen ultimate target).
- *Which pairing styles drive real matches?* → Honor the **configured** style
  (one preset per season). Seeded + ranked deterministic, random shuffles,
  'bracket'/unknown fall back to seeded. No separate picker.
- *Post-commit landing?* → **Stay on `/playoffs`** and show the now-locked bracket
  (so the locked state is actually seen), instead of today's navigate-to-schedule.

### Resolved During Planning (cont.)

- **`random` reseed behavior** → **resolve once at populate.** A populated bracket
  is stable (never re-shuffles on re-render/refresh). The chosen draw is persisted
  only as the team IDs on the match rows — there is no separate "draw result"
  record — so a **reset deliberately discards the draw**, and a post-reset
  re-populate may pair differently. That's acceptable (reset = intentional redo);
  only an un-reset populated bracket is guaranteed stable. (No persisted
  draw-result is needed.)

### Deferred to Implementation

- **Exact edit/locked-surface UI shape** (collapsed section vs dialog vs mode
  toggle) and which format fields show in the locked read-only summary. Build the
  collapsed-section leaning; adjust to Ed's taste after.
- **Auto-populate UX feedback** — silent fill-in vs a brief spinner/toast when the
  on-load populate fires (in `set-up`, season complete). Lean: a subtle inline "Setting matchups…"
  state; decide in Unit 4.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review,
> not implementation specification. The implementing agent should treat it as
> context, not code to reproduce.*

Page state machine — **place-slots only, no team names or standings ever:**

```
getPlayoffWeek?  ──no──▶  NO-PLAYOFFS   "This league doesn't run playoffs."
   │ yes
   ▼
matchups populated? (non-null team IDs)
   │ yes ───────────────▶  LOCKED        place-rule read-only + "matchups have
   │ no                          ▲         been set — view on the schedule" + Reset
   ▼                            │
  SET-UP (place-rule editable)  │ (populate: auto at season end / manual)
   • shows place-slots ("1st vs 3rd…") + the configured pairing, editable
   • status line only: season in progress → "fills in when all N/M matches
        complete";  season complete → interim auto-populate fires (one-shot)
   • format edit available (collapsed)
        │                       │
        └──(populate)───────────┘
        ▲
        └──(Reset: null team IDs, re-derive in place)── from LOCKED
```

Only **two display modes**: editable place-rule (SET-UP) vs locked place-rule
(LOCKED). "Season complete" only changes a *status line* and triggers the interim
populate — it never swaps to a real-team view. State re-derives after populate
(`SET-UP → LOCKED`) and reset (`LOCKED → SET-UP`) without leaving `/playoffs`.

## Implementation Units

- [x] **Unit 1: Playoff-state signal helpers**

**Goal:** Provide trustworthy, load-time signals for page state: does the league
run playoffs, and are the matchups populated.

**Requirements:** R1, R4

**Dependencies:** None

**Files:**
- Modify: `src/utils/playoffGenerator.ts` (add `arePlayoffMatchupsPopulated`)
- Test: `src/__tests__/database/playoffSignals.test.ts` (real-DB row semantics —
  the `.ts` db project, sequential/jsdom; this is a real-Postgres read so it
  belongs here, not a mocked co-located test)

**Approach:**
- Add `arePlayoffMatchupsPopulated(playoffWeekId): Promise<boolean>` — true when
  ≥1 match on that week has a **non-null `home_team_id`** (mirror the inverse of
  `populatePlayoffMatches`'s `.is('home_team_id', null)`). The caller passes
  `getPlayoffWeek(seasonId).id`; the page's `populated` state gates only on that
  single `playoffs` week (multi-week lock complexity deferred).
- Keep it a small pure-ish DB read; no state model rewrite of existing helpers.

**Patterns to follow:** `populatePlayoffMatches` query shape in the same file;
`checkRegularSeasonComplete` for the count/head pattern.

**Test scenarios:**
- Happy path: week with all team IDs filled → returns true.
- Edge: week with only null-team placeholders → returns false.
- Edge: week with zero matches → returns false (no throw).
- Edge: partially populated (some null, some filled) → returns true (committed).

**Verification:** Helper returns correct boolean for filled vs placeholder rows;
no throw on empty.

---

- [x] **Unit 2: `resetPlayoffMatchups` helper (null, don't delete)**

**Goal:** A safe unlock that empties team assignments while preserving placeholder
rows so the bracket can be re-populated.

**Requirements:** R5

**Dependencies:** None

**Files:**
- Modify: `src/utils/playoffGenerator.ts` (add `resetPlayoffMatchups`)
- Test: `src/__tests__/database/playoffReset.test.ts` (real-DB row preservation)

**Approach:**
- `resetPlayoffMatchups(seasonId, playoffWeekId)` UPDATEs the playoff-week rows,
  setting `home_team_id`, `away_team_id`, `scheduled_venue_id` back to `null`.
  Row count unchanged.
- Do **not** call `clearPlayoffMatches` here (it deletes rows → re-populate fails).

**Patterns to follow:** The UPDATE pattern inside `populatePlayoffMatches`;
`clearPlayoffMatches` for the season/week filter (but UPDATE not DELETE).

**Test scenarios:**
- Happy path: populated week → after reset, all team IDs null AND row count
  unchanged.
- Integration: reset → `populatePlayoffMatches` succeeds again (no "No placeholder
  matches found"). This is the loop that's broken today with `clearPlayoffMatches`.
- Error path: DB error surfaces as `{ success: false, error }`, no throw.

**Verification:** After reset, `arePlayoffMatchupsPopulated` is false, rows still
exist, and a subsequent populate succeeds.

---

- [x] **Unit 3: Generation honors the configured matchup style (core fix)**

**Goal:** The real generated/populated bracket reflects the season's configured
pairing, not hardcoded seeded.

**Requirements:** R2, R3

**Dependencies:** None (consumed by Unit 4)

**Files:**
- Modify: `src/utils/playoffGenerator.ts` (`generatePlayoffBracket` gains a style
  param + real-pairing selection)
- Test: `src/utils/playoffGenerator.pairing.test.ts` (pure pairing logic, mocked
  standings)

**Approach:**
- This is **not a new UI control.** The pairing style is already chosen in the
  season-creation wizard and lives in `weekMatchupStyles[0]`. Unit 3 only makes
  bracket generation *honor* that existing choice instead of hardcoding seeded.
- `generatePlayoffBracket(seasonId, playoffWeekId, style?: MatchupStyle)` selects
  the **real** pairing for the initial (week-1) fill-in:
  - `'seeded'` → current `generatePlayoffPairs` (1vLast). Default/fallback.
  - `'ranked'` → adjacent seed pairs (1v2, 3v4, …).
  - `'random'` → shuffle seed order, then pair (fair draw); resolve **once** here
    (a populated bracket never re-shuffles; reset discards the draw — see
    Resolved open questions).
  - `'bracket'`, unknown, or null/undefined → **fall back to seeded** (never throw
    — week-2+ progression is out of scope; see Scope Boundaries). Fallback covers
    only *style-value* problems; genuine errors (standings fetch, DB) still
    propagate via the existing `{ success:false }` path — they do NOT silently
    seed-fallback.
- Reuse the existing seed→team mapping; only the seed-pairing step changes. Do
  **not** use `generateMatchupPairs` for real pairing (it returns
  placeholder/negative pairs for random/bracket — it's a preview helper).
- **Caller (Unit 4) passes the style from `resolvedConfig.week_matchup_styles[0]`
  (the loaded config), not from reducer state** — see Unit 4 for the race this
  avoids.

**Execution note:** Implement the pairing selection test-first — it's pure logic
with clear inputs/outputs and a safety-critical fallback.

**Technical design:** *(directional, not spec)* a small internal
`realPairsForStyle(bracketSize, style)` returning `[homeSeed, awaySeed][]`, with a
default branch returning the seeded pairs.

**Patterns to follow:** `generatePlayoffPairs` (seeded) and the `'ranked'` branch
shape in `generateMatchupPairs` (adjacent), but returning *real* seeds only.

**Test scenarios:**
- Happy path: `'seeded'`, 8 teams → `[1,8],[2,7],[3,6],[4,5]`.
- Happy path: `'ranked'`, 8 teams → `[1,2],[3,4],[5,6],[7,8]`.
- Edge: `'random'`, 8 teams → 4 pairs, every seed 1..8 used exactly once, even split.
- Edge: odd team count (7) → last seed excluded, 6-team bracket, style honored.
- Error/fallback: `'bracket'` or an unexpected value → seeded pairs, no throw.
- Edge: <2 teams with results → existing `{ success:false }` path preserved.

**Verification:** `generatePlayoffBracket` returns matchups whose seed pairing
matches the requested style; unknown styles fall back to seeded without throwing.

---

- [x] **Unit 4: Review-first page rewrite (`PlayoffSetup.tsx`)**

**Goal:** Replace the configure-first page with the lifecycle-driven review-first
finals page.

**Requirements:** R1, R2, R5, R6, R7

**Dependencies:** Units 1, 2, 3

**Files:**
- Modify: `src/operator/PlayoffSetup.tsx` (in-place rewrite). **Drop** the inline
  real-team `StandingsTable`, the team-named `ExcludedTeamsNotice`, the
  `PlayoffBracketCard` (real teams), the mount-time `generatePlayoffBracket` call
  **and the `bracket` state object it fed** — none belong on a place-only page.
  **Add** `PlayoffBracketPreviewCard` (place/seed slots) for display and
  `useTeamsBySeason` (`src/api/hooks/useTeams.ts`) for the team **count**.
- Test: `src/operator/PlayoffSetup.test.tsx` (state rendering + actions, mocked
  supabase/helpers)

**Approach:**
- **Place-slots only.** The page renders the *place-based rule* ("1st vs 3rd…"),
  never team names or standings. Reuse **`PlayoffBracketPreviewCard`** (the
  place/seed preview already used by `PlayoffsSetupWizard`; its
  `onMatchupStyleChange` prop is the editable place-rule control) — it needs only
  team *count* (`useTeamsBySeason(seasonId).length`) + config, not standings.
- **Compute the preview `bracketSize` from `resolvedConfig`, not reducer state.**
  Like the style (below), `calculateQualifyingTeams(teamCount, …)` reads
  qualification fields that default in the reducer and race hydration — derive them
  from `resolvedConfig` (or gate the preview on the reducer having hydrated) so the
  slot count isn't briefly wrong.
- Compute `playoffState` (see state machine): `no-playoffs` (no playoff week) |
  `set-up` (not populated — editable place-rule) | `locked` (populated). Compute
  on load **and re-derive after populate and after reset** — the page stays on
  `/playoffs`, so the view flips in-place without a remount. `checkRegularSeasonComplete`
  only feeds a **status line** and the interim populate trigger; it does **not**
  change which mode renders.
- Render per state:
  - **no-playoffs:** calm terminal card — "This league doesn't run playoffs." No
    error styling, no format controls, no add-prompt.
  - **set-up (editable):** the place-slot preview + the configured pairing,
    editable; a status line — season in progress → "fills in automatically once
    all regular-season matches are complete (N of M played)"; season complete →
    **interim auto-populate fires behind a one-shot ref guard** (mirror
    `hasLoadedInitialConfig`: fire once, only when config loaded and not already
    populated) so re-renders / StrictMode can't double-fire or reshuffle `random`;
    a manual "Set matchups now" override remains. Format edit available (collapsed).
  - **locked (populated):** the place-rule **read-only** + "matchups have been set
    — view them on the schedule" + a deliberate **"Reset matchups"** action
    (Unit 2, confirms clearly). After reset → returns to `set-up`.
- **Rewire the populate handler to build the bracket on demand** (important — the
  page no longer holds a `bracket` state object). Today `handleCreateMatches`
  consumes a `bracket` built on mount; that's gone. Both the interim auto-populate
  effect and the manual "Set matchups now" must now: (a) require season-complete +
  `resolvedConfig` loaded, (b) call `generatePlayoffBracket(seasonId,
  playoffWeek.id, resolvedConfig.week_matchup_styles[0])` (Unit 3) **on demand**,
  (c) bail via the existing `{ success:false }` surface if generation fails, then
  (d) feed the result to `populatePlayoffMatches`. Do **not** read the style from
  reducer state (defaults to `['seeded']`, races hydration — would silently force
  seeded). `generatePlayoffBracket` is now used only to build the WRITE, never to
  render the page.
- After a successful populate, **remove the `navigate('/schedule')`** — stay on
  `/playoffs` and re-derive `playoffState` in place to show the `locked` state.
- **Format edit = tucked-away** collapsed "Edit playoff format" section (closed by
  default) reusing `PlayoffTemplateSelector` + `PlayoffSettingsCard`; editable
  until populated, then hidden/locked.
- **Narrow `useBlocker`** to fire only when the edit section is open AND
  `settings.isModified` (review-only visits never block).

**Execution note:** Characterize the existing populate/reset/save call wiring
before replacing the render tree, so the data flow is preserved while the layout
changes.

**Patterns to follow:** `PlayoffsSetupWizard.tsx` for place-preview card
composition + team-count via `useTeamsBySeason` (reuse, do not modify it); the
existing save handlers + the `hasLoadedInitialConfig` ref pattern in
`PlayoffSetup.tsx`; `SectionCard` collapse pattern for the edit section. **Note:**
`handleCreateMatches` is *rewired*, not copied — drop its `navigate('/schedule')`
and its reliance on a prebuilt `bracket` state (build on demand per Approach).

**Test scenarios:**
- Happy path: no playoff week → "doesn't run playoffs" message; no error card; no
  format controls.
- Happy path: `set-up`, season in progress → **place-slots** render ("1st vs 3rd…")
  + "fills in when N/M complete"; **no team names, no standings table** anywhere;
  edit section present but collapsed.
- Happy path: `set-up`, season complete + unpopulated → interim auto-populate is
  attempted (one-shot); still renders place-slots, not team names.
- Happy path: `locked` (populated) → place-rule read-only + "view on the schedule"
  + "Reset matchups"; format edit hidden/locked; no team names rendered.
- Integration: after populate succeeds, state **re-derives to `locked` in-place**
  (no remount); route stays on `/playoffs`.
- Integration: "Reset matchups" → confirm → matchups nulled → state re-derives to
  `set-up` (re-populate possible), still on `/playoffs`.
- Edge: re-render / refresh in any state does **not** re-fire auto-populate
  (one-shot ref guard holds) — and never reshuffles a `random` draw.
- Edge: populate uses the configured style from `resolvedConfig` even before
  reducer state hydrates (no seeded-default leak).
- Edge: `useBlocker` does not block when the edit section is closed/clean; blocks
  only when open AND dirty.

**Verification:** The page never renders a team name or standings; each state
renders its place-only layout; populate/reset round-trips in-place; navigation
guard only fires on dirty edits.

---

- [x] **Unit 5: Align `PlayoffsCard` status signal**

**Goal:** The dashboard card's label matches reality (and the page) — placeholders
are not "Bracket created."

**Requirements:** R4

**Dependencies:** Unit 1

**Files:**
- Modify: `src/components/operator/PlayoffsCard.tsx`
- Test: `src/components/operator/PlayoffsCard.test.tsx`

**Approach:**
- Replace the raw match-count check with `arePlayoffMatchupsPopulated` (Unit 1).
  Subtitle/button: placeholders only → "Ready to set up" / "Setup Playoffs";
  populated → "Bracket created" / "View Bracket".

**Patterns to follow:** Existing `loadPlayoffStatus` effect; swap the count query
for the Unit 1 helper.

**Test scenarios:**
- Happy path: placeholder-only week → "Ready to set up" (not "Bracket created").
- Happy path: populated week → "Bracket created" / "View Bracket".
- Edge: no playoff week → existing empty/"no playoff week" state unchanged.

**Verification:** Card label flips only when matchups are actually populated, in
agreement with the page.

## System-Wide Impact

- **Interaction graph:** `generatePlayoffBracket` is called by `PlayoffSetup.tsx`
  only (verified). Adding an optional `style` param is backward-compatible
  (defaults to seeded). `PlayoffsCard` + page now share the Unit 1 signal.
- **Config-hydration race (display AND write):** both the place-preview
  `bracketSize` and the populate-time style come from config fields that **default
  in the reducer** and race hydration. Read them from `resolvedConfig` (or gate on
  `hasLoadedInitialConfig`), never raw reducer state, or the preview shows the
  wrong slot count and the write silently force-seeds.
- **Error propagation:** All new helpers return `{ success, error }` / boolean and
  never throw (scoring-never-breaks). Unit 3 falls back to seeded on bad *style
  value* only; real errors (standings/DB) propagate.
- **State lifecycle risks:** Auto-populate must be **idempotent** — one-shot ref
  guard (not just `state === 'set-up'`, which stays true through the async write)
  so a re-render/refresh never double-fills or re-shuffles. Reset preserves rows so
  re-populate is safe. The populate write needs **final** standings, so both auto
  and manual populate stay gated on season-complete.
- **API surface parity:** None — operator web page only; no mobile path.
- **Unchanged invariants:** `PlayoffsSetupWizard.tsx`, the standings/seeding math,
  the `/playoffs` route, and the reused cards' internal field UI are untouched.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Honoring style edges the origin "don't touch bracket-generation" boundary | Scoped to *pairing-function selection* only; math untouched; Ed mandated it in conversation; seeded fallback never breaks |
| Auto-populate-on-load double-fires or re-shuffles | One-shot ref guard (not just `state === 'set-up'`) + gate on config loaded; resolve `random` once at populate, never re-shuffle a populated bracket |
| `random`/`bracket` styles half-supported | `random` resolved once (fair shuffle); `bracket`/unknown fall back to seeded; documented as "works, not perfect" v1 |
| Multi-week playoff brackets | Single `playoffs` week gates the lock today; multi-week progression explicitly deferred |
| Interim on-load auto ≠ true hands-off Ed wants | Phase-2 server-side trigger deferred to its own task; page reflects state regardless of fill-in source |
| Placeholder-row count may differ from bracket size (qualification `fixed`/`percentage` or wildcards → fewer pairs than placeholders), leaving extra un-populated rows | Pre-existing in `populatePlayoffMatches` (index-paired); signal still reads "populated" correctly off the first filled row. Out of scope to fix here; verify the bracket renders sanely in Unit 4 and note if it surfaces |

## Documentation / Operational Notes

- Update `TABLE_OF_CONTENTS.md` for any new test files.
- No migration / schema change (signal is derived from existing columns; reset
  uses existing columns).
- Verify clean: `npx tsc --noEmit -p tsconfig.app.json`, `pnpm lint`, `pnpm build`.

## Sources & References

- **Origin document:** `docs/brainstorms/2026-06-12-playoff-review-page-requirements.md`
- Related code: `src/operator/PlayoffSetup.tsx`, `src/utils/playoffGenerator.ts`,
  `src/hooks/playoff/usePlayoffSettingsReducer.ts`,
  `src/components/operator/PlayoffsCard.tsx`,
  `src/components/playoff/PlayoffBracketCard.tsx`
- Memory: app north star (set-once/runs-itself), scoring-never-breaks,
  works-not-perfect v1.
