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
 *
 * A second scorer can keep its OWN preference by passing a key and default:
 * the room race starts on "home-away" (Player 1 left, Player 2 right) under
 * its own key, so flipping one never flips the other.
 */

import { useCallback, useState } from 'react';

/** How each game's two players are arranged in the list. */
export type DisplayMode = 'break-rack' | 'home-away';

/** localStorage key for the persisted ordering preference. */
const DISPLAY_MODE_KEY = 'rackem-games-display-mode';

function readDisplayMode(key: string, fallback: DisplayMode): DisplayMode {
  try {
    const stored = localStorage.getItem(key);
    return stored === 'home-away' || stored === 'break-rack' ? stored : fallback;
  } catch {
    return fallback;
  }
}

/** Where a scorer keeps its preference, and what it starts on. */
export interface GameDisplayModeOptions {
  /** localStorage key. Defaults to the league games list's key. */
  storageKey?: string;
  /** Mode before the viewer has ever flipped it. Defaults to break-rack. */
  defaultMode?: DisplayMode;
}

export interface GameDisplayMode {
  displayMode: DisplayMode;
  setDisplayMode: (mode: DisplayMode) => void;
  /** Flip between the two modes (the header bar + gear both call this). */
  toggleDisplayMode: () => void;
}

export function useGameDisplayMode({
  storageKey = DISPLAY_MODE_KEY,
  defaultMode = 'break-rack',
}: GameDisplayModeOptions = {}): GameDisplayMode {
  const [displayMode, setMode] = useState<DisplayMode>(() => readDisplayMode(storageKey, defaultMode));

  const setDisplayMode = useCallback(
    (mode: DisplayMode) => {
      setMode(mode);
      try {
        localStorage.setItem(storageKey, mode);
      } catch {
        /* storage unavailable — preference still applies for this session */
      }
    },
    [storageKey]
  );

  const toggleDisplayMode = useCallback(() => {
    // Functional update so a rapid double-tap can't read a stale value.
    setMode((prev) => {
      const next: DisplayMode = prev === 'break-rack' ? 'home-away' : 'break-rack';
      try {
        localStorage.setItem(storageKey, next);
      } catch {
        /* storage unavailable */
      }
      return next;
    });
  }, [storageKey]);

  return { displayMode, setDisplayMode, toggleDisplayMode };
}
