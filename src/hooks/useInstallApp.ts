/**
 * @fileoverview useInstallApp — platform-aware "add to home screen" state.
 *
 * Encapsulates everything a UI needs to offer PWA installation:
 *   - captures the Android/desktop-Chrome `beforeinstallprompt` event so the
 *     native install prompt can be fired on demand (it can only be used once);
 *   - detects iOS (which never fires that event — install is manual via the
 *     Safari share sheet);
 *   - detects whether the app is already running installed (standalone), so the
 *     caller can hide the entry point.
 *
 * The component decides what to show; this hook only reports capability.
 */

import { useCallback, useEffect, useState } from 'react';

/** Coarse platform bucket — only what the install UX needs to branch on. */
export type InstallPlatform = 'ios' | 'android' | 'other';

/** The `beforeinstallprompt` event (not in the standard DOM lib types). */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface UseInstallApp {
  /** App is already installed / running as a standalone PWA — hide the prompt. */
  isStandalone: boolean;
  /** A native install prompt was captured and can be fired (Android / desktop Chrome). */
  canPromptInstall: boolean;
  /** Coarse platform, for choosing native-prompt vs manual instructions. */
  platform: InstallPlatform;
  /** Fire the captured native prompt. No-op if none is available. */
  promptInstall: () => Promise<void>;
}

/** True when the page is running as an installed PWA (Android/desktop + iOS Safari). */
function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const displayStandalone =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches;
  // iOS Safari exposes a non-standard `navigator.standalone` instead.
  const iosStandalone =
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return displayStandalone || iosStandalone;
}

/** Coarse UA-based platform detection (iPadOS reports as Mac + touch). */
function detectPlatform(): InstallPlatform {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent || '';
  if (/android/i.test(ua)) return 'android';
  if (/iphone|ipod|ipad/i.test(ua)) return 'ios';
  // iPadOS 13+ masquerades as desktop Safari but has a touch screen.
  if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) return 'ios';
  return 'other';
}

export function useInstallApp(): UseInstallApp {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState<boolean>(() => detectStandalone());
  const [platform] = useState<InstallPlatform>(() => detectPlatform());

  useEffect(() => {
    const onBeforeInstallPrompt = (e: Event) => {
      // Stop Chrome's mini-infobar; we present our own entry point.
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onAppInstalled = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    // The prompt is single-use — drop it whatever the outcome.
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  return {
    isStandalone,
    canPromptInstall: deferredPrompt !== null,
    platform,
    promptInstall,
  };
}
