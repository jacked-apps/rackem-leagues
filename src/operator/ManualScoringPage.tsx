/**
 * @fileoverview LO manual-scoring page (Setup → Entry).
 *
 * STUB: this Unit-4 placeholder makes the `league/:leagueId/manual-scoring/:matchId`
 * route resolve so the picker navigation works end-to-end in dev. The two-phase
 * Setup (lineups → "Setup Match") and Entry (scoreboard + per-game scoring +
 * "Finalize Match") UI land in Units 5–6, along with the page-level R11 re-check.
 *
 * @see docs/plans/2026-06-03-001-feat-lo-manual-match-scoring-plan.md — Units 4–6
 */

import { useParams } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent } from '@/components/ui/card';

export default function ManualScoringPage() {
  const { leagueId, matchId } = useParams<{ leagueId: string; matchId: string }>();

  return (
    <div>
      <PageHeader
        title="Enter Match Scores"
        backTo={`/league/${leagueId}/manual-scoring`}
        subtitle="Manual scoring"
      />
      <Card className="m-4">
        <CardContent className="p-6 text-center text-muted-foreground">
          Manual scoring for match <span className="font-mono">{matchId}</span> — the
          Setup and Entry phases are under construction (Units 5–6).
        </CardContent>
      </Card>
    </div>
  );
}
