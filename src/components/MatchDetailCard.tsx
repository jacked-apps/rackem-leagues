/**
 * @fileoverview Match Detail Card Component
 *
 * Reusable card component that displays comprehensive match information.
 * Fetches its own data based on matchId - fully self-contained.
 * Shows teams, scores, winner, games won, points earned, and handicap thresholds.
 *
 * Can be used anywhere in the app - just pass a matchId!
 */

import { useMatchById } from '@/api/hooks/useMatches';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface MatchDetailCardProps {
  /** Match ID to display */
  matchId: string;
  /**
   * Player-facing trim. When true, hides operational/debug chrome that only
   * matters to operators — the match number, the status chip, and the
   * home/away verification ticks. The schedule's completed-match dropdown sets
   * this; the debug MatchDataViewer leaves it off to keep the full picture.
   * The winner chip and all score/threshold data stay either way.
   */
  playerView?: boolean;
  /**
   * Derived week label ("Week 5") from the parent, which has the season's full
   * week list. A self-contained single-match card can't derive its own number;
   * falls back to the stored week_name until that column is dropped.
   */
  weekLabel?: string;
}

/**
 * Match Detail Card Component
 *
 * Displays complete match information in a visually organized card layout.
 * Fetches match data automatically using TanStack Query.
 *
 * Features:
 * - Header with match info (number, week, date, status, verification)
 * - Two-column layout for home/away teams
 * - Games won, points earned for each team
 * - Handicap thresholds (to win, to tie, to lose)
 * - Winner highlighting with colored backgrounds
 * - Final score summary
 *
 * @example
 * <MatchDetailCard matchId="match-uuid-here" />
 */
