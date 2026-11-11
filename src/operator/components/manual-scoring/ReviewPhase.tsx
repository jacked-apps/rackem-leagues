/**
 * @fileoverview Review/correct surface for an already-scored match (LO v2).
 *
 * View-first read of a finished match (matchup, recorded winner, achievements,
 * confirmer line) plus the solo-operator correction flow:
 *
 *   reopen (once) → vacate a game → re-score (or Undo) → re-finalize
 *
 * The FIRST vacate reopens the match (`completed`→`in_progress`) exactly once;
 * while reopened a banner reminds the operator the state is uncommitted until
 * re-finalize. A games-mode tie blocks re-finalize and offers "Restore original
 * result" (the prior winner is intact on the row).
 *
 * @see docs/plans/2026-06-04-001-feat-lo-match-review-correction-plan.md — Units 6–7
 */

import { useMemo, useState } from 'react';
import { useMatchGames, useTeamDetails, useMatchWithLeagueSettings } from '@/api/hooks';
import { useGameConfirmations } from '@/api/hooks/useGameConfirmations';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Accordion } from '@/components/ui/accordion';
import { ScoringDialog } from '@/components/scoring/ScoringDialog';
import {
  loReopenMatch,
  loVacateGame,
  loCorrectGame,
  loRestoreGame,
  loRestoreCompletion,
  loFinalizeMatch,
  type LoGameResult,
} from '@/api/mutations/loManualScoring';
import { buildConfirmerAudit } from '@/utils/match/confirmerAudit';
import { regularGames, winnerWasScheduledBreaker, type EntryGame } from './entryHelpers';
import {
  achievementChips,
  buildNameTeamMap,
  fullNameTeamMap,
  confirmationsForGame,
  gameToSnapshot,
  type ConfirmationRow,
  type ReviewGame,
} from './reviewHelpers';
import { ReviewGameRow } from './ReviewGameRow';
import { VacateConfirmDialog } from './VacateConfirmDialog';

export interface ReviewPhaseProps {
  matchId: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  loMemberId: string;
  winCondition: 'games' | 'points';
  handicapType: string;
  pointsCalculator?: string | null;
  pointsCalculatorParams?: Record<string, unknown> | null;
  gameType: string;
  goldenBreakCountsAsWin: boolean;
  /** Finalize success → completion screen (reuse v1 host handler). */
  onFinalized: (summary: { winnerName: string }) => void;
  /** Restore-original / leave-without-finalizing → route back to the picker. */
  onRestored: () => void;
}

/** Pending re-score state the ScoringDialog + loCorrectGame need. */
interface Pending {
  gameId: string;
  gameNumber: number;
  winnerTeamId: string;
  winnerPlayerId: string;
  winnerPlayerName: string;
  loserPlayerName: string | null;
  winnerWasScheduledBreaker: boolean;
}

const NO_EXTRAS = {
  breakAndRun: false,
  goldenBreak: false,
  breakFouled: false,
  runout: false,
  winnerValue: null as number | null,
  loserValue: null as number | null,
};

