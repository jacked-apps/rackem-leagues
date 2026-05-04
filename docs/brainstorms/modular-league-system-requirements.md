---
date: 2026-04-28
topic: modular-league-system
supersedes: docs/brainstorms/modular-handicap-scoring-requirements.md
---

# Modular League System

## Problem Frame

The app today recognizes only two league shapes (`5_man` for 3v3, `8_man` for 5v5) baked into a `leagues.team_format` column referenced across ~24 files. A third preset (Fargo 5v5 with 10-7 points scoring) was added recently as a SystemModule but the underlying type tag still flows through the codebase. The April 18 brainstorm (`modular-handicap-scoring-requirements.md`) explicitly chose to lock the UI to three presets, defer custom team sizes (4v4, 6v6), defer mix-and-match, and defer operator-authored systems.

Two things have changed since:

1. **The Fargo league we built for is changing match format for next season.** Same handicap system (Fargo, manual entry, 100-850), same lineup geometry (5v5, 25 games via single round-robin), but switching from 10-7 points scoring to games-won. That means a different win condition (first-to-X-games instead of total-points-target) and a different threshold formula (extra-games-for-higher-team instead of start-points-for-lower-team). The three-preset lock cannot express this.

2. **Strategic ambition shifted.** Selling to BCA (and credibly competing with LeagueSys) requires the app to express any league an LO can describe. LeagueSys already does this — clunkily — and we want to do it better. That's not "keep the door open"; that's "the door must be open on day one."

External research confirms the underlying reality: **there is no canonical Fargo team-format threshold formula.** FargoRate's Race Calculator handles individual head-to-head races; team extension is always a league-defined approximation. Different leagues use different bands. This means the system cannot ship "the right formula" — it must ship a sensible *default* and let the LO override.

The remaining work is a structural refactor that turns league configuration into a set of independent modular axes, with a layered defaults strategy so any coherent combination produces a defensible answer.

## Strategic Identity

This is a **"BCA-grade adaptability"** refactor. Primary success is that an LO can configure any reasonable combination of lineup size, scoring method, handicap system, threshold logic, and standings sort — and the app produces sensible behavior. Anything LeagueSys can express, this should express; anything it can't but a real league wants, this should accommodate.

### Why now (the validation reviewers asked for)

Selling to the BCA has been the goal of this app from day one — not a late-stage rationalization for the modular pivot. **A BCA meeting is in the works in the near term.** That changes the calculus from "speculative ambition" to "concrete preparation."

The lived evidence supporting modular adaptability is multi-decade and operator-side, not just player-side:

- **20 years as a BCAPL-sanctioned league operator** running a 3v3 BCA points (-2..+2) handicap league. Paid annual BCA member fees, shipped results and standings to BCA, sent teams to the National Championship in Las Vegas. Direct first-hand experience of BCA's sanctioning process from the LO chair.
- **First-hand pain on team-championship qualification:** "getting each of my players in to the team championships was a hassle making sure to give them game data on them." This is a concrete LO operational pain that the Result Export workstream (deferred to its own doc) directly addresses.
- **Two years in Florida, three further BCA-touching leagues**, each with different rules: a BCA-rules cash league (5v5 percentage handicap, **not formally sanctioned** — used BCA-style rules informally), and the current Fargo-rated league (sends players to BCA championships, presumed sanctioned). Three different rule sets observed firsthand on top of the 20-year sanctioned operator background.
- **BCAPL local chapter rule variation is real.** The 20-year sanctioned 3v3 league used BCA points (-2..+2), not the BCAPL national SL1-SL9 system. This validates that `bca_points` is a legitimate BCAPL-sanctioned local variant — not just an informal house rule. Our existing handicap types (`bca_points`, `bca_percentage`, `fargo`) reflect formats encountered in real BCA-touching leagues, and `bcapl_sl` (the new addition) covers BCAPL's national headline format.

The trigger for the pivot was the developer's *current* Fargo league changing match format for next season — which exposed that the previous "ship one preset at a time as you encounter it" approach doesn't scale: every new league adds another preset, another month of work, and there is no end to that loop. The modular system breaks that cycle.

**Competitive positioning:** LeagueSys (LS) — the dominant operator-facing platform BCA has standardized on by default — has no wizards, no group/collaborative scoring, no player-facing stats, no own-match scoreboard, no visibility into other matches in your league. Even an *imperfectly* modular system that ships graceful behavior beats LS on the axes that matter to players, because LS doesn't compete on those axes at all. The 20-year LO experience also makes the pitch credible: this is built by someone who has lived the BCA operator workflow, not by an outsider guessing.

### What this means in practice

