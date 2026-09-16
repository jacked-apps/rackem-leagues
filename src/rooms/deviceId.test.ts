/**
 * @fileoverview Tests for the device id (a Game Room seat is a device).
 *
 * Pins: minted once and stable across calls and a simulated reload; a fresh
 * storage yields a new id; a throwing storage still returns a stable id for
 * the page load instead of crashing the room.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

async function freshModule() {
  vi.resetModules();
  return import('./deviceId');
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('getDeviceId', () => {
  it('mints a uuid once and returns the same one on every call', async () => {
    const { getDeviceId } = await freshModule();
    const a = getDeviceId();
    expect(a).toMatch(UUID);
    expect(getDeviceId()).toBe(a);
    expect(getDeviceId()).toBe(a);
  });

  it('survives a reload: a fresh module instance reads the stored id back', async () => {
    const first = (await freshModule()).getDeviceId();
    const second = (await freshModule()).getDeviceId();
    expect(second).toBe(first);
  });

  it('a fresh storage (new browser) yields a different id', async () => {
    const first = (await freshModule()).getDeviceId();
    localStorage.clear();
    const second = (await freshModule()).getDeviceId();
    expect(second).toMatch(UUID);
    expect(second).not.toBe(first);
  });

  it('a throwing storage still returns one stable id for this page load', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const { getDeviceId } = await freshModule();
    const a = getDeviceId();
    expect(a).toMatch(UUID);
    expect(getDeviceId()).toBe(a);
  });
});
