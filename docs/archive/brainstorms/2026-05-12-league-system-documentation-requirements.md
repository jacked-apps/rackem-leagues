---
date: 2026-05-12
topic: league-system-documentation
---

# League System Documentation (L1 Canonical Reference)

## Problem Frame

The app has a richly modular league configuration system — 13 configuration axes, 3 prepackaged Divisions, 3 handicap systems shipping (a 4th planned-then-deferred). But there is no shared vocabulary or canonical reference describing what each piece is, what to call it, and how the pieces compose.

Three concrete consequences:

1. **Rule conflation.** Even the system's developer ("Ed") and prior AI sessions have confused rules between Divisions when implementing changes. Without a source of truth, every conversation reinvents the terminology.
2. **Internal naming drift.** `src/info/FiveManFormatDetails.tsx` actually documents the 3v3 (3-Man) format. `src/info/EightManFormatDetails.tsx` documents the 5v5 (5-Man) format. The 3rd Division (`fargo_5v5`) has no explainer page at all. Internal code uses `standard_3v3` / `standard_5v5` / `fargo_5v5` while UI files use unrelated "5-Man" / "8-Man" labels. The earlier `modular-league-system-requirements.md` brainstorm uses `bca_points` / `bcapl_sl` in places while the live code uses `points` / `skill_level`. Nothing reconciles these.
3. **No shared CSI vocabulary.** The strategic brainstorm (`docs/brainstorms/modular-league-system-requirements.md`) names an upcoming meeting with Ozzy Reynolds (CEO, CueSports International). CSI has *official* names for several of the systems the app implements (`1-Point Scoring System`, `10-Point Scoring System`, `FargoRate`, `Race To`, `Division`). The app uses none of them today.

This brainstorm captures the decisions needed to produce a single canonical reference — **Layer 1 (L1)** in a four-layer documentation model — that becomes the source of truth for every future change, every future AI session, and every downstream user-facing surface.

## Strategic Context

- **CSI partnership pursuit.** The active strategic doc (`docs/brainstorms/modular-league-system-requirements.md`) frames the app as a "BCA-grade adaptability" play. A CEO-level meeting with Ozzy Reynolds (CSI) is in the works in the near term. Using CSI's exact published terminology where it exists is the highest-leverage move available before that meeting.
- **CSI vs BCA distinction.** The Billiard Congress of America (BCA) is a standards body. **CSI (CueSports International)** is the operator that runs BCAPL, the actual league brand. CSI replaced "BCA" branding circa 2020. The "BCA meeting" in the prior brainstorm is, in practice, a CSI meeting.
- **No-real-users window.** Per the earlier strategic brainstorm, the app has no production users currently. Code renames are safe; we are not preserving legacy strings.
- **L1 is the user's stated primary motivation.** Ed's exact words: *"first it will help you keep things straight when it comes to coding the specific things."* The doc-for-AI use is the load-bearing reason this branch exists. Marketing and player education (L2/L3/L4) are real but secondary.
- **Two-step split (added during planning).** Originally this brainstorm bundled the canonical docs AND the code-naming renames into one branch. During planning, Ed reframed: **Step 1 = pure docs branch** (this brainstorm now scopes to that); **Step 2 = code renames** executed against the locked L1 spec (separate branch, separate brainstorm if needed). Ed's exact words: *"FIRST we do all the explanations lock those down using our new naming convention (and having them POINT to the columns noting we should change this column name to match our new convention. once we get this locked down then step 2 can be changing names and fucking with the actual code."* This split is durable: the doc is a work order for the code rename, and the code rename has nothing left to invent once the doc lands.
- **Why this branch precedes the unified-scoreboard refactor** (next branch per `project_unified_scoreboard.md`, flagged 2026-05-03). The unified scoreboard collapses 4 scoreboards into one that reads `win_condition + threshold trio` per side — i.e., it consumes the modular axis values, not the SystemModule keys themselves. The SystemModule layer (which R9 renames) survives the scoreboard refactor unchanged as the source the scoreboard reads from. Sequencing doc + naming first means the scoreboard work is built against settled vocabulary; reversing the order means the scoreboard PR ships with the old names and gets churned in this branch's follow-up. Both branches can land in 2026-05.