- **BCA meeting upcoming** — research into BCA's actual ecosystem (formats, sanctioning, integrity priorities, LeagueSys gaps, FargoRate relationship) is itself a planning-phase deliverable. See Outstanding Questions.
- **No production users currently** (per the user) — we can be aggressive with schema changes; legacy `team_format` can be dropped, not just deprecated.
- **The user's own league plays without the app this season.** Trading correctness now for ability to adapt to whatever rules emerge mid-season-2.
- **LeagueSys is reference, not gold standard.** "Anything LS does, we should be able to express, but better." When LS encodes a combo, that's prior art we can reference for math/formulas — but our UX doesn't have to mirror theirs.
- **"Stop chasing one league at a time."** The previous shipping cadence — "I played this format, now ship it; new format showed up, now ship that one" — is the explicit *anti-pattern* this work eliminates.

## Requirements

**Modular Axes (R1–R13)**

These are the independent configuration axes the system must support. Each has a default at the system level, an override at the org level, and an override at the league level (mirroring the existing 3-tier preference cascade).

- **R1. Lineup size.** Configurable: 3, 4, 5, 6 players per side. Stored in `preferences.lineup_size` (already exists). Lineup size = 1 (individual leagues) and lineup size = 2 are deferred to a future iteration.
- **R2. Roster size.** Configurable: any integer ≥ lineup size. Stored in `preferences.max_roster_size` (already exists).
- **R3. Match structure.** Configurable: `single_round_robin`, `double_round_robin`. Stored in `preferences.game_generation` (already exists). APA-style alternating-pick individual-race format is deferred — design to be extensible to a future `individual_races_alternating_pick` value but do not implement.
- **R4. Per-pairing format.** Configurable: `single_rack` (one rack per pairing) or `race_to_n` (each pairing plays a race; first to N racks wins the pairing). Race-to-N is required to support BCAPL Skill Level handicapping (see R7). The race length N may be fixed per league or computed per-pairing from rating differential (see R8 `race_length_adjustment`). APA-style alternating-pick lineup format is still deferred — design data model to be extensible to a future `individual_races_alternating_pick` value but do not implement.
- **R5. Per-game scoring method.** Configurable: `winner_takes_all` (1 game-win to winner; per-game-unit), `points_10_7` (winner = configurable winner-points, loser = 0–N balls-pocketed; per-game-unit is points), `race_winner` (winner of the race wins 1 pairing; relevant only when per-pairing format is `race_to_n`). Other methods (`fixed_points`, `points_with_bonus`) may exist as variants of the above driven by `system_overrides` dials.
- **R6. Match win condition.** Configurable: `first_to_games` (first team to X games wins; X is per-match, derived from threshold), `first_to_pairings` (first team to win X pairings — relevant for race-to-N format), `highest_after_all_games` (play all scheduled games; highest total wins), `total_points_target` (first team to reach a points target). The win condition must be coherent with the per-game scoring method (see Combo Coherence below).
- **R7. Handicap rating system.** Configurable: `none`, `bca_points` (-2..+2 or -1..+1 reduced variant), `bca_percentage` (0–100% or 0–50% reduced variant), `fargo` (manual entry, 100–850), **`bcapl_sl` (Skill Level 1–9; BCA Pool League's official national handicap; pairs naturally with `race_to_n` per-pairing format and `race_length_adjustment` mechanism — each SL maps to a race-to-N target via the BCAPL Playing Handicap Chart).** Stored in `preferences.handicap_type` (already exists; free-form string by design). Adding a new rating system later requires only a new SystemModule.
- **R8. Handicap mechanism.** The shape of the threshold output. Configurable: `extra_games` (higher-rated team must win extra games beyond the median), `start_points` (lower-rated team starts the match with points already on the board), `race_length_adjustment` (per-pairing race length differs by rating diff — required for BCAPL SL + race-to-N combos). The mechanism must be coherent with the per-game scoring method and the match win condition.
- **R9. Threshold source.** Three layers, resolved in priority order, with graceful fallback when no layer produces a value:
  - **Layer 1 (innermost): generative defaults from primitives — Fargo only.** The FargoRate logistic curve is applied per-pairing and summed/integrated over the match for any Fargo combo at any lineup size. BCA points and BCA percentage handicap systems do not have a Layer 1 — these systems lack the probabilistic foundation for clean extrapolation, and Example B documents the failure mode. BCA combos at non-canonical lineup sizes flow directly to Layer 2 or Layer 3 with a "no Layer 1 default for this combo" warning.
  - **Layer 2: built-in named presets.** Where a published table exists, encode it as a built-in preset that overrides the generative default for its specific combo. Confirmed Layer 2 entries: BCA 3v3 points chart (existing `get3v3GamesNeeded.ts`), BCA 5v5 percentage chart (existing `get5v5GamesNeeded.ts`), FargoRate Race Calculator **at lineup_size=1 only** (it handles individual head-to-head races, not team formats — community convention of feeding team averages as pseudo-players is a Layer 1 generative technique, not a Layer 2 preset). For Fargo team formats (5v5, 4v4, 6v6), there is **no Layer 2 preset today** — Layer 1 generative is the path, with the LO supplying Layer 3 if their league has published bands.
  - **Layer 3 (outermost): LO custom override.** LO can supply a full custom table or override individual cells of a default. DB infrastructure (`threshold_charts`, `threshold_chart_rows`, `lookup_threshold()` SQL function) already exists from `supabase/migrations/20260410000002_threshold_charts.sql` but is unwired; this work wires it up.
- **R10. Standings sort.** Configurable: an ordered priority list of sort keys, picked from `match_wins`, `games_won`, `points_earned`. Default is `[match_wins, games_won, points_earned]` for games-won scoring, `[match_wins, points_earned, games_won]` for points scoring. LO can reorder. Head-to-head as a tiebreaker is deferred. *Justification (response to scope-guardian / product-lens flag of "speculative"):* the developer has personally observed standings-sort variation across the three different BCA leagues played in the last two years — this is variation directly seen in the wild, not hypothetical.
- **R11. Tiebreaker.** When a single match ends tied (only possible when total games is even — relevant for double round-robin or any combo that produces an even total), the tiebreaker triggers. Configurable: when triggered (`even_total_games_only` or `never`), and what format (`best_of_3_short_race`, `single_short_race`, `accept_tie`). Defaults: `even_total_games_only` + `best_of_3_short_race` for any double-RR combo; `accept_tie` for points-scoring matches that end exactly equal. *Justification (response to "speculative" flag):* same as R10 — observed variation across BCA leagues already played.
- **R12. Per-game achievements tracked.** Always-on at the data layer (break-and-run, golden break, runout, balls-pocketed all captured on `match_games`). Whether each achievement *counts* in scoring or standings is per-system: e.g., `golden_break_counts_as_win` already exists as a preference. Adding new achievements is independent of this refactor.
- **R13. Mid-season locking.** Once a league has any completed matches, configuration changes that would invalidate already-scored games are blocked. The `match.system_snapshot` JSONB column **already exists** (per `supabase/migrations/20260418000003_add_matches_system_snapshot.sql`) and is currently populated at first-scoring-event by `src/hooks/useMatchScoringMutations.ts` and read by `MatchEndVerification.tsx` and `useSpectateMatch.ts`. This work expands the snapshot's *shape* (more dials snapshotted) and ensures the resolver reads from the snapshot when present. R13 has two parts: (a) extend snapshot population at match-start (column exists, wiring exists, shape needs expanding); (b) per-dial mid-season-safe-to-change classification (deferred to planning — see Outstanding Questions). The locking *mechanism* is in scope; the locking *policy classification* is the planning-phase question.

**Combo Coherence (R14–R16) — graceful warnings, not rejections**

The modular axes are independent in storage but interact in combination. The system surfaces warnings for combinations that don't have clean math, but does **not** block the LO from saving them. (The "doesn't break, makes a match happen with whatever info we have" principle.)

- **R14. Per-game scoring method dictates the unit.** `winner_takes_all` produces game-wins as the unit; `points_10_7` produces points as the unit. Win conditions and threshold mechanisms operate in that unit. The system uses the unit information to choose sensible defaults but does not reject mismatches outright — it warns.
- **R15. Recognized clean triples (no warning surfaced).** These (per-game scoring × win condition × handicap mechanism) combinations are well-defined and produce no warnings:
  - (`winner_takes_all`, `first_to_games`, `extra_games`) — BCA 3v3, BCA 5v5, Fargo games-won
  - (`winner_takes_all`, `highest_after_all_games`, `extra_games` or `none`) — even-total tiebreaker formats
  - (`points_10_7`, `total_points_target`, `start_points`) — Fargo 10-7 points
  - (`points_10_7`, `highest_after_all_games`, `start_points`) — Fargo 10-7 with no early termination
  - (`race_winner`, `first_to_pairings`, `race_length_adjustment`) — BCAPL SL race format
  - Other combinations are flagged with a non-blocking warning (e.g., `points_10_7` + `first_to_games` warns "your scoring method produces points but your win condition counts games — the match will end when the game-count target is reached, ignoring point margin"). LO confirms and proceeds.
- **R16. When no threshold default is available, the system uses graceful fallback.** If the combo has no Layer 1 generative default (e.g., BCA-rating combos at non-canonical lineup sizes) and no Layer 2 preset, the wizard surfaces a clear notice: "no published default for this combo — you can: (a) supply a custom table, (b) accept an unhandicapped match (lower team gets no advantage), or (c) accept a rough estimate based on raw rating differential." LO picks one and proceeds. Match scoring still works in all three cases.
- **Genuinely impossible combinations still block.** Example: a scoring method whose unit cannot produce *any* threshold output shape. The bar for blocking is much higher than "the doc thinks this is incoherent."

**Integrity and Audit (R21)**

- **R21. Rating-edit audit log.** Any change to a player's rating (manually entered Fargo, BCAPL SL, BCA points, percentage) must be captured to an immutable audit table: who edited (user_id), when (timestamp), what changed (rating system, before-value, after-value, scope: per-match-lineup vs persistent member rating), and why (optional reason text). The audit log is read-only via UI; admin-level access can query it for dispute resolution. *Why:* this directly addresses BCA's #1 software anxiety (sandbagging — players or LOs silently editing handicap-relevant ratings to gain unfair advantage at sanctioned events). Without an audit log on rating mutations, the app cannot credibly serve BCAPL-sanctioned leagues.

**Migration and Deprecation (R17–R20)**

- **R17. `leagues.team_format` column is dropped.** The `5_man` / `8_man` enum is fully deprecated. Scope is larger than initially scoped (~24 files): grep confirms ~25 src files plus 11 occurrences in `supabase/migrations/`, and the `resolved_league_preferences` view (`supabase/migrations/20260417000000_add_modular_to_resolved_view.sql`) still COALESCEs `leagues.team_format` into its output. Drop sequencing requires: (1) backfill all leagues' preferences rows via a one-shot SQL migration (the lazy-migration logic in `useResolvedLeaguePrefs` is TypeScript and must be ported to SQL or run in a one-time job before the column drops), (2) update the resolved view to no longer reference `team_format`, (3) update all RPC/SQL functions that reference `team_format`, (4) update all `src/` readers — including `src/utils/lineup/getPlayerCount.ts` whose API takes `TeamFormat` as a parameter, (5) **verify Jack's mobile app does not read `team_format` directly** before drop (per memory — mobile mirrors web DB calls and is a separate codebase outside `src/`). Any production data may be lost (per user — no active users; acceptable). Mobile-app dependency check is a planning-phase blocker.
- **R18. The `SystemModule` interface continues to be the runtime contract,** but evolves to support the new axes. The three current modules (`bca3v3`, `bca5v5`, `fargo5v5`) remain as opinionated bundles that pre-fill all axes for their preset. Adding a new combination does not require a new module — the resolver can build a `SystemModule`-equivalent ad-hoc from preferences. **Note:** `SystemModule.key` (`src/systems/types.ts`) is currently a closed string literal union (`'bca3v3' | 'bca5v5' | 'fargo5v5'`) — it must be widened to `string` (or a discriminated approach) so ad-hoc resolved configs have a valid key. Similarly, the threshold output union (`BCAThreshold` `mode: 'games_to_win'` vs `FargoThreshold` `mode: 'start_points'`) is shaped around rating system; the new design needs to discriminate on **mechanism** (extra_games / start_points / race_length_adjustment) rather than rating system, so combos like (BCA-rating, points-scoring, start-points-mechanism) have a valid output shape. (See Key Decisions: "modules become opinionated defaults, not the runtime substrate.")
- **R19. The wizard's three preset cards survive,** but as *shortcuts* for common combos rather than the only path. A "Custom" path lets the LO set each axis independently. The wizard surfaces combo coherence errors and threshold-source requirements inline.
- **R20. Existing leagues' behavior is preserved during migration.** Resolution order is unchanged: league preferences → org preferences → system defaults. Existing leagues' resolved config produces the same behavior post-migration (validated by characterization tests on the three current presets).

## Success Criteria

1. An LO can create a league with any combination of (lineup size in {3,4,5,6} × match structure × handicap rating system × per-game scoring method × match win condition × handicap mechanism × standings sort) that is coherent under R14–R16, and the app produces a defensible threshold value, scoring run-through, and standings sort for that league without further LO input — using generative defaults where Layer 2 presets aren't available.
2. The legacy `5_man` / `8_man` tag is removed from the schema and from all runtime code paths. No reference to those strings remains in `src/`.
3. The user's current Fargo league (next season's games-won format) is configurable via the wizard with no code change — only LO config — and produces sensible thresholds even before the LO supplies a custom table.
4. The three current presets (BCA 3v3, BCA 5v5, Fargo 5v5 10-7) continue to resolve to identical behavior post-migration. Characterization tests prove this.
5. An LO can supply a custom threshold table via UI for any combo, and that table takes precedence over Layer 1 and Layer 2 defaults.
6. Combo coherence errors fire at config time, not at match-scoring time. The wizard never lets an LO save an incoherent league.
7. Standings sort is configurable per league. The current hardcoded W/L-first sort becomes the default for `winner_takes_all` scoring; points-first becomes the default for `points_10_7` scoring.

