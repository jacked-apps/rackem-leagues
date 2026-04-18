/**
 * @fileoverview Tests for the SystemModule resolver
 *
 * Verifies that pickModule() routes each documented `handicap_type` value to
 * the correct SystemModule and that unmapped/null/empty values fall back to
 * bca5v5 with a console warning (matching the legacy default routing of
 * getGamesNeeded() in src/utils/handicap/index.ts).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pickModule } from '../resolver';

describe('pickModule', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('mapped handicap types', () => {
    it('routes "points" to bca3v3', () => {
      const mod = pickModule('points');
      expect(mod.key).toBe('bca3v3');
    });

    it('routes "percentage" to bca5v5', () => {
      const mod = pickModule('percentage');
      expect(mod.key).toBe('bca5v5');
    });

    it('routes "fargo" to fargo5v5', () => {
      const mod = pickModule('fargo');
      expect(mod.key).toBe('fargo5v5');
    });
  });

  describe('unmapped values fall back to bca5v5 with a warning', () => {
    it('falls back on an unknown string', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const mod = pickModule('something_unrecognized');
      expect(mod.key).toBe('bca5v5');
      expect(warnSpy).toHaveBeenCalledOnce();
      expect(warnSpy.mock.calls[0][0]).toContain('Unmapped handicap_type');
    });

    it('falls back on null', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const mod = pickModule(null);
      expect(mod.key).toBe('bca5v5');
      expect(warnSpy).toHaveBeenCalledOnce();
    });

    it('falls back on undefined', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const mod = pickModule(undefined);
      expect(mod.key).toBe('bca5v5');
      expect(warnSpy).toHaveBeenCalledOnce();
    });

    it('falls back on empty string', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const mod = pickModule('');
      expect(mod.key).toBe('bca5v5');
      expect(warnSpy).toHaveBeenCalledOnce();
    });
  });

  describe('returned modules expose expected teamFormat constants', () => {
    it('bca3v3 is 3v3 double round robin', () => {
      const mod = pickModule('points');
      expect(mod.teamFormat).toEqual({
        lineupSize: 3,
        maxRosterSize: 5,
        gameGeneration: 'double_round_robin',
      });
    });

    it('bca5v5 is 5v5 single round robin', () => {
      const mod = pickModule('percentage');
      expect(mod.teamFormat).toEqual({
        lineupSize: 5,
        maxRosterSize: 8,
        gameGeneration: 'single_round_robin',
      });
    });

    it('fargo5v5 is 5v5 single round robin with manual rating entry', () => {
      const mod = pickModule('fargo');
      expect(mod.teamFormat).toEqual({
        lineupSize: 5,
        maxRosterSize: 8,
        gameGeneration: 'single_round_robin',
      });
      expect(mod.rating.requiresManualEntry).toBe(true);
    });

    it('BCA modules do not require manual rating entry', () => {
      expect(pickModule('points').rating.requiresManualEntry).toBe(false);
      expect(pickModule('percentage').rating.requiresManualEntry).toBe(false);
    });
  });

  describe('returned modules expose expected scoring method', () => {
    it('BCA modules use games_won_with_team_bonus', () => {
      expect(pickModule('points').scoring.method).toBe('games_won_with_team_bonus');
      expect(pickModule('percentage').scoring.method).toBe('games_won_with_team_bonus');
    });

    it('Fargo module uses points_accumulated', () => {
      expect(pickModule('fargo').scoring.method).toBe('points_accumulated');
    });
  });

  describe('returned modules expose expected threshold mode', () => {
    it('BCA modules use games_to_win threshold mode', () => {
      expect(pickModule('points').threshold.mode).toBe('games_to_win');
      expect(pickModule('percentage').threshold.mode).toBe('games_to_win');
    });

    it('Fargo module uses start_points threshold mode', () => {
      expect(pickModule('fargo').threshold.mode).toBe('start_points');
    });
  });
});
