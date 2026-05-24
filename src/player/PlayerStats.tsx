/**
 * @fileoverview Personal Stats Page (PLACEHOLDER)
 *
 * Landing page at `/stats` for a player's personal stats across every
 * league and season they've played in. **This is a placeholder** — the
 * real implementation (lifetime win/loss, breaks/runs, Fargo trend,
 * cross-season comparisons, etc.) is a separate planned feature
 * tracked in the project memory bank as a backlog item.
 *
 * The route exists now so the global drawer's "Stats" entry resolves
 * to a real page instead of a 404. Per-season league stats (Standings,
 * Top Shooters, Team Stats, Feats of Excellence) continue to live on
 * their existing `/league/:leagueId/season/:seasonId/...` routes.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/PageHeader';

/**
 * Personal stats landing page (placeholder).
 *
 * Future scope (not in this branch): lifetime aggregate stats, cross-
 * season trends, per-game-type breakdowns, Fargo rating history, feats
 * earned, comparisons against league averages.
 */
export function PlayerStats() {
  return (
    <div className="min-h-screen bg-muted">
      <PageHeader
        backTo="/my-teams"
        backLabel="Home"
        title="My Stats"
        subtitle="Your personal stats across every league you play in"
      />
      <div className="container mx-auto max-w-2xl px-4 py-6">
        <Card>
          <CardHeader>
            <CardTitle>Personal stats are on the way</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-foreground">
            <p>
              This page will eventually pull together your stats across every
              league and season you&apos;ve played in: win/loss record, breaks,
              runs, Fargo rating trend, feats earned, and comparisons across
              seasons.
            </p>
            <p>
              For now, season-specific stats live inside each league. Open one
              of your teams from the menu to see Standings, Top Shooters, Team
              Stats, and Feats of Excellence for that season.
            </p>
            <p className="text-xs italic text-muted-foreground">
              (Personal stats build-out is tracked in the project backlog.)
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default PlayerStats;
