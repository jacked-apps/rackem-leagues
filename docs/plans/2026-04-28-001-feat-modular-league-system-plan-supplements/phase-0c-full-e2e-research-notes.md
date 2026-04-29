# Phase 0c full per-game E2E spec — research notes

**Date:** 2026-04-29
**Purpose:** Prep for the next session to ship the full 18-game scoring E2E spec
**Status:** Notes only, no code yet

## Why these notes exist

The Phase 0c plan calls for a Playwright spec that drives the actual scoring UI for all 18 games of a 3v3 match, capturing per-game intermediate state as fixtures. The existing 3v3-foundation.spec.ts is the foundation; this is the per-game capture layer.

Two things make this non-trivial:

1. **Scoring UI components have no `data-testid` hooks.** A grep across `src/components/scoring/*.tsx` returns zero `data-testid` attributes. Playwright will need to use text/role-based selectors — workable but more brittle.

2. **`getServiceClient()` cached singleton has stale-OpenAPI behavior** for newly-added RPCs. Documented in the failed prep_match spec attempt. Fix candidates: (a) use `freshServiceClient()` per test for RPC-heavy specs; (b) refactor `serviceClient.ts` to expose a `refresh()` method; (c) document the issue and use the per-test fresh-client pattern.

## Scoring UI map (research findings)

Key components:

- `src/components/scoring/ScoringDialog.tsx` — modal that captures one game's outcome. Title: "Select Game Winner". Has a "Game {N}" header. Toggles: break-fouled, win-by-forfeit, break-and-run, golden-break, runout.
- `src/components/scoring/ThreeVThreeScoreboard.tsx` — running scoreboard for 3v3 (213 lines)
- `src/components/scoring/FiveVFiveScoreboard.tsx` — 5v5 running scoreboard
- `src/components/scoring/TenSevenScoreboard.tsx` — Fargo 10-7 running scoreboard
- `src/components/scoring/MatchEndVerification.tsx` — final verification flow (657 lines)
- `src/components/scoring/GameButtonRow.tsx` / `GamesList.tsx` — game-list UI
- `src/components/scoring/EditGameDialog.tsx` — edit a previously-scored game
- `src/components/scoring/ConfirmationDialog.tsx` / `ConfirmationModal.tsx` — confirmation flows

**Recommendation for the spec:** open the lineup page, lock the lineup (which fires prep_match), then for each game number 1..18:
1. Click the game button (somehow — likely text-based "Game N" or position in list)
2. Wait for ScoringDialog to open
3. Click winner (home team name or away team name button)
4. Submit the form
5. Query DB for current `match_games` rows + matches.home_team_score / away_team_score
6. Append to fixture array
7. Move to next game

After all 18 games, navigate to MatchEndVerification page; verify final result matches expected. This is the big lock for the user's "make sure the numbers match as each game is being recorded" requirement.

## Lineup-locking flow

Captain (home or away) populates 3 player slots, clicks lock button. The other captain confirms. When both sides are locked, `prep_match` RPC fires, which writes thresholds and creates 18 match_games rows. The lock button text and selector pattern need to be identified — search `src/player/MatchLineup.tsx` for the relevant Button component.

## Service-client RPC stale-cache fix options

When the spec needs to call `prep_match` directly (to bypass the lineup UI for a deterministic test), use this pattern:

```typescript
import { createClient } from '@supabase/supabase-js';
const LOCAL_URL = 'http://127.0.0.1:54321';
const LOCAL_SERVICE_KEY = 'eyJhbGciOi...';  // from serviceClient.ts comment
function freshServiceClient() {
  return createClient(LOCAL_URL, LOCAL_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
```

Don't use the cached `getServiceClient()` for RPC calls in newly-added specs. The cached singleton holds an OpenAPI spec from first connection, which can miss newly-added DB functions.

## What to write next session

1. `tests/e2e/characterization/3v3-lineup-and-prep.spec.ts` — locks the lineup-fill → lock → prep_match flow end-to-end. Asserts the matches row got the expected thresholds for a known set of player handicaps.

2. `tests/e2e/characterization/3v3-full-match.spec.ts` — drives all 18 games via the scoring UI, captures per-game state. Uses the foundation factory + a deterministic game-outcome sequence (e.g., home wins games 1-12, away wins 13-15, ties 16-18 → triggers tiebreaker).

3. Optionally: `tests/e2e/characterization/5v5-full-match.spec.ts` and `fargo-5v5-full-match.spec.ts` — same pattern for the other two systems.

## Recommended sequence for next session

1. Add `data-testid` attributes to the 6-8 critical scoring UI elements. Tiny, low-risk, makes specs robust.
2. Write the `3v3-lineup-and-prep.spec.ts` first — it's smaller and surfaces the lineup-UI selectors.
3. Write the `3v3-full-match.spec.ts` second — builds on the lineup pattern.
4. Run all three foundation/lineup/full-match specs together as the locked Phase 0c suite.
