/**
 * @fileoverview useInstallApp — platform-aware "add to home screen" state.
 *
 * Everything a UI needs to offer PWA installation:
 *   - captures the Android/desktop-Chrome `beforeinstallprompt` event so the
 *     native install can be fired on demand. This event is single-use AND often
 *     fires EARLY in page load — so capture runs at **app startup** (see
 *     {@link startInstallCapture}, called from `main.tsx`), stored at module
 *     scope, and stays available until the user installs (or fires it). That way
 *     a persistent "Install app" entry works whenever the user finally decides,
 *     even long after load.
 *   - detects iOS (which never fires that event — install is manual via the
 *     Safari share sheet);
 *   - detects whether the app is already running installed (standalone).
 *
 * The component decides what to show; this hook only reports capability.
 */

import { useCallback, useEffect, useReducer } from 'react';

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

// ---------------------------------------------------------------------------
// Module-level capture: lives for the whole session so an early-firing,
// single-use `beforeinstallprompt` is never missed by a lazily-mounted UI.
// ---------------------------------------------------------------------------

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installed = typeof window !== 'undefined' ? detectStandalone() : false;
let started = false;
const platform = detectPlatform();
const subscribers = new Set<() => void>();

function notify(): void {
  subscribers.forEach((fn) => fn());
}

/**
 * Start listening for the install + installed events. Idempotent — call ONCE at
 * app startup (`main.tsx`) so the (often early-firing) prompt is captured before
 * any install UI mounts. The hook also calls this defensively on mount.
 */
export function startInstallCapture(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  installed = detectStandalone();

  window.addEventListener('beforeinstallprompt', (e) => {
    // Suppress Chrome's mini-infobar; we present our own (persistent) entry point.
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    installed = true;
    notify();
  });
}

export function useInstallApp(): UseInstallApp {
  // Defensive: ensure capture is running even if startInstallCapture() wasn't
  // called at boot (isolated tests, Storybook, etc.).
  useEffect(() => {
    startInstallCapture();
  }, []);

  // Re-render this component whenever the module-level capture state changes.
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    subscribers.add(rerender);
    return () => {
      subscribers.delete(rerender);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    // The browser prompt is single-use — drop it whatever the outcome.
    deferredPrompt = null;
    notify();
  }, []);

  return {
    isStandalone: installed,
    canPromptInstall: deferredPrompt !== null,
    platform,
    promptInstall,
  };
}

/** Test-only: reset the module-level capture between cases. */
export function __resetInstallCaptureForTests(): void {
  deferredPrompt = null;
  installed = false;
}
