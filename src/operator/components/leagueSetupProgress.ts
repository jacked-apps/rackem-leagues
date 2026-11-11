/**
 * @fileoverview Pure derivation of a league's setup progress + step states.
 *
 * Extracted from `LeagueStatusCard` so the "which step is done / which is the
 * current next step / what % complete" logic is unit-testable without the
 * component's supabase fetches.
 *
 * The setup flow has FIVE ordered stages (mirrors Wizard 2.0):
 *   1. Create the season
 *   2. Set up the weekly schedule
 *   3. Add teams + captains
 *   4. Generate the matchups
 *   5. Activate the season  ← previously uncounted, which made the progress bar
 *                              read 100% while step 5 was still open
 *
 * Counting activation as the real 5th step is what makes the progress bar and
 * the Next-Steps checklist agree: four-of-five done = 80% with step 5 as the
 * highlighted "do this next", not 100% with a contradictory open step.
 */

export interface SetupState {
  readonly seasonCount: number;
  readonly scheduleExists: boolean;
  readonly teamCount: number;
  readonly matchupsExist: boolean;
  /** True once the season's status is 'active' (the activation step is done). */
  readonly isActive: boolean;
}

export interface SetupProgress {
  /** Per-stage completion, index 0..4 matching the five ordered stages. */
  readonly stepsDone: readonly boolean[];
  /** Index of the first incomplete stage, or -1 when every stage is done. */
  readonly firstIncompleteIndex: number;
  /** Whole-number percent complete across all five stages. */
  readonly percent: number;
  /** True when all five stages (including activation) are complete. */
  readonly allComplete: boolean;
}

const STAGE_COUNT = 5;

/**
 * Derive the five-stage completion vector, the current (first incomplete)
 * stage, and the percent complete from already-fetched league counts.
 */
export function deriveSetupProgress(state: SetupState): SetupProgress {
  const stepsDone: boolean[] = [
    state.seasonCount > 0,
    state.scheduleExists,
    state.teamCount > 0,
    state.matchupsExist,
    state.isActive,
  ];

  const firstIncompleteIndex = stepsDone.findIndex((done) => !done);
  const doneCount = stepsDone.filter(Boolean).length;
  const percent = Math.round((doneCount / STAGE_COUNT) * 100);

  return {
    stepsDone,
    firstIncompleteIndex,
    percent,
    allComplete: firstIncompleteIndex === -1,
  };
}
