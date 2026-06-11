/**
 * @fileoverview `useScoringParticipationModes` — the two opt-in modes a person
 * can set on the live-scoring screen, with persistence scaled to the
 * CONSEQUENCE of each mode (the more it can affect the scoring record, the more
 * perishable it is, so it can't quietly outlive the person's attention):
 *
 *  • **Auto-Confirm** — auto-accepts opponent scores with no modal (still
 *    records a vouch, flagged `auto_confirmed`). High consequence: you're
 *    rubber-stamping games you didn't actively verify. So it must NOT silently
 *    persist forever. It survives a page **refresh** (the one real annoyance —
 *    losing it mid-match on an accidental reload) but turns OFF the moment you
 *    **leave** the scoring screen, forcing a deliberate re-enable next time.
 *    Stored in `sessionStorage` keyed by match; cleared on a real unmount.
 *
 *  • **I'm Not Scoring** — suppresses the auto confirm/vacate prompts entirely.
 *    NOT auto-deny (that would be a nightmare) and NOT auto-confirm — just
 *    silence. The person can still peek a game and confirm manually if they
 *    choose. Lower consequence (opting out of prompts never writes anything),
 *    so it's allowed to last the whole match: stored in `localStorage` keyed by
 *    match, surviving refreshes and navigation until the person turns it off or
 *    moves to a different match.
 *
 * The "survives refresh, off on leave" behavior for Auto-Confirm leans on a
 * browser fact: a hard refresh / tab close discards the page WITHOUT running
 * React effect cleanup, while an in-app (SPA) route change DOES run cleanup.
 * So "clear on unmount" gives us exactly "off on leave, survive refresh" — with
 * one wrinkle: React StrictMode (dev) fires a throwaway mount→unmount→mount,
 * and a naive clear-on-unmount would wipe the value during that fake unmount.
 * We defer the clear to a macrotask (`setTimeout(0)`) and cancel it on the next
 * mount; StrictMode's synchronous remount cancels it, a real navigate-away lets
 * it fire. The pending-timer handle lives at module scope so it survives the
 * unmount→mount gap (a ref would be recreated). Only one scoring screen is ever
 * mounted at a time, so a single shared handle is safe.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

/** sessionStorage/localStorage key builders — keyed by match so a mode set on
 *  one match never leaks into another. */
const autoConfirmKey = (matchId: string) => `scoring:autoConfirm:${matchId}`;
const notScoringKey = (matchId: string) => `scoring:notScoring:${matchId}`;

/** Pending Auto-Confirm clear, scheduled on unmount, cancelled on remount.
 *  Module-scoped on purpose — see the file overview (survives the StrictMode
 *  unmount→mount gap; a useRef would not). */
let autoConfirmClearTimer: ReturnType<typeof setTimeout> | null = null;

function readSession(key: string): boolean {
  try {
    return sessionStorage.getItem(key) === 'true';
  } catch {
    return false;
  }
}

function readLocal(key: string): boolean {
  try {
    return localStorage.getItem(key) === 'true';
  } catch {
    return false;
  }
}

export interface ScoringParticipationModes {
  /** Auto-accept opponent scores without a modal (still records a vouch). */
  autoConfirm: boolean;
  setAutoConfirm: (value: boolean) => void;
  /** Suppress the auto confirm/vacate prompts (peek-and-confirm still works). */
  notScoring: boolean;
  setNotScoring: (value: boolean) => void;
}

/**
 * Owns the two scoring participation modes and their consequence-scaled
 * persistence. Both setters keep state and storage in lockstep and enforce
 * mutual exclusion: the modes contradict each other (always-confirm vs
 * never-prompt), so turning one on turns the other off.
 *
 * @param matchId - The match being scored; namespaces both modes. Until it's
 *   known (route still resolving) both modes are simply off and un-persisted.
 */
export function useScoringParticipationModes(
  matchId: string | undefined
): ScoringParticipationModes {
  const [autoConfirm, setAutoConfirmState] = useState<boolean>(() =>
    matchId ? readSession(autoConfirmKey(matchId)) : false
  );
  const [notScoring, setNotScoringState] = useState<boolean>(() =>
    matchId ? readLocal(notScoringKey(matchId)) : false
  );

  // Keep the latest matchId available to the unmount cleanup without making the
  // lifecycle effect depend on it (the effect must run only on real mount/
  // unmount, not when matchId resolves).
  const matchIdRef = useRef(matchId);
  matchIdRef.current = matchId;

  // Auto-Confirm "off on leave, survive refresh" lifecycle. See file overview.
  useEffect(() => {
    // Remount: cancel any clear a just-fired unmount scheduled (StrictMode).
    if (autoConfirmClearTimer) {
      clearTimeout(autoConfirmClearTimer);
      autoConfirmClearTimer = null;
    }
    return () => {
      // Real unmount (SPA navigation) → clear so Auto-Confirm is off next time.
      // A refresh/tab-close never runs this cleanup, so the value survives.
      const id = matchIdRef.current;
      if (!id) return;
      autoConfirmClearTimer = setTimeout(() => {
        try {
          sessionStorage.removeItem(autoConfirmKey(id));
        } catch {
          /* storage unavailable — nothing to clear */
        }
        autoConfirmClearTimer = null;
      }, 0);
    };
  }, []);

  const setAutoConfirm = useCallback(
    (value: boolean) => {
      setAutoConfirmState(value);
      // Mutually exclusive with notScoring.
      if (value) setNotScoringState(false);
      if (!matchId) return;
      try {
        sessionStorage.setItem(autoConfirmKey(matchId), value ? 'true' : 'false');
        if (value) localStorage.removeItem(notScoringKey(matchId));
      } catch {
        /* storage unavailable — state still updates for this session */
      }
    },
    [matchId]
  );

  const setNotScoring = useCallback(
    (value: boolean) => {
      setNotScoringState(value);
      // Mutually exclusive with autoConfirm.
      if (value) setAutoConfirmState(false);
      if (!matchId) return;
      try {
        localStorage.setItem(notScoringKey(matchId), value ? 'true' : 'false');
        if (value) sessionStorage.removeItem(autoConfirmKey(matchId));
      } catch {
        /* storage unavailable — state still updates for this session */
      }
    },
    [matchId]
  );

  return { autoConfirm, setAutoConfirm, notScoring, setNotScoring };
}
