/**
 * @fileoverview TeamManagementContent — the reusable Manage Teams editing area,
 * with NO page chrome of its own. It wires the data hook + the focused logic
 * hooks (venues, team actions, import) + the derived stats into the presentational
 * panels and the modals. Both the standalone edit page and the season-setup step
 * render this and supply their own footer via `renderFooter` — so the content
 * never knows where "done" or "continue" leads.
 *
 * See docs/plans/2026-06-12-001-refactor-teams-standalone-vs-setup-plan.md.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useTeamManagement } from '@/hooks/useTeamManagement';
import { useResolvedLeaguePrefs } from '@/api/hooks/useResolvedLeaguePrefs';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { AllPlayersRosterCard } from '@/components/AllPlayersRosterCard';
import { VenueLimitModal } from './VenueLimitModal';
import { TeamEditorModal } from './TeamEditorModal';
import { VenueCreationModal } from '@/components/operator/VenueCreationModal';
import { SetupSummaryCard } from './team-management/SetupSummaryCard';
import { VenuesPanel } from './team-management/VenuesPanel';
import { TeamsPanel } from './team-management/TeamsPanel';
import { computeTeamSetupStats } from './team-management/teamSetupStats';
import { useVenueAssignment } from './team-management/useVenueAssignment';
import { useTeamActions } from './team-management/useTeamActions';
import { useTeamImport } from './team-management/useTeamImport';

/** Data the wrapper's footer needs to decide its label + target + visibility. */
export interface TeamManagementFooterContext {
  leagueId: string;
  seasonId: string | null;
  hasTeams: boolean;
}

interface TeamManagementContentProps {
  leagueId: string;
  /** Render the page footer from the content's live data (edit vs setup). */
  renderFooter?: (ctx: TeamManagementFooterContext) => React.ReactNode;
}

export function TeamManagementContent({ leagueId, renderFooter }: TeamManagementContentProps) {
  const navigate = useNavigate();
  const { confirm, ConfirmDialogComponent } = useConfirmDialog();

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

  const { data: leaguePrefs } = useResolvedLeaguePrefs(leagueId);
  const maxRosterSize = leaguePrefs?.max_roster_size ?? 8;
  const lineupSize = leaguePrefs?.lineup_size ?? 5;

  const organizationId = league?.organization_id || null;

  const venueLogic = useVenueAssignment(leagueId, venues, leagueVenues);
  const teamLogic = useTeamActions(teams, refreshTeams, confirm);
  const importLogic = useTeamImport(leagueId, previousSeasonId, seasonId, confirm);

  const stats = computeTeamSetupStats(leagueVenues, teams);

  if (loading) {
    return (
      <div className="container mx-auto px-4 max-w-7xl py-8">
        <div className="text-center text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (error || !league) {
    return (
      <div className="container mx-auto px-4 max-w-7xl py-8">
        <div className="bg-card rounded-xl shadow-sm p-6">
          <h3 className="text-destructive text-lg font-semibold mb-4">Error</h3>
          <p className="text-foreground mb-4">{error || 'League not found'}</p>
          <Button
            loadingText="none"
            onClick={() => navigate(organizationId ? `/operator-dashboard/${organizationId}` : '/my-teams')}
          >
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      {renderFooter?.({ leagueId, seasonId, hasTeams: teams.length > 0 })}

      <div className="container mx-auto px-4 max-w-7xl py-3 lg:py-8">
        <div className="w-full grid grid-cols-1 gap-2 lg:grid-cols-12 lg:gap-6">
          {/* Left Column */}
          <div className="col-span-1 lg:col-span-4 space-y-3">
            <SetupSummaryCard
              isTraveling={stats.isTraveling}
              isInHouse={stats.isInHouse}
              venueCount={leagueVenues.length}
              tablesAvailable={leagueVenues.reduce(
                (sum, lv) => sum + (lv.available_table_numbers?.length ?? 0),
                0,
              )}
              teamCount={teams.length}
              maxTeams={stats.maxTeams}
              isAtMaxTeams={stats.isAtMaxTeams}
            />

            <VenuesPanel
              venues={venues}
              leagueVenues={leagueVenues}
              teams={teams}
              organizationId={organizationId}
              assigningVenueId={venueLogic.assigningVenueId}
              selectingAll={venueLogic.selectingAll}
              onSelectAll={venueLogic.handleSelectAll}
              onNewVenue={venueLogic.openVenueCreation}
              onToggleVenue={venueLogic.handleToggleVenue}
              onOpenLimitModal={venueLogic.handleOpenLimitModal}
            />

            {teams.length > 0 && <AllPlayersRosterCard teams={teams} />}
          </div>

          <TeamsPanel
            teams={teams}
            leagueVenues={leagueVenues}
            previousSeasonId={previousSeasonId}
            seasonId={seasonId}
            importingTeams={importLogic.importingTeams}
            isAtMaxTeams={stats.isAtMaxTeams}
            hasBye={stats.hasBye}
            maxTeams={stats.maxTeams}
            expandedTeams={teamLogic.expandedTeams}
            onImport={importLogic.handleImportTeams}
            onAddTeam={teamLogic.openAddTeam}
            onEditTeam={teamLogic.openEditTeam}
            onDeleteTeam={teamLogic.handleDeleteTeam}
            onToggleExpand={teamLogic.toggleTeamExpansion}
          />
        </div>

        {/* Venue Limit Modal */}
        {venueLogic.limitModalVenue && (
          <VenueLimitModal
            venue={venueLogic.limitModalVenue.venue}
            leagueVenue={venueLogic.limitModalVenue.leagueVenue}
            allLeagueVenues={leagueVenues}
            onSuccess={venueLogic.handleLimitUpdateSuccess}
            onCancel={venueLogic.closeLimitModal}
          />
        )}

        {/* Team Editor Modal */}
        {teamLogic.showTeamEditor && seasonId && (
          <TeamEditorModal
            leagueId={leagueId}
            seasonId={seasonId}
            rosterSize={maxRosterSize}
            lineupSize={lineupSize}
            venues={venues}
            leagueVenues={leagueVenues}
            members={members}
            allTeams={teams}
            defaultTeamName={teamLogic.generateDefaultTeamName()}
            existingTeam={
              teamLogic.editingTeam
                ? {
                    id: teamLogic.editingTeam.id,
                    team_name: teamLogic.editingTeam.team_name,
                    captain_id: teamLogic.editingTeam.captain_id,
                    home_venue_id: teamLogic.editingTeam.home_venue_id,
                    roster_size: teamLogic.editingTeam.roster_size,
                    status: teamLogic.editingTeam.status,
                  }
                : null
            }
            onSuccess={teamLogic.handleTeamCreateSuccess}
            onCancel={teamLogic.closeTeamEditor}
          />
        )}

        {/* Venue Creation Modal */}
        {venueLogic.showVenueCreation && organizationId && (
          <VenueCreationModal
            organizationId={organizationId}
            onSuccess={venueLogic.handleVenueCreated}
            onCancel={venueLogic.closeVenueCreation}
          />
        )}
        {ConfirmDialogComponent}
      </div>
    </>
  );
}
