/**
 * @fileoverview Tests for walkupMemory — the per-tournament note in the browser.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { rememberWalkupName, recallWalkupName, forgetWalkupName } from './walkupMemory';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('walkupMemory', () => {
  it('remembers a name for the tournament it was entered on', () => {
    rememberWalkupName('jt-1', 'Rocket');
    expect(recallWalkupName('jt-1')).toBe('Rocket');
  });

  it('does not carry a name to a different tournament', () => {
    // The whole point of keying per token: tonight is not last week.
    rememberWalkupName('jt-1', 'Rocket');
    expect(recallWalkupName('jt-2')).toBeNull();
  });

  it('forgets on request', () => {
    rememberWalkupName('jt-1', 'Rocket');
    forgetWalkupName('jt-1');
    expect(recallWalkupName('jt-1')).toBeNull();
  });

  it('survives storage being unavailable', () => {
    // Private modes can throw on access rather than returning null. Spy on the
    // instance, not Storage.prototype — happy-dom's localStorage doesn't route
    // through the prototype, so a prototype spy silently never fires.
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });

    expect(() => rememberWalkupName('jt-1', 'Rocket')).not.toThrow();
    expect(recallWalkupName('jt-1')).toBeNull();
  });
});
