/**
 * @fileoverview Captain re-up modal.
 *
 * Shown when `useCaptainReupPrompt` detects the current user is
 * captain of any team(s) inside the last-3-weeks re-up window with
 * no submitted answer + no active dismissal.
 *
 * Two-phase UI:
 *   - Phase 1 (intro): big "Same as last season" CTA + "Make changes"
 *     + "Not now". Defaults captain to no-change, team to returning —
 *     one tap → done forever for that team.
 *   - Phase 2 (form): rendered if captain chose "Make changes". Uses
 *     CaptainReupForm.
 *
 * Multi-team handling (per brainstorm): a captain with multiple
 * qualifying teams gets ONE modal with the intro phase showing each
 * team in its own card. Each team's "Same as last season" + "Make
 * changes" is independent. "Not now" defers ALL teams (single defer
 * to keep the captain UX dead-simple).
 */

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Pencil } from 'lucide-react';
import { useSubmitCaptainReup, useDismissCaptainReup } from '@/api/hooks/useCaptainReup';
import { CaptainReupForm, type CaptainReupFormTeamContext } from './CaptainReupForm';

export interface CaptainReupModalTeam extends CaptainReupFormTeamContext {
  // (alias — kept distinct so callers can extend later)
}

interface CaptainReupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teams: CaptainReupModalTeam[];
  /** The member id of the captain currently using the app — used as
   *  audit trail and as the default same-captain choice. */
  currentCaptainId: string;
}

type TeamUiState =
  | { phase: 'intro' }
  | { phase: 'submitted' } // answered via "Same as last season" or form save
  | { phase: 'form' };     // currently in the "Make changes" form

export function CaptainReupModal({
  open,
  onOpenChange,
  teams,
  currentCaptainId,
}: CaptainReupModalProps) {
  // Per-team UI state (intro / form / submitted). All start at intro.
  const [perTeam, setPerTeam] = useState<Record<string, TeamUiState>>(
    () => Object.fromEntries(teams.map((t) => [t.teamId, { phase: 'intro' }])),
  );

  const submit = useSubmitCaptainReup();
  const dismiss = useDismissCaptainReup();

  const handleSameAsLast = async (team: CaptainReupModalTeam) => {
    await submit.mutateAsync({
      seasonId: team.seasonId,
      teamId: team.teamId,
      captainId: team.currentCaptainId,
      returningNextSeason: true,
      nextCaptainId: null,
      submittedByCaptainId: currentCaptainId,
    });
    setPerTeam((prev) => ({ ...prev, [team.teamId]: { phase: 'submitted' } }));
  };

  const handleMakeChanges = (teamId: string) => {
    setPerTeam((prev) => ({ ...prev, [teamId]: { phase: 'form' } }));
  };

  const handleFormSubmitted = (teamId: string) => {
    setPerTeam((prev) => ({ ...prev, [teamId]: { phase: 'submitted' } }));
  };

  const handleDismissAll = async () => {
    // Single defer: dismiss all qualifying teams in one go so the
    // captain doesn't have to tap "Not now" once per team.
    await Promise.all(
      teams
        .filter((t) => perTeam[t.teamId]?.phase === 'intro')
        .map((t) =>
          dismiss.mutateAsync({
            seasonId: t.seasonId,
            teamId: t.teamId,
            captainId: t.currentCaptainId,
          }),
        ),
    );
    onOpenChange(false);
  };

  // If every team has been submitted, close the modal automatically.
  const allDone = teams.every(
    (t) => perTeam[t.teamId]?.phase === 'submitted',
  );
  if (allDone && open) {
    // Defer the close to the next tick so the user sees the green
    // confirmation briefly.
    setTimeout(() => onOpenChange(false), 800);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>End of the season is here</DialogTitle>
          <DialogDescription>
            Let your league operator know your plans for next season.
            {teams.length > 1 &&
              ` You captain ${teams.length} team${teams.length === 1 ? '' : 's'} — answer for each below.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          {teams.map((team) => {
            const state = perTeam[team.teamId] ?? { phase: 'intro' };

            if (state.phase === 'submitted') {
              return (
                <div
                  key={team.teamId}
                  className="border rounded-lg p-4 bg-green-50 dark:bg-green-950/20 border-green-300 dark:border-green-800 flex items-center gap-2"
                >
                  <CheckCircle2 className="h-5 w-5 text-green-700 dark:text-green-400" />
                  <span className="font-medium">{team.teamName}</span>
                  <span className="text-sm text-muted-foreground">— saved</span>
                </div>
              );
            }

            if (state.phase === 'form') {
              return (
                <div key={team.teamId} className="border rounded-lg p-4">
                  <CaptainReupForm
                    team={team}
                    submittedByCaptainId={currentCaptainId}
                    onSubmitted={() => handleFormSubmitted(team.teamId)}
                  />
                </div>
              );
            }

            // Intro phase — big primary "Same as last season" + small "Make changes"
            return (
              <div key={team.teamId} className="border rounded-lg p-4 space-y-3">
                <div className="font-semibold">{team.teamName}</div>
                <Button
                  loadingText="Saving..."
                  isLoading={submit.isPending}
                  onClick={() => handleSameAsLast(team)}
                  className="w-full h-12 text-base"
                >
                  <CheckCircle2 className="h-5 w-5 mr-2" />
                  Same as last season
                </Button>
                <Button
                  variant="outline"
                  loadingText="none"
                  onClick={() => handleMakeChanges(team.teamId)}
                  className="w-full"
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Make changes
                </Button>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end pt-2 border-t">
          <Button
            variant="ghost"
            loadingText="none"
            onClick={handleDismissAll}
            disabled={dismiss.isPending}
          >
            Not now
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
