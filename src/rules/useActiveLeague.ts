/**
 * @fileoverview Active-league state for the House-rules filter (R10).
 *
 * The active league is a per-device selection that persists in localStorage
 * (`rackem:rules:activeLeague`). It drives the default scope when the player
 * toggles the filter on.
 *
 * Resolution rules (see origin R10):
 *   - Logged out: the stored value is discarded (can't validate without
 *     memberships); the scope picker opens on toggle instead.
 *   - Logged in, 0 leagues: same — picker opens.
 *   - Logged in, 1 league: auto-select that league silently.
 *   - Logged in, 2+ leagues, no stored value: picker opens.
 *   - Stored value valid within current memberships: honored.
 *   - Stored value stale (league no longer a membership): discarded.
 *
 * The stored value is also cleared on sign-out so a second user on the same
 * device can't inherit the previous user's scope.
 */

import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/supabaseClient';
import { useMyMemberships } from './useMyMemberships';
import type { ActiveLeague } from './house-rules.types';

const STORAGE_KEY = 'rackem:rules:activeLeague';

function readStored(): ActiveLeague {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActiveLeague;
    if (!parsed || typeof parsed.id !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStored(value: ActiveLeague): void {
  try {
    if (value === null) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    /* localStorage unavailable — ignore */
  }
}

export function useActiveLeague() {
  const memberships = useMyMemberships();
  const [activeLeague, setActiveLeagueState] = useState<ActiveLeague>(() => readStored());

  // Validate the stored value against memberships once they load.
  useEffect(() => {
    if (!memberships.data) return;
    const leagues = memberships.data.leagues;

    // Stored but stale → discard.
    if (activeLeague && !leagues.some((l) => l.id === activeLeague.id)) {
      setActiveLeagueState(null);
      writeStored(null);
      return;
    }

    // No stored value + exactly one league → auto-pick.
    if (!activeLeague && leagues.length === 1) {
      const only = leagues[0];
      const next: ActiveLeague = {
        id: only.id,
        displayName: only.displayName,
        organizationName: only.organizationName,
      };
      setActiveLeagueState(next);
      writeStored(next);
    }
  }, [memberships.data, activeLeague]);

  // Clear on sign-out so the next user on the device doesn't inherit.
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setActiveLeagueState(null);
        writeStored(null);
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const setActiveLeague = useCallback((next: ActiveLeague) => {
    setActiveLeagueState(next);
    writeStored(next);
  }, []);

  const clear = useCallback(() => setActiveLeague(null), [setActiveLeague]);

  return { activeLeague, setActiveLeague, clear } as const;
}
