/**
 * @fileoverview Venue Management Page
 *
 * Allows operators to view and manage their venues.
 * When accessed with a leagueId query param, shows league-specific venue management:
 * - Which org venues are assigned to this league
 * - Toggle to assign/unassign venues from the league
 * - Table limit configuration for assigned venues
 *
 * @example
 * // Organization-level venue management
 * /venues/org-123
 *
 * // League-specific venue management
 * /venues/org-123?leagueId=league-456
 */
import React, { useState, useMemo } from 'react';
import { Plus, Check } from 'lucide-react';
import { useParams, useSearchParams } from 'react-router-dom';
import { VenueCreationModal } from '@/components/operator/VenueCreationModal';
import { VenueCard } from '@/components/operator/VenueCard';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useVenuesByOrganization, useLeagueVenues, useLeagueById } from '@/api/hooks';
import { useAddLeagueVenue, useRemoveLeagueVenue } from '@/api/hooks/useLeagueVenueMutations';
import { VenueLimitModal } from './VenueLimitModal';
import type { Venue, LeagueVenue } from '@/types/venue';
import { parseLocalDate } from '@/utils/formatters';
import { buildLeagueTitle, getTimeOfYear } from '@/utils/leagueUtils';

/**
 * VenueManagement Component
 *
 * Lists all venues for the organization with ability to add/edit.
 * When leagueId query param is present, shows league-specific controls:
 * - Visual indicator for venues assigned to the league
 * - Toggle to assign/unassign venues
 * - Table limit configuration for assigned venues
 */
