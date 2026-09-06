/**
 * @fileoverview The early-8 control in the scoring dialog.
 *
 * These flags describe how the game ENDED, not what either player deserves
 * credit for. The row already carries the winner and the loser, so one flag
 * reads from both sides — which is what lets a player ask how often a break &
 * run beat them, not just how often they managed one.
 *
 * Two consequences are asserted here: the control is named for the method
 * rather than for a player, and only one ending can be recorded, because a
 * break & run and an early 8 are rival accounts of the same game.
 *
 * The exclusivity is enforced in two places on purpose: this UI, and the
 * `match_games_early_eight_excludes_feats` CHECK constraint. Relying on the
 * constraint alone would surface the conflict as a failed save after the
 * scorer had already moved on.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent } from '@/test/utils';
import { ScoringDialog } from '../ScoringDialog';

const GAME = {
  gameNumber: 3,
  winnerTeamId: 'team-home',
  winnerPlayerId: 'player-1',
  winnerPlayerName: 'Dana',
  winnerWasScheduledBreaker: true,
};

/** Defaults describe a plain 8-ball win with nothing ticked. */
function renderDialog(overrides: Record<string, unknown> = {}) {
  const handlers = {
    onBreakAndRunChange: vi.fn(),
    onGoldenBreakChange: vi.fn(),
    onRunoutChange: vi.fn(),
    onEarlyEightChange: vi.fn(),
    onBreakFouledChange: vi.fn(),
    onWinByForfeitChange: vi.fn(),
    onCancel: vi.fn(),
    onConfirm: vi.fn(),
  };
  renderWithProviders(
    <ScoringDialog
      open
      game={GAME}
      breakAndRun={false}
      goldenBreak={false}
      goldenBreakCountsAsWin
      gameType="8-ball"
      {...handlers}
      {...overrides}
    />
  );
  return handlers;
}

const earlyEightBox = () => screen.getByLabelText(/early 8/i);

beforeEach(() => vi.clearAllMocks());

describe('ScoringDialog — early 8 availability', () => {
  it('offers it for 8-ball', () => {
    renderDialog();
    expect(earlyEightBox()).toBeInTheDocument();
  });

  it.each(['9-ball', '10-ball'])(
    'does not offer it for %s, where there is no early 8',
    (gameType) => {
      renderDialog({ gameType });
      expect(screen.queryByLabelText(/early 8/i)).not.toBeInTheDocument();
    }
  );

  it('names it for the method, not for either player', () => {
    renderDialog();
    // Plain "Early 8", like its neighbours. An attribution ("won on opponent's
    // early 8") would read from one chair only, and the same record has to
    // serve the player who lost that way too.
    expect(screen.getByText('Early 8')).toBeInTheDocument();
  });
});

describe('ScoringDialog — only one ending can be recorded', () => {
  it('clears Break & Run when early 8 is ticked', async () => {
    const user = userEvent.setup();
    const h = renderDialog({ breakAndRun: true });

    await user.click(earlyEightBox());

    expect(h.onEarlyEightChange).toHaveBeenCalledWith(true);
    expect(h.onBreakAndRunChange).toHaveBeenCalledWith(false);
  });

  it('clears Golden Break when early 8 is ticked', async () => {
    const user = userEvent.setup();
    const h = renderDialog({ goldenBreak: true });

    await user.click(earlyEightBox());

    expect(h.onGoldenBreakChange).toHaveBeenCalledWith(false);
  });

  it('clears Runout when early 8 is ticked', async () => {
    const user = userEvent.setup();
    // Runout only renders when the winner did NOT break.
    const h = renderDialog({
      runout: true,
      game: { ...GAME, winnerWasScheduledBreaker: false },
    });

    await user.click(earlyEightBox());

    expect(h.onRunoutChange).toHaveBeenCalledWith(false);
  });

  it('clears early 8 when Break & Run is ticked (the reverse direction)', async () => {
    const user = userEvent.setup();
    const h = renderDialog({ earlyEight: true });

    await user.click(screen.getByLabelText(/break & run/i));

    expect(h.onEarlyEightChange).toHaveBeenCalledWith(false);
  });

  it('unticking early 8 does not resurrect anything', async () => {
    const user = userEvent.setup();
    const h = renderDialog({ earlyEight: true });

    await user.click(earlyEightBox());

    expect(h.onEarlyEightChange).toHaveBeenCalledWith(false);
    expect(h.onBreakAndRunChange).not.toHaveBeenCalled();
    expect(h.onGoldenBreakChange).not.toHaveBeenCalled();
  });
});

describe('ScoringDialog — early 8 and forfeit', () => {
  it('is cleared by a forfeit, which is a different way to end a game', async () => {
    const user = userEvent.setup();
    const h = renderDialog({ earlyEight: true });

    await user.click(screen.getByLabelText(/win by forfeit/i));

    expect(h.onEarlyEightChange).toHaveBeenCalledWith(false);
  });
});

describe('ScoringDialog — early 8 survives a break foul', () => {
  it('is not cleared when the break foul flips who broke', async () => {
    const user = userEvent.setup();
    const h = renderDialog({ earlyEight: true });

    // A break foul changes who broke. It says nothing about whether the loser
    // then pocketed the 8 early — anyone can do that from any position — so
    // unlike the breaker-dependent achievements this must be left alone.
    await user.click(screen.getByLabelText(/break foul/i));

    expect(h.onEarlyEightChange).not.toHaveBeenCalled();
  });
});
