/**
 * @fileoverview VenuesPanel — the "League Venues" section of the Manage Teams
 * editing surface: select-all, per-venue assign toggle + table-limit entry, and
 * the empty/add-venue state. Presentational — the container passes the data and
 * the action callbacks; this panel derives assigned/capacity/teams-at-venue from
 * the venue + league-venue + team data. Extracted from
 * `src/operator/TeamManagement.tsx` as part of the content/chrome decomposition.
 */

import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { VenueListItem } from '@/components/VenueListItem';
import type { Venue, LeagueVenue } from '@/types/venue';
import type { TeamWithQueryDetails } from '@/types/team';

interface VenuesPanelProps {
  venues: Venue[];
  leagueVenues: LeagueVenue[];
  teams: TeamWithQueryDetails[];
  /** Null while the league hasn't loaded — disables venue creation. */
  organizationId: string | null;
  /** Venue id currently mid-toggle (disables that row), or null. */
  assigningVenueId: string | null;
  /** True while the select-all bulk action is in flight. */
  selectingAll: boolean;
  onSelectAll: () => void;
  onNewVenue: () => void;
  onToggleVenue: (venue: Venue) => void;
  onOpenLimitModal: (venue: Venue) => void;
}

export function VenuesPanel({
  venues,
  leagueVenues,
  teams,
  organizationId,
  assigningVenueId,
  selectingAll,
  onSelectAll,
  onNewVenue,
  onToggleVenue,
  onOpenLimitModal,
}: VenuesPanelProps) {
  const isVenueAssigned = (venueId: string): boolean =>
    leagueVenues.some((lv) => lv.venue_id === venueId);

  const areAllVenuesAssigned = (): boolean =>
    venues.length > 0 && venues.every((venue) => isVenueAssigned(venue.id));

  const getTeamsAtVenue = (venueId: string): number =>
    teams.filter((team) => team.home_venue_id === venueId).length;

  return (
    <div className="bg-card rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-foreground">League Venues</h2>
        {venues.length > 0 && (
          <Button size="sm" variant="outline" onClick={onNewVenue} disabled={!organizationId}>
            <Plus className="h-4 w-4 mr-2" />
            New
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Select venues teams can use and adjust number of tables actually available
      </p>

      {/* Select All Checkbox */}
      {venues.length > 0 && (
        <div className="flex items-center gap-3 p-2 bg-muted rounded mb-2">
          <input
            type="checkbox"
            checked={areAllVenuesAssigned()}
            onChange={onSelectAll}
            disabled={selectingAll}
            className="mt-0"
          />
          <span className="text-sm font-medium text-foreground">
            {selectingAll ? 'Updating...' : 'Select All'}
          </span>
        </div>
      )}

      {venues.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-sm text-muted-foreground mb-3">No venues yet</p>
          <Button size="sm" onClick={onNewVenue} disabled={!organizationId} loadingText="none">
            <Plus className="h-4 w-4 mr-2" />
            Add Venue
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {venues.map((venue) => {
            const assigned = isVenueAssigned(venue.id);
            const leagueVenue = leagueVenues.find((lv) => lv.venue_id === venue.id);
            const venueCapacity = leagueVenue?.capacity ?? leagueVenue?.available_table_numbers?.length;
            const teamsAtVenue = getTeamsAtVenue(venue.id);

            return (
              <VenueListItem
                key={venue.id}
                venue={venue}
                isAssigned={assigned}
                isToggling={assigningVenueId === venue.id}
                capacity={venueCapacity}
                teamsAtVenue={teamsAtVenue}
                onToggle={() => onToggleVenue(venue)}
                onLimitClick={() => onOpenLimitModal(venue)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
