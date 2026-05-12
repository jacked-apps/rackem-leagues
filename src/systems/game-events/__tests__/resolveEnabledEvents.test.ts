/**
 * @fileoverview Tests for `resolveEnabledEvents` — the registry-default plus
 * cascade-override layering used by the modal to decide which events render.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  clearRegistry,
  registerSeedGameEvents,
  resolveEnabledEvents,
} from '../index';

describe('resolveEnabledEvents', () => {
  beforeEach(() => {
    clearRegistry();
    registerSeedGameEvents();
  });

  describe('Registry defaults — BCA Standard rules', () => {
    it('eight_ball with empty cascade matches BCA Standard rules', () => {
      const enabled = resolveEnabledEvents({}, 'eight_ball');
      // BCA Standard: B&R, Runout, Win by Forfeit, Break Foul enabled by
      // default. Golden Break is NOT in BCA Standard for 8-ball — LO opts
      // in via the modal's edit mode if their league counts it.
      // Net-new events (early_8, scratch_on_8, eight_wrong_pocket) ship
      // dormant; activated via the modal edit mode.
      expect(enabled).toEqual(
        new Set([
          'break_and_run',
          'runout',
          'win_by_forfeit',
          'break_fouled',
        ]),
      );
    });

    it('eight_ball with golden_break override enables it', () => {
      // LO who runs a league that DOES count golden break toggles it on
      // via edit mode. Cascade override flips the default.
      const enabled = resolveEnabledEvents({ golden_break: true }, 'eight_ball');
      expect(enabled.has('golden_break')).toBe(true);
    });

    it('nine_ball with empty cascade enables only events that apply to 9-ball', () => {
      const enabled = resolveEnabledEvents({}, 'nine_ball');
      // 8-ball-only events (golden_break, runout, early_8, scratch_on_8, eight_wrong_pocket) excluded by gameTypes filter.
      expect(enabled).toEqual(
        new Set(['break_and_run', 'win_by_forfeit', 'break_fouled']),
      );
    });

    it('ten_ball with empty cascade enables the same shape as 9-ball', () => {
      const enabled = resolveEnabledEvents({}, 'ten_ball');
      expect(enabled).toEqual(
        new Set(['break_and_run', 'win_by_forfeit', 'break_fouled']),
      );
    });

    it('Phase 1 net-new events stay dormant by default everywhere', () => {
      for (const gameType of ['eight_ball', 'nine_ball', 'ten_ball'] as const) {
        const enabled = resolveEnabledEvents({}, gameType);
        expect(enabled.has('early_8')).toBe(false);
        expect(enabled.has('scratch_on_8')).toBe(false);
        expect(enabled.has('eight_wrong_pocket')).toBe(false);
      }
    });
  });

  describe('cascade overrides', () => {
    it('explicit false in cascade hides an event that was on by default', () => {
      const enabled = resolveEnabledEvents({ runout: false }, 'eight_ball');
      expect(enabled.has('runout')).toBe(false);
      // Other defaults preserved.
      expect(enabled.has('break_and_run')).toBe(true);
    });

    it('explicit true in cascade enables an event that was off by default (Phase 2 path)', () => {
      const enabled = resolveEnabledEvents({ early_8: true }, 'eight_ball');
      expect(enabled.has('early_8')).toBe(true);
    });

    it('cascade override does NOT bypass the gameTypes filter', () => {
      // golden_break is 8-ball-only; setting it true on 9-ball still excludes it.
      const enabled = resolveEnabledEvents({ golden_break: true }, 'nine_ball');
      expect(enabled.has('golden_break')).toBe(false);
    });

    it('absent keys in cascade fall back to registry default (inherit)', () => {
      const enabled = resolveEnabledEvents({}, 'eight_ball');
      expect(enabled.has('break_and_run')).toBe(true); // registry default true
      expect(enabled.has('early_8')).toBe(false); // registry default false
    });
  });

  describe('edge cases', () => {
    it('empty registry returns empty set, no throw', () => {
      clearRegistry();
      expect(resolveEnabledEvents({}, 'eight_ball')).toEqual(new Set());
    });

    it('cascade map references unknown event names are silently ignored', () => {
      // Unknown event names in the cascade have no effect — they're not in
      // the registry, so they never appear in the iterated event list.
      const enabled = resolveEnabledEvents({ nonexistent_event: true }, 'eight_ball');
      expect(enabled.has('nonexistent_event')).toBe(false);
    });
  });
});
