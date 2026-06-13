# Playoff Review Page — Requirements

**Created:** 2026-06-12
**Status:** Ready for planning
**Type:** Page redesign (operator-facing)

## What this page is

The dashboard **Playoffs** page (`src/operator/PlayoffSetup.tsx`, route
`/league/:leagueId/season/:seasonId/playoffs`, opened from `PlayoffsCard` on the
league dashboard) is the operator's **end-of-season playoff-finals surface**.

Playoffs are the **finals** — they happen at the very end, *after every
regular-season match has been played* and the standings are final. This page's
real job is the moment the season finishes:

> **Look at the final standings → decide the seeding (who plays who by place:
> 1st-vs-2nd, 1st-vs-last, etc.) → populate the playoff matches from that.**

That **seeding/pairing adjustment is the point of the page.** The playoff
*format/template* (how many teams qualify, how many weeks) is set during season
creation and is only secondary background here.

> **CORRECTION (supersedes "real teams" language below):** this page **never shows
> actual team names or standings** — only **places** (1st, 2nd, 3rd…). It exists to
> set the *place-based rule* (which place plays which place) so the app pulls the
> right teams from the standings and fills the match records at season end. Real
> teams would only churn mid-season and belong on the schedule once set. Anywhere
> below that says "final bracket with real teams" / "standings table," read it as
> **place-slots only.** Two display modes: editable place-rule, or locked
> place-rule. The authoritative spec is the plan
> (`docs/plans/2026-06-12-002-feat-playoff-review-page-plan.md`).

## Problem (what's wrong today)

The page **leads with a configure-the-format question** — the
`PlayoffTemplateSelector` + `PlayoffSettingsCard`, the same controls the operator
(LO) already answered during season creation — and frames itself as setup. It
buries the actual job (final standings → pairing → populate) below a format
interrogation the LO already answered. It also treats some settled states as
errors/incomplete (e.g. "no playoff week" shows a red error).

This page is **not a wizard step** and **not a shared "content + two covers"**
surface. It's its own standalone kind of page — *review your finals and set the
matchups* — distinct from `PlayoffsSetupWizard.tsx` (the format-question step
inside season creation: Teams → Playoffs → Schedule), which stays exactly as-is.

## Goal

Make `/playoffs` a **review-first finals page**: the LO opens it and sees the
state of their playoff. When the regular season finishes, it puts the **final
standings + the resulting bracket + the seeding/pairing choice + the populate
action** front and centre. Changing the *format* is a minor secondary action;
everything is protected once the matches are populated.

### Guiding principle (app-wide north star)
**Set it once, it runs itself, every season reuses the same setup.** The whole app
aims at: an LO configures a league the way they want, and then never has to touch
it again — it just runs. This page must honour that:
- **Never force re-setup.** A new season **inherits** the league's existing
  playoff config (format + place-pairing); the LO is not re-asked. The config
  already resolves league → org → global (`useResolvedPlayoffConfig`), so this is
  mostly "don't break it" + "don't gate the page behind a setup question."
- **Auto-run.** Once the place-pairing is set, the playoff **resolves and
  populates on its own** when the season completes — no required LO action.
- The page is therefore a **passive reflection + occasional override**, not a
  recurring chore.

## Users

League Operators (LOs) reviewing/running a league's playoff for an active season.
Web-only operator surface.

## The lifecycle this page reflects

Three states drive what the page shows:

