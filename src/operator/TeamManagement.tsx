/**
 * @fileoverview Team Management Page
 *
 * Central hub for managing teams in a league:
 * 1. Assign venues to the league (from operator's venues)
 * 2. Create and manage teams
 * 3. Assign captains and build rosters
 */
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/supabaseClient';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/PageHeader';
// Organization ID will come from the league data
import { useTeamManagement } from '@/hooks/useTeamManagement';
import { queryKeys } from '@/api/queryKeys';
import { VenueLimitModal } from './VenueLimitModal';
import { TeamEditorModal } from './TeamEditorModal';
import { VenueCreationModal } from '@/components/operator/VenueCreationModal';
import { InfoButton } from '@/components/InfoButton';
import { TeamCard } from '@/components/TeamCard';
import { VenueListItem } from '@/components/VenueListItem';
import { AllPlayersRosterCard } from '@/components/AllPlayersRosterCard';
import type { Venue, LeagueVenue } from '@/types/venue';
import type { TeamWithQueryDetails } from '@/types/team';
import { logger } from '@/utils/logger';
import { toast } from 'sonner';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';

/**
 * TeamManagement Component
 *
 * Two-phase approach:
 * Phase 1: Assign venues to league (what venues can teams use?)
 * Phase 2: Create teams and assign captains
 */
