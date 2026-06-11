/**
 * @fileoverview Component tests for the LO correction flow (Unit 7): vacate →
 * reopen-once → vacated row → undo / re-score → re-finalize, plus the tie block
 * + restore-original escape and the mid-correction banner.
 *
 * The data layer is mocked; module-level `matchStatus`/`gamesData` simulate the
 * server so each re-render reflects the post-mutation state.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// ── Mutable fake server state ───────────────────────────────────────────────
let matchStatus = 'completed';
let gamesData: Array<Record<string, unknown>> = [];

const G = (id: string, n: number, winner: string) => ({
  id,
  game_number: n,
  home_player_id: 'h1',
  away_player_id: 'a1',
  winner_player_id: winner,
  winner_team_id: winner === 'h1' ? 'HT' : 'AT',
  confirmed_by_home: 'h1',
  confirmed_by_away: 'a1',
  is_tiebreaker: false,
});

// ── Mocks ───────────────────────────────────────────────────────────────────
vi.mock('@/api/hooks', () => ({
  useMatchWithLeagueSettings: vi.fn(() => ({ data: { status: matchStatus }, refetch: vi.fn() })),
  useMatchGames: vi.fn(() => ({ data: gamesData, isLoading: false, refetch: vi.fn() })),
  useTeamDetails: vi.fn(() => ({ data: { team_players: [] } })),
}));
vi.mock('@/api/hooks/useGameConfirmations', () => ({
  useGameConfirmations: vi.fn(() => ({ data: [], refetch: vi.fn() })),
}));

const loReopenMatch = vi.fn(async () => {
  matchStatus = 'updating';
});
const loVacateGame = vi.fn(async ({ gameId }: { gameId: string }) => {
  gamesData = gamesData.map((g) =>
    g.id === gameId ? { ...g, winner_player_id: null, winner_team_id: null } : g
  );
});
const loRestoreGame = vi.fn(async ({ gameId }: { gameId: string }) => {
  gamesData = gamesData.map((g) =>
    g.id === gameId ? { ...g, winner_player_id: 'h1', winner_team_id: 'HT' } : g
  );
});
const loCorrectGame = vi.fn(async () => {});
const loRestoreCompletion = vi.fn(async () => {});
const loFinalizeMatch = vi.fn(async () => ({ winnerTeamId: 'HT', result: 'home_win' as const }));

vi.mock('@/api/mutations/loManualScoring', () => ({
  loReopenMatch: (...a: unknown[]) => loReopenMatch(...(a as [])),
  loVacateGame: (p: { gameId: string }) => loVacateGame(p),
  loRestoreGame: (p: { gameId: string }) => loRestoreGame(p),
  loCorrectGame: (...a: unknown[]) => loCorrectGame(...(a as [])),
  loRestoreCompletion: (...a: unknown[]) => loRestoreCompletion(...(a as [])),
  loFinalizeMatch: (...a: unknown[]) => loFinalizeMatch(...(a as [])),
}));

// Stub PlayerNameLink (used in the confirmer panel) — it pulls in member/auth
// hooks this test doesn't mock; we only care about the correction flow here.
vi.mock('@/components/PlayerNameLink', () => ({
  PlayerNameLink: ({ playerName }: { playerName: string }) => <span>{playerName}</span>,
}));

// Stub the heavy ScoringDialog to a minimal confirm affordance.
vi.mock('@/components/scoring/ScoringDialog', () => ({
  ScoringDialog: ({ open, onConfirm }: { open: boolean; onConfirm: () => void }) =>
    open ? (
      <button data-testid="dialog-confirm" onClick={onConfirm}>
        confirm
      </button>
    ) : null,
}));

import { ReviewPhase } from '../ReviewPhase';

const onFinalized = vi.fn();
const onRestored = vi.fn();

function renderReview() {
  return render(
    <ReviewPhase
      matchId="M1"
      homeTeamId="HT"
      awayTeamId="AT"
      homeTeamName="Sharks"
      awayTeamName="Jets"
      loMemberId="lo"
      winCondition="games"
      handicapType="points"
      gameType="eight_ball"
      goldenBreakCountsAsWin={false}
      onFinalized={onFinalized}
      onRestored={onRestored}
    />
  );
}

beforeEach(() => {
  matchStatus = 'completed';
  gamesData = [G('g1', 1, 'h1'), G('g2', 2, 'a1')];
  vi.clearAllMocks();
});

describe('ReviewPhase correction flow', () => {
  it('shows scored rows and no banner before any correction', () => {
    renderReview();
    expect(screen.getAllByTestId('scored-row')).toHaveLength(2);
    expect(screen.queryByTestId('correction-banner')).not.toBeInTheDocument();
    expect(screen.queryByTestId('refinalize')).not.toBeInTheDocument();
  });

  it('vacate → reopen once → vacated row + banner appear', async () => {
    renderReview();
    fireEvent.click(screen.getAllByTestId('game-trigger')[0]); // expand game 1
    fireEvent.click(screen.getAllByTestId('vacate')[0]);
    fireEvent.click(screen.getByTestId('vacate-confirm'));

    await waitFor(() => expect(screen.getByTestId('vacated-row')).toBeInTheDocument());
    expect(loReopenMatch).toHaveBeenCalledTimes(1);
    expect(loVacateGame).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('correction-banner')).toBeInTheDocument();
  });

  it('re-finalize is disabled while a game is vacated-pending', async () => {
    renderReview();
    fireEvent.click(screen.getAllByTestId('game-trigger')[0]); // expand game 1
    fireEvent.click(screen.getAllByTestId('vacate')[0]);
    fireEvent.click(screen.getByTestId('vacate-confirm'));

    await waitFor(() => expect(screen.getByTestId('vacated-row')).toBeInTheDocument());
    expect(screen.getByTestId('refinalize')).toBeDisabled();
  });

  it('vacating two games reopens exactly once', async () => {
    renderReview();
    fireEvent.click(screen.getAllByTestId('game-trigger')[0]); // expand game 1
    fireEvent.click(screen.getAllByTestId('vacate')[0]);
    fireEvent.click(screen.getByTestId('vacate-confirm'));
    await waitFor(() => expect(screen.getByTestId('vacated-row')).toBeInTheDocument());

    fireEvent.click(screen.getAllByTestId('game-trigger')[1]); // expand game 2
    fireEvent.click(screen.getByTestId('vacate'));
    fireEvent.click(screen.getByTestId('vacate-confirm'));
    await waitFor(() => expect(screen.getAllByTestId('vacated-row')).toHaveLength(2));

    expect(loReopenMatch).toHaveBeenCalledTimes(1);
    expect(loVacateGame).toHaveBeenCalledTimes(2);
  });

  it('undo restores the game and leaves the match reopened', async () => {
    renderReview();
    fireEvent.click(screen.getAllByTestId('game-trigger')[0]); // expand game 1
    fireEvent.click(screen.getAllByTestId('vacate')[0]);
    fireEvent.click(screen.getByTestId('vacate-confirm'));
    await waitFor(() => expect(screen.getByTestId('vacated-row')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('undo-vacate'));
    await waitFor(() => expect(loRestoreGame).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId('vacated-row')).not.toBeInTheDocument();
    // Still reopened (completion stays explicit — no auto re-complete).
    expect(screen.getByTestId('correction-banner')).toBeInTheDocument();
  });

  it('re-score a vacated game calls loCorrectGame and clears the vacated state', async () => {
    renderReview();
    fireEvent.click(screen.getAllByTestId('game-trigger')[0]); // expand game 1
    fireEvent.click(screen.getAllByTestId('vacate')[0]);
    fireEvent.click(screen.getByTestId('vacate-confirm'));
    await waitFor(() => expect(screen.getByTestId('vacated-row')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('rescore-home'));
    fireEvent.click(screen.getByTestId('dialog-confirm'));
    await waitFor(() => expect(loCorrectGame).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId('vacated-row')).not.toBeInTheDocument();
  });

  it('a tie on re-finalize blocks and restore-original recovers the prior result', async () => {
    loFinalizeMatch.mockRejectedValueOnce(new Error('This match is a tie that would require a tiebreaker'));
    matchStatus = 'updating'; // already reopened, all games scored
    renderReview();

    fireEvent.click(screen.getByTestId('refinalize'));
    await waitFor(() => expect(screen.getByTestId('tie-block')).toBeInTheDocument());
    expect(onFinalized).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('restore-original'));
    await waitFor(() => expect(loRestoreCompletion).toHaveBeenCalledTimes(1));
    expect(onRestored).toHaveBeenCalled();
  });

  it('finalize success calls onFinalized with the winning team name', async () => {
    matchStatus = 'updating';
    renderReview();
    fireEvent.click(screen.getByTestId('refinalize'));
    await waitFor(() => expect(onFinalized).toHaveBeenCalledWith({ winnerName: 'Sharks' }));
  });
});
