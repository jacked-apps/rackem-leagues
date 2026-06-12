/**
 * @fileoverview VenueSelectionStep — pick venues for this league
 *
 * Shows a checkbox list of existing venues in the operator's org.
 * Includes a button to open VenueCreationModal for adding new venues.
 * Saves the selected venue IDs to form data as a string array.
 */

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { InfoButton } from '@/components/InfoButton';
import { VenueCreationModal } from '@/components/operator/VenueCreationModal';
import { useVenuesByOrganization } from '@/api/hooks/useVenues';
import type { WizardStepProps } from '@/components/wizard';
import type { TeamsWizardFormData } from '../teamsWizardTypes';

export function VenueSelectionStep({
  value,
  onChange,
  formData,
}: WizardStepProps<string[] | undefined, TeamsWizardFormData>) {
  // organizationId comes from the URL on the create-new-league route
  // (`/create-league/:orgId`) but NOT on the create-next-season route
  // (`/operator/start-next-season/:leagueId`). The flow context fills
  // it in for both, so prefer that and fall back to useParams.
  const { orgId: orgIdFromUrl } = useParams<{ orgId: string }>();
  const flowContext = (formData as Record<string, unknown>)._flowContext as
    | { organizationId?: string; previousSeasonVenueIds?: string[] }
    | undefined;
  const orgId = flowContext?.organizationId ?? orgIdFromUrl;
  const { data: venues = [], isLoading } = useVenuesByOrganization(orgId);

  // Next-season pre-fill: when the operator clicks "Change venues" on
  // the gate, drop them into this editor with the previous season's
  // venues already checked. First-season flows have no
  // `previousSeasonVenueIds`, so this effect is a no-op there.
  const prevVenueIds = flowContext?.previousSeasonVenueIds;
  useEffect(() => {
    if (!value && prevVenueIds?.length) {
      onChange([...prevVenueIds]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prevVenueIds?.join('|')]);
  const [showCreate, setShowCreate] = useState(false);

  const selected = value ?? [];

  const toggleVenue = (venueId: string) => {
    if (selected.includes(venueId)) {
      onChange(selected.filter((id) => id !== venueId));
    } else {
      onChange([...selected, venueId]);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1">
        <p className="font-medium text-foreground">Which venues does this league use?</p>
        <InfoButton title="Venues" size="sm">
          <p>
            Select the venues where league matches will be played. You
            can add new venues if they&rsquo;re not in the list. Venue
            assignments can be changed later in the league settings.
          </p>
        </InfoButton>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading venues...</p>
      ) : venues.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No venues yet. Click &ldquo;Add New Venue&rdquo; below to create one.
        </p>
      ) : (
        <div className="space-y-2">
          {venues.map((venue) => (
            <div key={venue.id} className="flex items-center gap-3 p-3 border rounded-lg">
              <Checkbox
                id={`venue-${venue.id}`}
                checked={selected.includes(venue.id)}
                onCheckedChange={() => toggleVenue(venue.id)}
                className="size-5 border-2 border-input"
              />
              <Label htmlFor={`venue-${venue.id}`} className="flex-1 cursor-pointer">
                <span className="font-medium">{venue.name}</span>
                {venue.city && <span className="text-muted-foreground text-sm ml-2">{venue.city}</span>}
              </Label>
            </div>
          ))}
        </div>
      )}

      <Button variant="outline" onClick={() => setShowCreate(true)}>
        + Add New Venue
      </Button>

      {showCreate && orgId && (
        <VenueCreationModal
          organizationId={orgId}
          onCancel={() => setShowCreate(false)}
          onSuccess={(newVenue) => {
            onChange([...selected, newVenue.id]);
            setShowCreate(false);
          }}
        />
      )}
    </div>
  );
}