## Scope Boundaries

### In scope

- Modular preference columns for all 13 axes (R1–R13), with combo coherence warnings (R14–R16)
- Wiring the existing `threshold_charts` DB tables into runtime (Layer 3)
- Generative default engine for **Fargo only** (logistic-based, per-pairing). BCA combos at non-canonical sizes use Layer 2 / Layer 3 / graceful fallback — no Layer 1 for BCA.
- Built-in encoding of BCA 3v3 chart, BCA 5v5 chart, FargoRate Race Calculator (Layer 2). BCAPL Playing Handicap Chart for SL race-to-N (Layer 2) — chart values to be sourced from current BCAPL League Operator Manual during planning.
- LO custom threshold-chart editor UI
- Wizard "Custom" path with per-axis configuration and inline coherence warnings
- Drop of `leagues.team_format` column and removal of all `5_man` / `8_man` references from `src/`
- Snapshot-shape expansion on existing `match.system_snapshot` JSONB (R13) — column already exists
- Standings sort configuration (R10)
- Tiebreaker configuration (R11)
- BCAPL Skill Level handicap system as a fifth `handicap_type` value (R7), with race-to-N per-pairing format (R4) and race-length-adjustment mechanism (R8)
- Rating-edit audit log (R21)
- Smoke tests confirming the three current preset modules produce expected scoring outputs post-migration. (Soft replacement for full characterization-test sweep — given zero production users, the existing unit tests in `src/systems/__tests__/` plus a "create league with each preset, score one match" smoke test cover the regression-protection bar.)

