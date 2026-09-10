/**
 * @fileoverview The race room — the page two players actually use.
 *
 * It is a COMPONENT that takes a race id, not a page that finds one. Whoever
 * hosts a race decides who is playing and what to call them; the room is handed
 * that and renders it. So the same room works inside a game room, inside a
 * tournament, or — later — inside a league night where the two players also
 * have teams, positions and a lineup behind them. None of that is the room's
 * business, and nothing here would have to change to gain it.
 *
 * Everything a player does routes through the same dialogs the league uses:
 * `ScoringDialog` to enter a result, `ConfirmationDialog` to agree with one.
 * That is deliberate rather than convenient — a race that collected results in
 * its own way would be a second scoring implementation, and merging it back
 * into league scoring later would mean rewriting one of them.
 */

import { useState } from 'react';
import { ScoringDialog } from '@/components/scoring/ScoringDialog';
import { ConfirmationDialog } from '@/components/scoring/ConfirmationDialog';
import { Card, CardContent } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useRaceView, type RaceNameOverrides } from './useRaceView';
import { useRaceActions } from './useRaceActions';
import { RaceScoreboard } from './RaceScoreboard';
import { RaceGamesList } from './RaceGamesList';
import { FirstBreakerPrompt } from './FirstBreakerPrompt';
import { isSettled, winnerSideOf, type RaceSeat } from './types';

interface ScoreRaceProps {
  raceId: string;
  /** Names the host already knows, so the room does not look them up. */
  names?: RaceNameOverrides;
}

/** A result being entered, held while the extras dialog is open. */
interface PendingResult {
  gameNumber: number;
  winner: RaceSeat;
  winnerWasBreaker: boolean;
  breakAndRun: boolean;
  goldenBreak: boolean;
  breakFouled: boolean;
  runout: boolean;
}

export function ScoreRace({ raceId, names }: ScoreRaceProps) {
  const { view, isLoading, error } = useRaceView(raceId, names);
  const { start, record, confirm, vacate } = useRaceActions(raceId);
  const [pending, setPending] = useState<PendingResult | null>(null);
  /** Games this viewer waved off — neither agreed nor denied — for this session. */
  const [dismissed, setDismissed] = useState<number[]>([]);

  if (isLoading) return <LoadingSpinner />;
  if (error || !view) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          This race could not be loaded.
        </CardContent>
      </Card>
    );
  }

  const { race, home, away, games, mySide, homeWon, awayWon } = view;
  const isPlayer = mySide !== null;
  const busy = start.isPending || record.isPending || confirm.isPending || vacate.isPending;

  // The one game waiting on this viewer: the opponent entered a result and this
  // side has not answered it. A spectator is never asked.
  const awaitingMe = !mySide
    ? null
    : games.find(
        (g) =>
          g.winner_player_id !== null &&
          !isSettled(g) &&
          (mySide === 'home' ? g.confirmed_by_home : g.confirmed_by_away) === null &&
          !dismissed.includes(g.game_number)
      ) ?? null;

  const awaitingWinner = awaitingMe
    ? winnerSideOf(awaitingMe, race) === 'home'
      ? home
      : away
    : null;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 p-4">
      <RaceScoreboard
        home={home}
        away={away}
        homeWon={homeWon}
        awayWon={awayWon}
        mySide={mySide}
        winnerSide={
          race.winner_player_id === null
            ? null
            : race.winner_player_id === race.home_member_id
              ? 'home'
              : 'away'
        }
      />

      {race.status === 'created' && isPlayer ? (
        <FirstBreakerPrompt
          home={home}
          away={away}
          breakRule={race.break_rule}
          disabled={busy}
          onChoose={(side) => start.mutate({ firstBreakerSide: side })}
        />
      ) : null}

      <RaceGamesList
        race={race}
        games={games}
        home={home}
        away={away}
        activeGameNumber={view.activeGameNumber}
        vacatableGameNumber={view.vacatableGameNumber}
        isPlayer={isPlayer}
        busy={busy}
        onScore={(gameNumber, winner, winnerWasBreaker) =>
          setPending({
            gameNumber,
            winner,
            winnerWasBreaker,
            breakAndRun: false,
            goldenBreak: false,
            breakFouled: false,
            runout: false,
          })
        }
        onVacate={(gameNumber) => vacate.mutate({ gameNumber })}
      />

      <ScoringDialog
        open={pending !== null}
        game={
          pending
            ? {
                gameNumber: pending.gameNumber,
                winnerPlayerName: pending.winner.displayName,
                winnerWasScheduledBreaker: pending.winnerWasBreaker,
              }
            : null
        }
        gameType={race.game_type}
        goldenBreakCountsAsWin
        // A race tracks no points, so the calculator-driven per-side inputs
        // stay out of the way. A league race would pass its calculator here.
        pointsCalculator={null}
        hideForfeit
        breakAndRun={pending?.breakAndRun ?? false}
        goldenBreak={pending?.goldenBreak ?? false}
        breakFouled={pending?.breakFouled ?? false}
        runout={pending?.runout ?? false}
        onBreakAndRunChange={(v) => setPending((p) => (p ? { ...p, breakAndRun: v } : p))}
        onGoldenBreakChange={(v) => setPending((p) => (p ? { ...p, goldenBreak: v } : p))}
        onBreakFouledChange={(v) => setPending((p) => (p ? { ...p, breakFouled: v } : p))}
        onRunoutChange={(v) => setPending((p) => (p ? { ...p, runout: v } : p))}
        onCancel={() => setPending(null)}
        onConfirm={() => {
          if (!pending) return;
          record.mutate({
            gameNumber: pending.gameNumber,
            winnerPlayerId: pending.winner.memberId,
            breakAndRun: pending.breakAndRun,
            goldenBreak: pending.goldenBreak,
            breakFouled: pending.breakFouled,
            runout: pending.runout,
          });
          setPending(null);
        }}
      />

      <ConfirmationDialog
        open={awaitingMe !== null}
        gameType={race.game_type}
        game={
          awaitingMe && awaitingWinner
            ? {
                gameNumber: awaitingMe.game_number,
                winnerPlayerName: awaitingWinner.displayName,
                breakAndRun: awaitingMe.break_and_run,
                goldenBreak: awaitingMe.golden_break,
                breakFouled: awaitingMe.break_fouled,
                runout: awaitingMe.runout,
                winByForfeit: awaitingMe.win_by_forfeit,
                winnerValue: awaitingMe.winner_value,
                loserValue: awaitingMe.loser_value,
              }
            : null
        }
        onConfirm={(gameNumber) => confirm.mutate({ gameNumber })}
        // Denying is a reversal: the result comes off and the game is replayed
        // or re-entered. It is the same act as reversing the last game, so it
        // goes through the same path rather than inventing a second one.
        onDeny={(gameNumber) => vacate.mutate({ gameNumber })}
        onDismiss={(gameNumber) => setDismissed((d) => [...d, gameNumber])}
        onClose={() => undefined}
      />
    </div>
  );
}
