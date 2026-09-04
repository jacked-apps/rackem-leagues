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
    isResetMatch: false,
    home: { participantId: 'p1', name: 'Ann', isWinner: true },
    away: { participantId: 'p2', name: 'Bo', isWinner: false },
  };
}

describe('MatchCell', () => {
  it('shows a Reopen control on a decided match in organizer mode', async () => {
    const onReopen = vi.fn();
    render(<MatchCell match={completedMatch()} readOnly={false} onReopen={onReopen} />);

    const reopen = screen.getByRole('button', { name: /reopen/i });
    await userEvent.click(reopen);
    expect(onReopen).toHaveBeenCalledWith('m1');
  });

  it('hides the Reopen control in read-only (public) mode', () => {
    render(<MatchCell match={completedMatch()} readOnly onReopen={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /reopen/i })).not.toBeInTheDocument();
  });

  it('renders both players (winner + loser) for a decided match', () => {
    render(<MatchCell match={completedMatch()} readOnly />);
    expect(screen.getByText('Ann')).toBeInTheDocument();
    expect(screen.getByText('Bo')).toBeInTheDocument();
  });
});
