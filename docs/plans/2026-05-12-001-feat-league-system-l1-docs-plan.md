---
title: League System L1 Documentation (docs/league-system/)
type: feat
status: active
date: 2026-05-12
origin: docs/brainstorms/2026-05-12-league-system-documentation-requirements.md
---

# League System L1 Documentation (docs/league-system/)

## Overview

Create the L1 canonical reference for the modular league configuration system as a **design-space map**, not a "current implementation manual." For each Module (configuration axis category), document the **category essence**, the **boundary** (what's NOT in this category), the **current variants** as peers (no implementation is privileged as "the basis" or "the default"), and known **possible variants** that fit the category essence but haven't been built yet.

The doc functions as:
1. **An anti-conflation classifier** — when discussing a new feature/behavior, you and Claude can both consult the doc to determine which Module it fits in, or recognize that it needs a new Module.
2. **A pedagogical reference** — Ed and future Claude sessions can read it to understand each piece in its simplest form, separated from how it currently happens to be implemented.
3. **A future-work enabler** — when LO-customization UI lands, the design space is already mapped. When new variants need to be built, the boundaries and connections are already documented.

This is **step 1 of a two-step initiative**:
- **Step 1 (this plan)** — Pure documentation work. Zero source-code changes.
- **Step 2 (separate plan + branch, after step 1 locks)** — Execute the code renames, hide the BCAPL Skill Level wizard card, delete the misnamed `src/info/` files, add `@see` file headers, fix the `calculatePlayerHandicap.ts` skill_level fall-through.

The step 1/step 2 split was set by Ed during planning: *"FIRST we do all the explanations lock those down using our new naming convention ... once we get this locked down then step 2 can be changing names and fucking with the actual code."*

## Problem Frame

The app has a richly modular league configuration system — 13 behavioral configuration axes (+ 1 persisted-but-unconsumed column), 3 prepackaged Divisions, 3 shipping handicap systems plus 1 known-from-the-world-but-not-yet-built (Skill Level). Today there's no shared vocabulary, no canonical reference, and most importantly **no anti-conflation tool**. Recent design and conversation work has shown that even with the developer + AI sessions putting careful effort in, **two ideas can drift into the same module** or the same idea can get described as two different modules.

The doc resolves this by separating **category essence** (the abstract definition of a module) from **specific variants** (current and possible implementations), and explicitly drawing **boundaries** (what differentiates this module from adjacent ones, signaling when a new feature needs a new module rather than a variant).

Primary audience per origin doc: **Ed + future Claude sessions during code work**, with a near-term CSI/Ozzy meeting as a secondary audience. The doc is built code-anchored (file paths in "Source of truth" sections), not date-stamped or implementation-tied (variants are peers, no canonical-by-default).

## Requirements Trace

From the origin doc, this plan satisfies the step 1 portion of each requirement, with two new requirements (R13, R14) added per Ed's planning-phase reframing toward design-space mapping.

- **R1.** `docs/league-system/` exists with the canonical reference structure (folders for major Modules, single files for thin Modules). *(Units 1, 2-9.)*
- **R2.** Each Division has a dedicated synthesis page. *(Unit 9.)*
- **R3.** Each Module has a dedicated reference — either a folder (Handicap Systems, Mechanisms, Scoring Systems, Threshold Charts) with `README.md` + variant sub-files, or a single file (Team Geometry, Match Format, Standings & Tiebreakers) with peer sections. *(Units 2-8.)*
- **R4.** CSI-official terminology used verbatim where it exists. *(All Module/variant pages.)*
- **R5.** Locally-coined terms marked as such with one-line rationale. *(All Module/variant pages.)*
- **R6.** Honesty framing paragraph in `README.md`; each Division page cites it by one-line reference. *(Unit 1 defines; Unit 9 cites.)*
- **R7 (step 1 portion).** Naming-taxonomy cheat sheet inlined in project `CLAUDE.md`; mirrors `README.md`. *(Unit 11.)* — *Step 2 portion (`@see` file headers) explicitly deferred.*
- **R8 (step 1 portion).** L1 Division pages and Handicap System pages document misnamed `src/info/` files as targets for step 2 deletion. *(Unit 9 + Unit 2.)* — *Actual deletion is step 2.*
- **R9 (step 1 portion).** L1 doc prescribes exact rename targets for step 2 (wizard preset keys, SystemModule keys, filenames) with "tentative — to be confirmed in step-2's plan" hedging. Each variant page and Division page lists current code locations AND step-2 rename targets per R10. *(Units 2-9.)* — *Code renames execute in step 2.*
- **R10.** Each Module README, each variant page, and each Division page has a **"Source of truth"** section listing current code file paths AND step-2 rename targets (no line numbers, no dates). *(Units 2-9.)*
- **R11.** Policy-contract section added to project `CLAUDE.md`, distinct from the cheat sheet, with explicit scope boundary, underlying principle ("docs lock meanings, options, and canonical names — not prose"), required-reading directive ("read the full L1 page for non-trivial rules questions"), and mirror invariant. *(Unit 11.)*
- **R12 (step 1 portion).** L1's `handicap-systems/skill-level.md` documents the rationale for the future step-2 wizard-card hide. *(Unit 2.)* — *Actual UI hide is step 2.*
- **R13 (new — design-space mapping).** For each Module, the doc documents: (a) the **category essence** — the abstract definition of what fits in this Module, (b) the **boundary** — what differentiates this Module from adjacent ones, (c) **current variants** as peers (no anchor, no default-by-implementation), and (d) **known possible variants** — variants that fit the category essence but haven't been built yet (e.g., simple-winner-only point allocation, formula-based loser-point computation). *(Units 2-8.)*
- **R14 (new — anti-conflation classifier).** The `README.md` includes a "How to classify a new idea" decision-tree-style walkthrough so future Claude sessions can use the doc to classify proposed changes ("this fits in Module X" vs "this needs new Module Z"). *(Unit 1.)*

## Success Criteria

- A future Claude session, given any rules-related question, can answer correctly by reading the relevant Module README + the relevant variant pages, and the linked source files.
- When Ed proposes a new feature or behavior, Claude can quickly consult the doc and either (a) classify it into an existing Module/variant, (b) flag it as a known possible variant already documented, or (c) recognize it requires a new Module — and surface the classification rather than silently choosing.
- Ed, returning to the codebase after two weeks away, can answer rules questions from the `README.md` cheat sheet + decision-tree in under one minute, and trace any specific behavior to the relevant variant page in under five minutes.
- Step 2's plan can be written from L1 with zero invented behavior — every code-rename target is named, every misnamed file is identified, every existing variant has a documented code anchor.
- When LO-customization UI work eventually lands (step 3+), the design space is already mapped: variants are documented as peers within their Module, boundaries are clear, and "what an LO could create" is enumerated for current categories.
- When Ed asks for a change that contradicts content in `docs/league-system/`, the next Claude session surfaces the contradiction before making any change.

## Scope Boundaries

- **All source-code changes.** Zero `src/` edits, zero migrations, zero test updates. Step 2 work.
- **Deleting the misnamed `src/info/` files.** Step 2 work.
- **Hiding the BCAPL Skill Level wizard card.** Step 2 work. L1 documents WHY in `skill-level.md`.
- **`@see` file headers** in load-bearing source files. Step 2 work.
- **L2 / L3 / L4 content.** This is step 1 / L1 only.
- **In-app rendering of L1 content.** L1 is markdown only.
- **17-Point Scoring System full documentation.** CSI names it; we don't implement it. One-paragraph reference in `scoring-systems/README.md` or as a possible variant; no dedicated page.
- **LO-customization UI work.** This is step 3+. L1 enables that work by mapping the design space, but does not specify the UI.
- **Auto-memory updates.** Already done in the brainstorm session (`feedback_canonical_docs_are_policy.md`, `feedback_keep_if_usable_hide_if_not.md`).

### Deferred to Separate Tasks (Step 2)

All work in the origin doc's [Code Renames Required (Step 2 work order)](../brainstorms/2026-05-12-league-system-documentation-requirements.md#code-renames-required-step-2-work-order) section:

- Rename wizard preset keys (`standard_3v3` → `points_3man`, etc.) — tentative targets pending step-2 plan
- Rename SystemModule keys (`bca3v3` → `points_3man`, etc.) — tentative targets pending step-2 plan
- Rename filenames (`src/systems/bca3v3.ts` → `points_3man.ts` snake_case per repo precedent — tentative)
- Type unions in `src/systems/types.ts`
- Delete three misnamed `src/info/` files + their NavRoutes entries
- Hide BCAPL Skill Level wizard card
- Add `@see` file-header comments to load-bearing source files
- Update wizard step copy referencing old Division names
- Update `TABLE_OF_CONTENTS.md` to remove the three deleted info file entries (step 1 *adds* L1 entries but does NOT remove the info-file entries — those files still exist in step 1)
- Address `calculatePlayerHandicap.ts` skill_level fall-through (add guard)

Step 2 needs its own brainstorm + plan. The L1 doc produced in step 1 is the spec.

## Context & Research

### Relevant Code and Patterns

**Existing `docs/` conventions:**
- Root-level docs use **UPPER_SNAKE_CASE** (`docs/BCA_HANDICAP_SYSTEM.md`, `docs/CUSTOM_5MAN_HANDICAP_SYSTEM.md`, `docs/LEAGUE_MANAGEMENT_PLAN.md`). These exist today and overlap heavily with planned L1 content. Step 1 adds a "superseded by docs/league-system/" header to each — see Unit 13.
- `docs/research/` uses lowercase-kebab + YAML frontmatter (e.g., `docs/research/fargo-games-won-threshold.md`). **L1 follows this convention** for nested reference docs.
- L1 introduces a new pattern for the repo: **folder-per-major-module with variant sub-files**. Document this convention in `README.md`.

**`@see` precedent:** `src/utils/handicap/fargoGamesWonThresholds.ts:24` uses `@see docs/plans/...`. Step 2 will add `@see docs/league-system/...` to load-bearing source files.

**`TABLE_OF_CONTENTS.md` shape:** "Last Updated" date at top, `## 📁 Section` headers with Markdown tables. The "Reference Documentation Folder" section uses `| Location | Purpose | Notes |` columns (verified at line 44). The `src/info/*.tsx` entries that step 2 will eventually remove live under the **Source Code** section (around line 361+), NOT under Reference Documentation Folder.

**Project `CLAUDE.md` top-level section order:** `# Claude Code Memory Bank`, `## Memory Bank Structure`, `## Core Workflows`, `## Documentation Updates`, `## Project Intelligence (memory-bank)`, `## Claude Code Specific Features`, `# Planning`. The cheat-sheet + policy-contract sections fit **between `## Claude Code Specific Features` and `# Planning`** as new `## League System Naming Taxonomy` and `## League System Doc Policy` sections (verified by feasibility re-review).

### Institutional Learnings

`docs/solutions/` does not exist — no prior solution docs to draw on. Strong candidate to seed via `/ce-compound` after step 2 lands (suggested seed topics: "Anti-conflation as a doc design pattern," "Folder-per-module + variant-sub-files for design-space mapping," "Brainstorm methodology baked into reference docs").

Closest in-repo prior art: `docs/plans/2026-04-28-001-feat-modular-league-system-plan.md` and `docs/plans/2026-05-01-001-feat-modular-league-system-v2-plan.md` — the architectural work that produced the current modular system. These explain *why* each Module exists and inform variant documentation.

### External References

CSI / FargoRate / BCAPL terminology research conducted during the brainstorm:
- 1-Point Scoring System: https://www.playcsipool.com/csinews/how-fargorate-improves-the-1-point-scoring-system-for-pool-leagues
- 10-Point Scoring System: https://www.playcsipool.com/csinews/how-fargorate-improves-the-10-point-scoring-system
- BCAPL homepage: https://www.playcsipool.com/bcapl.html
- FargoRate League Calculator (Race To): https://leaguecalc.fargorate.com/
- BCAPL LO Handbook 2020: https://www.playcsipool.com/uploads/7/3/5/9/7359673/bcapl_lo_handbook_web_1.pdf

APA Skill Level (SL1-SL9) — external research needed during implementation for `handicap-systems/skill-level.md`: the variant exists in the world (APA's national system; BCAPL has historically used various skill-level schemes locally). The variant page documents what we know about how it's calculated and used, even though we don't compute or report it.

## Key Technical Decisions

- **Design-space mapping, not implementation manual.** Each Module documents the abstract category, with current variants as peers and possible variants as first-class content. No variant is privileged as "the canonical/default/basis" within its category — the category essence is defined independently of any specific implementation.
- **Folder per major Module, single file for thin Modules.** Handicap Systems, Handicap Mechanisms, Scoring Systems, Threshold Charts get folders with one file per variant + a README. Team Geometry, Match Format, Standings & Tiebreakers stay as single files (no significant variants).
- **L1 filename convention: lowercase-kebab** matching the kebab-case precedent in `docs/research/`. The new folder-per-module pattern is itself a new repo convention; document this in `README.md`.
- **YAML frontmatter on each L1 page** (`title`, `date`, `status: active`, `audience: developer + AI sessions`). Matches `docs/research/` style.
- **Variant page template (each variant file):**
  1. **Name** (canonical, peer)
  2. **What it is** — 1–2 sentence definition, focused on this variant specifically
  3. **How it works / how it's calculated** — mechanics, formulas, key behavior
  4. **When you'd use it / pros** — use cases, fit, lived experience
  5. **When you wouldn't / cons** — limitations, mismatches
  6. **Interactions** — how this variant pairs with options in adjacent Modules (compatible / incompatible / conditional). **Required for all variants.**
  7. **Possible modifications** — what an LO could change while staying within this variant (informs future LO-customization UI). **Conditional** (added per scope-guardian re-review): include only if the variant has concrete LO-customizable parameters today or in the near roadmap. Omit or stub with "no in-variant modifications identified" for variants where the modification space is empty (e.g., FargoRate is locked to FargoRate's spec; race-length-adjustment isn't implemented). Don't write speculative content to fill the section.
  8. **Current code state** — what's built, where (Source of truth + step-2 rename targets). **Keep concise** (added per adversarial re-review to prevent shipped variants from anchoring by information-density): one short paragraph + bullet list of paths. Not a full code walkthrough — the source files themselves are the walkthrough.
- **Module README template (each Module folder's README, or top of single-file Module — single-file Modules adapt the template using sections instead of variant index, since they don't have separate variant files):**
  1. **Module name** (the category)
  2. **Essence** — 1–2 sentence abstract definition of what fits in this category. Independent of any specific implementation.
  3. **Boundary** — what's NOT in this category. Adjacent modules and what differentiates them. ("If a feature does X, it's a variant of this Module. If it does Y instead, that's a different Module.")
  4. **Variants index / sub-axes** — for folder Modules: current variants (links to per-variant pages) AND known possible variants (with brief sketches). For single-file Modules: sub-axes (the columns of the Module's axes) with values.
  5. **How this Module interacts** with other Modules at the category level
  6. **Future possibilities** — variants we haven't built but could; LO-customization potential. **Inclusion criterion** (added per scope-guardian re-review): list only variants that either (a) exist in another league/system in the real world (CSI, APA, BCAPL, NAPA, etc.), OR (b) Ed has named in a brainstorm/conversation with a use case attached. Not a comprehensive survey of theoretical possibilities.
  7. **Source of truth** — code locations for the axis values + dispatch logic
- **Boundary between "Possible modifications" (variant page section 7) and "Future possibilities" (Module README section 6)** (added per scope-guardian re-review): a *modification* stays on the variant page if it preserves the variant's core mechanic and only adjusts parameters (e.g., 10-Point with winner=12 instead of 10 stays in `ten-point-scoring.md`'s Possible modifications). A *new variant* goes in the Module README's Future possibilities if it changes the core mechanic (e.g., simple-winner-only — no per-game loser points at all — is a new variant of the Points-Per-Game category, not a modification of 10-7).
- **README anti-conflation classifier.** The top-level `README.md` includes a "How to classify a new idea" section: a short walkthrough that future Claude sessions can use to triage proposed features. ("Does it affect handicap calculation? → Handicap Systems. Does it affect how the handicap is applied during play? → Handicap Mechanisms. Does it affect how match victory is decided? → Scoring Systems. Etc.") This is the load-bearing daily-use feature of the doc.
- **Source-of-truth section format:** `current/code/path.ts → step-2 rename target (tentative, to be confirmed in step-2 plan): new/code/path.ts`. No line numbers, no dates.
- **Honesty framing single-sourced** in `README.md`; each Division page has a one-line link.
- **Mirror invariant for `CLAUDE.md` cheat sheet.** Same canonical names, same disambiguation rule, same Module groupings. Any future edit to one must update both in the same commit (R11 enforces). Drift risk is acknowledged (Risks section); mitigation is currently process-based.
- **Branch base constraint.** The `src/systems/game-events/` directory cited in `scoring-systems/README.md` was added on `refactor/golden-break-single-source` via commit `aebb6bb`. Implementer must branch from a base that includes that work, or note in the relevant variant page that the citation assumes a future state. Recommendation: wait for `refactor/golden-break-single-source` to merge to `main`, then branch from `main`.

## Open Questions

### Resolved During Planning

- **`points_system` column disposition:** RESOLVED. Persisted in `preferences` and resolved through the SQL view, but no scoring/handicap consumer reads the resolved value. Per Ed's "don't drop columns" directive, the column stays. Documented in `scoring-systems/README.md` (or appropriate variant page) as a persisted-but-unconsumed column. System has 13 *behavioral* axes; `points_system` is a 14th *persisted-but-unconsumed* column.
- **Skill Level treatment:** RESOLVED — full variant page (`handicap-systems/skill-level.md`), not a one-line reserved entry. The variant exists in the world (APA), even though we don't compute or report it. Document what we know.
- **L1 markdown filename casing:** RESOLVED — lowercase-kebab matching `docs/research/` precedent.
- **Step 2 code filename casing:** DEFERRED to step-2's plan (snake_case per repo precedent vs kebab-case per brainstorm). L1's filenames are independent of that choice.
- **`docs/league-system/` placement:** RESOLVED — new subdirectory under `docs/`, parallel to `docs/brainstorms/`, `docs/plans/`, `docs/research/`.
- **Folder-per-major-module vs single-file:** RESOLVED — folder for Handicap Systems, Handicap Mechanisms, Scoring Systems, Threshold Charts; single file for Team Geometry, Match Format, Standings & Tiebreakers.
- **"Choosing a Division" cheat-table:** RESOLVED — excluded. The Division pages themselves provide synthesis; no separate decision-aid table is needed in L1.

### Deferred to Implementation

- **Exact prose** for the honesty framing paragraph, the README anti-conflation classifier walkthrough, the policy-contract wording in `CLAUDE.md`, and each variant page's content. Templates are specified above; specific wording is implementer's call.
- **17-Point Scoring System placement** — short reference in `scoring-systems/README.md` as a "possible variant" entry (CSI names it; not implemented), no dedicated page.
- **Sub-categorization within Scoring Systems** — the "points per game" concept may be a sub-category of the 10-Point Scoring System path, or its own thing entirely. Implementer's call during writing. The variant page template accommodates either shape.
- **Variant pages for `none` options** — some Modules have a "none" value (e.g., `mechanism: 'none'`). Whether `none` gets its own variant page or is covered in the Module README is implementer's call.
- **Exact placement of the cheat-sheet block in `CLAUDE.md`** — between `## Claude Code Specific Features` and `# Planning` per Key Technical Decisions; specific section heading and ordering of cheat-sheet vs policy-contract is implementer's call.
- **Loss-cause event registry** (commit `aebb6bb`) — documented as a sub-section or sub-variant within `scoring-systems/`. Specific placement is implementer's call once writing the Scoring Systems pages. Read-only verification; no source-code edits.

### Deferred to Step 2

- All source-code work (see Scope Boundaries → Deferred to Separate Tasks).
- `calculatePlayerHandicap.ts` skill_level fall-through guard.
- Wizard step copy "BCA" references (~11 strings outside R9).

## Output Structure

```
docs/league-system/
  README.md                                    # Index + cheat sheet + honesty + "how to classify a new idea" decision-tree (Unit 1)
  divisions/
    points-3man.md                             # Points 3-Man Division synthesis (Unit 9)
    percentage-5man.md                         # Percentage 5-Man Division synthesis (Unit 9)
    fargo-10pt-5man.md                         # FargoRate 10-Point 5-Man Division synthesis (Unit 9)
  modules/
    handicap-systems/                          # Unit 2
      README.md                                # Category essence + boundary + variant index
      points.md                                # -2 to +2 integer variant
      percentage.md                            # 0–100 variant
      fargorate.md                             # FargoRate 100–850 variant
      skill-level.md                           # APA / BCAPL Skill Level — known-in-world, not currently shipped
    handicap-mechanisms/                       # Unit 3
      README.md                                # Category essence + boundary + variant index
      extra-games.md                           # Stronger team must win more games
      start-points.md                          # Weaker team starts with bonus points
      race-length-adjustment.md                # Per-pairing race length adjustment
      (none — covered in README)               # The "no handicap" case
    scoring-systems/                           # Unit 4
      README.md                                # Category essence + boundary + variant index
      one-point-scoring.md                     # CSI's 1-Point Scoring System ("Race To")
      ten-point-scoring.md                     # CSI's 10-Point Scoring System (or further nested if sub-categories emerge)
      seventeen-point-scoring.md               # CSI's 17-Point Scoring System — short reference only
    threshold-charts/                          # Unit 5
      README.md                                # Category essence + boundary + chart index
      (per-chart variant pages — number TBD)   # 3v3-games-needed, 5v5-games-needed, fargo-formula, etc.
    team-geometry.md                           # Single file, no significant variants (Unit 6)
    match-format.md                            # Single file (Unit 7)
    standings-tiebreakers.md                   # Single file (Unit 8)
  glossary.md                                  # Single-source term definitions (Unit 10)
```

Total: **~18–22 new markdown files** in this branch (variant count within `threshold-charts/` may vary by implementer's call). Plus modifications to `CLAUDE.md` (Unit 11), `TABLE_OF_CONTENTS.md` (Unit 12), and the three legacy `docs/*.md` files (Unit 13).

## Pre-Implementation Check (mandatory before Unit 1)

Before starting Unit 1, the implementer must:

1. **Confirm branch base includes `src/systems/game-events/`.** Run `ls src/systems/game-events/` from the working branch — if the directory doesn't exist, do NOT proceed. Either: (a) re-base on `refactor/golden-break-single-source` (where commit `aebb6bb` lives), or (b) wait for that branch to merge to `main` and branch from `main`. The Unit 4 loss-cause registry sub-section depends on this directory existing at write-time.
2. **Verify project `CLAUDE.md` section order.** Run `grep -n '^# \|^## ' CLAUDE.md` and confirm `## Claude Code Specific Features` appears followed by `# Planning`. If section order has changed since 2026-05-12, abort Unit 11 and re-plan that unit.
3. **Confirm `src/types/resolvedSystemConfig.ts` axis values still match plan's documented values.** If any axis (especially `tiebreaker_trigger`, `tiebreaker_format`, `handicap_type`, `mechanism`, `win_condition`, `points_calculator`) has values not enumerated in this plan, abort and revise the plan before writing — wrong axis values locked into L1 would create the exact conflation the doc is supposed to prevent.

## Implementation Units

- [ ] **Unit 1: `docs/league-system/` scaffolding + `README.md`**

**Goal:** Create the L1 entry point with the cheat sheet, honesty framing, "how to classify a new idea" decision-tree, doc convention statement, and "how to use this doc" policy reference.

**Requirements:** R1, R4, R5, R6, R10 (paths), R11 (policy reference), R14 (anti-conflation classifier).

**Dependencies:** None — foundational.

**Files:**
- Create: `docs/league-system/` (directory)
- Create: `docs/league-system/README.md`
- Create: `docs/league-system/divisions/` (empty, for Unit 9)
- Create: `docs/league-system/modules/` (empty, for Units 2-8)
- Create: `docs/league-system/modules/handicap-systems/` (empty, for Unit 2)
- Create: `docs/league-system/modules/handicap-mechanisms/` (empty, for Unit 3)
- Create: `docs/league-system/modules/scoring-systems/` (empty, for Unit 4)
- Create: `docs/league-system/modules/threshold-charts/` (empty, for Unit 5)

**Approach:**
- YAML frontmatter: `title: League System Canonical Reference`, `date: 2026-05-12`, `status: active`, `audience: developer + AI sessions`.
- Sections (in order):
  1. **Honesty framing** (verbatim from brainstorm) — single source for the rest of the doc to cite.
  2. **What this doc is for** — short prose: the design-space map, the anti-conflation classifier, the future-work enabler. Three sentences max.
  3. **Naming taxonomy cheat sheet** — exact tables from the origin doc's [Naming Taxonomy](../brainstorms/2026-05-12-league-system-documentation-requirements.md#naming-taxonomy) section. This block is the canonical source; `CLAUDE.md` mirrors it in Unit 11.
  4. **How to classify a new idea (anti-conflation walkthrough)** — short decision-tree-style prose: "If a proposed feature changes how a player's strength is encoded for the match → Handicap Systems. If it changes how the strength difference gets applied during play → Handicap Mechanisms. If it changes how match victory is decided → Scoring Systems. If it changes how the handicap-difference becomes a target threshold → Threshold Charts. Etc." Includes an explicit "if it doesn't fit any of these, we need a new Module" exit. Worked example: walk through one classification (e.g., "an LO proposes that the loser gets to choose their break in the next match if they lose by 3+ games" — classify it, find it doesn't fit cleanly, recognize it's a new Module about "between-match handicap adjustments").
  5. **Doc structure** — explain folder-per-major-module + single-file-thin-module convention. Variant pages are peers, no anchor.
  6. **Module index** — links to each Module README or single-file. One-line description per Module.
  7. **Division index** — links to the 3 Division synthesis pages.
  8. **How to use this doc** — short prose: read the cheat sheet for vocabulary; for any substantive question, read the relevant Module README and the relevant variant page; the L1 doc IS the source of truth (see policy section in `CLAUDE.md`).
- Brief reference at the bottom to `CLAUDE.md`'s policy-contract section (which is created in Unit 11).

**Patterns to follow:**
- Frontmatter style: `docs/research/fargo-games-won-threshold.md`.
- Section headings: `##` for top-level within the page.
- Table formatting: pipe-separated, no leading `|`, matching origin doc style.

**Test scenarios:**
- *Test expectation: none — documentation*.

**Verification:**
- Cheat sheet content is copy-pasteable verbatim into `CLAUDE.md` (Unit 11) and remains self-explanatory.
- All canonical names match the origin doc's Naming Taxonomy exactly.
- The "how to classify a new idea" walkthrough works on a real example (the worked example included in the doc) AND the implementer tries it on one additional made-up example to verify the walkthrough produces a clear answer.
- Module index entries link to files that will exist after Units 2-8 land (acceptable to commit Unit 1 first; verify after Units 2-8).
- Honesty framing paragraph is verbatim from the origin doc.

---

- [ ] **Unit 2: Module folder — Handicap Systems**

**Goal:** Create the Handicap Systems Module folder with category README + 4 variant pages: Points, Percentage, FargoRate, Skill Level.

**Requirements:** R3, R4 (CSI verbatim where applicable), R5 (coined terms marked), R10 (Source of truth), R12 (step 1 portion — skill-level rationale documented), R13 (design-space mapping).

**Dependencies:** Unit 1 (README must exist for cross-links to work; cheat sheet defines canonical names).

**Files:**
- Create: `docs/league-system/modules/handicap-systems/README.md`
- Create: `docs/league-system/modules/handicap-systems/points.md`
- Create: `docs/league-system/modules/handicap-systems/percentage.md`
- Create: `docs/league-system/modules/handicap-systems/fargorate.md`
- Create: `docs/league-system/modules/handicap-systems/skill-level.md`

**Approach:**

**`handicap-systems/README.md`** — Module category:
- **Essence:** One or two sentences. Something like: "A handicap system encodes a player's relative strength as a numeric or categorical value, used by the rest of the system to compute fair matchups."
- **Boundary:** What's NOT a handicap system. ("If something changes how that strength value gets applied during play — extra games, start points, race-length adjustments — that's a Handicap Mechanism, not a Handicap System.")
- **Variants index:** Links to the 4 variant files with one-line descriptions each. Listed as peers.
- **How this Module interacts:** Handicap Systems feed into Handicap Mechanisms (the strength values + mechanism produce thresholds/spots) and Threshold Charts (the chart consumes the handicap difference). Sketch the interaction graph briefly.
- **Future possibilities:** Other handicap systems that exist in the world (e.g., USAPL Skill Levels, ranking-based systems, win-percentage), or hypothetical schemes (e.g., LO-defined custom rating). Don't enumerate exhaustively; note that the category is open.
- **Source of truth:** `src/types/preferences.ts` (`handicap_type` column type), `src/utils/calculatePlayerHandicap.ts` (`HandicapType` union), `supabase/migrations/20260410000000_extend_preferences_modular.sql` (DB CHECK). Step-2 rename targets: none at the Module level (the file structure itself isn't being renamed).

**`points.md`** — Variant (the -2 to +2 system):
- Apply the variant template (Name / What it is / How it works / When you'd use it / When you wouldn't / Interactions / Possible modifications / Current code state).
- **What it is:** Integer values -2 to +2 representing player strength relative to a notional center. Higher = stronger.
- **How it works:** Each player has a rating from -2 to +2 (typically assigned by LO or by the rules of the league). Match-level handicapping uses the *difference* between team sums (or averages — implementer to confirm from `bca3v3.ts`); the difference maps to a target threshold via a chart (see `threshold-charts/`).
- **When you'd use it:** Operator wants simple integer-grade handicapping with a tight range; small leagues where players are well-known and ratings can be set qualitatively.
- **When you wouldn't:** Need for granular fairness (FargoRate is more precise); want automated rating updates (Points is manual).
- **Interactions:** Pairs with `extra_games` mechanism (current usage); does NOT pair with `start_points` mechanism (no current chart for that combo); compatible with 1-Point Scoring System; compatible with any threshold-chart that maps integer differences to game targets.
- **Possible modifications:** Different range (-3 to +3, -1 to +1); different chart granularity; ratings could come from a formula instead of LO assignment.
- **Current code state:** Used by `standard_3v3` preset. Code anchor: `src/systems/bca3v3.ts` → step-2 rename target (tentative): `points_3man.ts` (snake_case per repo precedent). DB allowed value: `'points'` in `preferences.handicap_type`.

**`percentage.md`** — Variant (the 0-100 system):
- Same template. Range 0–100. Used by `standard_5v5`. Code anchor: `src/systems/bca5v5.ts` → step-2 rename target (tentative): `percentage_5man.ts`. Interactions: `extra_games`, etc.

**`fargorate.md`** — Variant (the 100-850 system, CSI/FargoRate official):
- Same template. CSI's official term ("FargoRate" is FargoRate's trademark; CSI mandates FargoRate for handicapped BCAPL divisions since 2020). Used by `fargo_5v5`. Interactions: pairs with `start_points` mechanism (current usage); pairs with 10-Point Scoring System; could also pair with 1-Point Scoring System (CSI's future-Fargo league pivot — see strategic brainstorm `modular-league-system-requirements.md`). Cite CSI/FargoRate sources.

**`skill-level.md`** — Variant (APA / BCAPL Skill Level, 1–9):
- Same template, with disclaimers per the brainstorm.
- **What it is:** Integer values 1–9, representing player skill grade. APA's national system; BCAPL has historically used various skill-level schemes at the local-chapter level.
- **How it works:** Brief — 2-3 sentences max. The APA algorithm is proprietary and closed-source; we cannot verify or specify its mechanics. Document what's publicly known (innings-per-game tracking, recent-match window, SL1-SL9 grade output) and link to APA's public materials as authoritative references. **Do not speculate or synthesize calculation details** (per adversarial re-review — avoid getting calibration details wrong in a doc Ozzy/CSI might review).
- **When you'd use it:** Operator wants to support APA-style players or a BCAPL local chapter using SL1-SL9.
- **When you wouldn't:** Want automated rating computation (we don't compute APA ratings); want to report results back to APA (we don't — APA's own app is the authoritative system).
- **Disclaimers (required):** (a) The system does NOT compute APA handicaps; operators must enter ratings manually. (b) Match results played in this app are NOT reported back to APA and do NOT affect a player's APA rating.
- **Interactions:** Pairs with `race_length_adjustment` mechanism (APA's "skill level race chart"); compatible with 1-Point Scoring System.
- **Current code state:** `'skill_level'` value allowed in DB CHECK; stub branch exists in `src/systems/buildSystemFromPreferences.ts`; `HandicapType` union member in `src/utils/calculatePlayerHandicap.ts`. **Wizard card currently visible in `src/wizards/league-v2/steps/HandicapSystemStep.tsx`; step 2 hides this UI option** until a usable implementation lands (manual-entry mode, calibrated chart, or external integration).
- **Trigger to revive in app:** manual-entry mode is built, OR a BCAPL/CSI/APA-specific roadmap commits to a calculation pathway.

**Patterns to follow:**
- Variant template (Name / What it is / How it works / When you'd use it / When you wouldn't / Interactions / Possible modifications / Current code state) consistent across all 4 variants.
- Module README template (Essence / Boundary / Variants index / Interactions / Future possibilities / Source of truth).
- Variants listed in module README as peers, alphabetical or by-complexity. No "default" or "canonical" variant.

**Test scenarios:**
- *Test expectation: none — documentation*.

**Verification:**
- Each variant page completes all 8 sections of the variant template.
- Module README boundary section gives concrete examples of what's IN vs OUT.
- Code anchors in each variant page point to files that exist today (verifiable via `ls` or read).
- Step-2 rename targets are consistent across variants (`points_3man`, `percentage_5man`, `fargo_10pt_5man`) and match the origin doc's Code Renames Required section.
- Skill Level disclaimers are present and clear.

---

- [ ] **Unit 3: Module folder — Handicap Mechanisms**

**Goal:** Create the Handicap Mechanisms Module folder with category README + variant pages for `extra_games`, `start_points`, `race_length_adjustment`. The `none` value is covered in the Module README.

**Requirements:** R3, R4, R5, R10, R13.

**Dependencies:** Unit 1 (for cross-links).

**Files:**
- Create: `docs/league-system/modules/handicap-mechanisms/README.md`
- Create: `docs/league-system/modules/handicap-mechanisms/extra-games.md`
- Create: `docs/league-system/modules/handicap-mechanisms/start-points.md`
- Create: `docs/league-system/modules/handicap-mechanisms/race-length-adjustment.md`

**Approach:**

**`handicap-mechanisms/README.md`** — Module category:
- **Essence:** "A handicap mechanism is how the system applies a handicap difference during actual play — what changes in the match because team A is rated stronger than team B."
- **Boundary:** Not a handicap system (those are strength encodings); not a scoring system (those decide match victory). A mechanism specifically transforms a handicap-difference into a concrete in-match adjustment.
- **Variants index:** extra-games, start-points, race-length-adjustment, none.
- **The `none` case:** No mechanism applies. Used when no handicap is configured. Brief description in README; no separate file.
- **How this Module interacts:** Consumes the handicap difference (computed from Handicap Systems); produces a target/spot value used by Scoring Systems and the threshold-chart lookup.
- **Future possibilities:** Hybrid mechanisms (e.g., partial spot + partial race-length adjustment); LO-defined custom mechanisms.
- **Source of truth:** `src/types/preferences.ts` (`mechanism` column), `src/systems/calculators/*.ts` (per-mechanism implementations), the resolved view in `supabase/migrations/20260429000002_resolved_view_phase2_modular_axes.sql`.

**`extra-games.md`** — Variant:
- Apply variant template.
- **What it is:** The stronger team must win more games than the weaker team to win the match.
- **How it works:** Handicap difference + a threshold chart → target wins per side. E.g., "team A needs 8 wins, team B needs 5."
- **Interactions:** Used by Points handicap (BCA 3v3 pattern) and Percentage handicap (BCA 5v5 pattern). Pairs with 1-Point Scoring System.
- **Code state:** Used by `standard_3v3` and `standard_5v5` presets.

**`start-points.md`** — Variant:
- **What it is:** The weaker team starts the match with bonus points.
- **How it works:** Handicap difference → bonus points for the weaker team. E.g., "team B starts with 50 points."
- **Interactions:** Used by FargoRate handicap (Fargo 5v5 10-7 pattern). Pairs with 10-Point Scoring System.
- **Code state:** Used by `fargo_5v5` preset.

**`race-length-adjustment.md`** — Variant:
- **What it is:** Per-pairing race lengths vary by skill — stronger players need more games to win their individual rack-set.
- **How it works:** Per-pairing race length is set by player ratings (e.g., a 7-vs-5 SL match has the stronger player racing to 5 games and the weaker racing to 3).
- **Interactions:** Pairs naturally with Skill Level handicap (APA's well-known SL race chart). Not currently used by any shipping Division.
- **Code state:** Reserved; not implemented in any current SystemModule. Documented as a future possibility.

**Clarification (per feasibility re-review):** the term `manual_entry` that exists in `src/wizards/league-v2/steps/ThresholdSourceStep.tsx` is a **threshold-chart source** classification, NOT a handicap mechanism. Do not conflate.

**Patterns to follow:** Same variant template as Unit 2.

**Test scenarios:**
- *Test expectation: none — documentation*.

**Verification:**
- Each variant page completes the template.
- Boundary section explicitly contrasts mechanisms vs systems vs scoring.
- `manual_entry` clarification is present (not in this Module).

---

- [ ] **Unit 4: Module folder — Scoring Systems**

**Goal:** Create the Scoring Systems Module folder with category README + variant pages for CSI's 1-Point Scoring System, 10-Point Scoring System, and a short reference to 17-Point Scoring System.

**Requirements:** R3, R4 (CSI verbatim), R5, R10, R13.

**Dependencies:** Unit 1.

**Files:**
- Create: `docs/league-system/modules/scoring-systems/README.md`
- Create: `docs/league-system/modules/scoring-systems/one-point-scoring.md`
- Create: `docs/league-system/modules/scoring-systems/ten-point-scoring.md`

*(17-Point Scoring System is documented as a "Known possible variants" sub-section within `scoring-systems/README.md`, not its own file — per scope-guardian re-review, a dedicated file for "this exists but we don't use it" adds overhead without earning its keep.)*

**Approach:**

**`scoring-systems/README.md`** — Module category:
- **Essence:** "A scoring system defines how points or game-wins accumulate during a match, and how those accumulations decide match victory."
- **Boundary:** Not a handicap system (strength encoding); not a mechanism (in-match handicap application). A scoring system specifically governs match-level point/win accumulation and victory determination.
- **Variants index:** 1-Point Scoring System (CSI), 10-Point Scoring System (CSI), 17-Point Scoring System (CSI, reference only).
- **How this Module interacts:** Combined with `win_condition` axis (`games` vs `points`) to determine match outcome. Receives input from Handicap Mechanisms (start points or extra games). The `points_calculator` axis selects the specific per-game accumulation formula.
- **Persisted-but-unconsumed column note** (`points_system`): include a sub-section noting that the `preferences.points_system` column exists in the DB and is selected by the resolved view, but no scoring runtime consumes the resolved value. The column persists per Ed's "don't drop columns" directive; no behavior depends on its four values (`differential`, `bca_tiered`, `per_game`, `manual`). Future cleanup may rename or drop in a separate branch.
- **Loss-cause event registry note:** included as a sub-section within `scoring-systems/README.md` (decision locked here — implementer does not need to re-choose between "sub-section here" vs "out of scope"). Documents commit `aebb6bb`'s registry-driven loss-cause events (`early_8`, `scratch_on_8`, `eight_wrong_pocket`), how they feed into 10-Point Scoring's per-game allocations, and their `enabledByDefault: false` state. **Read-only verification** — implementer reads `src/systems/game-events/` but does not modify it. *Branch-base constraint applies — `src/systems/game-events/` must exist on the branch base; see Key Technical Decisions.*
- **Future possibilities:** Hybrid scoring (race-to-N games-OR-points, whichever first); match-end bonus points (currently doesn't fit — would need a new Module); LO-defined point allocation schemes.
- **Source of truth:** `src/types/preferences.ts` (`win_condition`, `points_calculator`, `points_calculator_params`, `points_system`), `src/systems/calculators/index.ts` (`getCalculator` dispatch), `src/systems/calculators/types.ts` (calculator types), `src/systems/calculators/{linear_above_threshold,accumulate_with_milestone_jumps,accumulated_per_game}.ts`, `src/systems/game-events/` (loss-cause registry — branch base constraint applies).

**`one-point-scoring.md`** — Variant (CSI's 1-Point Scoring System, a.k.a. "win/loss system" or "Race To"):
- Apply variant template.
- **What it is:** Each game won is worth 1 point. The match is decided by first team to a target number of wins ("race to N"). CSI's published name.
- **How it works:** Win condition = `'games'`. Race target depends on handicap (Threshold Charts).
- **Interactions:** Pairs with `extra_games` mechanism (Points and Percentage handicaps), or `race_length_adjustment` (Skill Level handicap).
- **Cite:** CSI 1-Point Scoring System URL.
- **Code state:** Used by `standard_3v3`, `standard_5v5`. `points_calculator` value: `'linear_above_threshold'` or similar (varies by Division — implementer to verify).

**`ten-point-scoring.md`** — Variant (CSI's 10-Point Scoring System):
- **What it is:** Per-game: winner gets 10 points, loser gets a calculated or entered amount 0–7. Team accumulates across the match. CSI's published name.
- **How it works:** Win condition = `'points'`. Each game's points feed into team match-totals. Current variant: 10-7 (winner=10, loser=entered 0–7).
- **Current implementation (10-7):** described as ONE current variant of the category. Per the design-space framing: this is *one* way the 10-Point category manifests; *other* implementations could exist within the same category (simple-winner-only with no loser points, entered-loser with different bounds, formula-based loser-point computation). Listed as peers within this variant page's "Possible modifications" section, not as a hierarchy.
- **Interactions:** Pairs with `start_points` mechanism (FargoRate handicap pattern). Pairs with FargoRate handicap; could also work with Percentage or Points if a calibrated chart is added.
- **Cite:** CSI 10-Point Scoring System URL.
- **Code state:** Used by `fargo_5v5`. `points_calculator` value: `'accumulated_per_game'` (implementer to verify).
- **Possible modifications (within 10-Point Scoring):** alternative winner amounts (12, 15, etc.); alternative loser bounds (0–5, 0–10); deterministic loser-point formula (vs entered); per-event bonuses (loss-cause events affecting allocation).

**`seventeen-point-scoring.md`** — Short reference:
- CSI names this system; we don't implement it. One-paragraph description ("similar to 10-Point but with a different per-game allocation"), with link to any CSI doc that explains it. No variant template needed — this is a placeholder / future-possibility entry.
- Listed in `scoring-systems/README.md`'s variants index with the note "[reference only — not implemented]".

**Patterns to follow:** Same variant template as Units 2-3.

**Test scenarios:**
- *Test expectation: none — documentation*.

**Verification:**
- CSI terminology verbatim in titles and definitions.
- `points_system` orphan note is precise (persisted-but-unconsumed, not "never read at runtime").
- Loss-cause event registry sub-section is read-only.
- 10-Point Scoring variant page presents 10-7 as a current variant in the category's design space, not as the canonical/default 10-Point implementation.
- 17-Point page is short reference only; no template required.

---

- [ ] **Unit 5: Module folder — Threshold Charts**

**Goal:** Create the Threshold Charts Module folder with category README + per-chart variant pages for the currently-used charts (3v3 games-needed, 5v5 games-needed, Fargo formula).

**Requirements:** R3, R4, R5, R10, R13.

**Dependencies:** Unit 1.

**Files:**
- Create: `docs/league-system/modules/threshold-charts/README.md`
- Create: `docs/league-system/modules/threshold-charts/3v3-games-needed.md`
- Create: `docs/league-system/modules/threshold-charts/5v5-games-needed.md`
- Create: `docs/league-system/modules/threshold-charts/fargo-formula.md`
- *(Implementer reads `supabase/migrations/20260410000003_seed_threshold_charts.sql` first to determine final variant-page count. The three named files above are the minimum — additional chart variants in the seed file get their own pages.)*

**Approach:**

**`threshold-charts/README.md`** — Module category:
- **Essence:** "A threshold chart maps a handicap-difference (or pair of handicap values) to a target/threshold value used during play — typically target wins or starting points."
- **Boundary:** Not a handicap system (charts consume strength values, don't define them). Not a mechanism (mechanisms decide how the threshold is *applied* — chart vs mechanism are separated). A threshold chart is specifically the data-lookup layer.
- **Variants index:** 3v3 games-needed (Points handicap), 5v5 games-needed (Percentage handicap), Fargo formula (FargoRate handicap), + any additional charts in the DB threshold_charts table.
- **How this Module interacts:** Inputs come from Handicap Systems (the rating values); outputs feed Handicap Mechanisms (the spot/extra-games target) and Scoring Systems (the race target or start-point bonus).
- **Cascade behavior:** Global → org → league override. Operators can copy a global chart and modify per-league. Per the brainstorm's strategic context (modular-league-system), this enables "BCA-grade adaptability."
- **Future possibilities:** LO-authored custom charts (UI work — step 3+); formula-based charts (vs explicit row tables); cross-axis charts (multi-input lookup).
- **Source of truth:** `supabase/migrations/20260410000002_threshold_charts.sql` (table definitions + `lookup_threshold` function), `supabase/migrations/20260410000003_seed_threshold_charts.sql` (the actual seeded charts — implementer reads this to determine final variant-page count), per-chart code anchors in each variant file.

**Per-chart variant pages** — apply variant template:
- **`3v3-games-needed.md`** — Used by Points 3-Man. Calculation: hardcoded chart in `src/utils/handicap/get3v3GamesNeeded.ts`. Inputs: integer handicap difference. Outputs: target wins per side. Pairs with `extra_games` mechanism.
- **`5v5-games-needed.md`** — Used by Percentage 5-Man. Similar template with `src/utils/handicap/get5v5GamesNeeded.ts`.
- **`fargo-formula.md`** — Used by FargoRate 10-Point 5-Man. Formula-based (not a chart per se): `2^(rating/100)` produces win-expectancy; pairs with `start_points` mechanism. Code anchor: `src/utils/handicap/fargoGamesWonThresholds.ts` and related.

**Patterns to follow:** Same variant template; module README template.

**Test scenarios:**
- *Test expectation: none — documentation*.

**Verification:**
- Module README essence and boundary are precise (chart = data layer; mechanism = application layer).
- Each chart variant page has accurate code anchors.
- `lookup_threshold()` SQL function is documented at the README level.
- Cascade behavior is explained.

---

- [ ] **Unit 6: Single-file Module — Team Geometry**

**Goal:** Single-file documentation for the Team Geometry Module covering `lineup_size`, `max_roster_size`, and `game_generation`.

**Requirements:** R3, R4, R5, R10, R13.

**Dependencies:** Unit 1.

**Files:**
- Create: `docs/league-system/modules/team-geometry.md`

**Approach:**

Apply the **Module README template** in a single file (no folder, no separate variant files — these axes have no significant variants, just value ranges):

- **Essence:** "Team geometry defines the structural shape of a team and the games-per-match schedule."
- **Boundary:** Not a scoring system (geometry sets the field; scoring decides victory). Not a handicap (geometry is about roster size, not player strength).
- **Sub-axes** (with sections for each):
  - **Lineup size** — players active per match. Currently: 3 or 5. Future possibilities: 4 (mentioned in brainstorm as known-possible), 6.
  - **Max roster size** — total players a team can carry. Currently: 5 (3v3 teams) or 8 (5v5 teams). LO can configure beyond defaults.
  - **Game generation** — `'single_round_robin'` (25 games for 5v5) vs `'double_round_robin'` (18 games for 3v3). Determines per-match game count.
- **Per-Division usage:** Table showing the three Divisions' values.
- **How this Module interacts:** Lineup size + game generation produce per-match game count. Roster size doesn't interact with other Modules (it's a team-management axis). Game count affects Scoring Systems (race targets must be reachable within the game count).
- **Source of truth:** `src/types/preferences.ts` (the three columns), `src/wizards/league-v2/presetMappings.ts` (per-Division values), `src/utils/lineup/` (game-generation logic).

**Patterns to follow:** Module README template structure, all in one file.

**Test scenarios:**
- *Test expectation: none — documentation*.

**Verification:**
- Three sub-axes documented with current values and possible future values.
- Per-Division values match `presetMappings.ts` (read-only verification).

---

- [ ] **Unit 7: Single-file Module — Match Format**

**Goal:** Single-file documentation for the Match Format Module covering `pairing_format` and `race_length`.

**Requirements:** R3, R4, R5, R10, R13.

**Dependencies:** Unit 1.

**Files:**
- Create: `docs/league-system/modules/match-format.md`

**Approach:**

Module README template in a single file:
- **Essence:** "Match format defines the structure of individual pairings within a match — single-rack vs multi-rack race-to-N."
- **Boundary:** Not game-count (Team Geometry); not scoring (Scoring Systems). Specifically the per-pairing structure.
- **Sub-axes:**
  - **Pairing format:** `'single_rack'` (one game per pairing) vs `'race_to_n'` (race to N games per pairing).
  - **Race length:** `null` for single_rack; integer N for race_to_n.
- **Future possibilities:** Sets format (best-of-N sets of races); time-limited pairings.
- **Per-Division usage.**
- **Note from brainstorm:** Pairing format is not yet user-facing (no wizard step exposes it). Future expansion territory.
- **Source of truth:** `src/types/preferences.ts`, `supabase/migrations/20260429000001_extend_preferences_phase2_modular_axes.sql`.

**Patterns to follow:** Same.

**Test scenarios:**
- *Test expectation: none — documentation*.

**Verification:**
- Two sub-axes documented.
- Note about pairing_format not being user-facing is included.

---

- [ ] **Unit 8: Single-file Module — Standings & Tiebreakers**

**Goal:** Single-file documentation for the Standings & Tiebreakers Module covering `standings_sort`, `tiebreaker_trigger`, `tiebreaker_format`.

**Requirements:** R3, R4, R5, R10, R13.

**Dependencies:** Unit 1.

**Files:**
- Create: `docs/league-system/modules/standings-tiebreakers.md`

**Approach:**

Module README template in a single file:
- **Essence:** "Standings & tiebreakers govern how teams are ordered season-to-date and how end-of-season ties are resolved."
- **Boundary:** Not match-scoring (Scoring Systems decide individual matches). Not playoff structure (out of scope for L1). Specifically the standings-display order and the tie-resolution rules.
- **Sub-axes** (values corrected per feasibility re-review against `src/types/resolvedSystemConfig.ts`):
  - **Standings sort:** Ordered array of `'match_wins'`, `'games_won'`, `'points_earned'`. Per-Division order.
  - **Tiebreaker trigger:** `'even_total_games_only'` | `'never'`. **(2 values, not 3.)**
  - **Tiebreaker format:** `'best_of_3_short_race'` | `'single_short_race'` | `'accept_tie'` | `'manual'`. **(`'accept_tie'` is a `tiebreaker_format` value, NOT a `tiebreaker_trigger` value — prior plan revision mis-categorized it.)**
  - Example combo (fargo_5v5): `tiebreaker_trigger='never'` + `tiebreaker_format='accept_tie'` (meaning: never trigger a tiebreaker process; accept ties as final).
- **Known gap:** Triple-tie fallback for even-game Fargo formats (per `project_tiebreaker_for_even_game_formats.md`). Document as a known limitation.
- **Future possibilities:** Head-to-head tiebreakers; division-of-games-won; per-LO custom tiebreakers.
- **Per-Division usage.**
- **Source of truth:** `src/types/preferences.ts`, `src/utils/standings/sortStandings.ts` (sort comparator), `src/utils/tiebreaker/gameNumbers.ts` (tiebreaker helper), `src/utils/__tests__/playoffGenerator.standingsSort.characterization.test.ts` (behavior verification), `supabase/migrations/20260429000002_resolved_view_phase2_modular_axes.sql` (resolved view cascade).

**Patterns to follow:** Same.

**Test scenarios:**
- *Test expectation: none — documentation*.

**Verification:**
- Three sub-axes documented.
- Known gap (triple-tie fallback) is documented.
- Source paths are accurate per feasibility re-review.

---

- [ ] **Unit 9: Division pages — synthesis**

**Goal:** Create the three Division spec sheets. Each is a synthesis layer that names the specific module variants used by that Division and links to them.

**Requirements:** R2, R6 (honesty reference), R8 (step 1 portion), R10.

**Dependencies:** Units 2-8 (Module pages must exist for cross-links).

**Files:**
- Create: `docs/league-system/divisions/points-3man.md`
- Create: `docs/league-system/divisions/percentage-5man.md`
- Create: `docs/league-system/divisions/fargo-10pt-5man.md`

**Approach:**

Each Division page structure:
1. **Short Nickname** (H1)
2. **Canonical Name** + one-sentence description
3. **Honesty framing line** linking to `../README.md#honesty`
4. **Module configuration** — bulleted list of the 7 Modules with the specific variant chosen for this Division. Each Module → variant entry links to the relevant variant page:
   - **Handicap System:** [Points](../modules/handicap-systems/points.md)
   - **Handicap Mechanism:** [Extra Games](../modules/handicap-mechanisms/extra-games.md)
   - **Scoring System:** [1-Point Scoring System](../modules/scoring-systems/one-point-scoring.md)
   - **Threshold Chart:** [3v3 Games Needed](../modules/threshold-charts/3v3-games-needed.md)
   - **Team Geometry:** [3 active / 5 roster / double round-robin](../modules/team-geometry.md)
   - **Match Format:** [Single rack](../modules/match-format.md)
   - **Standings & Tiebreakers:** [Wins → Games → Points / Best of 3 short race](../modules/standings-tiebreakers.md)
5. **How it plays** — brief narrative description (~150-250 words). Vibe of the league in practice.
6. **Why this Division exists** — origin / Ed's history with it / use case.
7. **Source of truth** — code anchors + step-2 rename targets:
   - SystemModule file: current path → step-2 rename target (tentative).
   - Wizard preset key: current → step-2 rename target.
   - Misnamed info file (if any): documented for step-2 deletion. Per feasibility re-review: `src/info/FiveManFormatDetails.tsx` describes Percentage 5-Man content (despite its name); `src/info/EightManFormatDetails.tsx` is orphaned 8-man legacy content not tied to any current Division; no info file documents Points 3-Man.

**Per-Division specifics** (corrected per feasibility re-review):

| Page | Old preset code | Old SystemModule | Existing info file |
|---|---|---|---|
| `points-3man.md` | `standard_3v3` | `bca3v3` (`src/systems/bca3v3.ts`) | **None** — no existing info file. |
| `percentage-5man.md` | `standard_5v5` | `bca5v5` (`src/systems/bca5v5.ts`) | `src/info/FiveManFormatDetails.tsx` — *"5-Man Team Format: Complete Guide"* describes 5-player-active format. **Step 2 deletes.** |
| `fargo-10pt-5man.md` | `fargo_5v5` | `fargo5v5` (`src/systems/fargo5v5.ts`) | **None** — no existing info file. |

`src/info/EightManFormatDetails.tsx` is orphaned 8-man BCA legacy content not tied to a current Division. Mention briefly in `percentage-5man.md`'s "Why this Division exists" section as historical context. **Step 2 deletes.**

**Patterns to follow:**
- Division page structure consistent across the three.
- Settings list mirrors `src/wizards/league-v2/presetMappings.ts` (read-only verification).
- Cross-links to module variant pages use relative paths.

**Test scenarios:**
- *Test expectation: none — documentation*.

**Verification:**
- Each Division page's module configuration matches `presetMappings.ts` values.
- All cross-links resolve to module variant pages that exist after Units 2-8.
- Honesty framing line links correctly.
- Source-of-truth listings name files that exist today.

---

- [ ] **Unit 10: `glossary.md`**

**Goal:** Single-sourced one-line definitions for every term used across L1. Cross-referenced from module/variant/division pages.

**Requirements:** R4, R5.

**Dependencies:** Units 1-9 (so we know which terms are used).

**Files:**
- Create: `docs/league-system/glossary.md`

**Approach:**
- YAML frontmatter same style.
- Definition list or table (implementer's call). Terms include:
  - CSI-official: 1-Point Scoring System, 10-Point Scoring System, 17-Point Scoring System, Race To, FargoRate, Spot, Division, Handicap Spot.
  - Coined (ours): Points (handicap), Percentage (handicap), Module, Variant, Category Essence, Boundary, Handicap System, Handicap Mechanism, Threshold Chart, Team Geometry, Match Format, Standings Sort, Tiebreaker, etc.
  - Concepts: Honesty framing, Anti-conflation classifier, Source of truth (in this doc's context).
- Top-of-file note: "Single source for term definitions. Other pages cross-reference; never duplicate."

**Patterns to follow:** Markdown definition list or table. Implementer's choice.

**Test scenarios:**
- *Test expectation: none — documentation*.

**Verification:**
- Every bolded term across Units 1-9 has a glossary entry.
- No duplicate definitions across L1.

---

- [ ] **Unit 11: Project `CLAUDE.md` — cheat sheet + policy contract**

**Goal:** Add the naming-taxonomy cheat sheet (mirror of `README.md`) and policy-contract section to project `CLAUDE.md`.

**Requirements:** R7 (step 1 portion), R11.

**Dependencies:** Unit 1.

**Files:**
- Modify: `CLAUDE.md` (repo root)

**Approach:**

Insert two new top-level sections, between `## Claude Code Specific Features` and `# Planning` (verified per repo-research-analyst):

1. **`## League System Naming Taxonomy`** — verbatim copy of the cheat-sheet block from `docs/league-system/README.md`. ~50 lines: bundled-vocab terms, handicap systems, scoring systems, division names, the 7 Modules, Points-vs-Points-Scoring disambiguation rule. End with a link to `docs/league-system/README.md` for the authoritative version.

2. **`## League System Doc Policy`** — verbatim of R11 enforcement bullets:
   - Never silently edit `docs/league-system/` files in response to a conflicting request.
   - Conflict-surfacing phrasing.
   - Two-form approval requirement.
   - **Scope boundary** — applies only to `docs/league-system/`; general "push back, don't be a yes-man" continues to apply everywhere else but does NOT require two-form approval.
   - **What counts as a conflict** — changes to Naming Taxonomy, Module categories/essences/boundaries, variant names, glossary definitions. Prose clarification, typos, examples are NOT gated.
   - **Underlying principle** — these docs lock the **meanings, options, and canonical names** of league-system concepts. Semantic change is gated; prose-quality change is not.
   - **Mirror invariant** — any edit to L1's taxonomy table must land in the same commit as the matching `CLAUDE.md` update.
   - **Required reading directive** — future Claude sessions answering any non-trivial rules question MUST read the relevant `docs/league-system/<module>/<variant>.md` file before answering. The cheat sheet is TL;DR for vocabulary; the L1 detail pages are authoritative for behavior.
   - Reference: `feedback_canonical_docs_are_policy.md`.

**Patterns to follow:** existing `CLAUDE.md` style; bulleted lists with bold headings; voice matching `## Project Intelligence (memory-bank)` → `### User Preferences` section.

**Test scenarios:**
- *Test expectation: none — documentation*.

**Verification:**
- **Precondition:** verify the existing `CLAUDE.md` still has the section order documented in Key Technical Decisions. If structure has diverged between plan-writing and implementation, abort and ask.
- Diff the cheat-sheet section against `docs/league-system/README.md` — both must match exactly.
- Section placement: between `## Claude Code Specific Features` and `# Planning`.
- Required-reading directive is present and visible.

---

- [ ] **Unit 12: `TABLE_OF_CONTENTS.md` update**

**Goal:** Add entries for the new `docs/league-system/` directory and its files. Update "Last Updated" date. Do NOT remove the existing `src/info/*.tsx` entries (those files still exist in step 1; step 2 removes them).

**Requirements:** Project-level TOC mandate.

**Dependencies:** Units 1-10.

**Files:**
- Modify: `TABLE_OF_CONTENTS.md`

**Approach:**
- Bump "Last Updated" date.
- Add a new sub-section under "Reference Documentation Folder" titled "League System Canonical Docs" using the **`| Location | Purpose | Notes |`** column header (verified per feasibility re-review at TOC line 44).
- Entries:
  - `/docs/league-system/` (folder header row).
  - `README.md` — "L1 index + cheat sheet + honesty + anti-conflation classifier. CLAUDE.md mirrors the cheat sheet."
  - `divisions/points-3man.md`, `divisions/percentage-5man.md`, `divisions/fargo-10pt-5man.md` — per-Division synthesis pages.
  - `modules/handicap-systems/` folder + its 5 files (README + 4 variants).
  - `modules/handicap-mechanisms/` folder + its 4 files.
  - `modules/scoring-systems/` folder + its 4 files (README + 3 variants including 17-Point reference).
  - `modules/threshold-charts/` folder + its files (count varies).
  - `modules/team-geometry.md`, `modules/match-format.md`, `modules/standings-tiebreakers.md` — single-file modules.
  - `glossary.md` — single-source term definitions.
- Do NOT touch the `src/info/*.tsx` entries (they live under the **Source Code** section around TOC line 361+, NOT under Reference Documentation Folder; step 2 removes them).

**Patterns to follow:** existing TOC formatting; `| Location | Purpose | Notes |` columns.

**Test scenarios:**
- *Test expectation: none — documentation*.

**Verification:**
- Last Updated date is current.
- All new files have entries.
- Source Code section's `src/info/*.tsx` entries unchanged.

---

- [ ] **Unit 13: Legacy doc "superseded by" headers**

**Goal:** Add a one-line "superseded by docs/league-system/ as of 2026-05-12" note to the three legacy reference docs at `docs/` root, so future Claude sessions reading them are pointed to L1.

**Requirements:** Anti-drift (per Ed's decision in planning).

**Dependencies:** Unit 1 (the L1 README must exist for the redirect to be meaningful).

**Files:**
- Modify: `docs/BCA_HANDICAP_SYSTEM.md`
- Modify: `docs/CUSTOM_5MAN_HANDICAP_SYSTEM.md`
- Modify: `docs/LEAGUE_MANAGEMENT_PLAN.md`

**Approach:**
- Add a single block at the top of each file, immediately after the H1 heading (or before, depending on file shape):
  > **Superseded as of 2026-05-12.** The canonical reference for league system configuration is now `docs/league-system/`. This file is kept in place for historical context; new work should reference the L1 docs. See `docs/league-system/README.md`.
- Do NOT delete content. Do NOT edit content. Only add the header note.
- This is a doc-only edit; complies with step 1's "no source code" boundary.

**Patterns to follow:** existing file structure; preserve everything below the new header.

**Test scenarios:**
- *Test expectation: none — documentation*.

**Verification:**
- Each of the three files has the superseded-by block.
- Block links to `docs/league-system/README.md`.
- No other content is changed in the legacy files.

## System-Wide Impact

- **Interaction graph:** None directly. Documentation only. The only "interaction" is `CLAUDE.md`'s cheat sheet loading into every future Claude Code session.
- **Error propagation, state lifecycle, API surface, integration coverage:** N/A.
- **Unchanged invariants:** Zero source-code touches. Zero behavioral changes. All app behavior, tests, migrations, routes, components unchanged. Step 1 is invisible to runtime.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Mirror invariant: `CLAUDE.md` cheat sheet drifts from `docs/league-system/README.md` | R11 + commit-time discipline. Drift is the known top risk; mitigation is process-based. If drift becomes real, a follow-up branch can add a CI/test enforcement (diff the two cheat-sheet blocks at build time). |
| R11 over-fires (Claude treats prose edits as policy conflicts) or under-fires (Claude silently edits taxonomy) | R11 includes scope boundary, underlying principle, and what-counts-as-conflict in `CLAUDE.md`. Refine wording if misfires happen in practice. |
| Step 2 doesn't materialize | L1 doc still has standalone value as design-space reference. Misnamed files / drift remain visible but documented. Acceptable failure mode. |
| Variant pages drift in tone/depth (some thin, some over-written) | Templates in Key Technical Decisions specify the 8-section variant template and 7-section module README template. Implementer should produce roughly similar depth across peer variants. |
| `src/systems/game-events/` doesn't exist on branch base | Key Technical Decisions specifies branch base must include the work from `refactor/golden-break-single-source` (commit `aebb6bb`). |
| Cross-link breakage during incremental commits | Each Unit creates files with cross-links to files that may not exist until later Units. Acceptable; verify cross-links at end of branch before final commit. |
| Implementer over-writes a variant page (treats 10-7 as anchor not peer) | Variant pages must follow the peer framing. The "When you'd use it / When you wouldn't" sections are about THIS variant's tradeoffs in the design space, not about how OTHER variants compare to it. Module README handles cross-variant comparison. |

## Documentation / Operational Notes

- **No deployment impact.** Markdown-only.
- **No CI impact.** No tests added or modified.
- **`CLAUDE.md` reload:** Existing sessions may not auto-pick up new cheat sheet until restart. Forward-looking change.
- **Post-merge follow-ups:**
  - Open step-2 brainstorm or plan to schedule the code renames.
  - After step 2 lands, run `/ce-compound` to seed `docs/solutions/` with the architectural learnings from this two-step initiative.

## Sources & References

- **Origin document:** [docs/brainstorms/2026-05-12-league-system-documentation-requirements.md](../brainstorms/2026-05-12-league-system-documentation-requirements.md)
- **Related strategic context:** [docs/brainstorms/modular-league-system-requirements.md](../brainstorms/modular-league-system-requirements.md) ("BCA-grade adaptability" framing, upcoming Ozzy/CSI meeting)
- **Superseded context:** [docs/brainstorms/modular-handicap-scoring-requirements.md](../brainstorms/modular-handicap-scoring-requirements.md)
- **Related plans:** [docs/plans/2026-04-28-001-feat-modular-league-system-plan.md](2026-04-28-001-feat-modular-league-system-plan.md), [docs/plans/2026-05-01-001-feat-modular-league-system-v2-plan.md](2026-05-01-001-feat-modular-league-system-v2-plan.md)
- **Related code (read-only this branch):**
  - `src/wizards/league-v2/presetMappings.ts` — current preset values; informs Division pages
  - `src/types/preferences.ts`, `src/types/resolvedSystemConfig.ts` — the 13 behavioral axes + the 14th persisted-but-unconsumed column
  - `src/systems/bca3v3.ts`, `bca5v5.ts`, `fargo5v5.ts`, `resolver.ts`, `buildSystemFromPreferences.ts`, `calculators/` — current SystemModule implementations
  - `src/systems/game-events/` — loss-cause event registry (commit `aebb6bb` on `refactor/golden-break-single-source`); branch base must include this
  - `src/info/FiveManFormatDetails.tsx`, `EightManFormatDetails.tsx`, `FormatComparison.tsx` — existing misnamed/orphan content; step 2 deletes
  - `src/wizards/league-v2/steps/HandicapSystemStep.tsx`, `ThresholdSourceStep.tsx`, `PointsCalculatorStep.tsx`, etc. — current wizard UI; step 2 updates copy
  - `src/utils/calculatePlayerHandicap.ts` — has skill_level fall-through; step 2 guards
  - `src/utils/handicap/get3v3GamesNeeded.ts`, `get5v5GamesNeeded.ts`, `fargoGamesWonThresholds.ts` — threshold chart implementations
  - `src/utils/standings/sortStandings.ts`, `src/utils/tiebreaker/gameNumbers.ts` — standings + tiebreaker logic
  - `supabase/migrations/20260410000000_extend_preferences_modular.sql`, `20260410000002_threshold_charts.sql`, `20260429000001_extend_preferences_phase2_modular_axes.sql`, `20260429000002_resolved_view_phase2_modular_axes.sql` — schema + resolved view
- **External docs:**
  - https://www.playcsipool.com/csinews/how-fargorate-improves-the-1-point-scoring-system-for-pool-leagues
  - https://www.playcsipool.com/csinews/how-fargorate-improves-the-10-point-scoring-system
  - https://www.playcsipool.com/bcapl.html
  - https://leaguecalc.fargorate.com/
  - https://www.playcsipool.com/uploads/7/3/5/9/7359673/bcapl_lo_handbook_web_1.pdf
- **Auto-memory referenced:**
  - `feedback_canonical_docs_are_policy.md` (R11)
  - `feedback_keep_if_usable_hide_if_not.md` (R12 / skill_level)
  - `feedback_dev_data_disposable.md` (step 2 justification)
  - `feedback_no_code_in_chat.md`, `feedback_commit_at_checkpoints.md`, `feedback_one_thing_at_a_time.md` (implementer guidance)
  - `project_unified_scoreboard.md` (next planned branch after step 2)
