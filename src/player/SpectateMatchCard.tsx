/**
 * @fileoverview Single-match scoreboard card for the spectator page.
 *
 * Renders one match in read-only spectator mode through the same
 * `UnifiedScoreboard` that the live scoring page uses. Mounts its own
 * data + realtime subscription via `useSpectateMatch` so each card ticks
 * live independently.
 *
 * This component is deliberately dumb — it doesn't know who's watching,
 * what team they're on, or whether they have any relationship to this
 * match. It just fetches state and renders. `isHomeTeam` is hard-coded to
 * false so no player-team-only affordances leak through; onVerify /
 * onSwapPlayer are no-ops and never visually surface in read-only paths.
 *
 * Pre-Unit-7-of-unified-scoreboard-plan, this component had its own
 * 3-way dispatch (Fargo / 5v5 / 3v3). Unit 7 collapsed that to a single
 * UnifiedScoreboard call, mirroring the live scoring page's collapse in
 * Unit 5.
 */

import { Loader2 } from 'lucide-react';
import { UnifiedScoreboard } from '@/components/scoring/UnifiedScoreboard';
import { useSpectateMatch } from '@/hooks/useSpectateMatch';
import { getCalculator } from '@/systems/calculators';
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

  if (!data.homeThresholds || !data.awayThresholds) {
    return (
      <div className="border-y bg-card py-6 text-center text-sm text-muted-foreground">
        {data.match.home_team?.team_name || 'Home'} vs{' '}
        {data.match.away_team?.team_name || 'Away'} — scoring not yet started.
      </div>
    );
  }

  // Same per-game-calculator gate as ScoreMatch.tsx — only pass
  // getPlayerPoints when the calculator awards per-player points (e.g.
  // accumulated_per_game). Aggregate calculators get undefined and the
  // P column hides.
  const calculatorName = data.match.system_snapshot?.points_calculator;
  const activeCalculator = calculatorName ? getCalculator(calculatorName) : null;
  const isPerGameCalculator = activeCalculator?.kind === 'per_game';

  const matchForScoreboard = {
    ...data.match,
    home_team_verified_by: (data.match as any).home_team_verified_by ?? null,
    away_team_verified_by: (data.match as any).away_team_verified_by ?? null,
  };

  return (
    <UnifiedScoreboard
      match={matchForScoreboard}
      homeLineup={data.homeLineup}
      awayLineup={data.awayLineup}
      homeThresholds={data.homeThresholds}
      awayThresholds={data.awayThresholds}
      homeLosses={data.homeLosses}
      awayLosses={data.awayLosses}
      allGamesComplete={data.allGamesComplete}
      isHomeTeam={false}
      onVerify={noop}
      isVerifying={false}
      gameType={data.gameType}
      winCondition={data.winCondition}
      lineupSize={data.lineupSize}
      getPlayerDisplayName={data.getPlayerDisplayName}
      getPlayerStats={data.getPlayerStats}
      // onSwapPlayer omitted — read-only spectator view has no swap UX.
      getPlayerPoints={isPerGameCalculator ? data.getPlayerPoints : undefined}
    />
  );
}
