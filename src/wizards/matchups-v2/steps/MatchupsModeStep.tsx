/**
 * @fileoverview MatchupsModeStep — "Fast-track or order teams myself?" gate.
 *
 * Two paths the operator can take to set up matchups:
 *   Fast-track  → loads teams, randomizes their schedule positions,
 *                 stashes the result on the gate slice, and advances
 *                 directly to the Review step (PositionsStep hidden
 *                 via showIf). Lets returning LOs blast through when
 *                 they don't care about the order.
 *   Manual      → advances to PositionsStep as before. Operators who
 *                 want a specific position order (or to seed it
 *                 deterministically and then shuffle interactively)
 *                 take this path.
 *
 * Why stash positions on the gate slice instead of writing directly
 * to formData.positions: the wizard's onChange only writes to the
 * CURRENT step's slot. ReviewStep falls back to this slot when the
 * positions step didn't render.
 */

import { useQuery } from '@tanstack/react-query';
import { Shuffle, ListOrdered } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { supabase } from '@/supabaseClient';
import { assignRandomPositions } from '@/utils/scheduleGenerator';
import type { WizardStepProps } from '@/components/wizard';
import type { MatchupsWizardFormData, MatchupTeamPosition } from '../matchupsWizardTypes';

type ModeValue = NonNullable<MatchupsWizardFormData['matchups-mode']>;

function seedSequentialPositions(
  teams: { id: string; team_name: string; home_venue_id: string | null }[],
): MatchupTeamPosition[] {
  const seeded: MatchupTeamPosition[] = teams.map((t, i) => ({
    id: t.id,
    team_name: t.team_name,
    home_venue_id: t.home_venue_id,
    schedule_position: i + 1,
  }));
  // Odd team count gets a BYE row appended so the round-robin
  // generator can pair every real team each week.
  if (teams.length % 2 !== 0) {
    seeded.push({
      id: 'BYE',
      team_name: 'BYE',
      home_venue_id: null,
      schedule_position: teams.length + 1,
    });
  }
  return seeded;
}

export function MatchupsModeStep({
  onChange,
  onNext,
  formData,
}: WizardStepProps<ModeValue | undefined, MatchupsWizardFormData>) {
  const ctx = (formData as Record<string, unknown>)._flowContext as
    | { seasonId?: string }
    | undefined;
  const seasonId = ctx?.seasonId;

  const { data: teams = [], isLoading } = useQuery({
    queryKey: ['teams', 'matchup-positions', seasonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teams')
        .select('id, team_name, home_venue_id')
        .eq('season_id', seasonId!)
        .eq('status', 'active')
        .order('created_at', { ascending: true });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    enabled: !!seasonId,
  });

  const handleFastTrack = () => {
    if (teams.length === 0) return;
    const seeded = seedSequentialPositions(teams);
    const randomized = assignRandomPositions(seeded);
    onChange({ mode: 'fast', positions: randomized });
    onNext();
  };

  const handleManual = () => {
    onChange({ mode: 'manual' });
    onNext();
  };

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <Label className="text-base">Matchups</Label>
        <p className="text-foreground mt-1">
          How would you like to set up the schedule of who plays who?
        </p>
      </div>

      {/* Both choices are equal-weight valid paths — same variant + same
          width so they read as parallel actions, not "primary +
          secondary". Visual styling (color tokens, dark-mode contrast)
          is Jack's call; matching the sizes is the dev side. */}
      <div className="flex flex-col gap-3">
        <Button
          onClick={handleFastTrack}
          disabled={isLoading || teams.length === 0}
          loadingText="none"
          className="w-full justify-start"
        >
          <Shuffle className="size-4" />
          Randomize teams and create matchups
        </Button>
        <Button
          onClick={handleManual}
          loadingText="none"
          className="w-full justify-start"
        >
          <ListOrdered className="size-4" />
          Manually organize teams
        </Button>
      </div>

      {teams.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {teams.length} team{teams.length === 1 ? '' : 's'} ready to schedule.
          You&rsquo;ll still review every week (and can edit any one) on the
          next page either way.
        </p>
      )}
    </div>
  );
}
