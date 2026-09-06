/**
 * @fileoverview Entry phase of the LO manual-scoring page.
 *
 * Shows a compact scoreboard (running totals + win thresholds, read from the
 * match row) and a per-game grid. The operator taps a game to pick the winner,
 * which opens the REUSED live `ScoringDialog` (forfeit toggle hidden) to capture
 * extras; confirming calls `loScoreGame` (fills both confirmation slots) and
 * recomputes. Tapping an already-scored game re-opens the dialog pre-filled
 * (R9 correction). "Finalize Match" runs `loFinalizeMatch`.
 *
 * It deliberately does NOT reuse `UnifiedScoreboard`: that component renders
 * `MatchEndVerification` (with its own two-party completion effect) when all
 * games are done, which would fight `loFinalizeMatch`. A lean scoreboard keeps
 * finalize in the operator's control. (Richer scoreboard reuse is a later polish.)
 *
 * @see docs/plans/2026-06-03-001-feat-lo-manual-match-scoring-plan.md — Unit 6
 */

import { useMemo, useState } from 'react';
import { useMatchWithLeagueSettings, useMatchGames, useTeamDetails } from '@/api/hooks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScoringDialog } from '@/components/scoring/ScoringDialog';
import { loScoreGame, loFinalizeMatch } from '@/api/mutations/loManualScoring';
import {
  regularGames,
  isGameScored,
  countUnscored,
  winnerWasScheduledBreaker,
  type EntryGame,
} from './entryHelpers';

export interface EntryPhaseProps {
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
  /** Called after a successful Finalize (host shows banner + routes to picker). */
  onFinalized: (summary: { winnerName: string }) => void;
}

/** The rich pending-score state the dialog + loScoreGame need. */
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
  earlyEight: false,
  winnerValue: null as number | null,
  loserValue: null as number | null,
};

