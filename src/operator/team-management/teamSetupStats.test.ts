/* eslint-disable @typescript-eslint/no-explicit-any -- test fixtures use minimal `as any` shapes */
/**
 * @fileoverview Tests for computeTeamSetupStats — the Manage Teams capacity rules.
 */

import { describe, it, expect } from 'vitest';
import { computeTeamSetupStats } from './teamSetupStats';

const lv = (capacity: number) => ({ capacity } as any);
const team = (status?: string) => ({ status } as any);

describe('computeTeamSetupStats', () => {
  it('no venues → not in-house, not traveling, max 0', () => {
    const s = computeTeamSetupStats([], []);
    expect(s).toMatchObject({
      isInHouse: false,
      isTraveling: false,
      totalCapacity: 0,
      maxTeams: 0,
      isAtMaxTeams: false,
      hasBye: false,
    });
  });

  it('one venue → in-house, max = 2× tables', () => {
    const s = computeTeamSetupStats([lv(4)], []);
    expect(s.isInHouse).toBe(true);
    expect(s.isTraveling).toBe(false);
    expect(s.totalCapacity).toBe(4);
    expect(s.maxTeams).toBe(8);
  });

  it('multiple venues → traveling, max = total tables', () => {
    const s = computeTeamSetupStats([lv(3), lv(2)], []);
    expect(s.isTraveling).toBe(true);
    expect(s.isInHouse).toBe(false);
    expect(s.totalCapacity).toBe(5);
    expect(s.maxTeams).toBe(5);
  });

  it('falls back to available_table_numbers length when capacity is absent', () => {
    const s = computeTeamSetupStats([{ available_table_numbers: [1, 2, 3] } as any], []);
    expect(s.totalCapacity).toBe(3);
    expect(s.maxTeams).toBe(6); // in-house
  });

  it('isAtMaxTeams true only when teams >= max and max > 0', () => {
    expect(computeTeamSetupStats([lv(1)], [team(), team()]).isAtMaxTeams).toBe(true); // 2 >= 2
    expect(computeTeamSetupStats([lv(1)], [team()]).isAtMaxTeams).toBe(false); // 1 < 2
    expect(computeTeamSetupStats([], [team()]).isAtMaxTeams).toBe(false); // max 0
  });

  it('hasBye true when any team has status bye', () => {
    expect(computeTeamSetupStats([lv(2)], [team('active'), team('bye')]).hasBye).toBe(true);
    expect(computeTeamSetupStats([lv(2)], [team('active')]).hasBye).toBe(false);
  });
});
