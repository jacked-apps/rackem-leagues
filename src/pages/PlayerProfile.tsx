/**
 * @fileoverview Public Player Profile Page
 *
 * Displays public information about a player:
 * - Name and player number
 * - Email (if they choose to share it)
 * - Current teams
 * - Pool-related stats (handicap, etc. - future)
 *
 * Privacy-focused: Does NOT show address, phone, DOB, or other sensitive info.
 * Accessible to all authenticated league members.
 */

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Mail, Users, Award } from 'lucide-react';
import { formatGameType, formatDayOfWeek } from '@/types/league';
import { logger } from '@/utils/logger';

interface PlayerData {
  id: string;
  first_name: string;
  last_name: string;
  system_player_number: number;
  email: string | null;
  bca_member_number: string | null;
}

interface TeamData {
  team: {
    id: string;
    team_name: string;
  };
  season: {
    id: string;
    season_name: string;
    league: {
      id: string;
      game_type: string;
      day_of_week: string;
      division: string | null;
    };
  };
  is_captain: boolean;
}

export function PlayerProfile() {
  const { playerId } = useParams<{ playerId: string }>();
  const [player, setPlayer] = useState<PlayerData | null>(null);
  const [teams, setTeams] = useState<TeamData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadPlayerProfile() {
      if (!playerId) {
        setError('Player ID not provided');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      // Fetch player basic info
      const { data: playerData, error: playerError } = await supabase
        .from('members')
        .select('id, first_name, last_name, system_player_number, email, bca_member_number')
        .eq('id', playerId)
        .single();

      if (playerError || !playerData) {
        logger.error('Error fetching player', { error: playerError?.message });
        setError('Unable to load player profile');
        setLoading(false);
        return;
      }

      setPlayer(playerData);

      // Fetch player's current teams
      const { data: teamsData, error: teamsError } = await supabase
        .from('team_players')
        .select(`
          is_captain,
          teams!inner(
            id,
            team_name,
            seasons!inner(
              id,
              season_name,
              status,
              leagues!inner(
                id,
                game_type,
                day_of_week,
                division
              )
            )
          )
        `)
        .eq('member_id', playerId)
        .eq('teams.seasons.status', 'active');

      if (teamsError) {
        logger.error('Error fetching teams', { error: teamsError.message });
        // Don't fail completely if teams don't load
      } else {
        // Transform the data to match our interface
        const transformedTeams = (teamsData || []).map((item: any) => ({
          is_captain: item.is_captain,
          team: {
            id: item.teams.id,
            team_name: item.teams.team_name,
          },
          season: {
            id: item.teams.seasons.id,
            season_name: item.teams.seasons.season_name,
            league: {
              id: item.teams.seasons.leagues.id,
              game_type: item.teams.seasons.leagues.game_type,
              day_of_week: item.teams.seasons.leagues.day_of_week,
              division: item.teams.seasons.leagues.division,
            },
          },
        }));
        setTeams(transformedTeams);
      }

      setLoading(false);
    }

    loadPlayerProfile();
  }, [playerId]);

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-center text-muted-foreground">Loading player profile...</p>
      </div>
    );
  }

  if (error || !player) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-center text-red-600">{error || 'Player not found'}</p>
        <div className="flex justify-center mt-4">
          <Button onClick={() => window.history.back()} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      {/* Back Button */}
      <Button onClick={() => window.history.back()} variant="ghost" className="mb-4">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back
      </Button>

      {/* Player Info Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-3xl">
            {player.first_name} {player.last_name}
          </CardTitle>
          <p className="text-lg text-muted-foreground">
            Player #{player.system_player_number.toString().padStart(5, '0')}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Email */}
          {player.email && (
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <a
                href={`mailto:${player.email}`}
                className="text-blue-600 hover:underline"
              >
                {player.email}
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Current Teams */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Current Teams</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {teams.length === 0 ? (
            <p className="text-muted-foreground">Not currently on any teams</p>
          ) : (
            <ul className="space-y-3">
              {teams.map((teamData) => (
                <li
                  key={teamData.team.id}
                  className="p-3 border rounded-lg hover:bg-muted transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-foreground">
                        {teamData.team.team_name}
                        {teamData.is_captain && (
                          <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                            Captain
                          </span>
                        )}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatGameType(teamData.season.league.game_type as any)} •{' '}
                        {formatDayOfWeek(teamData.season.league.day_of_week as any)}
                        {teamData.season.league.division &&
                          ` • ${teamData.season.league.division}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {teamData.season.season_name}
                      </p>
                    </div>
                    <Link
                      to={`/league/${teamData.season.league.id}/season/${teamData.season.id}/schedule`}
                    >
                      <Button variant="outline" size="sm">
                        View Schedule
                      </Button>
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* BCA Membership Status */}
      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5 text-muted-foreground" />
            <CardTitle>BCA Membership Status</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {player.bca_member_number ? (
            <div className="flex items-center gap-2">
              <span className="text-sm bg-green-100 text-green-800 px-2 py-1 rounded">Active</span>
              <span className="text-foreground">Member #{player.bca_member_number}</span>
            </div>
          ) : (
            <p className="text-muted-foreground">No BCA membership on file</p>
          )}
        </CardContent>
      </Card>

      {/* Future sections can be added here:
          - Handicap info
          - Win/loss record
          - Tournament history
          - etc.
      */}
    </div>
  );
}
