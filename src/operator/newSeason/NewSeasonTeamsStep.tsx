/**
 * @fileoverview Step 2 of the "Start Next Season" wizard — returning
 * teams.
 *
 * Per Ed's separation-of-concerns rule (2026-05-17): the operator
 * only handles TWO things in this step — dropouts (uncheck rows) and
 * captain changes (when the previous captain is archived/unavailable
 * and a new one is required). Team names and rosters are NOT
 * editable here; captains handle them post-activation via
 * TeamEditorModal.
 *
 * Closes Unit 4 of docs/plans/2026-05-17-001-feat-new-season-from-previous-plan.md.
 */

import { useMemo } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { MemberCombobox } from '@/components/MemberCombobox';
import { AlertTriangle, Users } from 'lucide-react';
import { useAllMembers } from '@/api/hooks';
import type { NewSeasonPrefill } from '@/api/queries/newSeasonPrefill';

export interface TeamDecision {
  sourceTeamId: string;
  included: boolean;
  captainId: string | null;
  teamName: string; // read-only display only
  homeVenueId: string | null;
}

interface NewSeasonTeamsStepProps {
  prefill: NewSeasonPrefill;
  teams: TeamDecision[];
  onChange: (teams: TeamDecision[]) => void;
}

export function NewSeasonTeamsStep({
  prefill,
  teams,
  onChange,
}: NewSeasonTeamsStepProps) {
  const { data: members = [] } = useAllMembers();

  // Map team decisions back onto their source team data for the
  // vacancy badge + name display. Source order is preserved.
  const rows = useMemo(() => {
    return teams.map((decision) => {
      const source = prefill.returningTeams.find(
        (t) => t.id === decision.sourceTeamId,
      );
      return { decision, source };
    });
  }, [teams, prefill.returningTeams]);

  const updateDecision = (
    sourceTeamId: string,
    patch: Partial<TeamDecision>,
  ) => {
    onChange(
      teams.map((t) =>
        t.sourceTeamId === sourceTeamId ? { ...t, ...patch } : t,
      ),
    );
  };

  const checkedCount = teams.filter((t) => t.included).length;

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        All teams from {prefill.previousSeason.season_name} are checked
        by default. Uncheck any that aren't returning. If a team's
        previous captain is no longer available, pick a new one.
        Roster changes and team renames are handled by captains after
        the season activates.
      </p>

      <div className="space-y-3">
        {rows.map(({ decision, source }) => {
          if (!source) return null;
          const captainBroken =
            decision.included &&
            (!decision.captainId ||
              !members.find((m) => m.id === decision.captainId));
          const captainNeedsAttention = captainBroken;

          return (
            <div
              key={decision.sourceTeamId}
              className={[
                'border rounded-lg p-4 transition-colors',
                !decision.included && 'opacity-50 bg-muted/30',
                captainNeedsAttention &&
                  decision.included &&
                  'border-yellow-400 bg-yellow-50 dark:bg-yellow-950/20',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <div className="flex items-start gap-3">
                <Checkbox
                  id={`team-${decision.sourceTeamId}`}
                  checked={decision.included}
                  onCheckedChange={(checked) =>
                    updateDecision(decision.sourceTeamId, {
                      included: !!checked,
                    })
                  }
                  className="mt-1"
                />
                <div className="flex-1 min-w-0">
                  <Label
                    htmlFor={`team-${decision.sourceTeamId}`}
                    className="text-base font-semibold cursor-pointer"
                  >
                    {source.team_name}
                  </Label>

                  {source.vacancyCount > 0 && decision.included && (
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {source.vacancyCount} roster{' '}
                      {source.vacancyCount === 1 ? 'vacancy' : 'vacancies'} —
                      the captain will fill these after the season starts
                    </p>
                  )}

                  {decision.included && (
                    <div className="mt-3 max-w-md">
                      <Label className="text-xs text-muted-foreground">
                        Captain
                      </Label>
                      <MemberCombobox
                        members={members}
                        value={decision.captainId ?? ''}
                        onValueChange={(memberId) =>
                          updateDecision(decision.sourceTeamId, {
                            captainId: memberId || null,
                          })
                        }
                        placeholder="Pick a captain..."
                      />
                      {captainBroken && (
                        <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-1 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Previous captain unavailable — pick a new one to
                          continue.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-sm text-muted-foreground border-t pt-3">
        {checkedCount} team{checkedCount === 1 ? '' : 's'} returning of{' '}
        {teams.length} previous-season team{teams.length === 1 ? '' : 's'}.
      </div>
    </div>
  );
}
