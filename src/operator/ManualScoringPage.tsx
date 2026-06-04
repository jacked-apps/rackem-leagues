/**
 * @fileoverview LO manual-scoring page host — dispatches Setup vs Entry phase.
 *
 * Loads the match + resolved league prefs and routes on match status:
 *  - `scheduled`   → Setup phase (enter lineups → "Setup Match").
 *  - `in_progress` → Entry phase (score games → "Finalize Match"). Built in Unit 6;
 *                    a placeholder + "match set up" banner stands in for now.
 *  - anything else → not eligible / already scored.
 *
 * This is the page-level R11 re-check (the picker also gates eligibility).
 *
 * @see docs/plans/2026-06-03-001-feat-lo-manual-match-scoring-plan.md — Units 5–6
 */

import { useParams } from 'react-router-dom';
import { useMatchWithLeagueSettings } from '@/api/hooks';
import { useResolvedLeaguePrefs } from '@/api/hooks/useResolvedLeaguePrefs';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { SetupPhase } from '@/components/operator/manual-scoring/SetupPhase';
import type { SystemOverrides } from '@/types/systemOverrides';

/** The match fields this page reads (the hook's full type is broader). */
interface MatchView {
  id: string;
  status: string;
  home_team_id: string;
  away_team_id: string;
  home_team?: { team_name?: string } | null;
  away_team?: { team_name?: string } | null;
  league?: {
    id?: string;
    handicap_variant?: 'standard' | 'reduced' | 'none';
    game_type?: string;
  } | null;
}

/** The resolved-prefs fields this page reads. */
interface PrefsView {
  lineup_size?: number;
  handicap_type?: string;
  win_condition?: 'games' | 'points';
  mechanism?: 'extra_games' | 'start_points' | 'race_length_adjustment' | 'none';
  game_generation?: string;
  system_overrides?: SystemOverrides;
}

export default function ManualScoringPage() {
  const { leagueId, matchId } = useParams<{ leagueId: string; matchId: string }>();
  const matchQuery = useMatchWithLeagueSettings(matchId);
  const match = matchQuery.data as unknown as MatchView | undefined;
  const resolvedLeagueId = match?.league?.id ?? leagueId;
  const prefsQuery = useResolvedLeaguePrefs(resolvedLeagueId);
  const prefs = prefsQuery.data as unknown as PrefsView | undefined;

  const header = (
    <PageHeader
      title="Enter Match Scores"
      backTo={`/league/${leagueId}/manual-scoring`}
      subtitle="Record a match that was played on paper"
    />
  );

  const message = (text: string) => (
    <div>
      {header}
      <Card className="m-4">
        <CardContent className="p-6 text-center text-muted-foreground">{text}</CardContent>
      </Card>
    </div>
  );

  if (matchQuery.isLoading || (match && prefsQuery.isLoading)) {
    return message('Loading…');
  }
  if (!match) {
    return message('Match not found.');
  }

  const status = match.status as string;

  if (status === 'scheduled') {
    if (!prefs) return message('Loading league settings…');
    return (
      <div>
        {header}
        <SetupPhase
          matchId={match.id}
          leagueId={resolvedLeagueId as string}
          homeTeamId={match.home_team_id}
          awayTeamId={match.away_team_id}
          homeTeamName={match.home_team?.team_name ?? 'Home'}
          awayTeamName={match.away_team?.team_name ?? 'Away'}
          lineupSize={prefs.lineup_size ?? 3}
          handicapType={prefs.handicap_type ?? 'points'}
          handicapVariant={match.league?.handicap_variant ?? 'standard'}
          gameType={match.league?.game_type ?? 'eight_ball'}
          winCondition={prefs.win_condition}
          mechanism={prefs.mechanism}
          gameGeneration={prefs.game_generation}
          systemOverrides={prefs.system_overrides}
          onSetupComplete={() => matchQuery.refetch()}
        />
      </div>
    );
  }

  if (status === 'in_progress') {
    // Entry phase (scoreboard + per-game scoring + Finalize) lands in Unit 6.
    return message('Match is set up. The scoring (Entry) phase is under construction (Unit 6).');
  }

  return message('This match is already scored or is not eligible for manual entry.');
}