1. **Does this league even run playoffs?** (`getPlayoffWeek`) — **no playoff week
   = the LO chose NOT to run playoffs.** This is a settled, legitimate state, not
   an error and not a "yet." The page should say so calmly ("This league doesn't
   run playoffs"), not throw a red error or beg the LO to add one. *(Today it
   renders an error card — that's wrong; see Technical notes.)*
2. **Is the regular season complete?** (`checkRegularSeasonComplete`) — playoffs
   are the **finals**, so nothing real happens here until **every regular-season
   match is played.** Before that, the page is in a *waiting* state: it shows the
   upcoming playoff (format + scheduled date) and says "the bracket fills in once
   all regular-season matches are complete." There is **no meaningful mid-season
   live bracket** — final standings are what seed it.
3. **Have the matchups been populated?** ("Approve & Set Matchups" →
   `populatePlayoffMatches`) — at season end, this seeds final standings into the
   playoff matches per the chosen pairing. Before it, nothing is committed; after
   it, the bracket is real and visible to teams. **Ideally this is automatic once
   the season completes; manual (one deliberate action) at minimum.**

   **⚠ This state is NOT reliably computed in code today** (review found this).
   Playoff matches are created as **empty placeholder rows** (null team IDs) at
   *schedule-generation* time — long before anyone approves anything.
   "Approve & Set Matchups" **updates** those placeholders with team IDs; it does
   not insert rows. So:
   - A raw count of matches on the playoff week is `> 0` for the **entire
     season** — `PlayoffsCard` already mislabels uncommitted placeholders as
     "Bracket created" because of this.
   - `PlayoffSetup`'s `matchesExist` starts `false` and only flips on a *failed*
     populate — so on a fresh load it never knows the real state.
   - **The trustworthy signal is: do the playoff-week matches have non-null team
     IDs?** This is the predicate the whole review-first / lock model (R2, R3)
     depends on, so it must be computed on load. See Technical notes.

## Requirements

### R1 — Review-first layout, by lifecycle state
The page opens on **where the playoff actually is**, not the format controls.
What leads depends on the lifecycle state:

- **No playoffs (no playoff week):** a calm terminal message — "This league
  doesn't run playoffs." Nothing else needed.
- **Season in progress — where the LO does the real work:** show the upcoming
  playoff (format name + scheduled playoff-week date) **and the place-pairing
  control** (R2: "1st plays 3rd…", settable now because it's place-based), plus
  "the bracket fills in automatically once all regular-season matches are
  complete (N of M played)." The pairing slots show *places* now, teams later.
- **Season complete — auto-resolved:** teams have dropped into their place-slots;
  show the **final bracket with real teams** (R3). This is mostly a *confirmation*
  view, since the pairing was already set.
- **Matches populated:** the **locked final bracket** (read-only), with the
  deliberate "reset matchups" affordance (R4) if the LO needs to redo it.

### R2 — Seeding/pairing is the primary adjustment (by PLACE, not team)
The headline control: the LO defines **how standings *places* are paired** — e.g.
"1st plays 3rd, 2nd plays 4th" (the per-week `weekMatchupStyles` / `MatchupStyle`,
already in code via `PlayoffBracketCard` + `handleMatchupStyleChange`).

Crucially, this is a **place-based rule, set against standings positions, not
specific teams** — so it can be set/adjusted **any time before the season ends**;
it does not need final standings. When the season finishes, the actual teams
**resolve into their place-slots automatically** (Kings finish 1st → Kings drop
into the 1st-place slot and play whoever took 3rd). This is the control that
should be **front and centre** on the page — not buried under format.

### R3 — Populate the matches (auto-preferred, manual at minimum)
When the season completes, the place-pairing rule (R2) + final standings resolve
into the actual playoff matches teams can see (`populatePlayoffMatches`).

Because the pairing is a **place-based rule already decided** (R2), this is purely
mechanical at season end — teams just drop into their slots — so it **can run
automatically the moment the season completes.** No "stop and decide" step is
required. Manual one-click is the minimum fallback. "Matchups populated" = the
playoff-week matches have **non-null team IDs** (see lifecycle state 3 + Technical
notes) — what the page reads on load to choose its state.

### R4 — Once populated, everything locks behind a deliberate reset
After the matches are populated, the bracket + pairing + format are **locked**
(read-only). To redo them, the LO uses a deliberate **"reset matchups"** action —
consequential, because teams can already see who they're playing, so it confirms
clearly.

**Unlock mechanism (review found the existing path is unsafe):** "reset matchups"
must **null out the team IDs** on the playoff-week placeholder rows (so the rows
survive and the populate step can re-fill them). It must **not** use the existing
`clearPlayoffMatches`, which *deletes* the placeholder rows — after a delete,
`populatePlayoffMatches` has nothing to update and fails ("No placeholder matches
found"). A small new "reset matchups" helper (null the team IDs) is the safe path
and keeps us within the "don't redesign the data model" boundary. See Technical
notes.

### R5 — Format edits are a minor, tucked-away secondary action
The *format/template* (`PlayoffTemplateSelector` + `PlayoffSettingsCard`) is set
during season creation, so on this page it's **background**, not the headline.
Keep it editable (freely until the matches are populated, then locked with the
rest), but **out of the way** — not the first thing seen.
- **Leaning (UI shape is the builder's call, adjustable after Ed sees it):** a
  **collapsed "Edit playoff format" section**, closed by default, one tap to open.
  Ed: "build however you want, we can adjust it to my taste after."

### R6 — Reuse, don't rebuild
This is an **in-place rewrite of `PlayoffSetup.tsx`** (same `/playoffs` route), so
the shared cards already imported there come along: `PlayoffTemplateSelector`,
`PlayoffSettingsCard`, `PlayoffBracketCard`, `PlayoffMatchRulesCard`. The
`StandingsTable` and `ExcludedTeamsNotice` are **inline local functions** in
`PlayoffSetup.tsx` today (not shared components) — they carry over for free in an
in-place rewrite; only extract them if the page is split into a new file.

The page-wide `useBlocker` (fires on `settings.isModified` anywhere) must
**narrow** so it only guards when the **edit section is open AND dirty** — a
review-only visit with no edits should never block navigation. That's a small
predicate change (`isEditOpen && isModified`), not a pure reuse.

## Scope boundaries (non-goals)

- **Not** touching `PlayoffsSetupWizard.tsx` (the season-creation format step).
- **Not** redesigning bracket-generation logic, the playoff data model, or the
  qualifying/seeding math.
- **Not** adding a new route — reuse the existing `/playoffs` route.
- **Not** redesigning `PlayoffsCard` — **except** its status signal: its
  "Bracket created" / "View Bracket" label currently fires off a raw match count,
  which is wrong (true all season). Align it to the same non-null-team-IDs signal
  this page defines, so the card and page agree. Small, same-bug fix — in scope.
- **Not** redesigning the individual config fields/UI inside the reused cards.

## Success criteria

- Opening Playoffs **mid-season** shows a calm waiting state (or "no playoffs" if
  none), **not** a configure-the-format question.
- When the season completes, the page leads with **final standings + bracket +
  the seeding/pairing choice + populate** — the LO can set who-plays-who and
  commit without hunting.
- A league with no playoff week shows a settled "doesn't run playoffs" message,
  not an error.
- Once populated, the bracket is protected — redoing it takes a deliberate "reset
  matchups" step.
- No regression to the season-creation playoff step (`PlayoffsSetupWizard`).

## Technical notes (for the planner — resolved during review)

These two are **architectural, not presentation** — the plan must build on them
rather than re-decide them:

1. **"Matchups set" predicate.** Compute on page load from whether the
   playoff-week matches have **non-null team IDs** (not row count, not the stale
   `matchesExist` flag). `populatePlayoffMatches` already keys off the inverse
   (`.is('home_team_id', null)`), so the signal is consistent with existing code.
   This drives the page's state (waiting → populate → locked, R3/R4) and the
   corrected `PlayoffsCard` label.
   - *Multi-week brackets:* schedule generation makes placeholders for **every**
     playoff week; later rounds stay null even after round 1 is filled. The plan
     must define **which week(s) gate the lock** (likely: round-1 week populated
     ⇒ locked).
2. **Unlock = reset, not delete.** A new small "reset matchups" helper nulls the
   team IDs on the playoff-week rows (preserving the placeholder rows so
   "Approve & Set Matchups" can re-fill them). Do **not** route the unlock through
   `clearPlayoffMatches` (it deletes rows and breaks re-commit).

**Edge/empty states** (surfaced by review):
- **No playoff week scheduled** → **DECIDED: this means the league chose no
  playoffs.** Show a calm terminal "This league doesn't run playoffs" — *not* an
  error card and *not* a prompt to add one. (Today it's a red error — fix it.)
- **Season still in progress** → **DECIDED: no live mid-season bracket.** Playoffs
  are the finals; show the waiting state (upcoming format + date + "fills in when
  all matches are complete"), don't try to render/preview a bracket from partial
  standings (which errors today on <2 teams-with-results anyway).
- **Post-commit landing** → today populate navigates away to `/schedule`; decide
  whether the review page stays on `/playoffs` to *show* the now-locked bracket
  (else the locked state is rarely seen).
- **Inherited-default config** → **DECIDED: no special treatment.** If the LO hit
  "Skip" in season setup, they *selected the default* — that's a real choice. The
  page treats a resolved default exactly like any other set format: review-first,
  edit section one tap away. No "you haven't picked yet" prompt or variant state.

## Open questions (still to decide)

- ~~Auto-populate vs manual~~ — **DECIDED: auto.** Per the app-wide north star
  (set-once / runs-itself), the playoff **resolves and populates automatically**
  when the season completes. A manual "populate now" stays as a fallback/override,
  but the default path requires no LO action.
- **Exact edit/locked-surface shape** — collapsed section (leaning) vs dialog vs
  edit-mode toggle, and how the locked read-only bracket presents. Deferred to
  build; adjust after Ed sees it. (Resolve together — locked is a conditional
  variant of the same region.)
- **Post-commit landing** — stay on `/playoffs` (show locked bracket) vs navigate
  to `/schedule` as today.

## Key files (for the planner)

- `src/operator/PlayoffSetup.tsx` — the page being redesigned (the `/playoffs`
  route target).
- `src/components/operator/PlayoffsCard.tsx` — dashboard entry point.
- `src/operator/PlayoffsSetupWizard.tsx` — the creation-chain step (reference for
  reuse; **do not change**).
- `src/components/playoff/` — reusable cards (`PlayoffTemplateSelector`,
  `PlayoffSettingsCard`, `PlayoffBracketCard`, `PlayoffMatchRulesCard`).
- `src/utils/playoffGenerator.ts` — `getPlayoffWeek`, `checkRegularSeasonComplete`,
  `generatePlayoffBracket`, `populatePlayoffMatches`, `clearPlayoffMatches`.
- `src/hooks/playoff/usePlayoffSettingsReducer.ts` — config/settings state.
