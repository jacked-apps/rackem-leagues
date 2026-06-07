/**
 * @fileoverview Tests for deriveSetupProgress — the five-stage setup logic.
 *
 * Locks the fix for the "100% while a step is still open" contradiction:
 * activation is the real 5th stage, so four-of-five reads 80% with step 5 as
 * the current step — never 100% with an open activate step.
 */

import { describe, it, expect } from 'vitest';
import { deriveSetupProgress } from './leagueSetupProgress';

const NOTHING = {
  seasonCount: 0,
  scheduleExists: false,
  teamCount: 0,
  matchupsExist: false,
  isActive: false,
};

describe('deriveSetupProgress', () => {
  it('no season yet → 0%, first step is the current one', () => {
    const p = deriveSetupProgress(NOTHING);
    expect(p.percent).toBe(0);
    expect(p.firstIncompleteIndex).toBe(0);
    expect(p.allComplete).toBe(false);
    expect(p.stepsDone).toEqual([false, false, false, false, false]);
  });

  it('season created, no schedule → 20%, schedule (index 1) is current', () => {
    const p = deriveSetupProgress({ ...NOTHING, seasonCount: 1 });
    expect(p.percent).toBe(20);
    expect(p.firstIncompleteIndex).toBe(1);
    expect(p.stepsDone[0]).toBe(true);
  });

  it('all four setup stages done but NOT activated → 80%, activate (index 4) is current', () => {
    const p = deriveSetupProgress({
      seasonCount: 1,
      scheduleExists: true,
      teamCount: 6,
      matchupsExist: true,
      isActive: false,
    });
    expect(p.percent).toBe(80); // not 100 — activation still pending
    expect(p.firstIncompleteIndex).toBe(4);
    expect(p.allComplete).toBe(false);
    expect(p.stepsDone).toEqual([true, true, true, true, false]);
  });

  it('fully activated → 100%, nothing left, allComplete', () => {
    const p = deriveSetupProgress({
      seasonCount: 1,
      scheduleExists: true,
      teamCount: 6,
      matchupsExist: true,
      isActive: true,
    });
    expect(p.percent).toBe(100);
    expect(p.firstIncompleteIndex).toBe(-1);
    expect(p.allComplete).toBe(true);
  });

  it('treats the first gap as current even when a later stage is somehow done', () => {
    // Defensive: out-of-order data shouldn't mislabel the current step.
    const p = deriveSetupProgress({
      seasonCount: 1,
      scheduleExists: false,
      teamCount: 6,
      matchupsExist: false,
      isActive: false,
    });
    expect(p.firstIncompleteIndex).toBe(1); // schedule is the first gap
    expect(p.percent).toBe(40); // season + teams done
  });
});
