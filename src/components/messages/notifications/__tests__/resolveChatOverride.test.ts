/**
 * @fileoverview Tests for the "is a higher level already overruling this chat?"
 * logic.
 *
 * This is what stops the per-chat switch from lying. Under the veto rule a chat
 * can only add silence, so turning one on while the master switch is off does
 * nothing — and silently doing nothing is the most likely way this feature
 * reads as broken.
 */

import { describe, it, expect } from 'vitest';
import { effectiveInterval, resolveChatOverride } from '../resolveChatOverride';

/** Everything above this chat allowing it — tests override one field at a time. */
const ALLOWED = {
  masterEnabled: true,
  quietHoursConfigured: false,
  kindIsLive: true,
  kindEnabled: true,
  kindIntervalMinutes: 5,
  kindLabel: 'Team chats',
};

describe('resolveChatOverride', () => {
  it('reports no override when every level allows it', () => {
    const result = resolveChatOverride(ALLOWED);
    expect(result.isOverruled).toBe(false);
    expect(result.message).toBeNull();
  });

  it('flags the master switch being off', () => {
    const result = resolveChatOverride({ ...ALLOWED, masterEnabled: false });
    expect(result.isOverruled).toBe(true);
    expect(result.message).toMatch(/off for your account/i);
  });

  it('flags the kind being muted, and names it', () => {
    const result = resolveChatOverride({ ...ALLOWED, kindEnabled: false });
    expect(result.isOverruled).toBe(true);
    expect(result.message).toContain('Team chats');
    expect(result.message).toMatch(/notification settings/i);
  });

  it('flags a kind that cannot push at all yet', () => {
    const result = resolveChatOverride({ ...ALLOWED, kindIsLive: false });
    expect(result.isOverruled).toBe(true);
    expect(result.message).toMatch(/don't send notifications yet/i);
  });

  it('reports the OUTERMOST cause when several levels are off', () => {
    // Telling someone their team-chat default is off, while their master switch
    // is also off, sends them to fix the wrong thing first.
    const result = resolveChatOverride({
      ...ALLOWED,
      masterEnabled: false,
      kindEnabled: false,
    });
    expect(result.message).toMatch(/off for your account/i);
  });

  it('does NOT treat quiet hours as an override', () => {
    // Quiet hours are temporary and expected. "You won't get this" would be
    // wrong for the rest of the day.
    const result = resolveChatOverride({ ...ALLOWED, quietHoursConfigured: true });
    expect(result.isOverruled).toBe(false);
  });

  it('passes the kind interval through, so the UI has a floor to show', () => {
    const result = resolveChatOverride({ ...ALLOWED, kindIntervalMinutes: 15 });
    expect(result.kindIntervalMinutes).toBe(15);
  });
});

describe('effectiveInterval — a chat may be quieter, never louder', () => {
  it('takes the chat value when it is longer', () => {
    expect(effectiveInterval(5, 30)).toBe(30);
  });

  it('ignores a chat value shorter than the kind default', () => {
    // The whole MAX rule in one case: set 5 against a 15-minute default and 15
    // still wins.
    expect(effectiveInterval(15, 5)).toBe(15);
  });

  it('falls back to the kind default when the chat sets nothing', () => {
    expect(effectiveInterval(5, null)).toBe(5);
  });

  it('uses the chat value when the kind imposes none', () => {
    expect(effectiveInterval(null, 20)).toBe(20);
  });

  it('is null when neither imposes one — how a DM always buzzes', () => {
    expect(effectiveInterval(null, null)).toBeNull();
  });
});