### Out of scope (deferred)

- **Lineup size = 1 (individual leagues).** Architecture must remain extensible; not implemented.
- **Lineup size = 2.** Same.
- **APA-style alternating-pick individual-race format** ("home picks first, away matches; alternating each round; each pairing plays a full race"). User has explicitly deferred. Architecture must remain extensible.
- **Head-to-head as a standings tiebreaker key.**
- **Anti-sandbag rule expansion** beyond what's already in `bca3v3.ts`. Deferred to its own brainstorm. (Note: R21 audit log is in scope here as the *infrastructure* for anti-sandbag enforcement; rule-level expansion is the deferred piece.)
- **FargoRate API integration** for automatic rating fetch. Pending BCA business relationship.
- **Achievement dialog redesign** (breaker-vs-racker validation, Loss-on-Break, Illegal Break) — separate workstream.
- **Mid-season system changes** that would affect already-scored games.
- **Result export to BCA national database / LeagueSys format** — table stakes for sanctioned leagues per the research, but a meaty workstream of its own (export format, scheduling, retry, error handling, BCA API integration). Carved out as a separate follow-up requirements doc, not in scope here. **Flagged as a strategic dependency for the BCA pitch — and a concrete LO pain the developer experienced firsthand during 20 years of sanctioned operation ("getting players in to team championships was a hassle making sure to give them game data on them").** The follow-up doc should center on eliminating this hassle.

