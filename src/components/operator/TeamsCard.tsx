/**
 * @fileoverview TeamsCard Component
 * Displays teams for a league with captain information
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { fetchTeamsWithDetails } from '@/api/hooks';
import { Button } from '@/components/ui/button';
import { InfoButton } from '@/components/InfoButton';
import type { TeamWithQueryDetails } from '@/types/team';
import { logger } from '@/utils/logger';
import { useFlowStageDetection } from '@/wizards/league-v2/useFlowStageDetection';

interface TeamsCardProps {
  /** League ID to fetch teams for */
  leagueId: string;
}

/**
 * TeamsCard Component
 *
 * Displays:
 * - List of teams enrolled in the league
 * - Team captains with names
 * - Captain phone numbers
 * - "Manage Teams" button to navigate to team management
 */
export const TeamsCard: React.FC<TeamsCardProps> = ({ leagueId }) => {
  const navigate = useNavigate();
  const [teams, setTeams] = useState<TeamWithQueryDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [isNavigating, setIsNavigating] = useState(false);
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);
  // Collapsed by default — the card stays a compact "Teams · N listed" header
  // until the operator opens it, instead of dumping the whole roster inline.
  const [collapsed, setCollapsed] = useState(true);

  const { context } = useFlowStageDetection(leagueId);
  const hasSeason = Boolean(context.seasonId);

  /**
   * Fetch teams with captain details
   */
  useEffect(() => {
    const fetchTeams = async () => {
      setLoading(true);
      try {
        const { data, error } = await fetchTeamsWithDetails(leagueId);

        if (error) throw error;
        setTeams(data || []);
      } catch (err) {
        logger.error('Error fetching teams', { error: err instanceof Error ? err.message : String(err) });
      } finally {
        setLoading(false);
      }
    };

    fetchTeams();
  }, [leagueId]);

  /**
   * Toggle team expansion
   */
  const toggleTeam = (teamId: string) => {
    setExpandedTeamId(expandedTeamId === teamId ? null : teamId);
  };

  /**
   * Format captain phone number for display
   */
  const formatPhoneNumber = (phone: string | null | undefined): string => {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  // The header doubles as the collapse toggle once teams exist. When there are
  // none (or still loading), there's nothing to collapse, so the header is inert
  // and the body always shows (loading hint / "add your first team" CTA).
  const hasTeams = !loading && teams.length > 0;

  return (
    <div className="bg-card lg:rounded-xl shadow-sm p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={() => hasTeams && setCollapsed((c) => !c)}
          className={`flex items-center gap-2 text-left ${hasTeams ? 'cursor-pointer' : 'cursor-default'}`}
          aria-expanded={hasTeams ? !collapsed : undefined}
        >
          {hasTeams &&
            (collapsed ? (
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            ))}
          <h2 className="text-xl font-semibold text-foreground">Teams</h2>
          {hasTeams && (
            <span className="text-sm font-normal text-muted-foreground">
              · {teams.length} listed
            </span>
          )}
        </button>
        <div className="flex items-center gap-2">
          <Button
            onClick={(e) => {
              e.stopPropagation();
              setIsNavigating(true);
              navigate(`/league/${leagueId}/manage-teams`);
            }}
            size="sm"
            disabled={isNavigating || !hasSeason}
            loadingText="Loading..."
          >
            {isNavigating ? 'Loading...' : 'Manage Teams'}
          </Button>
          {!hasSeason && (
            <InfoButton title="Manage Teams unavailable" size="sm">
              Create a season for this league before adding teams. Teams are
              attached to a season, so we need one in place first.
            </InfoButton>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground">Loading teams...</p>
        </div>
      ) : teams.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-4xl mb-3">👥</div>
          <p className="text-muted-foreground mb-4">No teams yet</p>
          <div className="inline-flex items-center gap-2">
            <Button
              onClick={() => {
                setIsNavigating(true);
                navigate(`/league/${leagueId}/manage-teams`);
              }}
              variant="outline"
              disabled={isNavigating || !hasSeason}
            >
              {isNavigating ? 'Loading...' : 'Add Your First Team'}
            </Button>
            {!hasSeason && (
              <InfoButton title="Teams require a season" size="sm">
                Create a season for this league before adding teams. Teams are
                attached to a season, so we need one in place first.
              </InfoButton>
            )}
          </div>
        </div>
      ) : !collapsed ? (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-sm font-semibold text-foreground pb-3">Team Name</th>
                <th className="text-left text-sm font-semibold text-foreground pb-3">Captain</th>
                <th className="text-left text-sm font-semibold text-foreground pb-3">Venue</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((team) => (
                <tr
                  key={team.id}
                  onClick={() => team.captain && toggleTeam(team.id)}
                  className={`border-b border-gray-100 last:border-0 ${team.captain ? 'cursor-pointer hover:bg-muted' : ''}`}
                >
                  <td className="py-3 text-sm font-medium text-foreground">
                    <div className="flex items-center gap-2">
                      {team.captain && (
                        expandedTeamId === team.id ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )
                      )}
                      <span>{team.team_name}</span>
                    </div>
                  </td>
                  <td className="py-3 text-sm text-foreground">
                    {team.captain ? (
                      <div>
                        <div>{`${team.captain.first_name} ${team.captain.last_name}`}</div>
                        {expandedTeamId === team.id && (
                          <div className="mt-1 text-xs text-muted-foreground space-y-0.5">
                            {team.captain.phone && (
                              <div>
                                <a href={`tel:${team.captain.phone}`} className="hover:text-blue-600">
                                  {formatPhoneNumber(team.captain.phone)}
                                </a>
                              </div>
                            )}
                            {team.captain.email && (
                              <div>
                                <a href={`mailto:${team.captain.email}`} className="hover:text-blue-600">
                                  {team.captain.email}
                                </a>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      'No captain'
                    )}
                  </td>
                  <td className="py-3 text-sm text-muted-foreground">
                    <div>
                      <div>{team.venue?.name || 'No venue'}</div>
                      {expandedTeamId === team.id && team.venue && (
                        <div className="mt-1 text-xs text-muted-foreground space-y-0.5">
                          {team.venue.phone && (
                            <div>
                              <a href={`tel:${team.venue.phone}`} className="hover:text-blue-600">
                                {formatPhoneNumber(team.venue.phone)}
                              </a>
                            </div>
                          )}
                          {team.venue.street_address && (
                            <div className="max-w-xs">
                              {team.venue.street_address}
                              {team.venue.city && team.venue.state && (
                                <>, {team.venue.city}, {team.venue.state}</>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
};
