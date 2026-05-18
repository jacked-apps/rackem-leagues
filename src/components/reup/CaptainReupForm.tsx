/**
 * @fileoverview "Make changes" form for one team's re-up response.
 *
 * Used inside CaptainReupModal AND on the dedicated /reup page
 * reachable from the hamburger menu. Two inputs only:
 *   - Returning toggle (yes/no)
 *   - Captain dropdown (current team members)
 *
 * Submit fires `useSubmitCaptainReup`. Parent provides the team
 * info; this component is presentation-only state-wise.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { MemberCombobox } from '@/components/MemberCombobox';
import { useSubmitCaptainReup } from '@/api/hooks/useCaptainReup';
import type { PartialMember } from '@/types/member';

export interface CaptainReupFormTeamContext {
  seasonId: string;
  teamId: string;
  teamName: string;
  currentCaptainId: string;
  /** Roster members eligible to be selected as next captain. Driven
   *  by the parent — typically the team's current rostered players. */
  eligibleCaptains: PartialMember[];
}

interface CaptainReupFormProps {
  team: CaptainReupFormTeamContext;
  /** The member id of whoever is filling out the form (audit trail). */
  submittedByCaptainId: string;
  /** Called after a successful submit so the parent can close the
   *  modal / advance the multi-team panel / etc. */
  onSubmitted?: () => void;
}

export function CaptainReupForm({
  team,
  submittedByCaptainId,
  onSubmitted,
}: CaptainReupFormProps) {
  const [returning, setReturning] = useState(true);
  const [nextCaptainId, setNextCaptainId] = useState(team.currentCaptainId);

  const submit = useSubmitCaptainReup();

  const handleSubmit = async () => {
    await submit.mutateAsync({
      seasonId: team.seasonId,
      teamId: team.teamId,
      captainId: team.currentCaptainId,
      returningNextSeason: returning,
      nextCaptainId:
        returning && nextCaptainId && nextCaptainId !== team.currentCaptainId
          ? nextCaptainId
          : null,
      submittedByCaptainId,
    });
    onSubmitted?.();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <Checkbox
          id={`returning-${team.teamId}`}
          checked={returning}
          onCheckedChange={(checked) => setReturning(!!checked)}
        />
        <Label htmlFor={`returning-${team.teamId}`} className="cursor-pointer">
          <span className="font-medium">{team.teamName}</span> will be playing
          next season
        </Label>
      </div>

      {returning && (
        <div className="ml-7 space-y-2">
          <Label className="text-sm text-muted-foreground">
            Captain next season
          </Label>
          <MemberCombobox
            members={team.eligibleCaptains}
            value={nextCaptainId}
            onValueChange={(id) => setNextCaptainId(id)}
            placeholder="Pick a captain..."
          />
          <p className="text-xs text-muted-foreground">
            Defaults to you. Pick a teammate if you're handing off.
          </p>
        </div>
      )}

      <div className="flex justify-end">
        <Button
          loadingText="Saving..."
          isLoading={submit.isPending}
          onClick={handleSubmit}
        >
          Save
        </Button>
      </div>
    </div>
  );
}
