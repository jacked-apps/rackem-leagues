/**
 * @fileoverview Tests for useInstallApp — capturing the native install prompt
 * and firing it once.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useInstallApp } from './useInstallApp';

/** Dispatch a fake `beforeinstallprompt` with a stubbed prompt()/userChoice. */
function fireBeforeInstallPrompt(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const e = new Event('beforeinstallprompt') as Event & {
    prompt: ReturnType<typeof vi.fn>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
  };
  e.prompt = vi.fn().mockResolvedValue(undefined);
  e.userChoice = Promise.resolve({ outcome });
  window.dispatchEvent(e);
  return e;
}

describe('useInstallApp', () => {
  it('starts with no installable prompt', () => {
    const { result } = renderHook(() => useInstallApp());
    expect(result.current.canPromptInstall).toBe(false);
  });

  it('captures beforeinstallprompt, fires it on demand, and clears it (single-use)', async () => {
    const { result } = renderHook(() => useInstallApp());

    let evt!: ReturnType<typeof fireBeforeInstallPrompt>;
    act(() => {
      evt = fireBeforeInstallPrompt();
    });
    expect(result.current.canPromptInstall).toBe(true);

    await act(async () => {
      await result.current.promptInstall();
    });
    expect(evt.prompt).toHaveBeenCalledTimes(1);
    // The browser prompt can only be used once — capability drops after firing.
    expect(result.current.canPromptInstall).toBe(false);
  });
});
