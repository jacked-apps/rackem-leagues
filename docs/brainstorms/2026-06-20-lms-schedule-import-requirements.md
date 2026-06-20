---
date: 2026-06-20
topic: lms-schedule-import
---

# Import a Schedule (LMS-format .xlsx)

## Problem Frame

We can **export** a season's schedule as the two-sheet `.xlsx` CSI/FargoRate LMS reads
(`feat/lms-schedule-export`). The reverse was missing. Our single real operator asked to
**sync the schedule**, so rather than forcing one direction, give him the **choice**: build
the season's matchups from **our** generator, **or** import them from a **file** — either an
LMS export, or a **sample we hand him to edit**. The file is the source of truth; we adopt it
exactly rather than regenerating (which would produce a different pattern).

Core reframe (Ed): **import is the matchup-generation step with a file as the source instead
of our round-robin chart** — it slots into the existing matchups flow and inherits its guardrails.

Key insight on the **sample**: if our sample export already contains the operator's **real team
names**, then when he edits + re-imports it, the names match by construction — reconciliation
becomes nearly automatic, and a non-LMS operator can author a schedule in Excel and hand it to us.

### How a file cell maps to one of our matches
| File cell | Away team | Home team | Match venue (ours) |
|-----------|-----------|-----------|--------------------|
| `1 @ 2`   | Teams-sheet #1 | Teams-sheet #2 | #2's home venue |

Flow: **upload .xlsx → parse Teams + Schedule → auto-match team names → review & map leftovers → accept → write matchups** (cancel writes nothing).

## Requirements

**Source choice**
- R0. The schedule-setup / matchups flow offers two sources: **generate** (our chart, existing) or **import a file**. On the import path we show on-screen instructions for the format we accept and a **"download sample"** button (the sample is a clean LMS-format `.xlsx` pre-filled with the operator's real teams; no instruction rows in the sheet, so it still round-trips).

**Pre-conditions (file-sourced matchup generation)**
- R1. Import populates an existing season's matchups from an uploaded `.xlsx`; an alternative **source** for the same matchup-generation step, reusing its write path + guardrails.
- R2. The season's **teams must already exist**; import wires matchups to existing teams, never creates teams from names. Our auto-created bye maps to the file's "Bye Team".
- R3. The season's **weeks must already exist** (from setup); the file's week numbers map **by order** to our regular weeks. Dates come from our weeks — the file has none.
- R4. Import is allowed only when **no match has been played**; it replaces the unplayed schedule and refuses if any match is played (same guardrail as Generate/Clear).

**Team reconciliation**
- R5. Match the file's team **names** to our team records: exact (case-insensitive) auto-matches; the bye normalizes ("Bye Team" ↔ our "BYE").
- R6. Close-but-not-exact names are **suggested** in the review screen but require confirmation; unmatched names get a manual "map to our team" picker. No fuzzy match is ever applied silently.
- R7. Every file team maps 1:1 to one of our teams (counts must match) before import can proceed.

**Review → accept / cancel**
- R8. A **review stage** shows the resolved team mapping and the resulting week-by-week matchups **before anything is written**; accept or cancel, and cancel writes nothing.
- R9. On accept, matchups are created: home/away per the `@`, match order per the cell's position, each match's venue = the **home team's** venue, tables by our existing logic.

**Validation / errors**
- R10. If the file's week count ≠ our regular-week count, a team can't be mapped, counts differ, the file is malformed, or any match is played, import **stops with a clear message and writes nothing**.

## Success Criteria
- An operator with teams + weeks set up can upload an LMS export (or his edited sample) and, after confirming the mapping, have our matchups match the file exactly — same pairings + home/away each week.
- **Round-trip holds:** export → import into a fresh season with the same teams reproduces the same matchups.
- No import overwrites played results or silently mis-maps a team.

## Scope Boundaries
- Not importing venues, tables, dates, scores, handicaps — supplied from our own data.
- Not creating teams, players, or season weeks from the file — operator prerequisites.
- Not a general spreadsheet importer — only the two-sheet LMS format we export.

## Key Decisions
- **Import = file-sourced matchup generation**, reusing the matchups flow + guardrails.
- **Sample carries our real team names**, so reconciliation is near-automatic and non-LMS operators can use it too.
- **Teams & weeks must pre-exist**; **review-before-write** with explicit accept/cancel; **home/away from `@`** → home team's venue.

## Build Status (feasibility PROVEN — building now, not deferred)
- DONE: xlsx **reader** `src/utils/xlsx/readXlsx.ts` (resolves the shared-strings table LMS uses) — validated against the operator's real `schedule.xlsx`. Tests in `src/utils/xlsx/__tests__/readXlsx.test.ts`.
- DONE: `src/utils/lmsImport/parseLmsSchedule.ts` — raw sheets → `{teams, weeks}` with validation. Tests alongside.
- TODO: team reconciliation (names → our teams), match-row builder (parsed → `MatchInsertData[]` via our ordered weeks), write path (reuse `insertMatches` in `src/utils/scheduleGenerator.ts`), the import/review UI + source-choice + sample-download button.

## Dependencies / Assumptions
- Reuses `fflate` + `src/utils/xlsx/` (writer for the sample, reader for import) and `insertMatches`.
- The file is self-describing (Teams sheet = number→name), so import keys on **names**, never our internal `schedule_position`.

## Outstanding Questions

### Deferred to Planning
- [Affects R0][Technical] Where the import entry point + source-choice live (schedule-setup page vs matchups page).
- [Affects R6][Technical] "Close name" matching approach (normalized compare vs edit-distance) — keep minimal; the review screen is the safety net.

## Next Steps
Building incrementally on `feat/lms-schedule-import` (stacked on `feat/lms-schedule-export`). Reader + parser done; reconciliation + write + UI next.