## Key Decisions

- **Graceful degradation is the load-bearing design principle.** When the system doesn't have a perfect answer for a configured combo, it does not block the league or the match — it warns the LO with honest labels (this is a guess vs this is a published chart vs this is your custom table) and proceeds with the best available fallback. The bar is "scoring doesn't break and the match can be played to completion," not "every combo is mathematically optimal." This principle directly addresses the developer's stated requirement: *"I need the scoring not to break if we don't have the correct shit. I need it to at least try to get a match going with whatever info we have."*
- **Strategic pivot from "ship my leagues" to "BCA-grade adaptability"** is grounded in (a) the BCA sales meeting in the near term — concrete, not speculative; (b) the developer's lived experience of three rule-divergent BCA-sanctioned leagues in two years — direct evidence of variation; (c) the unsustainability of the previous "encounter-then-ship" cadence. Supersedes the April 18 doc's lock-to-3-presets decision.
- **Threshold logic is data-driven, not formula-hardcoded.** External research and the developer's lived experience both confirm BCA-sanctioned leagues vary widely on rules, scoring, and handicap. There is no canonical Fargo team formula. The system must accommodate this.
- **Three-layer threshold resolution: generative → preset → LO custom — but Layer 1 is Fargo-only.** Earlier drafts proposed proportional extrapolation of BCA points/percentage charts to non-canonical lineup sizes; this was rejected because BCA points and percentage handicap systems lack the probabilistic foundation for clean extrapolation (Example B demonstrates the failure). For BCA combos at non-canonical sizes, the system uses graceful fallback (Layer 2 if a published chart exists; otherwise the wizard flags "no default available — supply a custom table or accept the unhandicapped fallback" and proceeds).
- **Modules become opinionated defaults, not the runtime substrate.** The three current `SystemModule` files (`bca3v3.ts`, `bca5v5.ts`, `fargo5v5.ts`) survive as bundles that pre-fill all axes for their preset, but the runtime resolver can build the equivalent of a SystemModule ad-hoc from any coherent preference combination. New combos do not require a new module file.
- **`leagues.team_format` is dropped, not deprecated.** No production users; acceptable to lose any production data. Eliminates ~25 files of legacy branching plus 11 migration references and the resolved view's COALESCE. Mobile-app dependency check is a planning-phase blocker.
- **Combo coherence is surfaced as warnings, not config-time rejections.** Earlier drafts had the wizard refuse to save "incoherent" combinations; the new framing flags incoherent combinations with explanatory warnings but lets the LO save them anyway. This honors the "try to get a match going with whatever info we have" principle. Genuinely impossible combos (e.g., scoring method has no possible threshold output shape) still block, but the bar is much higher than "the doc says this is incoherent."
- **Standings sort and tiebreaker get promoted to first-class preferences.** Currently hardcoded; this work makes them configurable. Reviewer concern that these are speculative is overruled by the developer's direct observation of variation across the three BCA leagues played in the last two years.
- **DB infrastructure for threshold charts already exists** — this work wires it up rather than building it from scratch. Note: `lookup_threshold()` SQL function has zero runtime callers today, so wiring is a multi-day refactor of every threshold-consuming call site, not "just turn it on."
- **`match.system_snapshot` JSONB column already exists** and is populated. This work expands the snapshot's *shape* (more dials snapshotted), not its existence.

