/**
 * @fileoverview Single-match scoreboard card for the spectator page.
 *
 * Renders the correct scoreboard variant (ThreeVThree / FiveVFive / TenSeven)
 * for one match in read-only spectator mode. Mounts its own data + realtime
 * subscription via useSpectateMatch so each card ticks live independently.
 *
 * This component is deliberately dumb — it doesn't know who's watching, what
 * team they're on, or whether they have any relationship to this match. It
 * just fetches state and renders. isHomeTeam is hard-coded to false so no
 * player-team-only affordances leak through; onVerify/onSwapPlayer are
 * no-ops and never visually surface in read-only paths.
 */

import { Loader2 } from 'lucide-react';
import { ThreeVThreeScoreboard } from '@/components/scoring/ThreeVThreeScoreboard';
import { FiveVFiveScoreboard } from '@/components/scoring/FiveVFiveScoreboard';
import { TenSevenScoreboard } from '@/components/scoring/TenSevenScoreboard';
import { useSpectateMatch } from '@/hooks/useSpectateMatch';
import type { MatchWithDetails } from '@/types';

interface SpectateMatchCardProps {
  /** The match to spectate. Passed in from the parent's list so we can render
   *  team labels immediately before data loads. */
  match: MatchWithDetails;
}

const noop = () => {};

export function SpectateMatchCard({ match: seedMatch }: SpectateMatchCardProps) {
  const data = useSpectateMatch(seedMatch.id);

  if (data.isLoading || !data.match || !data.homeLineup || !data.awayLineup) {
    return (
      <div className="border-y bg-card py-6 flex items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">
          Loading {seedMatch.home_team?.team_name || 'Home'} vs{' '}
          {seedMatch.away_team?.team_name || 'Away'}…
        </span>
      </div>
    );
  }

  // Cast seedMatch.table_number etc. aren't needed here — the scoreboards
  // read what they need from the match + lineups they receive.
  const matchForScoreboard = {
    ...data.match,
    home_team_verified_by: (data.match as any).home_team_verified_by ?? null,
    away_team_verified_by: (data.match as any).away_team_verified_by ?? null,
  };

  // Fargo: TenSevenScoreboard with point-accumulation display.
  // Phase 5 Unit 5.5: points + game counts come from the match row
  // (maintained per-game by `updateMatchRunningTotals`). The
  // start-points breakdown is the only Fargo-specific bit, derived from
  // the match row's repurposed `*_to_tie` columns in useSpectateMatch.
  if (data.handicapType === 'fargo') {
    return (
      <TenSevenScoreboard
        match={matchForScoreboard}
        homeLineup={data.homeLineup}
        awayLineup={data.awayLineup}
        homePoints={data.homePoints}
        awayPoints={data.awayPoints}
        homeGamesWon={data.homeWins}
        awayGamesWon={data.awayWins}
        totalScheduledGames={data.gameResults.size}
        startPoints={data.startPoints}
        startPointsFor={data.startPointsFor}
        allGamesComplete={data.allGamesComplete}
        isHomeTeam={false}
        onVerify={noop}
        isVerifying={false}
        gameType={data.gameType}
        getPlayerDisplayName={data.getPlayerDisplayName}
        getPlayerStats={data.getPlayerStats}
        getPlayerPoints={data.getPlayerPoints}
        // onSwapPlayer omitted — the 10-7 card only shows the swap action on
        // the current user's team and we're spectating, so it stays hidden.
      />
    );
  }

  // BCA systems — fall through to format-specific scoreboard.
  if (!data.homeThresholds || !data.awayThresholds) {
    return (
      <div className="border-y bg-card py-6 text-center text-sm text-muted-foreground">
        {data.match.home_team?.team_name || 'Home'} vs{' '}
        {data.match.away_team?.team_name || 'Away'} — scoring not yet started.
      </div>
    );
  }

  if (data.is5v5) {
    return (
      <FiveVFiveScoreboard
        match={matchForScoreboard}
        homeLineup={data.homeLineup}
        awayLineup={data.awayLineup}
        homeThresholds={data.homeThresholds}
        awayThresholds={data.awayThresholds}
        homeWins={data.homeWins}
        awayWins={data.awayWins}
        homeLosses={data.homeLosses}
        awayLosses={data.awayLosses}
        homePoints={data.homePoints}
        awayPoints={data.awayPoints}
        allGamesComplete={data.allGamesComplete}
        isHomeTeam={false}
        onVerify={noop}
        isVerifying={false}
        gameType={data.gameType}
        getPlayerDisplayName={data.getPlayerDisplayName}
        getPlayerStats={data.getPlayerStats}
      />
    );
  }

  return (
    <ThreeVThreeScoreboard
      match={matchForScoreboard}
      homeLineup={data.homeLineup}
      awayLineup={data.awayLineup}
      homeThresholds={data.homeThresholds}
      awayThresholds={data.awayThresholds}
      homeWins={data.homeWins}
      awayWins={data.awayWins}
      homeLosses={data.homeLosses}
      awayLosses={data.awayLosses}
      homePoints={data.homePoints}
      awayPoints={data.awayPoints}
      homeTeamHandicap={0}
      allGamesComplete={data.allGamesComplete}
      isHomeTeam={false}
      onVerify={noop}
      isVerifying={false}
      gameType={data.gameType}
      getPlayerDisplayName={data.getPlayerDisplayName}
      getPlayerStats={data.getPlayerStats}
    />
  );
}
