/**
 * @fileoverview Unit tests for buildWinCalcConfig — the win_condition → dial mapping.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildWinCalcConfig } from '../configs';

describe('buildWinCalcConfig', () => {
  afterEach(() => vi.restoreAllMocks());

  it("maps 'games' to a met_goal games comparator", () => {
    expect(buildWinCalcConfig('games')).toEqual({
      order: ['games'],
      games: { mode: 'met_goal' },
    });
  });

  it("maps 'points' to points-most then games-most", () => {
    expect(buildWinCalcConfig('points')).toEqual({
      order: ['points', 'games'],
      points: { mode: 'most' },
      games: { mode: 'most' },
    });
  });

  it('falls back to the games config (with one warning) for an unknown value', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const cfg = buildWinCalcConfig('bogus');
    expect(cfg).toEqual({ order: ['games'], games: { mode: 'met_goal' } });
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