export function ReviewPhase(props: ReviewPhaseProps) {
  const {
    matchId,
    homeTeamId,
    awayTeamId,
    homeTeamName,
    awayTeamName,
    loMemberId,
    winCondition,
    handicapType,
    pointsCalculator,
    pointsCalculatorParams,
    gameType,
    goldenBreakCountsAsWin,
    onFinalized,
    onRestored,
  } = props;

  const matchQuery = useMatchWithLeagueSettings(matchId);
  const gamesQuery = useMatchGames(matchId);
  const confirmationsQuery = useGameConfirmations(matchId);
  const homeTeam = useTeamDetails(homeTeamId);
  const awayTeam = useTeamDetails(awayTeamId);

  // Snapshots of games vacated THIS session — keys the vacated-row UI + powers Undo.
  const [vacatedSnapshots, setVacatedSnapshots] = useState<Record<string, LoGameResult>>({});
  const [vacateTarget, setVacateTarget] = useState<{ gameId: string; gameNumber: number } | null>(null);
  const [vacating, setVacating] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [extras, setExtras] = useState(NO_EXTRAS);
  const [finalizing, setFinalizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tieBlocked, setTieBlocked] = useState(false);

  const liveStatus = (matchQuery.data as unknown as { status?: string } | undefined)?.status;
  // Reopened-for-correction matches use the 'updating' state (same as a fresh LO
  // entry; here it's an already-completed match being corrected).
  const isReopened = liveStatus === 'updating';

  const nameTeamMap = useMemo(
    () =>
      buildNameTeamMap(
        { data: homeTeam.data, teamName: homeTeamName },
        { data: awayTeam.data, teamName: awayTeamName }
      ),
    [homeTeam.data, awayTeam.data, homeTeamName, awayTeamName]
  );
  // Confirmer audit shows FULL names (dispute adjudication wants real identities,
  // not nicknames), so it reads a full-name projection of the roster map.
  const confirmerNameMap = useMemo(() => fullNameTeamMap(nameTeamMap), [nameTeamMap]);
  const games = useMemo(
    () => regularGames((gamesQuery.data as unknown as ReviewGame[]) ?? []) as ReviewGame[],
    [gamesQuery.data]
  );
  const confirmations = useMemo(
    () => (confirmationsQuery.data as unknown as ConfirmationRow[]) ?? [],
    [confirmationsQuery.data]
  );

  const nameOf = (id: string | null) => (id ? nameTeamMap.get(id)?.name ?? 'Player' : 'Player');
  // Matchup uses FULL names (clearer for the LO); the winner stays nickname.
  const fullNameOf = (id: string | null) =>
    id ? nameTeamMap.get(id)?.fullName ?? 'Player' : 'Player';
  const hasVacatedPending = useMemo(() => games.some((g) => !g.winner_player_id), [games]);

  const refresh = () => {
    void gamesQuery.refetch();
    void matchQuery.refetch();
    void confirmationsQuery.refetch();
  };

  /** Reopen on the first correction only (idempotent server-side too). */
  const ensureReopened = async () => {
    if (liveStatus !== 'updating') {
      await loReopenMatch(matchId);
      await matchQuery.refetch();
    }
  };

  const handleVacateConfirm = async (reason: string | null) => {
    if (!vacateTarget) return;
    const game = games.find((g) => g.id === vacateTarget.gameId);
    if (!game) return;
    const snapshot = gameToSnapshot(game);
    setVacating(true);
    setError(null);
    try {
      await ensureReopened();
      await loVacateGame({ matchId, gameId: vacateTarget.gameId, loMemberId, reason });
      setVacatedSnapshots((prev) => ({ ...prev, [vacateTarget.gameId]: snapshot }));
      setVacateTarget(null);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to vacate the game.');
    } finally {
      setVacating(false);
    }
  };

  const handleUndo = async (gameId: string) => {
    const snapshot = vacatedSnapshots[gameId];
    if (!snapshot) return;
    setError(null);
    try {
      await loRestoreGame({ matchId, gameId, loMemberId, snapshot });
      setVacatedSnapshots((prev) => {
        const next = { ...prev };
        delete next[gameId];
        return next;
      });
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to undo the vacate.');
    }
  };

  const openRescore = (game: ReviewGame, winnerIsHome: boolean) => {
    const winnerPlayerId = (winnerIsHome ? game.home_player_id : game.away_player_id) ?? '';
    const loserPlayerId = winnerIsHome ? game.away_player_id : game.home_player_id;
    setExtras(NO_EXTRAS);
    setError(null);
    setPending({
      gameId: game.id,
      gameNumber: game.game_number,
      winnerTeamId: winnerIsHome ? homeTeamId : awayTeamId,
      winnerPlayerId,
      winnerPlayerName: nameOf(winnerPlayerId),
      loserPlayerName: loserPlayerId ? nameOf(loserPlayerId) : null,
      winnerWasScheduledBreaker: winnerWasScheduledBreaker(game as EntryGame, winnerIsHome),
    });
  };

  const handleConfirmRescore = async () => {
    if (!pending) return;
    try {
      await loCorrectGame({
        matchId,
        gameId: pending.gameId,
        loMemberId,
        result: {
          winnerTeamId: pending.winnerTeamId,
          winnerPlayerId: pending.winnerPlayerId,
          breakAndRun: extras.breakAndRun,
          goldenBreak: extras.goldenBreak,
          breakFouled: extras.breakFouled,
          runout: extras.runout,
          winByForfeit: false,
          winnerValue: extras.winnerValue,
          loserValue: extras.loserValue,
        },
      });
      setVacatedSnapshots((prev) => {
        const next = { ...prev };
        delete next[pending.gameId];
        return next;
      });
      setPending(null);
      setExtras(NO_EXTRAS);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save the game.');
    }
  };

  const handleFinalize = async () => {
    setFinalizing(true);
    setError(null);
    setTieBlocked(false);
    try {
      const { winnerTeamId } = await loFinalizeMatch({ matchId, loMemberId, winCondition });
      onFinalized({ winnerName: winnerTeamId === homeTeamId ? homeTeamName : awayTeamName });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to re-finalize the match.';
      if (/tie/i.test(msg)) setTieBlocked(true);
      else setError(msg);
      setFinalizing(false);
    }
  };

  const handleRestoreOriginal = async () => {
    setError(null);
    try {
      await loRestoreCompletion(matchId);
      onRestored();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore the original result.');
    }
  };

  if (gamesQuery.isLoading) {
    return <p className="p-4 text-muted-foreground">Loading match…</p>;
  }

  return (
    <div className="space-y-3 p-4">
      {isReopened && (
        <Card className="border-warning/40 bg-warning/10" data-testid="correction-banner">
          <CardContent className="p-3 text-sm text-foreground">
            Correction in progress — changes aren't committed until you re-finalize.
          </CardContent>
        </Card>
      )}

      <Accordion type="single" collapsible className="space-y-2">
        {games.map((game) => {
          const vacated = game.id in vacatedSnapshots;
          const audit = buildConfirmerAudit(
            game,
            confirmationsForGame(confirmations, game.id),
            confirmerNameMap,
            loMemberId
          );
          return (
            <ReviewGameRow
              key={game.id}
              value={game.id}
              gameNumber={game.game_number}
              homeName={fullNameOf(game.home_player_id)}
              awayName={fullNameOf(game.away_player_id)}
              homePlayerId={game.home_player_id}
              awayPlayerId={game.away_player_id}
              winnerName={game.winner_player_id ? nameOf(game.winner_player_id) : null}
              winnerSide={
                game.winner_player_id
                  ? game.winner_player_id === game.home_player_id
                    ? 'home'
                    : 'away'
                  : null
              }
              chips={achievementChips(game)}
              audit={audit}
              homeTeamName={homeTeamName}
              awayTeamName={awayTeamName}
              vacated={vacated}
              onVacate={() => setVacateTarget({ gameId: game.id, gameNumber: game.game_number })}
              onUndo={() => handleUndo(game.id)}
              onPickHome={() => openRescore(game, true)}
              onPickAway={() => openRescore(game, false)}
            />
          );
        })}
      </Accordion>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {tieBlocked && (
        <Card className="border-destructive" data-testid="tie-block">
          <CardContent className="space-y-2 p-3 text-sm">
            <p>
              These corrections produce a tie, which manual scoring can't finalize.
              Re-score a game to break the tie, or restore the original result.
            </p>
            <Button variant="outline" onClick={handleRestoreOriginal} data-testid="restore-original">
              Restore original result
            </Button>
          </CardContent>
        </Card>
      )}

      {isReopened && (
        <Button
          onClick={handleFinalize}
          disabled={hasVacatedPending || finalizing}
          isLoading={finalizing}
          loadingText="Re-finalizing…"
          size="lg"
          className="w-full"
          data-testid="refinalize"
        >
          {hasVacatedPending ? 'Re-score the vacated game(s) first' : 'Re-finalize Match'}
        </Button>
      )}

      <VacateConfirmDialog
        open={vacateTarget !== null}
        gameNumber={vacateTarget?.gameNumber ?? null}
        isBusy={vacating}
        onConfirm={handleVacateConfirm}
        onCancel={() => setVacateTarget(null)}
      />

      <ScoringDialog
        open={pending !== null}
        game={
          pending
            ? {
                gameNumber: pending.gameNumber,
                winnerPlayerName: pending.winnerPlayerName,
                winnerWasScheduledBreaker: pending.winnerWasScheduledBreaker,
              }
            : null
        }
        breakAndRun={extras.breakAndRun}
        goldenBreak={extras.goldenBreak}
        goldenBreakCountsAsWin={goldenBreakCountsAsWin}
        gameType={gameType}
        handicapType={handicapType}
        pointsCalculator={pointsCalculator}
        pointsCalculatorParams={pointsCalculatorParams}
        breakFouled={extras.breakFouled}
        runout={extras.runout}
        winnerValue={extras.winnerValue}
        loserValue={extras.loserValue}
        loserPlayerName={pending?.loserPlayerName ?? null}
        hideForfeit
        onBreakAndRunChange={(c) => setExtras((e) => ({ ...e, breakAndRun: c, goldenBreak: c ? false : e.goldenBreak }))}
        onGoldenBreakChange={(c) => setExtras((e) => ({ ...e, goldenBreak: c, breakAndRun: c ? false : e.breakAndRun }))}
        onBreakFouledChange={(c) => setExtras((e) => ({ ...e, breakFouled: c }))}
        onRunoutChange={(c) => setExtras((e) => ({ ...e, runout: c }))}
        onWinnerValueChange={(v) => setExtras((e) => ({ ...e, winnerValue: v }))}
        onLoserValueChange={(v) => setExtras((e) => ({ ...e, loserValue: v }))}
        onCancel={() => {
          setPending(null);
          setExtras(NO_EXTRAS);
        }}
        onConfirm={handleConfirmRescore}
      />
    </div>
  );
}
