/**
 * @fileoverview `useGameDisplayMode` — the games-list column ordering
 * preference, lifted out of `GamesList` so it can be driven from two places:
 * the column-header bar inside the list AND the scoring settings gear in the
 * header. State must live in the common parent (ScoreMatch) for both to stay in
 * sync, so this hook owns it.
 *
 * Persistence: `localStorage`, global (not per-match) and FOREVER. This is a
 * pure display preference with zero effect on the scoring record, so — unlike
 * the participation modes (see useScoringParticipationModes) — there's no
 * reason to expire it. The least-consequential setting persists the longest.
 */

import { useCallback, useState } from 'react';

/** How each game's two players are arranged in the list. */
export type DisplayMode = 'break-rack' | 'home-away';

/** localStorage key for the persisted ordering preference. */
const DISPLAY_MODE_KEY = 'rackem-games-display-mode';

function readDisplayMode(): DisplayMode {
  try {
    return localStorage.getItem(DISPLAY_MODE_KEY) === 'home-away'
      ? 'home-away'
      : 'break-rack';
  } catch {
    return 'break-rack';
  }
}

export interface GameDisplayMode {
  displayMode: DisplayMode;
  setDisplayMode: (mode: DisplayMode) => void;
  /** Flip between the two modes (the header bar + gear both call this). */
  toggleDisplayMode: () => void;
}

export function useGameDisplayMode(): GameDisplayMode {
  const [displayMode, setMode] = useState<DisplayMode>(readDisplayMode);

  const setDisplayMode = useCallback((mode: DisplayMode) => {
    setMode(mode);
    try {
      localStorage.setItem(DISPLAY_MODE_KEY, mode);
    } catch {
      /* storage unavailable — preference still applies for this session */
    }
  }, []);

  const toggleDisplayMode = useCallback(() => {
    // Functional update so a rapid double-tap can't read a stale value.
    setMode((prev) => {
      const next: DisplayMode = prev === 'break-rack' ? 'home-away' : 'break-rack';
      try {
        localStorage.setItem(DISPLAY_MODE_KEY, next);
      } catch {
        /* storage unavailable */
      }
      return next;
    });
  }, []);

  return { displayMode, setDisplayMode, toggleDisplayMode };
}