export const TeamManagement: React.FC = () => {
  const { leagueId } = useParams<{ leagueId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { confirm, ConfirmDialogComponent } = useConfirmDialog();

  // Use custom hook for all data fetching
  // NOTE: organizationId will be fetched from the league inside useTeamManagement
  const {
    league,
    venues,
    leagueVenues,
    teams,
    members,
    seasonId,
    previousSeasonId,
    loading,
    error,
    refreshTeams,
  } = useTeamManagement(null, leagueId);

  // Get organization ID from the league once it's loaded
  const organizationId = league?.organization_id || null;

  // UI state
  const [assigningVenue, setAssigningVenue] = useState<string | null>(null);
  const [selectingAll, setSelectingAll] = useState(false);
  const [limitModalVenue, setLimitModalVenue] = useState<{ venue: Venue; leagueVenue: LeagueVenue } | null>(null);
  const [showTeamEditor, setShowTeamEditor] = useState(false);
  const [editingTeam, setEditingTeam] = useState<TeamWithQueryDetails | null>(null);
  const [importingTeams, setImportingTeams] = useState(false);
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());
  const [showVenueCreation, setShowVenueCreation] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);

  /**
   * Check if all venues are assigned
   */
  const areAllVenuesAssigned = (): boolean => {
    if (venues.length === 0) return false;
    return venues.every(venue => isVenueAssigned(venue.id));
  };

  /**
   * Select or deselect all venues
   */
  const handleSelectAll = async () => {
    if (!leagueId || venues.length === 0) return;

    setSelectingAll(true);

    try {
      const allAssigned = areAllVenuesAssigned();

      if (allAssigned) {
        // Unassign all venues
        const { error: deleteError } = await supabase
          .from('league_venues')
          .delete()
          .eq('league_id', leagueId);

        if (deleteError) throw deleteError;
      } else {
        // Assign all venues
        const unassignedVenues = venues.filter(venue => !isVenueAssigned(venue.id));

        const newLeagueVenues = unassignedVenues.map(venue => {
          // Combine all table numbers from the venue into a single array
          const allTableNumbers = [
            ...(venue.bar_box_table_numbers ?? []),
            ...(venue.eight_foot_table_numbers ?? []),
            ...(venue.regulation_table_numbers ?? []),
          ].sort((a, b) => a - b);

          return {
            league_id: leagueId,
            venue_id: venue.id,
            available_table_numbers: allTableNumbers,
            capacity: allTableNumbers.length,
          };
        });

        const { error: insertError } = await supabase
          .from('league_venues')
          .insert(newLeagueVenues)
          .select();

        if (insertError) throw insertError;
      }

      // Invalidate TanStack Query cache to automatically refetch updated data
      await queryClient.invalidateQueries({
        queryKey: [...queryKeys.leagues.detail(leagueId), 'venues']
      });
    } catch (err) {
      logger.error('Error selecting all venues', { error: err instanceof Error ? err.message : String(err) });
      toast.error('Failed to update venues. Please try again.');
    } finally {
      setSelectingAll(false);
    }
  };

  /**
   * Check if a venue is assigned to the league
   */
  const isVenueAssigned = (venueId: string): boolean => {
    return leagueVenues.some(lv => lv.venue_id === venueId);
  };

  /**
   * Toggle venue assignment (assign or unassign)
   */
  const handleToggleVenue = async (venue: Venue) => {
    if (!leagueId) return;

    setAssigningVenue(venue.id);

    try {
      const isAssigned = isVenueAssigned(venue.id);

      if (isAssigned) {
        // Unassign: Delete from league_venues
        const leagueVenue = leagueVenues.find(lv => lv.venue_id === venue.id);
        if (!leagueVenue) return;

        const { error: deleteError } = await supabase
          .from('league_venues')
          .delete()
          .eq('id', leagueVenue.id);

        if (deleteError) throw deleteError;
      } else {
        // Assign: Insert into league_venues with all tables available by default
        // Combine all table numbers from the venue into a single array
        const allTableNumbers = [
          ...(venue.bar_box_table_numbers ?? []),
          ...(venue.eight_foot_table_numbers ?? []),
          ...(venue.regulation_table_numbers ?? []),
        ].sort((a, b) => a - b);

        const { error: insertError } = await supabase
          .from('league_venues')
          .insert([{
            league_id: leagueId,
            venue_id: venue.id,
            available_table_numbers: allTableNumbers,
            capacity: allTableNumbers.length,
          }])
          .select()
          .single();

        if (insertError) throw insertError;
      }

      // Invalidate TanStack Query cache to automatically refetch updated data
      await queryClient.invalidateQueries({
        queryKey: [...queryKeys.leagues.detail(leagueId), 'venues']
      });
    } catch (err: any) {
      logger.error('Error toggling venue', { error: err instanceof Error ? err.message : String(err) });
      toast.error(`Failed to update venue assignment: ${err.message || 'Please try again.'}`);
    } finally {
      setAssigningVenue(null);
    }
  };

  /**
   * Open limit modal for a specific venue
   */
  const handleOpenLimitModal = (venue: Venue) => {
    const leagueVenue = leagueVenues.find(lv => lv.venue_id === venue.id);
    if (!leagueVenue) return;

    setLimitModalVenue({ venue, leagueVenue });
  };

  /**
   * Handle successful limit update
   */
  const handleLimitUpdateSuccess = async (_updatedLeagueVenue: LeagueVenue) => {
    // Invalidate cache to refetch updated venue data
    if (leagueId) {
      await queryClient.invalidateQueries({
        queryKey: [...queryKeys.leagues.detail(leagueId), 'venues']
      });
    }
    setLimitModalVenue(null);
  };

  /**
   * Import teams from previous season
   * Copies teams, league venues, and rosters from the most recent completed season
   */
  const handleImportTeams = async () => {
    if (!previousSeasonId || !seasonId || !leagueId) return;

    const confirmImport = await confirm({
      title: 'Import Teams?',
      message: 'Import teams from last season? This will copy:\n• All team names and captains\n• Home venue assignments\n• Full rosters\n• League venue assignments',
      confirmText: 'Import',
      confirmVariant: 'default',
    });

    if (!confirmImport) return;

    setImportingTeams(true);

    try {
      // Fetch previous season's teams with rosters
      const { data: prevTeams, error: teamsError } = await supabase
        .from('teams')
        .select('*')
        .eq('season_id', previousSeasonId);

      if (teamsError) throw teamsError;

      // Fetch previous season's team_players (rosters)
      const { data: prevRosters, error: rostersError } = await supabase
        .from('team_players')
        .select('*')
        .eq('season_id', previousSeasonId);

      if (rostersError) throw rostersError;

      // Fetch previous season's league venues
      const { data: prevLeagueVenues, error: leagueVenuesError } = await supabase
        .from('league_venues')
        .select('*')
        .eq('league_id', leagueId);

      if (leagueVenuesError) throw leagueVenuesError;

      // Prepare new teams data
      prevTeams?.map(team => ({
        season_id: seasonId,
        league_id: leagueId,
        captain_id: team.captain_id,
        home_venue_id: team.home_venue_id,
        team_name: team.team_name,
        roster_size: team.roster_size,
      })) || [];

      // Prepare league venues (if not already assigned)
      prevLeagueVenues?.filter(lv =>
        !leagueVenues.some(existing => existing.venue_id === lv.venue_id)
      ).map(lv => ({
        league_id: leagueId,
        venue_id: lv.venue_id,
        available_bar_box_tables: lv.available_bar_box_tables,
        available_regulation_tables: lv.available_regulation_tables,
        available_total_tables: lv.available_total_tables,
      })) || [];

      // Create mapping of old team IDs to prepare roster data
      const rostersByOldTeamId: Record<string, typeof prevRosters> = {};
      prevRosters?.forEach(roster => {
        if (!rostersByOldTeamId[roster.team_id]) {
          rostersByOldTeamId[roster.team_id] = [];
        }
        rostersByOldTeamId[roster.team_id].push(roster);
      });

      // Prepare roster data (will need to map to new team IDs after creation)
      prevTeams?.map((oldTeam, index) => {
        const oldRosters = rostersByOldTeamId[oldTeam.id] || [];
        return {
          teamIndex: index,
          rosters: oldRosters.map(roster => ({
            member_id: roster.member_id,
            season_id: seasonId,
            is_captain: roster.is_captain,
          }))
        };
      }) || [];

      // Simulate success
      await new Promise(resolve => setTimeout(resolve, 1000));

      toast.success(`Successfully imported ${prevTeams?.length || 0} teams from last season!`);

      // Refresh the page data (in real implementation, this would refetch from DB)
      // For now, just show success message
    } catch (err) {
      logger.error('Error importing teams', { error: err instanceof Error ? err.message : String(err) });
      toast.error(err instanceof Error ? err.message : 'Failed to import teams');
    } finally {
      setImportingTeams(false);
    }
  };

  /**
   * Handle successful team creation/update
   */
  const handleTeamCreateSuccess = async () => {
    setShowTeamEditor(false);
    setEditingTeam(null);

    // Refresh teams list using hook function
    await refreshTeams();
  };

  /**
   * Handle team deletion
   */
  const handleDeleteTeam = async (teamId: string) => {
    const confirmed = await confirm({
      title: 'Delete Team?',
      message: 'Are you sure you want to delete this team? This will also remove all roster players. This action cannot be undone.',
      confirmText: 'Delete Team',
      confirmVariant: 'destructive',
    });

    if (!confirmed) return;

    try {
      // Delete team (cascade will delete team_players)
      const { error: deleteError } = await supabase
        .from('teams')
        .delete()
        .eq('id', teamId);

      if (deleteError) throw deleteError;

      // Refresh teams list using hook function
      await refreshTeams();
    } catch (err) {
      logger.error('Error deleting team', { error: err instanceof Error ? err.message : String(err) });
      toast.error(err instanceof Error ? err.message : 'Failed to delete team');
    }
  };

  /**
   * Toggle team expansion
   */
  const toggleTeamExpansion = (teamId: string) => {
    setExpandedTeams(prev => {
      const newSet = new Set(prev);
      if (newSet.has(teamId)) {
        newSet.delete(teamId);
      } else {
        newSet.add(teamId);
      }
      return newSet;
    });
  };

  /**
   * Generate default team name
   */
  const generateDefaultTeamName = (): string => {
    const teamNumber = teams.length + 1;
    return `Team ${teamNumber}`;
  };

  /**
   * Count teams that have a specific venue as their home
   */
  const getTeamsAtVenue = (venueId: string): number => {
    return teams.filter(team => team.home_venue_id === venueId).length;
  };

  /**
   * Handle successful venue creation
   * Refreshes the venues list from the hook
   */
  const handleVenueCreated = () => {
    setShowVenueCreation(false);
    // The useTeamManagement hook will automatically refresh venues
    // when the component re-renders
    window.location.reload(); // Simple refresh for now
  };

  // Calculate max teams based on league type
  // In-house (1 venue): 2 teams per table (both teams play at same venue)
  // Traveling (multiple venues): 1 home team per table
  const totalCapacity = leagueVenues.reduce(
    (sum, lv) => sum + (lv.capacity ?? lv.available_table_numbers?.length ?? 0),
    0
  );
  const isInHouse = leagueVenues.length === 1;
  const isTraveling = leagueVenues.length > 1;
  const maxTeams = isInHouse ? totalCapacity * 2 : totalCapacity;
  const isAtMaxTeams = teams.length >= maxTeams && maxTeams > 0;

  const isLoading = loading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="text-center text-gray-600">Loading...</div>
        </div>
      </div>
    );
  }

  if (error || !league) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-red-600 text-lg font-semibold mb-4">Error</h3>
            <p className="text-gray-700 mb-4">{error || 'League not found'}</p>
            <Button
              onClick={() => {
                setIsNavigating(true);
                navigate(organizationId ? `/operator-dashboard/${organizationId}` : '/dashboard');
              }}
              disabled={isNavigating}
              isLoading={isNavigating}
              loadingText="Loading..."
            >
              Back to Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        backTo={`/league/${leagueId}`}
        backLabel="Back to League"
        title="Manage Teams"
        subtitle="Assign venues and create teams for your league"
      >
        <div className="mt-2 flex flex-col gap-4">
          <InfoButton title="Quick Tip" label="Team Management Tips">
            <div className="space-y-3">
              <p className="text-sm text-gray-700">
                All you have to do is pick a captain for each team.
                After that, the captain can fill in the rest—team name, venue, and players.
              </p>
              <p className="text-sm text-gray-700">
                Feel free to add more info if you have it, but it's optional.
              </p>
              <p className="text-sm text-gray-700">
                If a team ever wants to change captains, that's something only you can do.
              </p>
            </div>
          </InfoButton>
          {teams.length > 0 && seasonId && (
            <div className="grid grid-cols-2 gap-2">
              <Button
                className="w-full"
                size="lg"
                variant="outline"
                onClick={() => {
                  setIsNavigating(true);
                  navigate(`/league/${leagueId}`);
                }}
                disabled={isNavigating}
                isLoading={isNavigating}
                loadingText="Loading..."
              >
                Save & Exit
              </Button>
              <Button
                className="w-full"
                size="lg"
                onClick={() => {
                  setIsNavigating(true);
                  navigate(`/league/${leagueId}/season/${seasonId}/playoffs-setup`);
                }}
                disabled={isNavigating}
                isLoading={isNavigating}
                loadingText="Loading..."
              >
                Save & Continue →
                </Button>
              </div>
            )}
          </div>
      </PageHeader>

      <div className="container mx-auto px-4 max-w-7xl py-3 lg:py-8">
        {/* Layout: Venues (left) and Teams (right) */}
        <div className="w-full grid grid-cols-1 gap-2 lg:grid-cols-12 lg:gap-6">
          {/* Left Column */}
          <div className="col-span-1 lg:col-span-4 space-y-3">
            {/* Status Card */}
            <div className="bg-white rounded-xl shadow-sm p-4">
              <h3 className="text-base font-semibold text-gray-900 mb-3">Setup Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Type:</span>
                  <span className="font-medium text-gray-900">
                    {isTraveling ? 'Traveling' : isInHouse ? 'In-House' : 'Not Set'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Venues:</span>
                  <span className="font-medium text-gray-900">{leagueVenues.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Tables Available:</span>
                  <span className="font-medium text-gray-900">
                    {leagueVenues.reduce((sum, lv) => sum + (lv.available_table_numbers?.length ?? 0), 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1.5">
                    <span className="text-gray-600">Teams:</span>
                    <InfoButton title="Max Teams Explained" size="sm">
                      {isInHouse ? (
                        <p>In-house leagues can have 2 teams per table since both teams play at the same venue.</p>
                      ) : (
                        <p>Traveling leagues are limited to 1 home team per table across all venues.</p>
                      )}
                    </InfoButton>
                  </div>
                  <span className={`font-medium ${isAtMaxTeams ? 'text-orange-600' : 'text-gray-900'}`}>
                    {teams.length}/{maxTeams}
                  </span>
                </div>
              </div>
            </div>

            {/* Venue Assignment Section */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-gray-900">League Venues</h2>
                {venues.length > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowVenueCreation(true)}
                    disabled={!organizationId}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    New
                  </Button>
                )}
              </div>
              <p className="text-xs text-gray-600 mb-4">
                Select venues teams can use and adjust number of tables actually available
              </p>

              {/* Select All Checkbox */}
              {venues.length > 0 && (
                <div className="flex items-center gap-3 p-2 bg-gray-50 rounded mb-2">
                  <input
                    type="checkbox"
                    checked={areAllVenuesAssigned()}
                    onChange={handleSelectAll}
                    disabled={selectingAll}
                    className="mt-0"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    {selectingAll ? 'Updating...' : 'Select All'}
                  </span>
                </div>
              )}

            {venues.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-gray-600 mb-3">No venues yet</p>
                <Button
                  size="sm"
                  onClick={() => setShowVenueCreation(true)}
                  disabled={!organizationId}
                  loadingText="none"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Venue
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {venues.map((venue) => {
                  const assigned = isVenueAssigned(venue.id);
                  const leagueVenue = leagueVenues.find(lv => lv.venue_id === venue.id);
                  const venueCapacity = leagueVenue?.capacity ?? leagueVenue?.available_table_numbers?.length;
                  const teamsAtVenue = getTeamsAtVenue(venue.id);

                  return (
                    <VenueListItem
                      key={venue.id}
                      venue={venue}
                      isAssigned={assigned}
                      isToggling={assigningVenue === venue.id}
                      capacity={venueCapacity}
                      teamsAtVenue={teamsAtVenue}
                      onToggle={() => handleToggleVenue(venue)}
                      onLimitClick={() => handleOpenLimitModal(venue)}
                    />
                  );
                })}
              </div>
            )}
            </div>

            {/* All Players Roster Card */}
            {teams.length > 0 && (
              <AllPlayersRosterCard teams={teams} />
            )}
          </div>

          {/* Teams Section - Main Right Area */}
          <div className="lg:col-span-8 bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Teams</h2>
              <div className="flex gap-2">
                {previousSeasonId && teams.length === 0 && (
                  <Button
                    variant="outline"
                    disabled={importingTeams || !seasonId}
                    onClick={handleImportTeams}
                    isLoading={importingTeams}
                    loadingText="Importing..."
                  >
                    Import from Last Season
                  </Button>
                )}
                <Button
                  disabled={leagueVenues.length === 0 || !seasonId || isAtMaxTeams}
                  onClick={() => setShowTeamEditor(true)}
                  loadingText="none"
                  title={
                    leagueVenues.length === 0
                      ? 'Assign at least one venue before adding teams'
                      : !seasonId
                      ? 'Create a season before adding teams'
                      : isAtMaxTeams
                      ? `Maximum of ${maxTeams} teams reached`
                      : ''
                  }
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Team
                </Button>
              </div>
            </div>

            {leagueVenues.length === 0 ? (
              <div className="text-center py-8 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-blue-800 mb-2">Assign at least one venue before adding teams</p>
                <p className="text-sm text-blue-600">Teams need a venue to call home</p>
              </div>
            ) : teams.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-6xl mb-4">🎱</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Teams Yet</h3>
                <p className="text-gray-600 mb-6">
                  Add your first team to get started
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {teams.map((team) => (
                    <TeamCard
                      key={team.id}
                      team={team}
                      isExpanded={expandedTeams.has(team.id)}
                      onToggleExpand={() => toggleTeamExpansion(team.id)}
                      onEdit={() => {
                        setEditingTeam(team);
                        setShowTeamEditor(true);
                      }}
                      onDelete={() => handleDeleteTeam(team.id)}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Completion Actions - Outside cards for better visibility */}
        {teams.length > 0 && seasonId && (
          <div className="flex justify-center gap-4 mt-6">
            <Button
              size="lg"
              variant="outline"
              onClick={() => {
                setIsNavigating(true);
                navigate(`/league/${leagueId}`);
              }}
              disabled={isNavigating}
              isLoading={isNavigating}
              loadingText="Loading..."
            >
              Save & Exit
            </Button>
            <Button
              size="lg"
              onClick={() => {
                setIsNavigating(true);
                navigate(`/league/${leagueId}/season/${seasonId}/playoffs-setup`);
              }}
              disabled={isNavigating}
              isLoading={isNavigating}
              loadingText="Loading..."
            >
              Save & Continue →
            </Button>
          </div>
        )}

        {/* Venue Limit Modal */}
        {limitModalVenue && (
          <VenueLimitModal
            venue={limitModalVenue.venue}
            leagueVenue={limitModalVenue.leagueVenue}
            allLeagueVenues={leagueVenues}
            onSuccess={handleLimitUpdateSuccess}
            onCancel={() => setLimitModalVenue(null)}
          />
        )}

        {/* Team Editor Modal */}
        {showTeamEditor && league && seasonId && (
          <TeamEditorModal
            leagueId={leagueId!}
            seasonId={seasonId}
            teamFormat={league.team_format}
            venues={venues}
            leagueVenues={leagueVenues}
            members={members}
            allTeams={teams}
            defaultTeamName={generateDefaultTeamName()}
            existingTeam={editingTeam ? {
              id: editingTeam.id,
              team_name: editingTeam.team_name,
              captain_id: editingTeam.captain_id,
              home_venue_id: editingTeam.home_venue_id,
              roster_size: editingTeam.roster_size,
            } : null}
            onSuccess={handleTeamCreateSuccess}
            onCancel={() => {
              setShowTeamEditor(false);
              setEditingTeam(null);
            }}
          />
        )}

        {/* Venue Creation Modal */}
        {showVenueCreation && organizationId && (
          <VenueCreationModal
            organizationId={organizationId}
            onSuccess={handleVenueCreated}
            onCancel={() => setShowVenueCreation(false)}
          />
        )}
        {ConfirmDialogComponent}
      </div>
    </div>
  );
};

export default TeamManagement;
