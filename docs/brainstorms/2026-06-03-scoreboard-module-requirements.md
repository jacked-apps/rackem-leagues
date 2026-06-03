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

## What's locked (May 21 + 2026-06-03 + Ed's follow-up)

1. **One side-agnostic unit, mirrored.** LO designs the spots once;
   the renderer mirrors home (reads `home_*` vars) and away (reads
   `away_*`). Identical positions and labels on both sides.
2. **Side labels are side-agnostic.** "Wins" not "Home Wins"; the
   home/away identity is positional (left / right) and the page-level
   header carries it.
3. **3 small / 2 large / 3 small per side.** Up to 8 spots total per
   side. Middle two are visually prominent; surrounding six are
   smaller.
4. **Spots are OPTIONAL.** A scoreboard can declare 4 spots, or 7, or
   8 — empty positions render as empty space, no placeholder. The 8
   is a ceiling, not a requirement.
5. **Each spot has a label + a template.** Template = a string with
   `{var_name}` placeholders plus the literal `/` separator.
   **v1 simplicity:** that's it. No other special characters, no
   format hints, no styling. Extra characters / fonts come later.
6. **Variable naming convention: side-agnostic.** Templates use
   side-agnostic names like `{wins}/{wins_to_win}`. At render time,
   the renderer prepends `home_` (home side) or `away_` (away side) —
   producing `home_wins`/`home_wins_to_win` and
   `away_wins`/`away_wins_to_win`. One template, two sides, the
   mirror happens at lookup time.
7. **Workshop validates spot references at config time.** A spot
   pointing to a variable that the league's chosen scoring modules
   don't write is REJECTED at workshop save. Runtime never has to
   handle "key doesn't exist" — it's a workshop guardrail.
8. **Shipping scoreboards are built the same way the LO builds.**
   BCA 3v3, BCA 5v5%, Fargo defaults aren't a separate code path —
   they're ScoreboardModule configurations we author using the same
   mechanism the LO uses in the workshop. Same data shape, same
   validation, same render.
9. **Scoreboard reads the state bag; never recomputes.** Whatever
   the scoring engine wrote, the scoreboard surfaces. Same
   architecture the threshold-math runtime uses.
10. **Never-break.** A render error or unexpected null blanks/mis-shows
    ONE spot — never crashes the page. Match recording is unaffected.
11. **Global region is separate.** Match-level readouts (5/25 games
    played, etc.) live outside the mirrored grid. Not in scope here.

## Module shape (proposed)

```
ScoreboardModule = {
  spots: ScoreboardSpot[];   // up to 8, positions filled as needed
}

ScoreboardSpot = {
  position: 'top_left' | 'top_center' | 'top_right' |
            'middle_left' | 'middle_right' |
            'bottom_left' | 'bottom_center' | 'bottom_right';
  label: string;                 // side-agnostic, char-limited
  template: string;              // e.g. '{wins}/{wins_to_win}'
                                 // — variables are side-agnostic; renderer
                                 //   prepends home_ or away_ at lookup time
  emptyFallback?: string;        // shown when ANY referenced variable
                                 //   resolves null/undefined (default: '—')
}
```

Positions a scoreboard does NOT include simply render empty — no
placeholder, no border, just whitespace.

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

## Resolved during this brainstorm

| Question | Resolution |
|---|---|
| Layout | 3-2-3, up to 8 spots per side (optional) |
| Template syntax | `{var_name}` placeholders + literal `/` only for v1 |
| Variable naming | Side-agnostic names (`{wins}`); renderer prepends `home_` / `away_` |
| Missing-variable fallback | `'—'` default; per-spot `emptyFallback` overrides |
| Reference validation | Workshop-time only — runtime trusts |
| Format hints | None for v1. Scoring modules write pre-formatted strings if needed |
| Template extras (fonts, newlines, markup) | Deferred to future iteration |
| Shipping scoreboards as code | They use the same data shape and renderer the LO would |

## Open Questions (still need Ed)

### 1. Default spots for each shipping system

I'll propose; Ed reacts. Each system's `scoreboard` field gets one of
these configurations, authored as if the LO had built it in the
workshop. **Each spot's label is char-limited per spot size** (small
spots ~8 chars, large spots ~12 chars).

**BCA 3v3 (Points handicap, games win-condition)** — proposed 6 spots:

| Position | Label | Template |
|---|---|---|
| top_left | Need | `{wins_to_win}` |
| top_center | Bonus | `{team_bonus}` |
| top_right | Tie at | `{wins_to_tie}` |
| middle_left | Wins | `{wins}/{wins_to_win}` |
| middle_right | Points | `{points}` |
| bottom_left | Win H/C | `{handicap_diff}` |

(top_center could be hidden when team bonus = 0; bottom_center +
bottom_right empty by default.)

**BCA 5v5% (Percentage handicap, games win-condition)** — proposed 5
spots: same as BCA 3v3 minus team bonus (Percentage has none).

**Fargo points-mode** — proposed 4 spots:

| Position | Label | Template |
|---|---|---|
| top_center | Start | `{wins_to_tie}` (the negotiated start credit) |
| middle_left | Points | `{points}` |
| middle_right | (empty) | — |
| bottom_center | Games | `{wins}` |

**Fargo games-won** — proposed 4 spots: similar to BCA 3v3 layout but
without team bonus.

These are starting points. Ed picks which spots, which labels, which
templates per system. Once locked, this becomes the implementation
spec.

### 2. Char limits per spot size

The locked numbers are still a proposal — small spots = ~8 chars label,
large = ~12. Final caps?

### 3. Empty-spot behavior

Confirmed positions a scoreboard doesn't include render as empty
whitespace (no placeholder). What about a spot whose TEMPLATE resolves
to all-fallback (`'—/—'` because no variables resolved)? Hide entirely,
or show the labeled empty value? Lean: show — the label communicates
intent.

### 4. Workshop preview

Out of scope for the module itself, but flagging: the module's data
shape should support "render with sample values" so the workshop can
preview an LO's configuration before they save. Probably free for the
shape proposed above (the renderer already takes variables → values).

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
