# 🔀 Merge guide — open PR round (2026-05-29)

A merge aid for the current **18 open PRs**: a safe order + the conflicts to
expect + how to resolve each. Built from file-overlap analysis (which PRs touch
which files) — so the *additive* calls are safe bets, and the one spot that needs
a human eye is flagged. Not a line-by-line merge simulation.

> One-time aid for this round — not a permanent doc. Delete when done.

---

## ⚠️ Stacks — merge bottom-up, in order (out-of-order = breakage)

- **Pairings:** **#149** → **#152**
- **Live-scoring / many-eyes:** **#143** → **#147** → **#155** → **#156** → **#157**

Each PR in a stack is based on the one before it, so the base must land first.

## ⚠️ The conflict magnet: #136

`#136 chore/stack-test-plan` — **111 files**, consolidates #120–123. It collides
with five other PRs (Standings, NavRoutes, the two nav test files, the dev seed,
the BCA doc). **Merge it LAST** so it does *one* careful rebase over everything,
instead of forcing five separate small rebases.

---

## Recommended order (low-risk first, stacks intact, #136 last)

| Step | PR | Notes / conflict |
|------|----|------------------|
| 1 | **#151** relax `match_games` CHECK | 1 migration file, isolated |
| 2 | **#154** break-indicator cleanup | 1 file, isolated |
| 3 | **#145** BCA pitch doc | creates the doc — **before #136** (it carries a stale copy) |
| 4 | **#158** nav test fixes | the 2 nav test files — **before #136** (these are the correct ones) |
| 5 | **#160** onboarding brainstorm + plan | docs + TOC only |
| 6 | **#150** lineup substitute seeds | dev seed file (vs #136) |
| 7 | **#153** handicap calculator | TOC + NavRoutes (additive) |
| 8 | **#159** passwordless sign-in | TOC only (its `src/login/*` files are new) |
| 9 | **#148** audit final batch | `Standings.tsx` (vs #136) |
| 10 | **#149 → #152** | pairings stack (in order) |
| 11 | **#143 → #147 → #155 → #156 → #157** | live-scoring / many-eyes stack (in order) |
| 12 | **#136** | the big one, last — rebase over all of the above |

*(Order steps 1–9 are flexible among themselves; the point is: independent/docs/small
first, stacks as units, #136 last.)*

---

## Conflicts → how to resolve

| File | PRs that collide | Resolution |
|------|------------------|------------|
| `TABLE_OF_CONTENTS.md` | #160, #159, #153, #149, #143 | **Trivial.** Each adds rows + bumps the "Last Updated" line. Keep **all** rows from both sides; take the **newest** date. Same fix every time. |
| `PageHeader.test.tsx`, `AppDrawer.test.tsx` | #158 vs #136 | **Keep #158's version** — the verified-green nav-redesign fixes. #136's copies are stale. |
| `src/navigation/NavRoutes.tsx` | #153 vs #136 | **Additive** — keep both sides' route entries. |
| `database/dev_seed_full.sql`, `dev_bootstrap_full.sql` | #150 vs #136 | **Additive** — keep both sides' seed rows. |
| `LIST_FOR_JACK.md`, `LIST_FOR_ED.md` | #145, #143 | **Additive** — keep both. |
| `docs/brainstorms/2026-05-17-bca-pitch-strategy.md` | #145 vs #136 | **Keep #145's** (the canonical doc). |
| `src/pages/Standings.tsx` | #148 vs #136 | **Needs a human eye** — #148 is a small audit tweak, #136 a big feature change. Take #136's version, reapply #148's tweak on top. |

---

## Notes

- The **`TABLE_OF_CONTENTS.md`** conflict recurs on almost every PR (everyone adds
  an index row). It's mechanical every time — keep all rows, newest date — so don't
  let the count alarm; none of those are real logic conflicts.
- Methodology caveat: this maps *which files overlap*, not exact line ranges. The
  additive rows above are safe; `Standings.tsx` is the only one flagged for judgment.
- **Not in this list:** the onboarding-cascade work (`feat/onboarding-cascade`) is
  not yet a PR — it sits *after* #159 (passwordless) merges, then rebases onto main.
