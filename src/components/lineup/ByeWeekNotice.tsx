/**
 * @fileoverview Bye-week notice for the lineup page.
 *
 * Shown in place of the lineup builder when a match contains the BYE team. A
 * bye matchup is not a real match — there's no opponent to play and no lineup
 * to build — so the real team's players see this instead, and the page never
 * tries to render a lineup against the roster-less bye. The state is conveyed
 * with an icon + text (not color), so it reads clearly regardless of theme or
 * color vision.
 */

import { Link } from 'react-router-dom';
import { ArrowLeft, CalendarOff } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface ByeWeekNoticeProps {
  /** The viewing player's team id — drives the Back to Schedule links. */
  userTeamId: string | null | undefined;
}

export function ByeWeekNotice({ userTeamId }: ByeWeekNoticeProps) {
  const scheduleTo = userTeamId ? `/team/${userTeamId}/schedule` : null;

  return (
    <div className="min-h-screen bg-muted">
      <header className="bg-card border-b sticky top-0 z-10">
        <div className="px-4 py-3">
          {scheduleTo && (
            <Link
              to={scheduleTo}
              className="flex items-center gap-2 text-sm text-muted-foreground mb-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Schedule
            </Link>
          )}
          <div className="text-4xl font-semibold text-foreground">Bye Week</div>
        </div>
      </header>

      <main className="px-4 py-6 max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarOff className="h-5 w-5" />
              You have a bye this week
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Your team isn&rsquo;t matched against another team this week, so
              there&rsquo;s no lineup to set and no match to play. Your bye is
              recorded for you automatically &mdash; nothing to do here.
            </p>
            {scheduleTo && (
              <Button asChild variant="outline">
                <Link to={scheduleTo}>Back to Schedule</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
