/**
 * @fileoverview VenuesModeStep — "Same venues?" gate (next-season only).
 *
 * Same shape as the other Keep/Change gates:
 *   Keep   → snapshot the previous-season venue IDs + auto-advance;
 *            VenueSelectionStep hidden via showIf.
 *   Change → mode='change' + auto-advance; VenueSelectionStep renders
 *            for free editing.
 *
 * For first-season flows the step's `showIf` hides it (no previous
 * venues to confirm) so the original VenueSelectionStep runs alone.
 */

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useVenuesByOrganization } from '@/api/hooks/useVenues';
import type { WizardStepProps } from '@/components/wizard';
import type { TeamsWizardFormData } from '../teamsWizardTypes';

type ModeValue = NonNullable<TeamsWizardFormData['venues-mode']>;

interface FlowContextShape {
  organizationId?: string;
  previousSeasonVenueIds?: string[];
}

export function VenuesModeStep({
  onChange,
  onNext,
  formData,
}: WizardStepProps<ModeValue | undefined, TeamsWizardFormData>) {
  const flowContext = (formData as Record<string, unknown>)._flowContext as
    | FlowContextShape
    | undefined;

  const prevVenueIds = flowContext?.previousSeasonVenueIds ?? [];
  const { data: venues = [] } = useVenuesByOrganization(flowContext?.organizationId);

  // Map IDs → names for the human-readable summary.
  const prevVenueNames = prevVenueIds
    .map((id) => venues.find((v: { id: string; name: string }) => v.id === id)?.name)
    .filter((n): n is string => !!n);

  const keepSnapshot: ModeValue = { mode: 'keep', venueIds: prevVenueIds };

  // No mount auto-fill: the summary should only reflect the operator's
  // active choices. The Keep button writes the snapshot.

  const handleKeep = () => {
    onChange(keepSnapshot);
    onNext();
  };

  const handleChange = () => {
    onChange({ mode: 'change' });
    onNext();
  };

  const usedCount = prevVenueIds.length;
  const totalCount = venues.length;
  const nameList = prevVenueNames.join(', ');

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <Label className="text-base">Venues</Label>
        <p className="text-foreground mt-1">
          Last season&rsquo;s teams played at{' '}
          <strong>
            {usedCount} of {totalCount} venue{totalCount === 1 ? '' : 's'}
          </strong>
          {nameList ? <>: {nameList}</> : null}. Same venues this season?
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          You can always add or remove venues later from the league&rsquo;s
          venue settings.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Button onClick={handleKeep} loadingText="none">
          Keep — same venues
        </Button>
        <Button variant="outline" onClick={handleChange} loadingText="none">
          Change venues →
        </Button>
      </div>
    </div>
  );
}