## Four-Layer Documentation Model (context)

Future branches will build L2, L3, and L4. This brainstorm explicitly ships **only L1**.

| Layer | Audience | Where it lives | Tone | Status |
|---|---|---|---|---|
| **L1** | Ed + Claude (future sessions) | Markdown in `docs/league-system/` | Dense, code-name-mapped, jargon allowed | **This branch** |
| **L2** | Ozzy / CSI / outside evaluators | In-app polished page(s) | Visual, brief, sales-quality | Future branch |
| **L3** | Operators picking a Division | In/near `src/wizards/league-v2/` | Decision-oriented | Future branch |
| **L4** | Players unfamiliar with format/handicap concepts | Public `/info` route (rebuild) | Friendly, low-jargon, hover/modal glossary | Future branch |

L2/L3/L4 will cite L1 as the source of truth. Truth lives in one place; presentation varies per layer.

## Requirements

- **R1.** A new directory `docs/league-system/` exists in the repo and contains the canonical reference (file structure in [L1 File Structure](#l1-file-structure)).
- **R2.** Every Division the app ships is documented with a single dedicated page following a consistent structure: **Short Nickname → Canonical Name → Settings list → How it Plays narrative → Why this Division exists**.
- **R3.** Every Module (the 7 conceptual building blocks) is documented with a single dedicated page that names every option, lists which Divisions use it, and explains how it can be varied.
- **R4.** Every CSI-official term in the doc uses CSI's exact published spelling (see [Naming Taxonomy](#naming-taxonomy)).
- **R5.** Every locally-coined term (i.e., where CSI has no official name) is marked as such with one line explaining why we chose it.
- **R6.** The doc explicitly states the three Divisions are *real leagues the developer has played in*, not "BCAPL standards." This framing is repeated in the README and each Division page.
- **R7.** `CLAUDE.md` integration is "defense in depth" so future AI sessions can't bypass the canonical reference. Split across the two steps:
  - **Step 1 (this branch):** A **naming-taxonomy cheat sheet** (~50 lines: the Division names, Module names, handicap/scoring system names, and the disambiguation rule) is pasted inline into the project `CLAUDE.md` so the vocabulary is loaded into every session's context automatically.
  - **Step 1 (this branch):** The cheat sheet in `CLAUDE.md` and `docs/league-system/README.md` must stay aligned. Treat the canonical source of truth as the doc; `CLAUDE.md` is the always-loaded mirror.
  - **Step 2 (separate branch):** Load-bearing source files (`src/systems/*.ts`, `src/wizards/league-v2/presetMappings.ts`, `src/types/resolvedSystemConfig.ts`, `src/types/preferences.ts`) gain file-header `@see` comments pointing to the specific `docs/league-system/` page that documents the file's responsibility. This catches Claude during grep-driven exploration (its actual working pattern), not just doc-first reading. Deferred because it's source-code work; tracked in step 2 plan.
- **R8.** *(Deferred to Step 2.)* The misnamed existing files (`src/info/FiveManFormatDetails.tsx`, `src/info/EightManFormatDetails.tsx`, `src/info/FormatComparison.tsx`) are deleted, and their NavRoutes entries removed. Step 1 documents them as misnamed in the relevant Division pages; the actual deletion happens in step 2.
- **R9.** *(Deferred to Step 2.)* Internal code identifiers are renamed to match the canonical names (see [Code Renames Required (Step 2 work order)](#code-renames-required-step-2-work-order)). Tests, callers, and DB seed/migration data are updated together. **Step 1's L1 doc prescribes the exact rename targets so step 2 has nothing to invent.**
- **R10.** The doc is durable but code-anchored. Because L1's primary audience is Ed + future Claude sessions during code work (see [Strategic Context](#strategic-context)), each Division and Module page includes a **"Source of truth"** section listing the load-bearing code files for that axis or preset (repo-relative paths, no line numbers — paths are stable, line numbers rot). **Each entry lists two things: the path/identifier as it exists today, AND the rename target for step 2 (e.g., "`src/systems/bca3v3.ts` → rename to `points_3man.ts` in step 2").** No manual date stamps — they go stale and a stale date implies false freshness. If a date is wanted, future iterations can derive it from `git log` at render time. Future Claude sessions need these anchors to navigate from doc to code efficiently, AND step 2 needs the rename targets to execute against. Pages still document *what each thing is and how it composes*, not *how it's currently coded* line-by-line.
- **R12.** *(Deferred to Step 2.)* **Hide the "BCAPL Skill Level" card from the league-creation wizard.** Specifically: remove the `skill_level` option *only* from the selectable handicap cards in `src/wizards/league-v2/steps/HandicapSystemStep.tsx` (the wizard UI). Do NOT delete the DB CHECK constraint, the stub branch in `buildSystemFromPreferences.ts`, the `HandicapType` union member in `src/utils/calculatePlayerHandicap.ts`, or any other code references — these stay intact as scaffolding for future revival. Per Ed's "keep if usable, hide if not" rule. Step 1's `handicap-systems.md` documents the rationale; step 2 executes the UI hide.
  - **Adjacent code-surface concern flagged by feasibility re-review (pass 2):** `src/utils/calculatePlayerHandicap.ts` has a silent fall-through where `handicap_type='skill_level'` produces a bogus percentage result. **Step 2** must decide whether to add an explicit early-return / error guard at that fall-through (preferred — so a forged or legacy `skill_level` config produces a visible failure rather than wrong data) or leave it as-is.
- **R11.** **Canonical-policy enforcement.** Once written and approved, `docs/league-system/` is treated as a policy contract, not a draft:
  - Claude (or any other contributor) must never silently edit these files in response to a conversational request that contradicts them.
  - When a user request conflicts with content in `docs/league-system/`, the conflict is surfaced explicitly as a point of contention ("the canonical reference says X; you're asking for Y — is this a global rule change, a misunderstanding, or a mistake?").
  - Changes to these files require **two forms of approval**: (a) explicit user invocation of a rule change ("change the system" / "update the rules"), separate from (b) explicit confirmation of the specific file edit. Either alone is insufficient.
  - **Scope boundary:** policy-contract enforcement applies *only* to files under `docs/league-system/`. The existing global "push back, don't be a yes-man" instruction in `~/.claude/CLAUDE.md` continues to apply to all other engineering decisions but does NOT require the two-form approval gate. Future AI sessions must not over-apply the policy-contract posture to anything that smells like a "rule."
  - **What counts as a conflict:** changes to the **Naming Taxonomy table**, **per-Division Settings list**, **the 7-Module groupings**, or **terminology definitions in the glossary** are policy edits requiring the gate. Prose clarification (typo fixes, rewording for readability, examples added) inside a Division/Module page's narrative sections is NOT policy-gated and can be edited freely. When in doubt, treat it as policy and ask.
  - **Mirror sync:** `CLAUDE.md`'s cheat sheet (per R7) is a mirror, not a parallel source. Any approved L1 edit that affects the taxonomy table MUST land in the same commit as the matching `CLAUDE.md` update. R11's gate fires once for the bundled change.
  - This rule is encoded in the project `CLAUDE.md` (next to the cheat sheet, but as a distinct section) so future AI sessions inherit the behavior. See auto-memory: `feedback_canonical_docs_are_policy.md`.

## Success Criteria

- A future Claude session, given any rules-related question, can answer correctly by reading `docs/league-system/` (now with code-file anchors per R10) and the linked source files.
- The naming used across code, doc, UI labels, and tests is internally consistent — no `standard_3v3` in code while the UI calls it "BCAPL 3v3" and the README calls it something else.
- Ed, returning to the codebase after two weeks away, can answer rules questions from the README cheat sheet in under one minute.
- When Ed asks for a change that contradicts content in `docs/league-system/`, the next Claude session surfaces the contradiction before making any code change — not silently reconciling.

## Naming Taxonomy

All of the following is locked. It is the single source of truth that the L1 doc, code renames, and downstream layers must follow.

### Bundle and building-block words

| Concept | Word we use | Source |
|---|---|---|
| The bundled set of choices that defines a league | **Division** | CSI (replaces "preset" / "format" / "template") |
| The individual configurable axis | **Module** | Ours (CSI has no equivalent) |
| The handicap unit of advantage | **Spot** | CSI (glossary-only — used in concept descriptions, not as a Module name) |
| A team's winning a single game | **Win** (not "point") | Plain English |
| A match-level winning aggregation | **Match Win** | Plain English |

### Handicap Systems

Three handicap systems ship. CSI has no formal name for the first two; we coin clean parallel labels.

| Code | Display Name | Range | Source of name |
|---|---|---|---|
| `points` | **Points** | -2 to +2 (integer) | Coined (operator colloquialism, no CSI brand) |
| `percentage` | **Percentage** | 0 – 100 | Coined (descriptive, no CSI brand) |
| `fargo` | **FargoRate** | 100 – 850 | CSI / FargoRate official |

**`skill_level` — reserved but hidden in this branch.** Initially planned in `modular-league-system-requirements.md` as "BCAPL national headline format" but research showed SL1-SL9 is actually APA terminology, not BCAPL. CSI now mandates FargoRate for BCAPL handicapped divisions. Current state: `src/wizards/league-v2/steps/HandicapSystemStep.tsx` ships a "BCAPL Skill Level" card, `buildSystemFromPreferences.ts` has a stub branch, DB CHECK allows the value — but no threshold logic exists, so it is not actually usable. Per Ed's "keep if usable, hide if not" rule, this branch **hides the wizard card** while preserving the schema, stub code, and DB CHECK for future revival. The `handicap-systems.md` L1 page includes a one-line entry: "**Skill Level (reserved)** — Schema exists. Hidden in wizard until a usable implementation lands. Strategic intent: any handicap system a league wants to use, including APA-style ratings, should be supportable — pending implementation work and these disclaimers being added: (a) the system does **not** compute APA handicaps (operators must enter ratings manually); (b) match results are **not** reported back to APA and do **not** affect a player's APA rating. Trigger to revive: a manual-entry mode is built, or a BCAPL/CSI/APA roadmap commits to specific calculation."

### Scoring Systems

CSI has official names for both. We adopt them verbatim.

| Code (current `win_condition` + calculator) | Display Name | Source |
|---|---|---|
| `win_condition='games'` | **1-Point Scoring System** (a.k.a. **Race To**) | CSI |
| `win_condition='points'` + `accumulated_per_game` calculator | **10-Point Scoring System** | CSI |

Future possibility: **17-Point Scoring System** (CSI also names this; not yet implemented).

### Divisions (the 3 presets)

The three prepackaged Divisions. Note the rename from current code identifiers.

| Old code | New code | Short Nickname | Canonical Name |
|---|---|---|---|
| `standard_3v3` | `points_3man` | **Points 3-Man** | **Points 3-Man Division** |
| `standard_5v5` | `percentage_5man` | **Percentage 5-Man** | **Percentage 5-Man Division** |
| `fargo_5v5` | `fargo_10pt_5man` | **FargoRate 10-Point 5-Man** | **FargoRate 10-Point 5-Man Division** |

**Honesty framing required** in the L1 README and on each Division page:

> *These three Divisions are real leagues the developer has played in. They are not BCAPL-endorsed standards — there isn't one. The modular system supports any BCAPL-compatible configuration; these ship as well-tested starting points.*

### The 7 Module groupings

The 13 raw configuration axes group into 7 user-facing Modules. Each gets one dedicated L1 doc page.

| # | Module | Wraps axes |
|---|---|---|
| 1 | **Handicap Systems** | `handicap_type` |
| 2 | **Handicap Mechanisms** | `mechanism` (extra games / start points / race-length adjust) |
| 3 | **Scoring Systems** | `win_condition` + `points_calculator` (tightly coupled — CSI names them together) |
| 4 | **Threshold Charts** | `threshold_chart_id` |
| 5 | **Team Geometry** | `lineup_size` + `max_roster_size` + `game_generation` |
| 6 | **Match Format** | `pairing_format` + `race_length` |
| 7 | **Standings & Tiebreakers** | `standings_sort` + `tiebreaker_trigger` + `tiebreaker_format` |

### Disambiguation rule for "Points"

"Points" is used as both a Handicap name (the -2 to +2 system) and inside CSI's Scoring System names ("1-Point Scoring System", "10-Point Scoring System"). To prevent collisions:

- **Page titles, headings inside `handicap-systems.md`, and any standalone reference to the handicap concept** use **"Points Handicap"** in full. Example: section heading "## Points Handicap", body sentence "the league uses Points Handicap with a +/-2 range."
- **Division short nicknames** (e.g., "Points 3-Man") use the bare word "Points" — these are deliberately concise labels, the surrounding structure makes meaning unambiguous (a Division name precedes Module context, never scoring-system context), and "Points Handicap 3-Man" would be visually noisy.
- The scoring systems are *always* written in full: **"1-Point Scoring System"** and **"10-Point Scoring System"**. Never abbreviated to "Points" or "Points scoring" in the L1 doc or anywhere downstream.

## L1 File Structure

```
docs/league-system/
  README.md                          ← Index, canonical names cheat sheet, honesty framing
  divisions/
    points-3man.md                   ← Points 3-Man Division spec sheet
    percentage-5man.md               ← Percentage 5-Man Division spec sheet
    fargo-10pt-5man.md               ← FargoRate 10-Point 5-Man Division spec sheet
  modules/
    handicap-systems.md              ← All 3 shipping handicap systems
    handicap-mechanisms.md           ← extra_games / start_points / race-length adjust
    scoring-systems.md               ← 1-Point + 10-Point CSI systems (and 17-Point note)
    threshold-charts.md              ← Cascade, lookup, override semantics
    team-geometry.md                 ← Lineup size, roster size, RR mode
    match-format.md                  ← Pairing format, race length
    standings-tiebreakers.md         ← Sort order + tiebreaker rules
  glossary.md                        ← One-line definitions: Spot, Race To, Division, Module, etc. (cross-referenced from module pages)
```

Total: **12 markdown files** (one index + three Division pages + seven Module pages + one glossary).

Each Division page follows the structure:
1. Short Nickname (H1)
2. Canonical Name + one-sentence "what this Division is"
3. Honesty framing line (one sentence, with a link back to the canonical paragraph in `README.md`)
4. **Settings** — bulleted list referencing each of the 7 Modules with the specific choice made
5. **How it Plays** — brief narrative description (not dry — readable but accurate)
6. **Why this Division exists** — origin / use case / Ed's history with it
7. **Source of truth** — bulleted list of repo-relative paths to the load-bearing code files for this Division (no line numbers — paths are stable). Per R10, this anchor is how future Claude sessions navigate from doc to code.

Each Module page follows the structure:
1. Module name (H1)
2. What this Module configures
3. **Options** — every shipping option with code identifier, display name, range/values, and origin (CSI vs coined)
4. **Which Divisions use which option**
5. **How to vary it** — what flexibility the modular system provides (and what's planned but not built)
6. **Source of truth** — bulleted list of repo-relative paths to the load-bearing code files for this Module's axes (no line numbers). Per R10.

## Code Renames Required (Step 2 work order)

**These renames are DEFERRED to step 2 — a separate branch executed after step 1's L1 doc locks.** Step 1 (this branch) writes the docs and prescribes these targets; step 2 executes them. Nothing in this section is in scope for step 1's commits.

The renames travel with the documentation work conceptually — they are how the doc becomes consistent with the codebase — but Ed's planning-phase directive split them out: *"FIRST we do all the explanations lock those down ... once we get this locked down then step 2 can be changing names and fucking with the actual code."*

**Single naming layer — code and UI agree, no internal/external split.** Per Ed's stated principle ("the branding should probably match inside the code as well as what we render"), the rename covers all three layers (wizard preset keys, SystemModule keys, filenames):

- **Wizard preset identifiers** in `src/wizards/league-v2/presetMappings.ts` and any callers:
  - `standard_3v3` → `points_3man`
  - `standard_5v5` → `percentage_5man`
  - `fargo_5v5` → `fargo_10pt_5man`
- **SystemModule keys** (the `key` field on each module). Feasibility re-review (pass 2) refined the count: ~74 non-test references across ~12 calling files (resolver.ts, buildSystemFromPreferences.ts, presetMappings.ts, leagueFormatOptions.ts, LeagueFormatStep.tsx, useCreateLeagueV2.ts, useFlowStageHandlers.ts, comboCoherence.ts, types.ts, thresholdLookup.ts, fargoMatchTotals.ts, useFargoStartPointsNegotiation.ts), plus ~224 test assertions inside the three characterization/test files for `bca3v3`/`bca5v5`/`fargo5v5`. The first pass's "~273" reflected raw grep including test files; the real refactor surface is ~74 + the per-test rename. The `resolver.ts` log message at line 52 also hardcodes "bca5v5" — update alongside the key field:
  - `bca3v3` → `points_3man`
  - `bca5v5` → `percentage_5man`
  - `fargo5v5` → `fargo_10pt_5man`
  - The resolver fallback in `src/systems/resolver.ts` (which currently defaults to `bca5v5`) is updated to the new key.
- **Filename renames** (snake_case per repo precedent — the calculators directory uses snake_case filenames that double as registry keys, e.g., `src/systems/calculators/accumulate_with_milestone_jumps.ts`; matching that convention):
  - `src/systems/bca3v3.ts` → `src/systems/points_3man.ts`
  - `src/systems/bca5v5.ts` → `src/systems/percentage_5man.ts`
  - `src/systems/fargo5v5.ts` → `src/systems/fargo_10pt_5man.ts`
- **Type unions** (e.g., in `src/systems/types.ts`) that enumerate the legacy keys are updated to the new keys.
- **Test fixtures** that hardcode the old keys are updated as part of the same change. Per `feedback_dev_data_disposable.md`, no test data preservation is required.
- **No DB columns store the preset key.** Verified via `grep` and direct read of `src/wizards/league-v2/useCreateLeagueV2.ts:33-35`: the preset key is consumed at wizard-submit to expand into the 13 axis values (`handicap_type`, `win_condition`, etc.) and is not itself persisted. The rename is source-code-only.
- **Existing info files** deleted from `src/info/` in step 2 (no archive needed — disposable test data, no real users):
  - `src/info/FiveManFormatDetails.tsx` (misleadingly named — was 3v3 content)
  - `src/info/EightManFormatDetails.tsx` (misleadingly named — was 5v5 content)
  - `src/info/FormatComparison.tsx` (uses old naming)
- **Routing cleanup (step 2):** Remove the three public route entries from `src/navigation/NavRoutes.tsx` (lines 49-51 imports, lines 158-160 route definitions): `/5-man-format-details`, `/8-man-format-details`, `/format-comparison`. Delete the component imports.
- **Wizard step copy updates (step 2, candidate scope):** Repo research found ~11 user-facing wizard strings referencing old "BCA" / "BCAPL" branding outside R9 above (`comboCoherence.ts`, `PointsCalculatorStep.tsx`, `leagueFormatOptions.ts`, `WinConditionStep.tsx`, `TiebreakerStep.tsx`, `MechanismStep.tsx`, `PairingFormatStep.tsx`, `HandicapSystemStep.tsx`, `useCreateLeagueV2.ts`, JSDoc in `presetMappings.ts`). Division-name references should update for consistency in step 2. Concept references ("BCA Classic", "BCAPL convention") need careful read; defer further or capture as step 2 follow-up.
- **`points_system` column (the dead column):** Per planning archaeology, `points_system` is orphaned legacy scaffolding never read at runtime. Per Ed's "don't drop columns" directive, the column stays. Step 2 does NOT drop it; step 2 does NOT rename it (no canonical target since the column has no semantic purpose). The L1 doc (Module 3, scoring-systems.md) documents it as "currently exists but unused at runtime; orphaned scaffolding awaiting a deliberate cleanup decision in a future branch." Step 3+ (future) may decide to drop it.

**Step 1 (this branch) TOC update:** `TABLE_OF_CONTENTS.md` is updated to add entries for the new `docs/league-system/` files. The misnamed info file entries (lines 509-511 per the feasibility review) stay in the TOC during step 1 — they describe files that still exist. Step 2 removes them when the files are deleted.

Note: `handicap_type` code values (`points` / `percentage` / `fargo`) already match the canonical display names (with capitalization). No rename needed for those.

## Scope Boundaries

**Explicitly NOT in this branch (Step 1):**

- **All source-code changes.** No file renames, no identifier renames, no test updates, no NavRoutes changes, no wizard card hides, no `@see` file headers, no wizard step copy updates. Per Ed's planning-phase directive, step 1 is pure docs. Anything that requires editing `src/`, `supabase/migrations/`, or test files is step 2 scope.
- **Deleting the misnamed `src/info/` files.** They stay during step 1 (documented as misnamed in the relevant L1 Division pages). Step 2 deletes them as part of the code rename branch.
- **L2 / L3 / L4 content.** The four-layer model is the long-term vision; this branch ships only L1.
- **In-app rendering of L1 content.** L1 is markdown-only. No React components, no routing, no hover/modal popups — those are L4.
- **`skill_level` / SL1-SL9 full documentation.** Deferred until BCAPL/APA scope is clarified (see [Open Questions](#open-questions)). The Naming Taxonomy (Handicap Systems) and `handicap-systems.md` Module page do include a one-line "reserved" entry — that's L1-scoped metadata, not full SL1-SL9 documentation.
- **Replacing `src/info/FormatComparison.tsx` with an L1 comparison view.** The deleted (in step 2) comparison page is L3 content per the layer model. This branch ships no comparison surface beyond a short "Choosing a Division" section in `README.md` if implementation judges it cheap.
- **17-Point Scoring System docs.** CSI names it; we don't implement it. One-line mention in `scoring-systems.md` is fine; no dedicated page.
- **Rewriting `modular-league-system-requirements.md` or `modular-handicap-scoring-requirements.md`.** Those are historical strategic docs and stay as-is. L1 *cites* them; it doesn't replace them.
- **Implementing new Modules** (e.g., team-level handicap, mid-match clinch detection). These are existing backlog items captured in auto-memory and stay there.
- **FargoRate API integration** or any data-source changes. Documentation only.
- **The `/rules` rulebook reader** described in `official-rulebook-reader-requirements.md`. That is a different feature documenting BCA's *playing rules* (8-ball fouls, etc.). Out of scope.

### Deferred to Separate Tasks (Step 2 — the code rename branch)

All work in the [Code Renames Required (Step 2 work order)](#code-renames-required-step-2-work-order) section. To summarize:

- Rename wizard preset keys (`standard_3v3` → `points_3man`, etc.)
- Rename SystemModule keys (`bca3v3` → `points_3man`, etc.) across ~78 non-test references plus tests
- Rename filenames (`src/systems/bca3v3.ts` → `points_3man.ts` snake_case)
- Update type unions in `src/systems/types.ts` and related
- Delete the three misnamed `src/info/` files + their NavRoutes entries
- Hide the BCAPL Skill Level wizard card (R12)
- Add `@see` file-header comments to load-bearing source files
- Update wizard step copy referencing old Division names (`comboCoherence.ts`, `leagueFormatOptions.ts`, etc.)
- Update `TABLE_OF_CONTENTS.md` to remove the three deleted info file entries
- Address the `calculatePlayerHandicap.ts` skill_level fall-through (add guard)

Step 2 needs its own brainstorm + plan. The L1 doc produced in step 1 is the spec.

## Open Questions

### Resolved during this brainstorm

- *Use BCAPL prefix in canonical names?* → No. Honest framing instead.
- *Which Points-collision resolution?* → Keep "Points" for handicap; always-explicit "1-Point / 10-Point Scoring System" for scoring; "Points Handicap" disambiguator when needed.
- *Drop SL1-SL9 from immediate scope?* → Yes. APA terminology, not BCAPL per current CSI publications.
- *Scope of this branch?* → L1 only.

### Deferred to planning

- **P0 BLOCKER — `points_system` vs `points_calculator` relationship.** The `preferences` table has both `points_system` (Phase 1, April 10: `differential` / `bca_tiered` / `per_game` / `manual`) and `points_calculator` (Phase 2, April 29: `linear_above_threshold` / `accumulate_with_milestone_jumps` / `accumulated_per_game` / ...). Both are read independently by the resolved view. Phase 2 migration comment says "architectural reframe: scoring_method → points_calculator" but the new column was added *alongside* `points_system`, not as a replacement. Planning must do a careful code read of `src/systems/calculators/`, the resolved-view consumers, and the actual scoring runtime to determine: (a) are these distinct axes? (b) is `points_system` legacy that should be dropped? (c) something else? **`scoring-systems.md` (L1 Module 3) is written AFTER planning resolves this.** Planning's job is to do the archaeology first, then implementation writes the page from a settled answer — R3 ("Every Module documented") remains achievable because planning is part of the workflow that produces the file. This also determines whether the system has 13 or 14 axes mapped to the 7 Modules.

  **Ed's mental model (verbatim, for planning context):**
  > "for most systems we keep track of 2 things. the games and the points.
  > 1. games. set number of games declare winner/loser for each done.
  > 2. points. points needs a system on HOW points are earned.
  > win condition tells you which is important for the match winner loser.
  > if wincon = games then handicap + threshold formula/chart = target/threshold wins.
  > if wincon = points then handicap + formula + pointsystem = either initial points or target depending on the system."

- *Exact location/format of the cheat-sheet block in `CLAUDE.md`.* R7 mandates a ~50-line cheat sheet inline; planning to determine the precise section heading and placement (likely top of the file or under a new "Canonical references" section).
- *Loss-cause event registry (recent commit `aebb6bb`).* Is this a sub-section of `scoring-systems.md`, a separate Module page, or out of scope for L1? Lean toward sub-section. Planning to confirm.

### Deferred to future branches

- *L2 (CSI/Ozzy pitch page) build-out.* Cite L1; visual; brief.
- *L3 (in-wizard Division decision tool).* Cite L1; embedded in `src/wizards/league-v2/`.
- *L4 rebuild* of the public `/info` pages, including the hover/modal glossary UX pattern Ed described in the original conversation.
- *Adding BCAPL Skill Levels* or APA support once BCAPL/APA roadmap is decided.

## Sources

- **Web research** (CSI official terminology, conducted 2026-05-12 in this brainstorm):
  - 1-Point Scoring System (a.k.a. "win/loss system"): https://www.playcsipool.com/csinews/how-fargorate-improves-the-1-point-scoring-system-for-pool-leagues
  - 10-Point Scoring System: https://www.playcsipool.com/csinews/how-fargorate-improves-the-10-point-scoring-system
  - BCAPL homepage (lists 1-Point / 10-Point / 17-Point Scoring Systems + FargoRate mandate): https://www.playcsipool.com/bcapl.html
  - FargoRate League Calculator (source for "Race To" terminology): https://leaguecalc.fargorate.com/
  - BCAPL LO Handbook 2020 (Popular League Handicapping Methods, "division" as the LMS config word): https://www.playcsipool.com/uploads/7/3/5/9/7359673/bcapl_lo_handbook_web_1.pdf
  - AzBilliards forum (community usage of "X-man team"): https://forums.azbilliards.com/threads/bca-league-format.547878/
- **Related code:**
  - `src/wizards/league-v2/presetMappings.ts` (current preset definitions)
  - `src/types/resolvedSystemConfig.ts` (13 configuration axes)
  - `src/types/preferences.ts` (preference cascade)
  - `src/systems/types.ts` (SystemModule interface)
  - `src/systems/bca3v3.ts`, `src/systems/bca5v5.ts`, `src/systems/fargo5v5.ts` (current preset implementations — likely targets for module references in docs)
  - `src/info/FiveManFormatDetails.tsx`, `src/info/EightManFormatDetails.tsx`, `src/info/FormatComparison.tsx` (to be archived)
  - `supabase/migrations/20260410000000_extend_preferences_modular.sql` (DB schema for the 13 axes)
- **Related brainstorms:**
  - `docs/brainstorms/modular-league-system-requirements.md` (strategic context, BCA-grade adaptability, Ozzy meeting reference)
  - `docs/brainstorms/modular-handicap-scoring-requirements.md` (SUPERSEDED; architectural detail on SystemModule + threshold charts)
  - `docs/brainstorms/official-rulebook-reader-requirements.md` (out of scope — playing rules, not league configuration)
- **Auto-memory:**
  - `project_unified_scoreboard.md` (next branch focus per 2026-05-03; this doc branch comes before that)
  - `feedback_dev_data_disposable.md` (justifies truncate-and-rebuild approach for code renames)

## Next Steps

→ `/ce-plan` for structured implementation planning.
