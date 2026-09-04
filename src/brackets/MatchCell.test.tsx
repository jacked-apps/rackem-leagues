// @vitest-environment jsdom
/**
 * @fileoverview Tests for MatchCell — the decided-state visual + reopen control.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MatchCell } from './MatchCell';
import type { MatchView } from './bracketViewModel';

/** A completed match: Ann (winner) over Bo. */
function completedMatch(): MatchView {
  return {
    id: 'm1',
    round: 1,
    side: 'winners',
    slot: 0,
    status: 'complete',
    inProgress: false,
    isResetMatch: false,
    home: { participantId: 'p1', name: 'Ann', isWinner: true },
    away: { participantId: 'p2', name: 'Bo', isWinner: false },
  };
}

describe('MatchCell', () => {
  it('shows a Reset control on a decided match in organizer mode', async () => {
    const onReopen = vi.fn();
    render(<MatchCell match={completedMatch()} readOnly={false} onReopen={onReopen} />);

    const reset = screen.getByRole('button', { name: /reset/i });
    await userEvent.click(reset);
    expect(onReopen).toHaveBeenCalledWith('m1');
  });

  it('hides the Reset control in read-only (public) mode', () => {
    render(<MatchCell match={completedMatch()} readOnly onReopen={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /reset/i })).not.toBeInTheDocument();
  });

  it('renders both players (winner + loser) for a decided match', () => {
    render(<MatchCell match={completedMatch()} readOnly />);
    expect(screen.getByText('Ann')).toBeInTheDocument();
    expect(screen.getByText('Bo')).toBeInTheDocument();
  });

  it('a ready match toggles playing/on-deck (organizer mode)', async () => {
    const onToggle = vi.fn();
    const ready: MatchView = {
      ...completedMatch(),
      status: 'ready',
      inProgress: false,
      home: { participantId: 'p1', name: 'Ann', isWinner: false },
      away: { participantId: 'p2', name: 'Bo', isWinner: false },
    };
    render(<MatchCell match={ready} readOnly={false} onToggleInProgress={onToggle} />);

    // On deck → "Start" marks it playing (true).
    await userEvent.click(screen.getByRole('button', { name: /start/i }));
    expect(onToggle).toHaveBeenCalledWith('m1', true);
  });
});
