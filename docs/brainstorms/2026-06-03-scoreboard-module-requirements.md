---
title: Scoreboard Module — Phase 1 design (post-rough-draft)
date: 2026-06-03
status: Requirements — capturing locked decisions + open questions
supersedes_partially: docs/brainstorms/2026-05-21-scoreboard-module-design-requirements.md
  (the rough draft; its locked decisions carry forward verbatim, this doc
  refines + adds the template + char-limit shape Ed sketched 2026-06-03)
scope: Replace the hardcoded scoreboard layout in `UnifiedScoreboard.tsx`
  with a per-system `ScoreboardModule` that reads from the state bag
  via labeled, templated spots. LO eventually edits via the workshop;
  today every shipping system declares a curated default.
not_in_scope: Workshop UI for editing the scoreboard. Live-color theming
  / animation customization. Per-player stat columns (own module per
  audit). Tiebreaker scoreboard variant. Cross-team comparison overlays.
---

# Scoreboard Module

## Why this doc exists

The May 21 rough draft (`2026-05-21-scoreboard-module-design-requirements.md`)
captured the core layout model: ONE side-agnostic unit, mirrored, 8 spots
in a 3-2-3 layout, paired-state render mode. Ed's 2026-06-03 message
confirmed all of that and added:

- **Template syntax**: spots show templated text like
  `{home_games_won}/{threshold_1}` — curly-brace placeholders against
  the state bag, with literal characters between (the `/`, etc.) preserved
- **Character limits**: small spots need short labels; large (middle)
  spots can be longer
- **"Lots to think about"** — explicit acknowledgment that this is a
  brainstorm-not-plan; details get fleshed out via dialogue

This doc consolidates everything and structures the remaining open
questions so planning can start cleanly.

## What's locked (from May 21 + 2026-06-03)

1. **One side-agnostic unit, mirrored.** LO designs the 8 spots once;
   the renderer mirrors home (reads `home_*` vars) and away (reads
   `away_*`). Identical positions and labels on both sides.
2. **Side labels are side-agnostic.** "Wins" not "Home Wins"; the
   home/away identity is positional (left / right) and the page-level
   header carries it.
3. **3 small / 2 large / 3 small per side.** 8 spots total per side.
   The middle two are visually prominent (primary axis: wins or
   points); the surrounding six are smaller.
4. **Each spot has a label + a template.** The template renders text
   by interpolating state-bag variables wrapped in `{curly_braces}`.
   Literal characters around variables (`/`, `+`, `-`, spaces) are
   preserved as-is.
5. **Paired-state spots are templates with two variables.** `{wins}/{wins_to_win}`
   produces "3/10". No separate "pair mode" — the template handles it
   because the pair is just two placeholders with a literal between.
6. **Scoreboard reads the state bag; never recomputes.** Whatever the
   scoring engine wrote, the scoreboard surfaces. Same architecture
   the threshold-math runtime uses: empty bag → modules seed/compute
   → scoreboard reads.
7. **Never-break.** A bad template, missing variable, or render error
   blanks/mis-shows ONE spot — never crashes the page. Match recording
   is unaffected.
8. **Global region is separate.** Match-level readouts (5/25 games
   played, etc.) live in their own region outside the mirrored 8-spot
   grid. Not in scope for this doc.

## Module shape (proposed)

```
ScoreboardModule = {
  spots: ScoreboardSpot[];   // exactly 8, positioned by index 0..7
}

ScoreboardSpot = {
  position: 'top_left' | 'top_center' | 'top_right' |
            'middle_left' | 'middle_right' |
            'bottom_left' | 'bottom_center' | 'bottom_right';
  label: string;             // side-agnostic, char-limited
  template: string;          // e.g. '{wins}/{wins_to_win}'
  emptyFallback?: string;    // shown when any variable resolves null/undefined
}
```

`SystemModule` gains:
```
readonly scoreboard: ScoreboardModule;
```

Each shipping system declares a curated default. Workshop will eventually
edit per-league.

## How rendering works

For each side (home, away):
1. Take the system's `scoreboard.spots`
2. For each spot:
   - Parse the template (find `{var}` placeholders)
   - For each placeholder: resolve `var` → if rendering the home side
     and var is `wins`, read `home_wins` from the state bag; for away,
     read `away_wins`. Globally-prefixed vars (declared via some
     convention, see Open Question 3) read as-is
   - If ANY variable resolves to null/undefined, show `emptyFallback`
     (default `'—'`)
   - If the render throws, log silently and show `emptyFallback`