## Dependencies / Assumptions

- The 3-tier preference cascade (`league → org → system_defaults`) and `useResolvedLeaguePrefs` continue to work as today. (Verified against `src/api/hooks/useResolvedLeaguePrefs.ts`.)
- The `threshold_charts` / `threshold_chart_rows` tables and `lookup_threshold()` SQL function exist and behave per the migration. (Verified against `supabase/migrations/20260410000002_threshold_charts.sql`.) **However:** the function has zero runtime callers today — wiring is a multi-day refactor of every threshold-consuming call site, not "just turn it on." `race_points` and `race_percentage` chart types are seeded as global templates already.
- `leagues.system_overrides` JSONB exists and is editable per-league. (Verified against schema.)
- `match.system_snapshot` JSONB column already exists and is populated at first-scoring-event. This work expands the snapshot's shape, not its existence.
- Standings sort is implemented in **two places** (`src/api/hooks/useStandings.ts` and `src/utils/playoffGenerator.ts` `sortStandingsByRank()`); R10 must refactor both, ideally extracting a shared helper.
- The existing `fargo5v5.ts` Fargo logistic uses a team-level formula calibrated against one real-match data point (`AVG_LOSER_POINTS = 4.2` at 117-rating-gap). R9 Layer 1's "per-pairing logistic" approach is a *different* formula — preserving the existing 5v5 10-7 combo's exact output number is a planning-phase question (recompute or preserve calibration?).
- No production users — schema changes can be aggressive. (Per user.) **But verify:** mobile app (Jack's, separate codebase) may read `team_format` directly; planning must grep the mobile repo before column drop.
- The user's league plays without the app for next season. (Per user — explicitly accepted in priority decision.)

## BCA Ecosystem Findings (research-driven, training-data only — verify before meeting)

The pre-meeting research surfaced several findings that materially shape what "BCA-grade" means and identify scope gaps in this doc. Sources are training data (web search unavailable in the research environment); confidence labeled per item. **All should be verified against current playbca.com / leaguesys.com / fargorate.com materials before the BCA meeting.**

### 1. LeagueSys is third-party, not BCA-owned (high confidence)

LeagueSys (leaguesys.com) is the dominant operator-facing platform BCA has standardized on by default — but it is owned by a separate company, not the BCA. Strategic implication: the pitch to BCA isn't simply "here's a tool for you" — it's partly "here's why this beats or augments your current third-party standard."

### 2. BCAPL's official handicap is the Skill Level (SL) system, not BCA points or percentage (high confidence)

BCA Pool League nationally uses the SL1–SL9 skill-level system, modeled structurally on APA. Each SL maps to a "race-to-N" target — i.e., per-pairing race-to-N rather than single-rack-per-pairing. **This is a handicap system not currently in our `handicap_type` enum.** Our four current values (`none`, `bca_points`, `bca_percentage`, `fargo`) cover what the developer has personally seen in Florida leagues but not what BCAPL actually sanctions nationally. Adding `bcapl_sl` as a fifth handicap rating system is a likely BCA prerequisite.

The developer's three Florida BCA leagues may have been running local-LO custom rules rather than BCAPL-official format. Worth clarifying before the meeting whether those leagues were strictly BCAPL-sanctioned or BCA-affiliated under a different umbrella.

### 3. Sandbagging is BCA's #1 software anxiety (high confidence)

Tamper-evident rating management with a clear audit log is essentially table stakes for any BCA-aligned tool. Players manipulating their SL to get an unfair handicap advantage (especially before the National Championship) is a chronic integrity concern. **This concern is not currently addressed in the modular system doc.** Any LO ability to silently edit ratings or backfill match results without provenance will be scrutinized hard. R7 (handicap rating system) needs an adjacent requirement on rating-edit auditability.

### 4. BCA Verified / FargoRate partnership (moderate confidence)

BCA is rolling out "BCA Verified" — a player identity layer linking BCA member numbers to FargoRate's ratings. Strategic direction: portable, verified player identity across BCA-sanctioned events. The app's existing `bca_member_number` field on placeholder players already aligns with this direction (per memory: "Paying dues requires a BCA number"; BCA/CSI integration is on the roadmap). Should be reaffirmed as the canonical player identity anchor in the data model — not optional.

### 5. Result export to BCA's national database is table stakes (high confidence)

BCA's National Championship qualification depends on match results flowing into their national rating/standings database (currently via LeagueSys export format). An app that keeps results siloed without an export path is dead on arrival for sanctioned leagues. **This is also not currently addressed in this doc.** Worth raising as a follow-up requirements doc, not in scope here.

### 6. The LO is BCA's customer; the player is the beneficiary (moderate confidence)

BCA's revenue flows through annual LO certification fees plus per-player membership fees. They do not currently earn SaaS license revenue from software. Pitch implication: features that solve LO operational pain (lineup management, dues tracking, qualification math, result submission) land harder than player-facing UX features alone. Player-side features remain real differentiators against LeagueSys, but the LO-side story is what gets revenue conversations going.

### 7. BCAPL rule diversity (high confidence)

Rule variations across BCA leagues, per the research:
- **Handicap:** BCAPL SL (most common nationally), Fargo (rare/informal), no handicap (open divisions), local custom (BCA points / percentage as the developer has seen)
- **Scoring:** Race-to-N per BCAPL chart (national standard), fixed race-to-5 ignoring SL (casual), game-wins with handicap as spot balls
- **Match win:** First-to-3-of-5-matches (national standard), all 5 played for stats (some leagues)
- **Standings:** Match W/L first, total games won as tiebreaker (BCAPL national); local LO variation common
- **Roster:** 5–8 typical; team SL cap varies by LO (e.g., 23 for 8-ball is common but LO-set)

This validates the modular pivot: BCAPL itself standardizes on a few defaults but local LOs customize materially. The variation the developer has observed is real and consistent with national patterns.

### Bottom-line implications for this doc

- **R7 needs a fifth handicap value: `bcapl_sl`.** Race-to-N per skill level. Probably the single most important addition for BCA credibility.
- **Per-pairing format `race_to_n` (R4) is no longer "deferred-but-extensible" — it's required to support BCAPL SL.** Promotes from out-of-scope to in-scope. (The user's own clarification about APA-style alternating-pick race format remains separately deferred.)
- **A new concern around rating-edit audit log** is needed. Could be a separate requirements doc or absorbed here as R21.
- **Result export to LeagueSys / BCA national format** is a separate workstream — flagged here, not scoped here.

