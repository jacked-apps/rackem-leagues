/**
 * @fileoverview Tests for copyText — the copy that works outside a secure context.
 *
 * The case that matters is the one that bit us: a dev server reached by its LAN
 * address is NOT a secure context, so navigator.clipboard is unavailable and a
 * naive copy button fails exactly where sharing a link matters most.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { copyText } from './clipboard';

/** Point window.isSecureContext at a value for one test. */
function setSecureContext(value: boolean) {
  Object.defineProperty(window, 'isSecureContext', {
    value,
    configurable: true,
    writable: true,
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('copyText', () => {
  it('uses the clipboard API in a secure context', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setSecureContext(true);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    expect(await copyText('https://example.test/join')).toBe(true);
    expect(writeText).toHaveBeenCalledWith('https://example.test/join');
  });

  it('falls back when the context is not secure (a LAN IP on a phone)', async () => {
    const writeText = vi.fn();
    setSecureContext(false);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    const exec = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, 'execCommand', { value: exec, configurable: true });

    expect(await copyText('https://example.test/join')).toBe(true);
    // The modern API must not even be attempted — it throws here.
    expect(writeText).not.toHaveBeenCalled();
    expect(exec).toHaveBeenCalledWith('copy');
  });

  it('reports failure instead of claiming success when every route fails', async () => {
    setSecureContext(true);
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn().mockRejectedValue(new Error('denied')),
      },
      configurable: true,
    });

    // The caller needs to know, so it can offer the text another way.
    expect(await copyText('nope')).toBe(false);
  });

  it('cleans up its scratch element', async () => {
    setSecureContext(false);
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    Object.defineProperty(document, 'execCommand', {
      value: vi.fn().mockReturnValue(true),
      configurable: true,
    });

    await copyText('x');
    expect(document.querySelector('textarea')).toBeNull();
  });
});