3. Render the spot with its label above/beside the templated value

## Character limits (initial proposal)

| Spot size | Label cap | Rendered-value visible cap (approx) |
|---|---|---|
| Small (top + bottom rows) | 8 chars | 5–8 chars |
| Large (middle row) | 12 chars | 3–6 chars (often a single big number) |

Limits enforced by the workshop validator (future). Today, just sized
in CSS — long labels truncate.

## Open Questions (need Ed)

### Locked by Ed's 2026-06-03 message
- **Layout**: 3-2-3, 8 spots per side. ✓
- **Template syntax**: `{var_name}` placeholders with literals between. ✓
- **Char limits**: explicit caps; numbers above are a starting point — Ed
  picks final.

### Still open

1. **State-bag variable naming.** Today's `home_to_win`, `home_to_tie`,
   `home_games_won` etc. are the column names. Should the scoreboard
   templates reference the bag keys exactly (`{home_games_won}`), or
   should the module use side-agnostic names (`{wins}`) and the
   renderer prepend `home_` / `away_` at mirror time? May 21 draft
   leaned toward side-agnostic (`{wins}` mirrors to `home_wins` /
   `away_wins`). Confirm.

2. **Missing-variable fallback.** Default `'—'` (em dash) when a
   referenced variable is null/undefined? Or `''` (blank, collapses
   the spot)? Or per-spot configurable (`emptyFallback` field)?

3. **Global variables in mirrored spots.** Can a sided spot mix a
   per-side var with a global (`{home_wins}/{total_games}`)? May 21
   left this open. Lean: allow, but use a distinguishing prefix in
   the template (e.g. `{$total_games}` for global vs `{wins}` for
   side-resolved). What prefix?

4. **Default 8-spot set per system.** Which 8 spots does each shipping
   system declare as default? Needs your call per system:
   - BCA 3v3 (Points): wins, win target, tie target, lose edge, points
     earned, ?, ?, ?
   - BCA 5v5% (Percentage): same shape?
   - Fargo points-mode: points accumulated, start credit, ?, ?, ...
   - Fargo games-won: ?, ?, ...

5. **Template literals — how literal?** Are spaces preserved? Newlines
   allowed (`{wins}\n{wins_to_win}` for stacked)? What about HTML/
   markdown characters? Initial proposal: plain-text only, no markup,
   spaces preserved, no newlines (kept on one line for layout).

6. **Format hints.** A var might be an integer (5), a decimal (5.5),
   a percentage (75%), or already-formatted text. Does the template
   syntax support format hints (`{wins:int}`, `{percent:%}`)? Or do
   the scoring modules write pre-formatted strings to the bag?

7. **Hide-empty spots.** Should a spot whose template resolves to an
   all-fallback value (`'—/—'`) hide entirely, or always show the
   labeled empty value?

8. **Workshop preview / validation.** Today's scope is shipping curated
   defaults. When the workshop UI lands, what's the smallest viable
   "preview" — does the LO pick a spot and see "Sample value: 5/10"?
   (Probably the workshop's brainstorm, but flagging now so this
   module's data shape supports it.)

## Non-Goals (this branch)

- **Workshop UI** for editing the scoreboard. Future.
- **Color theming / animation dials.** Use existing fixed styles.
- **Tiebreaker scoreboard variant.** TiebreakerScoreboard.tsx already
  exists for that path; out of scope here.
- **Per-player stat columns** (separate module per the UI audit).
- **Global region implementation.** Acknowledged as future work; not
  this module's responsibility.

## Sources & References

- `docs/brainstorms/2026-05-21-scoreboard-module-design-requirements.md` —
  the rough draft this builds on (locks side-agnostic-mirror, label-
  vs-displayName naming crash, reader-never-recomputer rule, etc.)
- `docs/brainstorms/2026-06-03-ui-modularity-audit-requirements.md` —
  scoreboard listed as module concept #3 in the audit
- `CLAUDE.md` core principles — runtime trusts (scoreboard is runtime);
  game data is sacred (scoreboard's failure is bounded)
- Today's hardcoded scoreboard: `src/components/scoring/UnifiedScoreboard.tsx`
  (4 of its 9 `winCondition` peeks become scoreboard-module dials)