## Worked Examples (sanity check the model)

These three combos are not currently supported. The model below shows the resolution path for each.

**Example A: 4v4 + Fargo + games-won**
- Lineup size: 4. Match structure: single round-robin → 16 games per match.
- Per-game scoring: `winner_takes_all`. Win condition: `first_to_games`. Handicap mechanism: `extra_games`.
- Threshold resolution: no Layer 2 preset (no published BCA or BCAPL chart for this combo). Layer 1 generative: apply Fargo logistic per-pairing across 16 pairings, sum to expected wins for higher team, derive extra-games as `round(expected_wins_higher - 8.5)`. UI labels: "Extrapolated from FargoRate logistic." LO can replace with a custom table (Layer 3).
- Default games-needed: lower team needs 9; higher team needs 9 + extra.

**Example B: 3v3 + BCA points (-2..+2) + 10-7 points scoring**
- Lineup size: 3. Match structure: double round-robin → 18 games per match.
- Per-game scoring: `points_10_7`. Win condition: `total_points_target` or `highest_after_all_games`. Handicap mechanism: `start_points`.
- Threshold resolution: no Layer 2 preset (BCA 3v3 chart was designed for games-won, not 10-7). Layer 1 generative is **not available**: the BCA points rating system combined with points-unit scoring (10-7) doesn't have a probabilistic foundation suitable for proportional extrapolation. The wizard surfaces "no Layer 1 default available for this combo" and requires the LO to supply a custom table (Layer 3) at config time.

