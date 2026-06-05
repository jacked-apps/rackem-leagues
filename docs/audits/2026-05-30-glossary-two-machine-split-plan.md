# Glossary Review — Two-Machine Parallel Work Protocol

**Date:** 2026-05-30
**Owner:** Ed (one human, two machines, two Claudes)
**Purpose:** Let the PC Claude and the Mac Claude work the glossary review **in parallel** without git conflicts, doing the **identical** job. Hand this file to the PC Claude so both sides are on exactly the same page.

---

## The setup

- **One human (Ed)** drives both machines. Two Claudes, two branches.
- **PC branch:** `feat/operator-help-phase-1` (the existing branch). **Owns `src/glossary/entries/general.tsx`** — the keystone container concepts (league, season, match, matchup, game, etc.).
- **Mac branch:** `feat/operator-help-phase-1-mac` (branched from the current pushed HEAD of the PC branch). **Owns the four smaller category files**, worked in this order:
  1. `src/glossary/entries/standings.tsx` (start here — smallest, fewest keystone dependencies)
  2. `src/glossary/entries/match-format.tsx`
  3. `src/glossary/entries/scoring.tsx`
  4. `src/glossary/entries/handicap.tsx`

### The iron rule

**Each file has exactly ONE owner.** PC never edits the Mac's four files; Mac never edits `general.tsx`. This single rule is what makes every merge conflict-free — git only conflicts when both branches change the same lines, and that can never happen if neither side touches the other's files.

---

## File ownership

| File | Owner | Notes |
|---|---|---|
| `entries/general.tsx` | **PC** | Keystone container concepts. Mac only *reads* this. |
| `entries/standings.tsx` | **Mac** | First up. |
| `entries/match-format.tsx` | **Mac** | |
| `entries/scoring.tsx` | **Mac** | |
| `entries/handicap.tsx` | **Mac** | |

### Shared files — DO NOT both edit

These are stable during a content-review pass. If either side genuinely needs to change one, **relay through Ed first** so only one machine touches it:

- `src/glossary/index.tsx` — the aggregator/registry that imports every category file.
- `src/glossary/types.ts` — the `GlossaryEntry` schema contract.
- `docs/audits/*.md` — the seed walkthrough, the maintenance cadence, and this plan are **read-only reference**.

---

## The keystone-relay protocol (the ONLY routine coordination point)

When the **Mac** is reviewing one of its files and needs a keystone that lives in `general.tsx` — e.g. to add an in-body `<a href="#slug">` link, a "Relevant topics:" entry, or a `related` edge — it cannot edit `general.tsx` itself. Instead:

1. **Mac → Ed:** "Need keystone `<name>`, slug `<slug>`, in `general.tsx`" (plus what it should say).
2. **Ed → PC Claude:** PC adds/edits it in `general.tsx`, commits, **pushes** `feat/operator-help-phase-1`.
3. **Ed → Mac:** Mac runs `git fetch origin && git merge origin/feat/operator-help-phase-1` to pull the keystone into its branch.
4. **Mac** adds the link in its own file and continues.

**Direction is one-way: PC *writes* `general.tsx`, Mac only *reads* it.** Never both write. That's what keeps it clean.

---

## The review process (identical on both sides)

Follow `docs/audits/2026-05-29-glossary-maintenance-cadence.md`. For each entry in an owned file:

1. Open `/learn#<slug>` in the browser and read the rendered `shortDef` + `longDef`.
2. **Apply Ed's red-pen notes** from `docs/audits/2026-05-28-glossary-seed-walkthrough.md` wherever they touch entries in this file.
3. Check each entry:
   - **Accurate** (matches how the app actually behaves and the locked L1 canon in `docs/league-system/`).
   - **Clear** — `shortDef` is 1–2 plain-English sentences (popover form); rich detail lives in `longDef`.
   - **NO DRIFT** — never tie a definition to a preset name (e.g. "used by 5v5 Standard"). Describe what the thing *is*. Preset names can change, and tying breaks the definition and falsely limits where the concept applies.
   - **Links resolve** — every in-body `<a href="#slug">` points at a real entry.
   - **"Relevant topics:" menu** present in `longDef` when there are multiple in-body links.
   - **`related`** = edge concepts *not* mentioned in the body (no duplication of in-body links).
4. Run `pnpm glossary:verify` to confirm no L1 anchors broke (this only catches broken anchors, **not** content rot — humans catch content rot).

### `reviewedByEd` is Ed's call ONLY

`reviewedByEd` (ISO date) means **Ed personally approved the rendered entry as accurate and clear.** Neither Claude self-approves. A Claude *proposes* ("this reads right" / "this needs X") and *fixes* the mechanics; **Ed** makes the accuracy call and **Ed** sets `reviewedByEd` to today. If a Claude edits a previously-reviewed entry, it **clears or flags** the marker — never silently keeps it.

---

## Sync ritual

- **Before leaving a machine:** commit + push.
- **Mac, on arriving or after a keystone relay:** `git fetch origin && git merge origin/feat/operator-help-phase-1` (pulls in PC's keystone work — clean, because Mac never edits `general.tsx`).
- The PC doesn't need the Mac's files mid-work; it only pulls the Mac branch at merge-back time.

---

## Merge-back at the end

When both file-sets are done, the Mac branch merges into the PC branch
(`git merge origin/feat/operator-help-phase-1-mac` from the PC side) — **conflict-free because the changed files are disjoint** — or both branches PR up separately. Jack does the actual merge.

---

## Tooling cheat-sheet

- `pnpm glossary:progress` — list reviewed vs unreviewed entries.
- `pnpm glossary:verify` — L1-anchor drift audit (broken anchors only).
- `/learn#<slug>` — the rendered entry in the browser.
