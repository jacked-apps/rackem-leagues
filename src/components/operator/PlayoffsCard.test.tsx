/* eslint-disable @typescript-eslint/no-explicit-any -- test mocks use minimal shapes */
/**
 * @fileoverview Tests for PlayoffsCard's status signal (Unit 5).
 *
 * The card must label playoffs by the trustworthy populated signal
 * (`arePlayoffMatchupsPopulated`), not a raw match count — so placeholder-only
 * weeks read "Ready to set up", not "Bracket created".
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PlayoffsCard } from './PlayoffsCard';

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('@/api/hooks/usePlayoffConfigurations', () => ({
  useResolvedPlayoffConfig: () => ({
    data: { name: 'Standard Playoffs', config_source: 'league' },
    isLoading: false,
  }),
}));

const gen = {
  getPlayoffWeek: vi.fn(),
  checkRegularSeasonComplete: vi.fn(),
  arePlayoffMatchupsPopulated: vi.fn(),
};
vi.mock('@/utils/playoffGenerator', () => ({
  getPlayoffWeek: (...a: any[]) => gen.getPlayoffWeek(...a),
  checkRegularSeasonComplete: (...a: any[]) => gen.checkRegularSeasonComplete(...a),
  arePlayoffMatchupsPopulated: (...a: any[]) => gen.arePlayoffMatchupsPopulated(...a),
}));

const WEEK = { id: 'W1', scheduled_date: '2026-05-01', week_name: 'Playoffs' };

beforeEach(() => {
  vi.clearAllMocks();
  gen.getPlayoffWeek.mockResolvedValue(WEEK);
  gen.checkRegularSeasonComplete.mockResolvedValue({
    isComplete: false,
    completedMatches: 4,
    totalMatches: 10,
  });
});

describe('PlayoffsCard status signal', () => {
  it('placeholder-only week → "Ready to set up" / "Setup Playoffs"', async () => {
    gen.arePlayoffMatchupsPopulated.mockResolvedValue(false);
    render(<PlayoffsCard leagueId="L1" seasonId="S1" />);
    expect(await screen.findByText('Ready to set up')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /setup playoffs/i })).toBeInTheDocument();
    expect(screen.queryByText('Bracket created')).not.toBeInTheDocument();
  });

  it('populated week → "Bracket created" / "View Bracket"', async () => {
    gen.arePlayoffMatchupsPopulated.mockResolvedValue(true);
    render(<PlayoffsCard leagueId="L1" seasonId="S1" />);
    expect(await screen.findByText('Bracket created')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /view bracket/i })).toBeInTheDocument();
  });

  it('no playoff week → "No playoff week scheduled"', async () => {
    gen.getPlayoffWeek.mockResolvedValue(null);
    gen.arePlayoffMatchupsPopulated.mockResolvedValue(false);
    render(<PlayoffsCard leagueId="L1" seasonId="S1" />);
    expect(await screen.findByText('No playoff week scheduled')).toBeInTheDocument();
  });
});