export function EntryPhase(props: EntryPhaseProps) {
  const {
    matchId,
    homeTeamId,
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
  } = props;

  const matchQuery = useMatchWithLeagueSettings(matchId);
  const gamesQuery = useMatchGames(matchId);
  const homeTeam = useTeamDetails(homeTeamId);
  const awayTeam = useTeamDetails(props.awayTeamId);

  const nameById = useNameMap(homeTeam.data, awayTeam.data);
  const games = useMemo(
    () => regularGames(((gamesQuery.data as unknown as EntryGame[]) ?? [])),
    [gamesQuery.data]
  );
  const match = matchQuery.data as unknown as Record<string, unknown> | undefined;

  const [pending, setPending] = useState<Pending | null>(null);
  const [extras, setExtras] = useState(NO_EXTRAS);
  const [finalizing, setFinalizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unscored = countUnscored(games);

  const refresh = () => {
    void gamesQuery.refetch();
    void matchQuery.refetch();
  };

  const openFor = (game: EntryGame, winnerIsHome: boolean, prefill: typeof NO_EXTRAS) => {
    const winnerPlayerId = (winnerIsHome ? game.home_player_id : game.away_player_id) ?? '';
    const loserPlayerId = winnerIsHome ? game.away_player_id : game.home_player_id;
    setExtras(prefill);
    setError(null);
    setPending({
      gameId: game.id,
      gameNumber: game.game_number,
      winnerTeamId: winnerIsHome ? homeTeamId : props.awayTeamId,
      winnerPlayerId,
      winnerPlayerName: nameById.get(winnerPlayerId) ?? 'Winner',
      loserPlayerName: loserPlayerId ? (nameById.get(loserPlayerId) ?? null) : null,
      winnerWasScheduledBreaker: winnerWasScheduledBreaker(game, winnerIsHome),
    });
  };

  const editGame = (game: EntryGame) => {
    const winnerIsHome = game.winner_team_id === homeTeamId;
    openFor(game, winnerIsHome, {
      breakAndRun: !!game.break_and_run,
      goldenBreak: !!game.golden_break,
      breakFouled: !!game.break_fouled,
      runout: !!game.runout,
      earlyEight: !!game.early_eight,
      winnerValue: game.winner_value ?? null,
      loserValue: game.loser_value ?? null,
    });
  };

  const handleConfirm = async () => {
    if (!pending) return;
    try {
      await loScoreGame({
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
          earlyEight: extras.earlyEight,
          winByForfeit: false,
          winnerValue: extras.winnerValue,
          loserValue: extras.loserValue,
        },
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
    try {
      const { winnerTeamId } = await loFinalizeMatch({ matchId, loMemberId, winCondition });
      onFinalized({ winnerName: winnerTeamId === homeTeamId ? homeTeamName : awayTeamName });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to finalize the match.');
      setFinalizing(false);
    }
  };

  return (
    <div className="space-y-4 p-4">
      <ScoreboardHeader
        match={match}
        homeTeamName={homeTeamName}
        awayTeamName={awayTeamName}
        winCondition={winCondition}
      />

      <div className="space-y-2">
        {games.map((game) => (
          <GameRow
            key={game.id}
            game={game}
            homeName={nameById.get(game.home_player_id ?? '') ?? 'Home'}
            awayName={nameById.get(game.away_player_id ?? '') ?? 'Away'}
            winnerName={game.winner_player_id ? (nameById.get(game.winner_player_id) ?? 'Winner') : null}
            onPickHome={() => openFor(game, true, NO_EXTRAS)}
            onPickAway={() => openFor(game, false, NO_EXTRAS)}
            onEdit={() => editGame(game)}
          />
        ))}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button
        onClick={handleFinalize}
        disabled={unscored > 0 || finalizing}
        isLoading={finalizing}
        loadingText="Finalizing…"
        size="lg"
        className="w-full"
      >
        {unscored > 0 ? `${unscored} game(s) not yet scored` : 'Finalize Match'}
      </Button>

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
        earlyEight={extras.earlyEight}
        winnerValue={extras.winnerValue}
        loserValue={extras.loserValue}
        loserPlayerName={pending?.loserPlayerName ?? null}
        hideForfeit
        onBreakAndRunChange={(c) => setExtras((e) => ({ ...e, breakAndRun: c, goldenBreak: c ? false : e.goldenBreak }))}
        onGoldenBreakChange={(c) => setExtras((e) => ({ ...e, goldenBreak: c, breakAndRun: c ? false : e.breakAndRun }))}
        onBreakFouledChange={(c) => setExtras((e) => ({ ...e, breakFouled: c }))}
        onRunoutChange={(c) => setExtras((e) => ({ ...e, runout: c }))}
        onEarlyEightChange={(c) =>
          setExtras((e) => ({
            ...e,
            earlyEight: c,
            // An early 8 is the loser ending the game, so nothing the winner
            // did survives it. Same rule the live dialog enforces.
            ...(c
              ? { breakAndRun: false, goldenBreak: false, runout: false }
              : {}),
          }))
        }
        onWinnerValueChange={(v) => setExtras((e) => ({ ...e, winnerValue: v }))}
        onLoserValueChange={(v) => setExtras((e) => ({ ...e, loserValue: v }))}
        onCancel={() => {
          setPending(null);
          setExtras(NO_EXTRAS);
        }}
        onConfirm={handleConfirm}
      />
    </div>
  );
}

/** Compact running-totals + threshold header. */
function ScoreboardHeader({
  match,
  homeTeamName,
  awayTeamName,
  winCondition,
}: {
  match: Record<string, unknown> | undefined;
  homeTeamName: string;
  awayTeamName: string;
  winCondition: 'games' | 'points';
}) {
  const num = (v: unknown) => (typeof v === 'number' ? v : 0);
  const homeMain = winCondition === 'points' ? num(match?.home_points_earned) : num(match?.home_games_won);
  const awayMain = winCondition === 'points' ? num(match?.away_points_earned) : num(match?.away_games_won);
  const unit = winCondition === 'points' ? 'pts' : 'wins';
  return (
    <Card>
      <CardContent className="flex items-center justify-around p-4 text-center">
        <div>
          <div className="font-semibold">{homeTeamName}</div>
          <div className="text-2xl font-bold">{homeMain}</div>
          <div className="text-xs text-muted-foreground">
            {unit} · to win {num(match?.home_to_win) || '—'}
          </div>
        </div>
        <div className="text-muted-foreground">vs</div>
        <div>
          <div className="font-semibold">{awayTeamName}</div>
          <div className="text-2xl font-bold">{awayMain}</div>
          <div className="text-xs text-muted-foreground">
            {unit} · to win {num(match?.away_to_win) || '—'}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** One game row: matchup + pick buttons (unscored) or winner + edit (scored). */
function GameRow({
  game,
  homeName,
  awayName,
  winnerName,
  onPickHome,
  onPickAway,
  onEdit,
}: {
  game: EntryGame;
  homeName: string;
  awayName: string;
  winnerName: string | null;
  onPickHome: () => void;
  onPickAway: () => void;
  onEdit: () => void;
}) {
  return (
    <Card>
      <CardHeader className="py-2">
        <CardTitle className="flex items-center gap-2 text-sm font-normal">
          <Badge variant="secondary">Game {game.game_number}</Badge>
          <span>
            {homeName} vs {awayName}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-3">
        {isGameScored(game) ? (
          <div className="flex items-center justify-between">
            <span className="font-semibold">🏆 {winnerName}</span>
            <Button variant="outline" size="sm" onClick={onEdit} data-testid="edit-game">
              Edit
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onPickHome} data-testid="pick-home">
              {homeName} wins
            </Button>
            <Button variant="outline" className="flex-1" onClick={onPickAway} data-testid="pick-away">
              {awayName} wins
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Build an id→display-name map from both team rosters. */
function useNameMap(homeData: unknown, awayData: unknown): Map<string, string> {
  return useMemo(() => {
    const map = new Map<string, string>();
    for (const data of [homeData, awayData]) {
      const players = (data as { team_players?: Array<{ members?: { id: string; nickname: string | null; first_name: string; last_name: string } }> } | undefined)?.team_players;
      players?.forEach((tp) => {
        const m = tp.members;
        if (m) map.set(m.id, m.nickname || `${m.first_name} ${m.last_name}`.trim());
      });
    }
    return map;
  }, [homeData, awayData]);
}
