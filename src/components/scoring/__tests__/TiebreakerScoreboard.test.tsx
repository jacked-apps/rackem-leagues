/**
 * @fileoverview Tests for TiebreakerScoreboard — Unit 6 of the
 * unified-scoreboard plan covers the R18 team-name fix.
 *
 * The finish line comes from the tiebreak record's games_needed (Unit 4 of
 * docs/plans/2026-10-28-001-feat-tiebreaker-record-plan.md) — the last block
 * pins that it is no longer a hardcoded 2.
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
        gamesNeeded={2}
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
        gamesNeeded={2}
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
        gamesNeeded={2}
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

/** A confirmed tiebreak game won by one side. */
function wonBy(team: string, id: string) {
  return { id, winner_team_id: team, confirmed_by_home: true, confirmed_by_away: true };
}

describe('TiebreakerScoreboard — finish line comes from the record', () => {
  it('does NOT finish at 2 wins when the record needs 3', () => {
    const gameResults = new Map([
      [19, wonBy('home', 'g19')],
      [20, wonBy('home', 'g20')],
    ]);
    renderWithProviders(
      <TiebreakerScoreboard
        match={buildTiebreakerMatch()}
        gameResults={gameResults}
        isHomeTeam={true}
        gameType="8-ball"
        gamesNeeded={3}
        {...noopHandlers}
      />,
    );
    // Still the live scoreboard (not the end-of-match verification panel).
    expect(screen.getByText(/first to 3 wins/i)).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('labels a single-race tiebreaker "First to 1 Win"', () => {
    renderWithProviders(
      <TiebreakerScoreboard
        match={buildTiebreakerMatch()}
        gameResults={new Map()}
        isHomeTeam={true}
        gameType="8-ball"
        gamesNeeded={1}
        {...noopHandlers}
      />,
    );
    expect(screen.getByText(/first to 1 win$/i)).toBeInTheDocument();
  });

  it('ignores unconfirmed games when counting toward the finish line', () => {
    const gameResults = new Map([
      [19, wonBy('home', 'g19')],
      [20, { ...wonBy('home', 'g20'), confirmed_by_away: false }],
    ]);
    renderWithProviders(
      <TiebreakerScoreboard
        match={buildTiebreakerMatch()}
        gameResults={gameResults}
        isHomeTeam={true}
        gameType="8-ball"
        gamesNeeded={2}
        {...noopHandlers}
      />,
    );
    expect(screen.getByText(/first to 2 wins/i)).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });
});
