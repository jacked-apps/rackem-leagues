/**
 * @fileoverview Tests for push capability resolution + VAPID key conversion (Unit 5).
 */

import { describe, it, expect } from 'vitest';
import {
  resolvePushCapability,
  urlBase64ToUint8Array,
  arrayBufferToBase64Url,
  type PushEnv,
} from './pushCapability';

const baseEnv: PushEnv = {
  hasServiceWorker: true,
  hasPushManager: true,
  hasNotification: true,
  permission: 'default',
  isIOS: false,
  isStandalone: false,
};

describe('resolvePushCapability', () => {
  it('is supported on a capable browser with permission not denied', () => {
    expect(resolvePushCapability(baseEnv)).toBe('supported');
    expect(resolvePushCapability({ ...baseEnv, permission: 'granted' })).toBe('supported');
  });

  it('is denied when the user blocked notifications', () => {
    expect(resolvePushCapability({ ...baseEnv, permission: 'denied' })).toBe('denied');
  });

  it('needs iOS install on an iOS Safari tab (not standalone) — even without PushManager', () => {
    expect(
      resolvePushCapability({
        ...baseEnv,
        isIOS: true,
        isStandalone: false,
        hasPushManager: false, // iOS tab reports no PushManager; install is the fix
      })
    ).toBe('needs-ios-install');
  });

  it('is supported on an installed iOS PWA (standalone)', () => {
    expect(
      resolvePushCapability({ ...baseEnv, isIOS: true, isStandalone: true })
    ).toBe('supported');
  });

  it('is unsupported when the browser lacks service worker / push', () => {
    expect(resolvePushCapability({ ...baseEnv, hasServiceWorker: false })).toBe('unsupported');
    expect(resolvePushCapability({ ...baseEnv, hasPushManager: false })).toBe('unsupported');
    expect(resolvePushCapability({ ...baseEnv, hasNotification: false })).toBe('unsupported');
  });
});

describe('VAPID key conversion', () => {
  it('decodes a base64url string to the expected bytes', () => {
    // "AQAB" (base64) => bytes [1, 0, 1]
    expect(Array.from(urlBase64ToUint8Array('AQAB'))).toEqual([1, 0, 1]);
  });

  it('round-trips bytes → base64url → bytes (incl. url-safe chars and padding)', () => {
    const cases = [[1, 0, 1], [251, 255], [0], [255, 254, 253, 1, 2, 3]];
    for (const bytes of cases) {
      const buf = new Uint8Array(bytes).buffer;
      const encoded = arrayBufferToBase64Url(buf);
      expect(encoded).not.toContain('='); // padding stripped
      expect(encoded).not.toMatch(/[+/]/); // url-safe alphabet only
      expect(Array.from(urlBase64ToUint8Array(encoded))).toEqual(bytes);
    }
  });
});