export function MatchDetailCard({ matchId, playerView = false, weekLabel }: MatchDetailCardProps) {
  const { data: match, isLoading, error } = useMatchById(matchId);

  // Helper: Determine match winner
  const getWinner = (match: any) => {
    // Check match_result field first (authoritative)
    if (match.match_result === 'home_win') return 'home';
    if (match.match_result === 'away_win') return 'away';
    if (match.match_result === 'tie') return 'tie';

    // Fallback to games won comparison
    if (match.home_games_won === null || match.away_games_won === null) return null;
    if (match.home_games_won > match.away_games_won) return 'home';
    if (match.away_games_won > match.home_games_won) return 'away';
    return 'tie';
  };

  // Helper: Get status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'in_progress': return 'bg-blue-500';
      case 'awaiting_verification': return 'bg-yellow-500';
      case 'scheduled': return 'bg-gray-400';
      default: return 'bg-gray-400';
    }
  };

  if (isLoading) {
    return (
      <Card className="overflow-hidden">
        <div className="p-8 text-center text-muted-foreground">Loading match data...</div>
      </Card>
    );
  }

  if (error || !match) {
    return (
      <Card className="overflow-hidden">
        <div className="p-8 text-center text-destructive">
          Error loading match: {error ? (error as Error).message : 'Match not found'}
        </div>
      </Card>
    );
  }

  const winner = getWinner(match);
  const hasScores = match.home_games_won !== null && match.away_games_won !== null;

  return (
    <Card className="overflow-hidden py-0 gap-0">
      {/* Header Row - Match Info — flush to the top edge (py-0/gap-0 on the Card
          root) so the muted bar's top corners follow the card's rounded curve. */}
      <div className="bg-muted px-4 py-2 border-b flex flex-wrap items-center gap-4 text-sm">
        {/* Match number — operator/debug only. */}
        {!playerView && <div className="font-semibold">Match #{match.match_number}</div>}
        <div className="text-muted-foreground">
          {weekLabel ?? match.season_week?.week_name ?? 'Week ?'}
        </div>
        <div className="text-muted-foreground">
          {match.season_week?.scheduled_date
            ? new Date(match.season_week.scheduled_date).toLocaleDateString()
            : 'Date TBD'
          }
        </div>
        {/* Status chip — operator/debug only; in the player schedule the row's
            own "Final" tag already says this. */}
        {!playerView && (
          <Badge className={getStatusColor(match.status)}>
            {match.status.replace(/_/g, ' ')}
          </Badge>
        )}
        {hasScores && winner && (
          <Badge className={winner === 'home' ? 'bg-green-600' : winner === 'away' ? 'bg-blue-600' : 'bg-gray-600'}>
            {winner === 'home' ? 'Home Win' : winner === 'away' ? 'Away Win' : 'Tie'}
          </Badge>
        )}
        {/* Verification ticks — operator/debug only. */}
        {!playerView && (
          <div className="ml-auto flex gap-2">
            {(match as any).home_team_verified_by && (
              <Badge variant="outline" className="text-xs">Home ✓</Badge>
            )}
            {(match as any).away_team_verified_by && (
              <Badge variant="outline" className="text-xs">Away ✓</Badge>
            )}
          </div>
        )}
      </div>

      {/* Match Details - Two-column mobile-responsive grid */}
      <div className="p-2">
        <div className="grid md:grid-cols-2 gap-3">
          {/* Home Team Column */}
          <div className={`space-y-2 p-1.5 rounded-lg border-2 ${winner === 'home' ? 'bg-success/10 border-success/40' : 'border-border'}`}>
            <div className="flex items-center justify-between mb-2">
              <h3 className={`font-bold text-lg ${winner === 'home' ? 'text-success' : 'text-foreground'}`}>
                🏠 {match.home_team?.team_name || 'Home TBD'}
              </h3>
              {winner === 'home' && (
                <Badge className="bg-green-600">WINNER</Badge>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Games Won:</span>
                <div className="font-bold text-xl">{match.home_games_won ?? '-'}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Points Earned:</span>
                <div className="font-bold text-xl text-info">
                  {match.home_points_earned ?? '-'}
                </div>
              </div>
            </div>

            {/* Handicap Thresholds — games-mode concept; meaningless under a
                points system. Operator/debug only. */}
            {!playerView && (
              <div className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
                <div className="font-semibold mb-1">Thresholds (Handicapped):</div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <span className="text-muted-foreground">To Win:</span>
                    <div className="font-medium">{match.home_to_win ?? '-'}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">To Tie:</span>
                    <div className="font-medium">{match.home_to_tie ?? '-'}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">To Lose:</span>
                    <div className="font-medium">
                      {match.away_to_win ? `< ${match.away_to_win}` : '-'}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Away Team Column */}
          <div className={`space-y-2 p-1.5 rounded-lg border-2 ${winner === 'away' ? 'bg-info/10 border-info/40' : 'border-border'}`}>
            <div className="flex items-center justify-between mb-2">
              <h3 className={`font-bold text-lg ${winner === 'away' ? 'text-info' : 'text-foreground'}`}>
                ✈️ {match.away_team?.team_name || 'Away TBD'}
              </h3>
              {winner === 'away' && (
                <Badge className="bg-blue-600">WINNER</Badge>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Games Won:</span>
                <div className="font-bold text-xl">{match.away_games_won ?? '-'}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Points Earned:</span>
                <div className="font-bold text-xl text-info">
                  {match.away_points_earned ?? '-'}
                </div>
              </div>
            </div>

            {/* Handicap Thresholds — operator/debug only (see home column). */}
            {!playerView && (
              <div className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
                <div className="font-semibold mb-1">Thresholds (Handicapped):</div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <span className="text-muted-foreground">To Win:</span>
                    <div className="font-medium">{match.away_to_win ?? '-'}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">To Tie:</span>
                    <div className="font-medium">{match.away_to_tie ?? '-'}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">To Lose:</span>
                    <div className="font-medium">
                      {match.home_to_win ? `< ${match.home_to_win}` : '-'}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Match Summary Row — the per-team "Games Won" already shows this same
            score, so it's redundant in the player view. Operator/debug only. */}
        {!playerView && hasScores && (
          <div className="mt-4 pt-4 border-t border-border text-center">
            <div className="text-sm text-muted-foreground">Final Score</div>
            <div className="text-3xl font-bold font-mono mt-1">
              {match.home_games_won} - {match.away_games_won}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              Game Differential: {Math.abs((match.home_games_won ?? 0) - (match.away_games_won ?? 0))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
