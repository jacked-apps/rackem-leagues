/**
 * @fileoverview Operator match picker for LO manual scoring.
 *
 * Lists the active season's weeks (accordion) with each match's status. Only
 * `scheduled` matches (with two real teams) are clickable — they open the
 * manual-scoring page for that match. Ineligible matches show a status badge but
 * aren't actionable, which also sets up the future "take over any match" end-state.
 *
 * Reached from the league dashboard's "Score a Match" card. Entry is dev-gated
 * (hidden in production) until the scoring page (Units 5–6) is built out.
 *
 * @see docs/plans/2026-06-03-001-feat-lo-manual-match-scoring-plan.md — Unit 4
 */

import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useActiveSeason } from '@/api/hooks';
import { useSeasonSchedule } from '@/hooks/useSeasonSchedule';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import { parseLocalDate } from '@/utils/formatters';
import {
  isMatchEligibleForManualScoring,
  isMatchEligibleForReview,
  manualScoringStatusLabel,
} from '@/utils/match/manualScoringEligibility';
import type { MatchWithDetails } from '@/types/schedule';

function formatWeekDate(scheduledDate: string | undefined): string {
  if (!scheduledDate) return 'Week';
  return parseLocalDate(scheduledDate).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * One match row: matchup + status badge.
 *
 * A `scheduled` match (with two real teams) is clickable and opens the v1
 * enter-from-blank flow (`onScore`). A finished match (`completed` /
 * `awaiting_verification`, or a reopened-not-refinalized one) is clickable and
 * opens the v2 review/correct surface (`onReview`). Everything else is greyed.
 */
function MatchRow({
  match,
  onScore,
  onReview,
  onLmsSheet,
}: {
  match: MatchWithDetails;
  onScore: () => void;
  onReview: () => void;
  onLmsSheet: () => void;
}) {
  const label = `${match.home_team?.team_name ?? 'BYE'} vs ${match.away_team?.team_name ?? 'BYE'}`;

  if (isMatchEligibleForManualScoring(match)) {
    return (
      <Button
        variant="outline"
        className="w-full justify-between"
        onClick={onScore}
        data-testid="eligible-match"
      >
        <span>{label}</span>
        <Badge>{manualScoringStatusLabel(match.status)}</Badge>
      </Button>
    );
  }

  if (isMatchEligibleForReview(match)) {
    return (
      <div className="flex w-full items-center gap-2">
        <Button
          variant="outline"
          className="flex-1 justify-between"
          onClick={onReview}
          data-testid="review-match"
        >
          <span>{label}</span>
          <Badge variant="outline">Review · {manualScoringStatusLabel(match.status)}</Badge>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0"
          onClick={onLmsSheet}
          title="Print results for CSI / FargoRate LMS"
          data-testid="lms-sheet"
        >
          <Printer className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div
      className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-muted-foreground opacity-60"
      data-testid="ineligible-match"
    >
      <span>{label}</span>
      <Badge variant="secondary">{manualScoringStatusLabel(match.status)}</Badge>
    </div>
  );
}

export default function ManualScoringMatchPicker() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const navigate = useNavigate();
  const { data: activeSeason, isLoading: seasonLoading } = useActiveSeason(leagueId);
  const { schedule, loading, error } = useSeasonSchedule(activeSeason?.id, leagueId);

  const weeksWithMatches = useMemo(
    () => schedule.filter((w) => w.matches.length > 0),
    [schedule]
  );
  // Actionable = scheduled (v1 enter-from-blank) OR finished (v2 review/correct).
  const totalActionable = useMemo(
    () =>
      schedule.reduce(
        (n, w) =>
          n +
          w.matches.filter(
            (m) => isMatchEligibleForManualScoring(m) || isMatchEligibleForReview(m)
          ).length,
        0
      ),
    [schedule]
  );

  const header = (
    <PageHeader
      title="Enter Match Scores"
      backTo={`/league/${leagueId}`}
      subtitle="Record a match that was played on paper"
    />
  );

  if (seasonLoading || loading) {
    return (
      <div>
        {header}
        <p className="p-4 text-muted-foreground">Loading schedule…</p>
      </div>
    );
  }

  if (error || !activeSeason) {
    return (
      <div>
        {header}
        <Card className="m-4">
          <CardContent className="p-6 text-center text-muted-foreground">
            {error ? 'Failed to load the schedule.' : 'This league has no active season.'}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      {header}
      <div className="space-y-4 p-4">
        {totalActionable === 0 && (
          <Card>
            <CardContent className="p-4 text-center text-muted-foreground">
              No matches are currently available to score or review.
            </CardContent>
          </Card>
        )}

        {weeksWithMatches.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              No matches scheduled yet.
            </CardContent>
          </Card>
        ) : (
          <Accordion
            type="multiple"
            defaultValue={weeksWithMatches.map((w) => w.week.id)}
            className="space-y-2"
          >
            {weeksWithMatches.map((w) => (
              <AccordionItem key={w.week.id} value={w.week.id}>
                <AccordionTrigger>{formatWeekDate(w.week.scheduled_date)}</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2">
                    {w.matches.map((match) => (
                      <MatchRow
                        key={match.id}
                        match={match}
                        onScore={() =>
                          navigate(`/league/${leagueId}/manual-scoring/${match.id}`)
                        }
                        onReview={() =>
                          navigate(`/league/${leagueId}/match-review/${match.id}`)
                        }
                        onLmsSheet={() =>
                          navigate(`/league/${leagueId}/match/${match.id}/lms-sheet`)
                        }
                      />
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </div>
    </div>
  );
}
