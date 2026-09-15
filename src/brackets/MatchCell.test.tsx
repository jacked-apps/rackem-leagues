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

  it('offers "Add player" on a bye, not "Reset"', () => {
    // Resetting a bye would leave one player and nobody coming; the useful
    // action is to fill the empty seat.
    const onLateEntry = vi.fn();
    render(
      <MatchCell
        match={byeMatch()}
        readOnly={false}
        onReopen={vi.fn()}
        onLateEntry={onLateEntry}
      />
    );

    expect(screen.getByRole('button', { name: /add player/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /reset/i })).toBeNull();
  });

  it('offers "Reset" on an ordinary decided match, not "Add player"', () => {
    render(
      <MatchCell
        match={{ ...byeMatch(), isBye: false, away: { participantId: 'p2', name: 'Doc', isWinner: false } }}
        readOnly={false}
        onReopen={vi.fn()}
        onLateEntry={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /reset/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /add player/i })).toBeNull();
  });

  it('labels the empty seat of a bye as "Bye"', () => {
    render(<MatchCell match={byeMatch()} readOnly={false} />);
    expect(screen.getByText('Bye')).toBeTruthy();
  });

  it('offers nothing on a bye without the callback — free tournaments', () => {
    render(<MatchCell match={byeMatch()} readOnly={false} onReopen={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /add player/i })).toBeNull();
  });
});

/** A settled winners round-1 match with one seat empty. */
function byeMatch(): MatchView {
  return {
    id: 'm1',
    round: 1,
    side: 'winners' as const,
    slot: 0,
    status: 'complete' as const,
    inProgress: false,
    isBye: true,
    isResetMatch: false,
    home: { participantId: 'p1', name: 'Slim', isWinner: true },
    away: { participantId: null, name: null, isWinner: false },
  };
}
