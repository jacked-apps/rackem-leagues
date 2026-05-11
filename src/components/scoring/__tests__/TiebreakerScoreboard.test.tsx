/**
 * @fileoverview Tests for TiebreakerScoreboard — Unit 6 of the
 * unified-scoreboard plan covers the R18 team-name fix.
 *
 * R20 "don't lock things down" is verified by inspection in code review,
 * not by a runtime test. The component remains hardcoded to "first to 2
 * wins" and a 3-game best-of-3 format because those are the only method
 * wired today; the hardcodes don't paint the component into a corner
 * that would prevent a future tiebreaker_format axis from plugging in.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/utils';
import { TiebreakerScoreboard } from '../TiebreakerScoreboard';
import type { MatchGame } from '@/types/match';

function buildTiebreakerMatch(overrides: Record<string, unknown> = {}) {
  return {
    id: 'match-tb-1',
    home_team_id: 'home',
    away_team_id: 'away',
    home_team: { team_name: 'Sharks' },
    away_team: { team_name: 'Jets' },
    home_team_verified_by: null,
    away_team_verified_by: null,
    home_tiebreaker_verified_by: null,
    away_tiebreaker_verified_by: null,
    ...overrides,
  };
}

const noopHandlers = {
  onVerify: vi.fn(),
};

describe('TiebreakerScoreboard — R18 team-name display', () => {
  it('renders actual team names instead of HOME / AWAY (mid-tiebreaker)', () => {
    const gameResults = new Map<number, MatchGame>();

    renderWithProviders(
      <TiebreakerScoreboard
        match={buildTiebreakerMatch()}
        gameResults={gameResults}
        isHomeTeam={true}
        gameType="8-ball"
        {...noopHandlers}
      />,
    );

    expect(screen.getByText('Sharks')).toBeInTheDocument();
    expect(screen.getByText('Jets')).toBeInTheDocument();
    // Generic HOME / AWAY labels are gone.
    expect(screen.queryByText('HOME')).not.toBeInTheDocument();
    expect(screen.queryByText('AWAY')).not.toBeInTheDocument();
  });

  it('falls back to "Home" / "Away" when team_name is missing', () => {
    const gameResults = new Map<number, MatchGame>();
    const match = buildTiebreakerMatch({
      home_team: undefined,
      away_team: undefined,
    });

    renderWithProviders(
      <TiebreakerScoreboard
        match={match}
        gameResults={gameResults}
        isHomeTeam={true}
        gameType="8-ball"
        {...noopHandlers}
      />,
    );

    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Away')).toBeInTheDocument();
  });

  it('still shows the 0-0 starting score with the new labels', () => {
    const gameResults = new Map<number, MatchGame>();

    renderWithProviders(
      <TiebreakerScoreboard
        match={buildTiebreakerMatch()}
        gameResults={gameResults}
        isHomeTeam={true}
        gameType="8-ball"
        {...noopHandlers}
      />,
    );

    // Both 0s render (one per team).
    expect(screen.getAllByText('0').length).toBe(2);
    // The "First to 2 Wins" rule label is preserved (R20 — don't lock
    // things down, but don't gratuitously change either).
    expect(screen.getByText(/first to 2 wins/i)).toBeInTheDocument();
  });
});