**Example C: 5v5 + Fargo + games-won**
- Lineup size: 5. Match structure: single round-robin → 25 games per match.
- Per-game scoring: `winner_takes_all`. Win condition: `first_to_games`. Handicap mechanism: `extra_games`.
- Threshold resolution: no Layer 2 preset (FargoRate Race Calculator handles individual races, not team formats — though community convention is to feed team averages as pseudo-players). Layer 1 generative: apply Fargo logistic per-pairing across 25 pairings, sum to expected wins for higher team, derive extra-games. UI labels: "Extrapolated from FargoRate logistic."
- This is the user's actual upcoming league. Layer 1 generates a default; the LO (or the league's BCA contact) can override with the league's actual published bands once known.

## Outstanding Questions

### Resolve Before Planning

*(All previously open items have been resolved. The doc is ready for `/ce:plan`.)*

**Resolved during brainstorm:**
- **Florida-leagues sanctioning status.** The 5v5 percentage league was a "BCA-rules cash league" with no formal BCA affiliation (rules borrowed informally). The current Fargo league sends players to BCA championships, so is presumed sanctioned. The 20-year 3v3 was a fully sanctioned BCAPL operator role with annual fees, result submission, and team qualification — direct LO-side BCA experience.

### Deferred to Planning

- **[Affects R5, R6][Needs research]** Beyond `winner_takes_all`, `points_10_7`, and `race_winner`, are there per-game scoring variants in active use across BCA local leagues that this system should express now? Planning phase to survey LO community (AzBilliards forum, BCAPL operator groups) for variants and decide ship-now vs add-later.
- **[Affects R7, R9][Needs research][BCA-meeting-input]** Source the **current BCAPL Playing Handicap Chart** (SL → race-to-N targets for 8-ball and 9-ball) directly from playbca.com or via the BCA contact. This is the authoritative Layer 2 preset for `bcapl_sl` and is required for the system to serve BCAPL-sanctioned leagues correctly.
- **[Affects R7, R9][Needs research][BCA-meeting-input]** Confirm BCA's expected file format for result import to their national database. (Feeds the deferred Result Export workstream.)
- **[Affects R9][Needs research]** What's the authoritative form of the Fargo logistic for Layer 1 generative defaults? FargoRate's published divisor varies between sources (100 vs 144). Planning phase should validate against FargoRate's own materials and capture test cases.
- **[Affects R9][Needs research]** What does LeagueSys actually expose to LOs? LeagueSys is prior art for the modular UX. Planning should review LS's wizard fields to ensure parity (and identify gaps where we can do better).
- **[Affects R7, R9][Needs research]** Once the developer's current Fargo league publishes its games-won rules for the new season, capture the actual threshold bands as a Layer 2 preset.
- **[Affects R13][Technical]** Which preference dials are safe to change mid-season vs which require the league to be locked? Per-dial classification needed during planning.
- **[Affects R17][Technical]** Sequence the `team_format` column drop carefully: smoke tests must pass before the column is removed. **Mobile-app dependency check (grep Jack's repo for `team_format`) must happen first.**
- **[Affects R21][Technical]** Audit-log table schema and access patterns: column set, retention policy, who can query, integration with existing edit pathways (manual rating entry on lineup page, post-match rating recompute). Planning phase to design.
- **[Affects R2][Technical]** Is there a sensible upper bound on `max_roster_size`? Currently no validation; in practice some absurd value (50?) would break UX. Planning to set a soft cap.
- **[Affects R18][Technical]** The runtime resolver that builds an ad-hoc SystemModule from preferences — interface design and where it lives. (Likely `src/systems/resolver.ts` extends to do this.) Includes the `SystemModule.key` widening and threshold-output union restructuring noted in R18.

## Next Steps

All blocking decisions are resolved. **Ready for `/ce:plan`.**

Suggested next-step ordering:
1. `/ce:plan` to produce the implementation plan from this requirements doc
2. Mobile-app `team_format` grep (planning-phase blocker for R17 column drop)
3. Pre-meeting BCA research follow-up: pull BCAPL Playing Handicap Chart, confirm result-export format, verify LeagueSys ownership status (training-data findings should be re-verified against current materials before the meeting)
4. After BCA meeting: spin up follow-up requirements docs for (a) Result Export workstream, (b) anti-sandbag rule expansion, (c) FargoRate API integration if a partnership emerges
