/**
 * @fileoverview Winner-only mode (`hideExtras`) in the scoring dialog.
 *
 * A casual race (a game room) records only who won each game. `hideExtras`
 * strips the dialog down to the winner line and Save. The regression half
 * matters as much: league scoring never passes the prop, so without it every
 * existing control must still render exactly as before.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/utils';
import { ScoringDialog } from '../ScoringDialog';

/** A Fargo 10-7 calculator puts a loser-side counter in the dialog. */
const FARGO_CALC = 'accumulated_per_game';

function renderDialog(overrides: Record<string, unknown> = {}) {
  renderWithProviders(
    <ScoringDialog
      open
      game={{ gameNumber: 2, winnerPlayerName: 'Dana', winnerWasScheduledBreaker: true }}
      breakAndRun={false}
      goldenBreak={false}
      goldenBreakCountsAsWin
      gameType="8-ball"
      pointsCalculator={FARGO_CALC}
      onBreakAndRunChange={vi.fn()}
      onGoldenBreakChange={vi.fn()}
      onRunoutChange={vi.fn()}
      onEarlyEightChange={vi.fn()}
      onBreakFouledChange={vi.fn()}
      onWinByForfeitChange={vi.fn()}
      onLoserValueChange={vi.fn()}
      onCancel={vi.fn()}
      onConfirm={vi.fn()}
      {...overrides}
    />
  );
}

/** Every "extra" label the dialog can show for a breaker-side 8-ball win. */
const EXTRAS = [/break & run/i, /8 on the break/i, /early 8/i, /break foul/i, /win by forfeit/i];

describe('ScoringDialog — hideExtras (winner only)', () => {
  it('hides every extra but keeps the winner and Save', () => {
    renderDialog({ hideExtras: true });
    for (const label of EXTRAS) {
      expect(screen.queryByLabelText(label)).not.toBeInTheDocument();
    }
    expect(screen.queryByText(/tap a value to continue/i)).not.toBeInTheDocument();
    expect(screen.getByText('Winner: Dana')).toBeInTheDocument();
    // The hidden counter must not block Save.
    expect(screen.getByRole('button', { name: /save game/i })).toBeEnabled();
  });

  it('hides Runout too, when the winner did not break', () => {
    renderDialog({
      hideExtras: true,
      game: { gameNumber: 2, winnerPlayerName: 'Dana', winnerWasScheduledBreaker: false },
    });
    expect(screen.queryByLabelText(/runout/i)).not.toBeInTheDocument();
  });
});

describe('ScoringDialog — without hideExtras (league scoring unchanged)', () => {
  it('still renders every extra and the per-side counter', () => {
    renderDialog();
    for (const label of EXTRAS) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
    expect(screen.getByText(/tap a value to continue/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save game/i })).toBeDisabled();
  });

  it('still renders Runout for a non-breaker win', () => {
    renderDialog({
      game: { gameNumber: 2, winnerPlayerName: 'Dana', winnerWasScheduledBreaker: false },
    });
    expect(screen.getByLabelText(/runout/i)).toBeInTheDocument();
  });
});
