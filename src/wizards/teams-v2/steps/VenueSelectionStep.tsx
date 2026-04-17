/**
 * @fileoverview VenueSelectionStep — pick venues for this league
 *
 * Shows a checkbox list of existing venues in the operator's org.
 * Includes a button to open VenueCreationModal for adding new venues.
 * Saves the selected venue IDs to form data as a string array.
 */

import { useState } from 'react';
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
}: WizardStepProps<string[] | undefined, TeamsWizardFormData>) {
  const { orgId } = useParams<{ orgId: string }>();
  const { data: venues = [], isLoading } = useVenuesByOrganization(orgId);
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
        <p className="font-medium text-gray-900">Which venues does this league use?</p>
        <InfoButton title="Venues" size="sm">
          <p>
            Select the venues where league matches will be played. You
            can add new venues if they&rsquo;re not in the list. Venue
            assignments can be changed later in the league settings.
          </p>
        </InfoButton>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500">Loading venues...</p>
      ) : venues.length === 0 ? (
        <p className="text-sm text-gray-500">
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
                className="size-5 border-2 border-gray-400"
              />
              <Label htmlFor={`venue-${venue.id}`} className="flex-1 cursor-pointer">
                <span className="font-medium">{venue.name}</span>
                {venue.city && <span className="text-gray-500 text-sm ml-2">{venue.city}</span>}
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
