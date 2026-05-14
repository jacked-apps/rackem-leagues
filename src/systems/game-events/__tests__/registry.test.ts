/**
 * @fileoverview Tests for the game-events registry runtime — registration,
 * lookup, listing, clearing, and self-registration via
 * `registerSeedGameEvents`.
 *
 * Mirrors the calculator-registry test pattern: hermetic setup via
 * `clearRegistry()` + `registerSeedGameEvents()` in `beforeEach`.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getGameEvent,
  listGameEvents,
  registerGameEvent,
  registerSeedGameEvents,
  clearRegistry,
} from '../index';
import { breakAndRun } from '../definitions/break_and_run';
import type { GameEventDefinition } from '../types';

describe('game-events registry', () => {
  beforeEach(() => {
    clearRegistry();
    registerSeedGameEvents();
  });

  describe('getGameEvent', () => {
    it('returns the registered definition for a known name', () => {
      const event = getGameEvent('break_and_run');
      expect(event).not.toBeNull();
      expect(event?.name).toBe('break_and_run');
      expect(event?.label).toBe('Break and Run');
    });

    it('returns null for an unregistered name', () => {
      expect(getGameEvent('nonexistent_event')).toBeNull();
    });

    it('returns null for null/undefined input without throwing', () => {
      expect(getGameEvent(null)).toBeNull();
      expect(getGameEvent(undefined)).toBeNull();
    });
  });

  describe('listGameEvents', () => {
    it('returns all 8 seed definitions after self-registration', () => {
      const events = listGameEvents();
      expect(events).toHaveLength(8);
    });

    it('includes all expected seed event names', () => {
      const names = listGameEvents().map(e => e.name);
      expect(names).toEqual(
        expect.arrayContaining([
          'break_and_run',
          'golden_break',
          'runout',
          'win_by_forfeit',
          'break_fouled',
          'early_8',
          'scratch_on_8',
          'eight_wrong_pocket',
        ]),
      );
    });
  });

  describe('registerGameEvent', () => {
    it('throws on duplicate registration', () => {
      // 'break_and_run' is already registered via registerSeedGameEvents.
      expect(() => registerGameEvent(breakAndRun)).toThrow(/Duplicate registration/);
    });

    it('registers a new event with a unique name', () => {
      const customEvent: GameEventDefinition = {
        name: 'custom_test_event',
        label: 'Custom Test',
        gameTypes: ['eight_ball'],
        attributedTo: 'winner',
        enabledByDefault: { eight_ball: false, nine_ball: false, ten_ball: false },
      };
      registerGameEvent(customEvent);
      expect(getGameEvent('custom_test_event')).toEqual(customEvent);
    });
  });

  describe('clearRegistry', () => {
    it('empties the registry', () => {
      clearRegistry();
      expect(listGameEvents()).toHaveLength(0);
      expect(getGameEvent('break_and_run')).toBeNull();
    });
  });

  describe('registerSeedGameEvents', () => {
    it('is idempotent — second call does not throw or duplicate', () => {
      // beforeEach already called once; calling again should be a no-op.
      expect(() => registerSeedGameEvents()).not.toThrow();
      expect(listGameEvents()).toHaveLength(8);
    });

    it('repopulates after clearRegistry', () => {
      clearRegistry();
      expect(listGameEvents()).toHaveLength(0);
      registerSeedGameEvents();
      expect(listGameEvents()).toHaveLength(8);
    });
  });
});
