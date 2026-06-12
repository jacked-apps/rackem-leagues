/**
 * @fileoverview TeamsPanel — the main "Teams" section of the Manage Teams editing
 * surface: Add Team (with its venue/season/max/bye guards), Import-from-last-season,
 * the open-BYE warning, the empty states, and the team list. Presentational — the
 * container owns the data + actions. Extracted from `src/operator/TeamManagement.tsx`
 * as part of the content/chrome decomposition.
 */

import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TeamCard } from '@/components/TeamCard';
import type { LeagueVenue } from '@/types/venue';
import type { TeamWithQueryDetails } from '@/types/team';

interface TeamsPanelProps {
  teams: TeamWithQueryDetails[];
  leagueVenues: LeagueVenue[];
  /** Set when a previous season exists → enables Import (only when team list empty). */
  previousSeasonId: string | null;
  /** Null until a season is in scope — gates Add Team + Import. */
  seasonId: string | null;
  importingTeams: boolean;
  isAtMaxTeams: boolean;
  /** An open BYE slot exists → steer the operator to fill it, not add a team. */
  hasBye: boolean;
  maxTeams: number;
  /** Ids of teams whose roster is expanded. */
  expandedTeams: Set<string>;
  onImport: () => void;
  onAddTeam: () => void;
  onEditTeam: (team: TeamWithQueryDetails) => void;
  onDeleteTeam: (teamId: string) => void;
  onToggleExpand: (teamId: string) => void;
}

export function TeamsPanel({
  teams,
  leagueVenues,
  previousSeasonId,
  seasonId,
  importingTeams,
  isAtMaxTeams,
  hasBye,
  maxTeams,
  expandedTeams,
  onImport,
  onAddTeam,
  onEditTeam,
  onDeleteTeam,
  onToggleExpand,
}: TeamsPanelProps) {
  return (
    <div className="lg:col-span-8 bg-card rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-foreground">Teams</h2>
        <div className="flex gap-2">
          {previousSeasonId && teams.length === 0 && (
            <Button
              variant="outline"
              disabled={importingTeams || !seasonId}
              onClick={onImport}
              isLoading={importingTeams}
              loadingText="Importing..."
            >
              Import from Last Season
            </Button>
          )}
          <Button
            disabled={leagueVenues.length === 0 || !seasonId || isAtMaxTeams || hasBye}
            onClick={onAddTeam}
            loadingText="none"
            title={
              leagueVenues.length === 0
                ? 'Assign at least one venue before adding teams'
                : !seasonId
                  ? 'Create a season before adding teams'
                  : hasBye
                    ? 'You have an open BYE slot — fill it with your new team instead of adding a separate one'
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

      {/* Open BYE slot → adding a separate team would wedge the league.
          Steer the operator to fill the bye instead. */}
      {hasBye && (
        <div className="mb-4 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
          <p className="font-medium">Your league has an open BYE slot</p>
          <p className="text-muted-foreground">
            The BYE is your reserved spot for the next team (odd team count). To add another
            team, <strong>fill the BYE</strong> — give it a name + captain — instead of adding a
            separate team, which would leave a duplicate.
          </p>
        </div>
      )}

      {leagueVenues.length === 0 ? (
        <div className="text-center py-8 bg-info/10 border border-info/40 rounded-lg">
          <p className="text-foreground mb-2">Assign at least one venue before adding teams</p>
          <p className="text-sm text-info">Teams need a venue to call home</p>
        </div>
      ) : teams.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-6xl mb-4">🎱</div>
          <h3 className="text-lg font-medium text-foreground mb-2">No Teams Yet</h3>
          <p className="text-muted-foreground mb-6">Add your first team to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {teams.map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              isExpanded={expandedTeams.has(team.id)}
              onToggleExpand={() => onToggleExpand(team.id)}
              onEdit={() => onEditTeam(team)}
              onDelete={() => onDeleteTeam(team.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
