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

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { CheckCircle2, UserPlus, XCircle, AlertTriangle, ClipboardCheck, Bell } from 'lucide-react';
import { useLeagueReupStatus } from '@/api/hooks/useLeagueReupStatus';
import { clearReupDismissals } from '@/api/mutations/captainReup';
import type { ReupResponseState } from '@/api/queries/leagueReupStatus';

interface LeagueReupStatusCardProps {
  leagueId: string;
}

export function LeagueReupStatusCard({ leagueId }: LeagueReupStatusCardProps) {
  const { data, isLoading } = useLeagueReupStatus(leagueId);
  const queryClient = useQueryClient();
  // Track which row is currently being reminded so its button can show
  // a per-row loading state without blocking the others.
  const [pendingTeamId, setPendingTeamId] = useState<string | null>(null);

  const remindMutation = useMutation({
    mutationFn: clearReupDismissals,
    onSettled: () => {
      // Refresh the LO card + invalidate the captain modal's cache so
      // the next captain page load sees the cleared dismissal.
      queryClient.invalidateQueries({ queryKey: ['leagueReupStatus', leagueId] });
      queryClient.invalidateQueries({ queryKey: ['captainReupPrompt'] });
    },
  });

  if (isLoading || !data || !data.withinWindow || !data.seasonId) return null;
  if (data.entries.length === 0) return null;

  // "Remind all" appears when ANY team is still missing a submission —
  // the LO doesn't need to know "dismissed vs never-seen" plumbing.
  // Both states resolve to "captain will see the modal next page load"
  // after the mutation clears any dismissals.
  const noResponseCount = data.entries.filter(
    (e) => e.state.kind === 'no_response',
  ).length;

  const remindOne = async (teamId: string) => {
    setPendingTeamId(teamId);
    try {
      await remindMutation.mutateAsync({ seasonId: data.seasonId!, teamId });
      toast.success('Captain will see the re-up prompt on their next page load.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remind');
    } finally {
      setPendingTeamId(null);
    }
  };

  const remindAll = async () => {
    setPendingTeamId('__all__');
    try {
      await remindMutation.mutateAsync({ seasonId: data.seasonId! });
      toast.success('All pending captains will see the prompt on their next page load.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remind');
    } finally {
      setPendingTeamId(null);
    }
  };

  return (
    <Card className="mb-6 px-4">
      {/* Wrapped in an accordion so the operator can collapse it once
          they've eyeballed the status. Defaults to closed — the header
          alone (counts) is usually enough at-a-glance; the per-team
          list is on-demand. */}
      <Accordion type="single" collapsible>
        <AccordionItem value="reup" className="border-b-0">
          <AccordionTrigger className="py-3 hover:no-underline">
            <div className="flex items-center gap-2 text-lg font-semibold">
              <ClipboardCheck className="h-5 w-5 text-blue-600" />
              Re-up Status
              <span className="text-sm font-normal text-muted-foreground ml-2">
                {data.countSubmitted} of {data.entries.length} confirmed
                {data.countNoResponse > 0 &&
                  ` · ${data.countNoResponse} still waiting`}
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            {noResponseCount > 0 && (
              <div className="flex justify-end mb-2">
                <Button
                  variant="outline"
                  loadingText="Sending…"
                  isLoading={pendingTeamId === '__all__'}
                  onClick={remindAll}
                  disabled={pendingTeamId !== null}
                >
                  <Bell className="size-4" />
                  Remind all ({noResponseCount})
                </Button>
              </div>
            )}
            <ul className="space-y-2">
              {data.entries.map((entry) => {
                const canRemind = entry.state.kind === 'no_response';
                return (
                  <li
                    key={entry.teamId}
                    className="flex items-center gap-3 p-2 rounded hover:bg-muted/50"
                  >
                    {/* Remind button on the LEFT. Rendered with
                        `invisible` for submitted rows so the column
                        stays aligned across all rows. Mobile: just
                        the bell icon (sm:inline shows the word on
                        desktop). */}
                    <Button
                      variant="outline"
                      size="sm"
                      loadingText="…"
                      isLoading={pendingTeamId === entry.teamId}
                      onClick={() => remindOne(entry.teamId)}
                      disabled={pendingTeamId !== null || !canRemind}
                      className={canRemind ? '' : 'invisible'}
                      aria-label="Remind"
                    >
                      <Bell className="size-4" />
                      <span className="hidden sm:inline">Remind</span>
                    </Button>
                    <StateIcon state={entry.state} />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{entry.teamName}</div>
                      {entry.captainName && (
                        <div className="text-xs text-muted-foreground">
                          Captain: {entry.captainName}
                        </div>
                      )}
                    </div>
                    <div className="text-sm text-right flex-shrink-0">
                      <StateLabel state={entry.state} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
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
