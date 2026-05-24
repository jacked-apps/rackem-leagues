/**
 * @fileoverview MyTeams Page
 *
 * Mobile-first accordion view of all teams the logged-in user is on.
 * Each team expands to show full details including roster, venue, and actions.
 *
 * Flow: Dashboard → My Teams (accordion list) → Expand to see details
 */

import { useContext, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { UserContext } from '@/context/UserContext';
import { useMemberId } from '@/api/hooks';
import { usePlayerTeams, useCaptainTeamEditData, useMatchesByTeam } from '@/api/hooks';
import { useResolvedLeaguePrefs } from '@/api/hooks/useResolvedLeaguePrefs';
import { useCaptainReupPrompt } from '@/hooks/useCaptainReupPrompt';
import { queryKeys } from '@/api/queryKeys';
import { TeamEditorModal } from '@/operator/TeamEditorModal';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
// import { Link } from 'react-router-dom';
import { formatPartialMemberNumber } from '@/types/member';
import { formatGameType, formatDayOfWeek } from '@/types/league';
import { PlayerNameLink } from '@/components/PlayerNameLink';
import { PlayerRoster } from '@/components/PlayerRoster';
import { PageHeader } from '@/components/PageHeader';
import { MapPin, Users, AlertCircle, ArrowRight, Pencil, Bell } from 'lucide-react';
import { parseLocalDate } from '@/utils/formatters';
import { buildLeagueTitle, getTimeOfYear } from '@/utils/leagueUtils';
import { TenBallIcon } from '@/components/icons/TenBallIcon';
import { NineBallIcon } from '@/components/icons/NineBallIcon';
import { EightBallIcon } from '@/components/icons/EightBallIcon';

interface TeamData {
  team_id: string;
  teams: {
    id: string;
    team_name: string;
    captain_id: string;
    roster_size: number;
    captain: {
      id: string;
      first_name: string;
      last_name: string;
      system_player_number: number;
      bca_member_number: string | null;
    };
    venue: {
      id: string;
      name: string;
    } | null;
    team_players: Array<{
      member_id: string;
      is_captain: boolean;
      members: {
        id: string;
        first_name: string;
        last_name: string;
        system_player_number: number;
        bca_member_number: string | null;
      };
    }>;
    season: {
      id: string;
      season_name: string;
      league: {
        id: string;
        game_type: string;
        day_of_week: string;
        division: string | null;
        league_start_date: string;
      };
    };
  };
}

/**
 * Team accordion item component
 * Renders a single team with next match info and quick actions
 */
function TeamAccordionItem({
  teamData,
  memberId,
  needsReup,
  onEditTeam,
}: {
  teamData: TeamData;
  memberId: string | null;
  /** True if this team is in the captain's re-up prompt list — i.e.,
   *  the season is in its last 3 weeks and no submitted answer exists.
   *  Drives the "Re-up needed" pill below the team name. */
  needsReup: boolean;
  onEditTeam: (teamId: string) => void;
}) {
  const team = teamData.teams;
  const isCaptain = team.captain_id === memberId;
  const navigate = useNavigate();
  const leagueId = team.season.league.id;

  // Resolved preferences — lazy-migrates legacy leagues on first access
  const { data: leaguePrefs } = useResolvedLeaguePrefs(leagueId);
  const handicapType = leaguePrefs?.handicap_type ?? 'points';

  // Fetch all matches to find makeups and upcoming
  const { data: allMatches = [] } = useMatchesByTeam(team.id);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Find makeup matches (past date, not completed)
  const makeupMatches = allMatches
    .filter(match => {
      if (match.status === 'completed') return false;
      if (!match.scheduled_date) return false;

      const [year, month, day] = match.scheduled_date.split('-').map(Number);
      const scheduledDate = new Date(year, month - 1, day);
      scheduledDate.setHours(0, 0, 0, 0);

      return scheduledDate < today;
    })
    .sort((a, b) => a.scheduled_date!.localeCompare(b.scheduled_date!)) // Oldest first
    .slice(0, 1); // Show only the oldest makeup — keeps the list clean

  // Find upcoming matches (in_progress or future scheduled)
  const upcomingMatches = allMatches
    .filter(match => {
      if (match.status === 'completed') return false;
      if (match.status === 'in_progress') return true;
      if (!match.scheduled_date) return false;

      const [year, month, day] = match.scheduled_date.split('-').map(Number);
      const scheduledDate = new Date(year, month - 1, day);
      scheduledDate.setHours(0, 0, 0, 0);

      return scheduledDate >= today;
    })
    .sort((a, b) => {
      // in_progress first, then by date
      if (a.status === 'in_progress' && b.status !== 'in_progress') return -1;
      if (a.status !== 'in_progress' && b.status === 'in_progress') return 1;
      return a.scheduled_date!.localeCompare(b.scheduled_date!);
    })
    .slice(0, 1); // Only show next upcoming

  // Combine: upcoming always first, then oldest makeup (max 2 buttons total)
  const actionableMatches = [...upcomingMatches, ...makeupMatches];

  // Calculate team readiness
  const minRoster = team.roster_size === 5 ? 3 : 5;
  const hasVenue = team.venue !== null;
  const hasMinRoster = team.team_players.length >= minRoster;
  const isReady = hasVenue && hasMinRoster;

  // Filter out captain from roster
  // const nonCaptainPlayers = team.team_players.filter(p => !p.is_captain);

  // Get the appropriate ball icon based on game type
  const getBallIcon = () => {
    const gameType = team.season.league.game_type;
    const iconSize = 32;

    if (gameType === 'nine_ball') {
      return <NineBallIcon size={iconSize} />;
    } else if (gameType === 'ten_ball') {
      return <TenBallIcon size={iconSize} />;
    } else {
      // eight_ball or default
      return <EightBallIcon size={iconSize} />;
    }
  };

  return (
    <AccordionItem
      key={team.id}
      value={team.id}
      className="bg-card border rounded-lg shadow-sm"
    >
      <AccordionTrigger className="pl-4 pr-1 py-4 hover:no-underline [&[data-state=open]>svg]:rotate-180">
        <div className="flex flex-col gap-2 w-full">
          {/* Row 1: League name with ball icon - grid only for this row */}
          <div className="grid grid-cols-[36px_1fr_36px] gap-1 w-full items-center -mr-8">
            {/* Ball icon on left */}
            <div className="flex justify-center">
              {getBallIcon()}
            </div>

            {/* League name (centered) */}
            <div className="text-center">
              <h3 className="font-semibold text-lg text-foreground">
                {team.season.league.league_start_date ? (
                  buildLeagueTitle({
                    gameType: team.season.league.game_type,
                    dayOfWeek: team.season.league.day_of_week,
                    division: team.season.league.division,
                    season: getTimeOfYear(parseLocalDate(team.season.league.league_start_date)),
                    year: parseLocalDate(team.season.league.league_start_date).getFullYear(),
                  })
                ) : (
                  `${formatGameType(team.season.league.game_type as any)} ${formatDayOfWeek(team.season.league.day_of_week as any)}`
                )}
              </h3>
            </div>

            {/* Placeholder for chevron space (chevron is rendered outside grid by AccordionTrigger) */}
            <div></div>
          </div>

          {/* Row 2: Team name - full width left aligned */}
          <div className="flex items-center gap-2 w-full text-left">
            <h2 className="font-semibold text-xl text-foreground">
              {team.team_name}
            </h2>
          </div>

          {/* Row 2.5: Re-up reminder pill — only for captains whose
              team is in the last 3 weeks of the season and hasn't
              answered yet. Clicking takes the captain straight to the
              /reup page where they can submit. */}
          {isCaptain && needsReup && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigate('/reup');
              }}
              className="self-start flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-3 py-1.5 text-sm font-medium text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
            >
              <Bell className="size-4" />
              Re-up needed for next season
              <ArrowRight className="size-4" />
            </button>
          )}

          {/* Rows 3+: Actionable matches or setup incomplete warning */}
          {!isReady && actionableMatches.length > 0 ? (
            // Show single setup incomplete flag if team not ready
            <div className="flex items-center justify-end w-full">
              <span className="text-xs font-bold px-2 py-0.5 rounded text-yellow-700 bg-yellow-100">
                SETUP INCOMPLETE
              </span>
            </div>
          ) : actionableMatches.length > 0 ? (
            // Show matches with Quick Score buttons if team is ready
            actionableMatches.map((match) => {
              const isMakeup = makeupMatches.some(m => m.id === match.id);
              const isInProgress = match.status === 'in_progress';
              const tagText = isMakeup ? 'MAKEUP' : isInProgress ? 'IN PROGRESS' : 'UPCOMING';
              const tagColor = isMakeup ? 'text-orange-700 bg-orange-100' : 'text-blue-700 bg-blue-100';

              return (
                <div key={match.id} className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2 text-base text-foreground">
                    <span>
                      {match.season_week?.week_name || 'Week ?'} -{' '}
                      {parseLocalDate(match.scheduled_date!).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 ml-auto">
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${tagColor}`}>
                      {tagText}
                    </span>
                    <div
                      role="button"
                      tabIndex={0}
                      className={`inline-flex items-center justify-center rounded-md text-xs font-medium transition-colors cursor-pointer px-2 h-7 ${
                        isMakeup
                          ? 'text-orange-700 hover:text-orange-800 hover:bg-orange-50'
                          : 'text-blue-600 hover:text-blue-700 hover:bg-blue-50'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        window.location.href = `/match/${match.id}/lineup`;
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.stopPropagation();
                          window.location.href = `/match/${match.id}/lineup`;
                        }
                      }}
                    >
                      Quick Score <ArrowRight className="h-3 w-3 ml-1" />
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-xs text-muted-foreground italic">No upcoming matches</div>
          )}
        </div>
      </AccordionTrigger>

      <AccordionContent className="px-4 pb-4">
        <div className="space-y-4 pt-2">
          {/* View Schedule Button */}
          <div>
            <Button
              variant="default"
              className="w-full"
              disabled={!isReady}
              onClick={() => {
                if (isReady) {
                  window.location.href = `/team/${team.id}/schedule`;
                }
              }}
              loadingText="none"
            >
              View Schedule
            </Button>
          </div>

          {/* Team Readiness Warning (Captains Only) */}
          {isCaptain && !isReady && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-yellow-900">
                    Team Setup Incomplete
                  </p>
                  <ul className="text-sm text-yellow-800 mt-1 space-y-1">
                    {!hasVenue && <li>• Home venue required</li>}
                    {!hasMinRoster && (
                      <li>
                        • Minimum {minRoster} players required (
                        {team.team_players.length}/{team.roster_size} currently)
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Home Venue with Edit Team Button (Captains Only) */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>Home Venue</span>
              </div>
              {isCaptain && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-sm h-8 gap-1.5"
                  onClick={() => onEditTeam(team.id)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit Team
                </Button>
              )}
            </div>
            <p className="text-base text-foreground ml-6">
              {team.venue?.name || 'No venue assigned'}
            </p>
          </div>

          {/* Captain */}
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-1">
              <Users className="h-4 w-4" />
              <span>Captain</span>
            </div>
            <div
              className={`text-base ml-6 ${
                team.captain.id === memberId
                  ? 'font-semibold text-blue-600'
                  : 'text-foreground'
              }`}
            >
              <PlayerNameLink
                playerId={team.captain.id}
                playerName={`${team.captain.first_name} ${team.captain.last_name}`}
                className={team.captain.id === memberId ? 'font-semibold' : ''}
              />{' '}
              {formatPartialMemberNumber(team.captain)}
            </div>
          </div>

          {/* Roster */}
          <PlayerRoster
            playerIds={team.team_players.map(p => p.member_id)}
            handicapType={handicapType}
            handicapVariant="standard"
            gameType={team.season.league.game_type as 'eight_ball' | 'nine_ball' | 'ten_ball'}
            leagueId={team.season.league.id}
            captainId={team.team_players.find(p => p.is_captain)?.member_id}
          />

          {/* Action Buttons */}
          <div className="pt-2 flex justify-center">
            <Button
              variant="default"
              className="px-8"
              onClick={() => {
                window.location.href = `/league/${team.season.league.id}/season/${team.season.id}/standings`;
              }}
              loadingText="none"
            >
              Stats & Standings
            </Button>
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

export function MyTeams() {
  const userContext = useContext(UserContext);
  const queryClient = useQueryClient();
  const memberId = useMemberId();

  // Fetch teams using TanStack Query
  const { data: teamsData = [], isLoading: loading, error: teamsError } = usePlayerTeams(memberId);
  const teams = (teamsData || []) as unknown as TeamData[];
  const error = teamsError ? 'Unable to load your teams' : null;

  // Teams in the re-up window that this captain still owes an answer
  // for. We pass each team's id down to TeamAccordionItem so the pill
  // shows on the right row(s). Empty/idle for non-captains and for
  // seasons not in the 3-week window.
  const { data: reupPrompts = [] } = useCaptainReupPrompt();
  const reupTeamIds = new Set(reupPrompts.map((p) => p.teamId));

  // Team editing modal state
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);

  // Fetch edit data when team is selected for editing
  const { data: editData, isLoading: loadingEditData } = useCaptainTeamEditData(editingTeamId);

  // Handle edit button click
  const handleEditTeam = (teamId: string) => {
    setEditingTeamId(teamId);
  };

  // Handle successful team update
  const handleTeamUpdateSuccess = async () => {
    setEditingTeamId(null);

    // Invalidate teams cache to refetch updated data
    if (memberId) {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.teams.byMember(memberId),
      });
    }
  };

  // Handle cancel editing
  const handleCancelEdit = () => {
    setEditingTeamId(null);
  };

  if (userContext?.loading || loading) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-center text-muted-foreground">Loading your teams...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-center text-destructive">{error}</p>
      </div>
    );
  }

  if (!userContext?.isLoggedIn) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-center text-muted-foreground">
          Please log in to view your teams
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted">
      <PageHeader
        title="My Teams"
      />

      {/* Main Content */}
      <main className="px-4 py-6 max-w-2xl mx-auto">
        {teams.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">You are not currently on any teams</p>
            </CardContent>
          </Card>
        ) : (
          <Accordion type="single" collapsible className="space-y-4">
            {teams.map((teamData) => (
              <TeamAccordionItem
                key={teamData.teams.id}
                teamData={teamData}
                memberId={memberId}
                needsReup={reupTeamIds.has(teamData.teams.id)}
                onEditTeam={handleEditTeam}
              />
            ))}
          </Accordion>
        )}
      </main>

      {/* Team Editor Modal for Captains */}
      {editingTeamId && editData && !loadingEditData && (
        <TeamEditorModal
          leagueId={editData.leagueId}
          seasonId={editData.seasonId}
          rosterSize={editData.rosterSize}
          lineupSize={editData.lineupSize}
          venues={editData.venues}
          leagueVenues={editData.leagueVenues}
          members={editData.members}
          defaultTeamName={editData.team.team_name}
          allTeams={editData.allTeams}
          existingTeam={{
            id: editData.team.id,
            team_name: editData.team.team_name,
            captain_id: editData.team.captain_id,
            home_venue_id: editData.team.home_venue_id,
            roster_size: editData.team.roster_size,
          }}
          onSuccess={handleTeamUpdateSuccess}
          onCancel={handleCancelEdit}
          variant="captain"
        />
      )}
    </div>
  );
}
