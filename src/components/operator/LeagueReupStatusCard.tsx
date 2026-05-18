/**
 * @fileoverview LO-facing "Re-up Status" card.
 *
 * Renders on the league page during the 3-week re-up window. Shows
 * per-team response state so the LO knows who's responded, who's
 * dropping, and who still needs chasing.
 *
 * Hidden entirely outside the window — the hook reports
 * `withinWindow: false` and we render null.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, UserPlus, XCircle, AlertTriangle, ClipboardCheck } from 'lucide-react';
import { useLeagueReupStatus } from '@/api/hooks/useLeagueReupStatus';
import type { ReupResponseState } from '@/api/queries/leagueReupStatus';

interface LeagueReupStatusCardProps {
  leagueId: string;
}

export function LeagueReupStatusCard({ leagueId }: LeagueReupStatusCardProps) {
  const { data, isLoading } = useLeagueReupStatus(leagueId);

  if (isLoading || !data || !data.withinWindow) return null;
  if (data.entries.length === 0) return null;

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ClipboardCheck className="h-5 w-5 text-blue-600" />
          Re-up Status
          <span className="text-sm font-normal text-muted-foreground ml-2">
            {data.countSubmitted} of {data.entries.length} confirmed
            {data.countNoResponse > 0 &&
              ` · ${data.countNoResponse} still waiting`}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {data.entries.map((entry) => (
            <li
              key={entry.teamId}
              className="flex items-center justify-between gap-3 p-2 rounded hover:bg-muted/50"
            >
              <div className="flex items-center gap-2 min-w-0">
                <StateIcon state={entry.state} />
                <div className="min-w-0">
                  <div className="font-medium truncate">{entry.teamName}</div>
                  {entry.captainName && (
                    <div className="text-xs text-muted-foreground">
                      Captain: {entry.captainName}
                    </div>
                  )}
                </div>
              </div>
              <div className="text-sm text-right flex-shrink-0">
                <StateLabel state={entry.state} />
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function StateIcon({ state }: { state: ReupResponseState }) {
  switch (state.kind) {
    case 'returning_same':
      return <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />;
    case 'returning_new_captain':
      return <UserPlus className="h-5 w-5 text-blue-600 flex-shrink-0" />;
    case 'not_returning':
      return <XCircle className="h-5 w-5 text-red-600 flex-shrink-0" />;
    case 'no_response':
      return <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0" />;
  }
}

function StateLabel({ state }: { state: ReupResponseState }) {
  switch (state.kind) {
    case 'returning_same':
      return <span className="text-green-700 dark:text-green-400">Returning, same captain</span>;
    case 'returning_new_captain':
      return (
        <span className="text-blue-700 dark:text-blue-400">
          Returning, new captain: {state.nextCaptainName}
        </span>
      );
    case 'not_returning':
      return <span className="text-red-700 dark:text-red-400">Not returning (will drop)</span>;
    case 'no_response':
      return <span className="text-yellow-700 dark:text-yellow-400">No response yet (will drop)</span>;
  }
}
