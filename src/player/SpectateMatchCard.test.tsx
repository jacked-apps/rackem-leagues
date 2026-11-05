/**
 * @fileoverview Tests for SpectateMatchCard's non-scoreboard states.
 *
 * Regression for the 2026-11-01 playoff night: one Live Matches card sat on
 * "Loading…" forever. A card that can't draw a scoreboard must now say why —
 * "couldn't load" on a failed query, "waiting for lineups" when a lineup row
 * is missing — instead of spinning.
 *
 * `useSpectateMatch` is mocked; nothing hits supabase.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { MatchWithDetails } from '@/types';

const hookResult: Record<string, unknown> = {};
vi.mock('@/hooks/useSpectateMatch', () => ({
  useSpectateMatch: () => hookResult,
}));

import { SpectateMatchCard } from './SpectateMatchCard';

const seed = {
  id: 'm1',
  home_team: { team_name: 'Team Fluff' },
  away_team: { team_name: 'Chalk Cue' },
} as unknown as MatchWithDetails;

function setHook(values: Record<string, unknown>) {
  for (const k of Object.keys(hookResult)) delete hookResult[k];
  Object.assign(hookResult, values);
}

describe('SpectateMatchCard — states without a scoreboard', () => {
  it('says it could not load when a query failed (no endless spinner)', () => {
    setHook({ isLoading: false, error: new Error('boom'), match: null });
    render(<SpectateMatchCard match={seed} />);
    expect(screen.getByText(/Couldn't load Team Fluff vs Chalk Cue/)).toBeInTheDocument();
    expect(screen.queryByText(/Loading/)).not.toBeInTheDocument();
  });

  it('says it is waiting for lineups when a lineup row is missing', () => {
    setHook({ isLoading: false, error: null, match: { id: 'm1' }, homeLineup: { id: 'l1' }, awayLineup: null });
    render(<SpectateMatchCard match={seed} />);
    expect(screen.getByText(/waiting for lineups/)).toBeInTheDocument();
  });

  it('still shows the loading line while data is on its way', () => {
    setHook({ isLoading: true, error: null, match: null });
    render(<SpectateMatchCard match={seed} />);
    expect(screen.getByText(/Loading Team Fluff vs Chalk Cue/)).toBeInTheDocument();
  });
});