export const VenueManagement: React.FC = () => {
  const { orgId } = useParams<{ orgId: string }>();
  const [searchParams] = useSearchParams();
  const leagueId = searchParams.get('leagueId');

  // Fetch all org venues
  const { data: venues = [], isLoading: venuesLoading, refetch } = useVenuesByOrganization(orgId!);

  // Fetch league data and league venues if in league context
  const { data: league, isLoading: leagueLoading } = useLeagueById(leagueId);
  const { data: leagueVenues = [], refetch: refetchLeagueVenues } = useLeagueVenues(leagueId);

  // Mutations for adding/removing league venues
  const addLeagueVenueMutation = useAddLeagueVenue();
  const removeLeagueVenueMutation = useRemoveLeagueVenue();

  const [showModal, setShowModal] = useState(false);
  const [editingVenue, setEditingVenue] = useState<Venue | null>(null);
  const [limitModalVenue, setLimitModalVenue] = useState<{ venue: Venue; leagueVenue: LeagueVenue } | null>(null);

  /**
   * Map of venue IDs to their league venue records for quick lookup
   */
  const leagueVenueMap = useMemo(() => {
    const map = new Map<string, LeagueVenue>();
    leagueVenues.forEach(lv => map.set(lv.venue_id, lv));
    return map;
  }, [leagueVenues]);

  /**
   * Check if a venue is assigned to the current league
   */
  const isVenueAssigned = (venueId: string): boolean => {
    return leagueVenueMap.has(venueId);
  };

  /**
   * Get league venue record for a venue
   */
  const getLeagueVenue = (venueId: string): LeagueVenue | undefined => {
    return leagueVenueMap.get(venueId);
  };

  /**
   * Generate display name for league
   */
  const getLeagueName = (): string => {
    if (!league) return '';
    const startDate = parseLocalDate(league.league_start_date);
    const season = getTimeOfYear(startDate);
    const year = startDate.getFullYear();
    return buildLeagueTitle({
      gameType: league.game_type,
      dayOfWeek: league.day_of_week,
      division: league.division,
      season,
      year
    });
  };

  /**
   * Handle toggling venue assignment to league
   */
  const handleToggleAssignment = async (venue: Venue, isCurrentlyAssigned: boolean) => {
    if (!leagueId) return;

    if (isCurrentlyAssigned) {
      // Remove venue from league
      const leagueVenue = getLeagueVenue(venue.id);
      if (leagueVenue) {
        await removeLeagueVenueMutation.mutateAsync({ leagueVenueId: leagueVenue.id });
        refetchLeagueVenues();
      }
    } else {
      // Add venue to league with all tables available by default
      const allTableNumbers = [
        ...(venue.bar_box_table_numbers ?? []),
        ...(venue.eight_foot_table_numbers ?? []),
        ...(venue.regulation_table_numbers ?? []),
      ].sort((a, b) => a - b);

      await addLeagueVenueMutation.mutateAsync({
        leagueId,
        venueId: venue.id,
        availableTableNumbers: allTableNumbers,
        capacity: allTableNumbers.length,
      });
      refetchLeagueVenues();
    }
  };

  /**
   * Open table limits modal for an assigned venue
   */
  const handleEditLimits = (venue: Venue) => {
    const leagueVenue = getLeagueVenue(venue.id);
    if (leagueVenue) {
      setLimitModalVenue({ venue, leagueVenue });
    }
  };

  /**
   * Handle successful venue creation or update
   */
  const handleVenueCreated = () => {
    // Refetch venues to get latest data from cache/server
    refetch();
    setShowModal(false);
    setEditingVenue(null);
  };

  /**
   * Open modal to edit existing venue
   */
  const handleEditVenue = (venue: Venue) => {
    setEditingVenue(venue);
    setShowModal(true);
  };

  // Determine back navigation based on context
  const backTo = leagueId ? `/league/${leagueId}/settings` : `/operator-settings/${orgId}`;
  const backLabel = leagueId ? 'Back to League Settings' : 'Back to Settings';

  const loading = venuesLoading || (leagueId && leagueLoading);

  if (loading) {
    return (
      <div className="min-h-screen bg-muted py-8">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="text-center text-muted-foreground">Loading venues...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted">
      <PageHeader
        backTo={backTo}
        backLabel={backLabel}
        title="Manage Venues"
        subtitle="Add and manage venues where your leagues play"
      >
        <Button onClick={() => setShowModal(true)} className="mt-4" loadingText="none">
          <Plus className="h-5 w-5 mr-2" />
          Add Venue
        </Button>
      </PageHeader>

      <div className="container mx-auto px-4 max-w-7xl py-8">
        {/* League Context Banner */}
        {leagueId && league && (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <Check className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-blue-900">
                  Managing venues for: <span className="font-bold">{getLeagueName()}</span>
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  Toggle venues on/off to assign them to this league. Click &quot;Set Limits&quot; to adjust table availability.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Venues List */}
        {venues.length === 0 ? (
          <div className="bg-card rounded-xl shadow-sm p-12 text-center">
            <div className="text-6xl mb-4">🏢</div>
            <h3 className="text-lg font-medium text-foreground mb-2">No Venues Yet</h3>
            <p className="text-muted-foreground mb-6">
              Add your first venue to start organizing league play locations.
            </p>
            <Button onClick={() => setShowModal(true)} loadingText="none">
              Add First Venue
            </Button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {venues.map((venue) => {
              const assigned = isVenueAssigned(venue.id);
              const leagueVenue = getLeagueVenue(venue.id);

              return (
                <div
                  key={venue.id}
                  className={`relative ${leagueId && assigned ? 'ring-2 ring-green-500 rounded-xl' : ''}`}
                >
                  {/* League assignment controls */}
                  {leagueId && (
                    <div className={`absolute top-0 left-0 right-0 z-10 p-3 rounded-t-xl ${assigned ? 'bg-green-50' : 'bg-muted'}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Switch
                            id={`assign-${venue.id}`}
                            checked={assigned}
                            onCheckedChange={() => handleToggleAssignment(venue, assigned)}
                            disabled={addLeagueVenueMutation.isPending || removeLeagueVenueMutation.isPending}
                          />
                          <Label
                            htmlFor={`assign-${venue.id}`}
                            className={`text-sm font-medium ${assigned ? 'text-green-700' : 'text-muted-foreground'}`}
                          >
                            {assigned ? 'Assigned' : 'Not Assigned'}
                          </Label>
                        </div>
                        {assigned && leagueVenue && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditLimits(venue)}
                          >
                            Set Limits
                          </Button>
                        )}
                      </div>
                      {assigned && leagueVenue && (
                        <div className="mt-2 text-xs text-green-700">
                          {leagueVenue.available_table_numbers?.length > 0
                            ? `${leagueVenue.available_table_numbers.length} tables available`
                            : 'No tables assigned'}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Venue Card with top padding when in league context */}
                  <div className={leagueId ? 'pt-20' : ''}>
                    <VenueCard
                      venue={venue}
                      onEdit={handleEditVenue}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Venue Creation/Edit Modal */}
        {showModal && orgId && (
          <VenueCreationModal
            organizationId={orgId}
            onSuccess={handleVenueCreated}
            onCancel={() => {
              setShowModal(false);
              setEditingVenue(null);
            }}
            existingVenue={editingVenue}
          />
        )}

        {/* Table Limits Modal */}
        {limitModalVenue && (
          <VenueLimitModal
            venue={limitModalVenue.venue}
            leagueVenue={limitModalVenue.leagueVenue}
            allLeagueVenues={leagueVenues}
            onSuccess={() => {
              setLimitModalVenue(null);
              refetchLeagueVenues();
            }}
            onCancel={() => setLimitModalVenue(null)}
          />
        )}
      </div>
    </div>
  );
};

export default VenueManagement;
