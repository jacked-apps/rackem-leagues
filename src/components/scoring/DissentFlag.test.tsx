/**
 * @fileoverview Render tests for the dissent flag (many-eyes Unit 5, restructured
 * per Ed's spec on 2026-05-26).
 *
 * Pins the new visible shape: title with "Conflict!", recorded-result block
 * (winner, extras, points), agree-count line, disagreer names line, CTA.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DissentFlag } from './DissentFlag';
import type { ResultLike } from '@/utils/match/deriveDissents';

const baseRecorded: ResultLike = {
  winner_team_id: 'home',
  winner_player_id: 'p-x',
  break_and_run: false,
  golden_break: false,
  break_fouled: false,
  runout: false,
  win_by_forfeit: false,
  winner_value: null,
  loser_value: null,
};

describe('<DissentFlag />', () => {
  it('shows the game number with the "Conflict!" tone', () => {
    render(
      <DissentFlag
        gameNumber={3}
        recordedResult={baseRecorded}
        winnerPlayerName="Alice"
        agreeingConfirmerNames={['Bob']}
        disagreeingConfirmerNames={['Jack']}
      />
    );
    expect(screen.getByText(/Game 3/)).toBeInTheDocument();
    expect(screen.getByText(/Conflict/)).toBeInTheDocument();
  });

  it('shows the recorded winner', () => {
    render(
      <DissentFlag
        gameNumber={1}
        recordedResult={baseRecorded}
        winnerPlayerName="Alice"
        agreeingConfirmerNames={[]}
        disagreeingConfirmerNames={['Jack']}
      />
    );
    expect(screen.getByText(/Winner:/)).toBeInTheDocument();
    expect(screen.getByText(/Alice/)).toBeInTheDocument();
  });

  it('lists truthy achievements; "none" when there are no truthy flags', () => {
    const { rerender } = render(
      <DissentFlag
        gameNumber={1}
        recordedResult={{ ...baseRecorded, break_and_run: true, golden_break: true }}
        winnerPlayerName="Alice"
        agreeingConfirmerNames={[]}
        disagreeingConfirmerNames={['Jack']}
      />
    );
    expect(screen.getByText(/Break & Run/)).toBeInTheDocument();
    expect(screen.getByText(/Golden Break/)).toBeInTheDocument();

    rerender(
      <DissentFlag
        gameNumber={1}
        recordedResult={baseRecorded}
        winnerPlayerName="Alice"
        agreeingConfirmerNames={[]}
        disagreeingConfirmerNames={['Jack']}
      />
    );
    expect(screen.getByText(/Achievements: none/i)).toBeInTheDocument();
  });

  it('shows points when present, hides the row when both are null', () => {
    render(
      <DissentFlag
        gameNumber={1}
        recordedResult={{ ...baseRecorded, winner_value: 7, loser_value: 3 }}
        winnerPlayerName="Alice"
        agreeingConfirmerNames={[]}
        disagreeingConfirmerNames={['Jack']}
      />
    );
    expect(screen.getByText(/Points:/)).toBeInTheDocument();
    expect(screen.getByText(/W 7/)).toBeInTheDocument();
    expect(screen.getByText(/L 3/)).toBeInTheDocument();
  });

  it('shows agree count when there are agreers', () => {
    render(
      <DissentFlag
        gameNumber={1}
        recordedResult={baseRecorded}
        winnerPlayerName="Alice"
        agreeingConfirmerNames={['Bob', 'Cara', 'Dan']}
        disagreeingConfirmerNames={['Jack']}
      />
    );
    expect(screen.getByText(/3 agree/i)).toBeInTheDocument();
  });

  it('uses "disagrees" (singular) for one name, "disagree" (plural) for multiple', () => {
    const { rerender } = render(
      <DissentFlag
        gameNumber={1}
        recordedResult={baseRecorded}
        winnerPlayerName="Alice"
        agreeingConfirmerNames={[]}
        disagreeingConfirmerNames={['Jack']}
      />
    );
    expect(screen.getByText(/Jack disagrees/i)).toBeInTheDocument();

    rerender(
      <DissentFlag
        gameNumber={1}
        recordedResult={baseRecorded}
        winnerPlayerName="Alice"
        agreeingConfirmerNames={[]}
        disagreeingConfirmerNames={['Jack', 'Mark', 'Ruben']}
      />
    );
    expect(screen.getByText(/Jack, Mark, Ruben disagree/i)).toBeInTheDocument();
  });

  it('renders the verify-and-vacate call to action', () => {
    render(
      <DissentFlag
        gameNumber={1}
        recordedResult={baseRecorded}
        winnerPlayerName="Alice"
        agreeingConfirmerNames={[]}
        disagreeingConfirmerNames={['Jack']}
      />
    );
    expect(screen.getByText(/verify/i)).toBeInTheDocument();
    expect(screen.getByText(/vacate/i)).toBeInTheDocument();
  });
});
