# ⚠️ Merge status: `feat/lo-match-review-correction` → `main`

This is an **integration branch**, not a finished merge. Read before merging to main.

## Done (Claude) — the 3 additive / notes conflicts
Reconciled by hand, safe to take as-is:
- `src/navigation/NavRoutes.tsx` — additive: kept BOTH the `Learn` lazy-import (main #163) and the
  LO lazy-imports. Route blocks merged cleanly on their own.
- `LIST_FOR_ED.md` — union of the two distinct notes.
- `TABLE_OF_CONTENTS.md` — union of both sides' index rows; took our (superset) version of the
  `pendingConfirmations.ts` bullet to avoid duplication. **Regenerate the TOC after merge** to tidy the
  "Last Updated" header (both lines kept).

## ⚠️ PROVISIONAL — the 8 scoring-engine conflicts (NEEDS JACK)
Git can't commit a partial merge, so these were defaulted to **the branch version** (the conflict-map
recommendation: branch = #143 + the later many-eyes amendments). **This is NOT a verified resolution.**
Please diff each against main's `#143` before trusting it — confirm main has no post-#143 hotfix the
branch lacks:

- `src/utils/match/pendingConfirmations.ts`  (+ its test)
- `src/hooks/useMatchScoring.ts`
- `src/hooks/useMatchScoringMutations.ts`
- `src/player/ScoreMatch.tsx`
- `src/realtime/useMatchRealtime.ts`  (+ its test)
- `src/components/scoring/ConfirmationDialog.tsx`

To re-resolve your own way: `git checkout --conflict=merge` semantics are gone (already committed), so
diff `origin/main -- <file>` vs this branch and reconcile by hand, or reset this branch and redo the
merge taking your call on these 8.

## Note
- `MatchEndVerification.tsx` (the #169 completion-nav fix already in main) did NOT conflict — the LO
  stack never touched it.
- Migrations are additive — no conflict (`game_confirmations`, `reason`, `updating`-status all land clean).

## ⚠️ ALSO — a semantic break beyond the textual conflicts (NEEDS JACK)
The branch builds RED even after the 11 conflicts, because of a main-side **API change** that isn't a
textual conflict (so git auto-merged it silently):

- `src/utils/match/computeMatchPrepPayload.ts` imports `generateGameOrder` from `@/utils/gameOrder`.
- Main's **#149 (pairings extraction)** moved/renamed that: `@/utils/gameOrder` is gone; it's now
  `generatePairings(input: PairingsInput): GameSlot[]` in `@/systems/pairings` — **different name AND
  signature/shape**, not a path rename.
- So the LO prep payload (which feeds `prep_match`) must be adapted to the new pairings API. This is
  must-not-break code (game generation), so it needs a real port + test, not a find/replace.

Likely there are more of these once that one's fixed (tsc stops at the first import failure). Treat the
build as RED until the pairings port + the 8 engine files are done.
