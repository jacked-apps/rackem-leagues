/**
 * @fileoverview RLS Tests for Teams and Team Players Tables
 *
 * Tests team management operations:
 * - Captains managing their teams
 * - Operators managing teams in their organization
 * - Players viewing all teams
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { createTestClient } from '@/test/dbTestUtils';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

describe('Teams Table - RLS Tests', () => {
  let client: SupabaseClient<Database>;
  let testTeamId: string;
  let testSeasonId: string;
  let testLeagueId: string;

  beforeAll(async () => {
    client = createTestClient();

    // Get a test team
    const { data: team } = await client
      .from('teams')
      .select('id, season_id, league_id')
      .limit(1)
      .single();

    if (team) {
      testTeamId = team.id;
      testSeasonId = team.season_id;
      testLeagueId = team.league_id;
    }
  });

  describe('SELECT Operations', () => {
    it('should allow viewing all teams', async () => {
      const { data, error } = await client
        .from('teams')
        .select('*')
        .limit(10);

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should allow viewing teams with captain info', async () => {
      const { data, error } = await client
        .from('teams')
        .select(`
          *,
          captain:members(first_name, last_name)
        `)
        .limit(5);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('should allow filtering teams by season', async () => {
      if (!testSeasonId) {
        console.warn('⚠️ No test season found, skipping test');
        return;
      }

      const { data, error } = await client
        .from('teams')
        .select('*')
        .eq('season_id', testSeasonId);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('should allow filtering teams by league', async () => {
      if (!testLeagueId) {
        console.warn('⚠️ No test league found, skipping test');
        return;
      }

      const { data, error } = await client
        .from('teams')
        .select('*')
        .eq('league_id', testLeagueId);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });
  });

  describe('UPDATE Operations - Captain Features', () => {
    it('should allow updating team name', async () => {
      if (!testTeamId) {
        console.warn('⚠️ No test team found, skipping test');
        return;
      }

      // Get current name
      const { data: before } = await client
        .from('teams')
        .select('team_name')
        .eq('id', testTeamId)
        .single();

      // Update name
      const newName = `Test Team ${Date.now()}`;
      const { error } = await client
        .from('teams')
        .update({ team_name: newName })
        .eq('id', testTeamId);

      expect(error).toBeNull();

      // Verify update
      const { data: after } = await client
        .from('teams')
        .select('team_name')
        .eq('id', testTeamId)
        .single();

      expect(after?.team_name).toBe(newName);

      // Restore original name
      if (before) {
        await client
          .from('teams')
          .update({ team_name: before.team_name })
          .eq('id', testTeamId);
      }
    });

    it('should allow updating home venue', async () => {
      if (!testTeamId) {
        console.warn('⚠️ No test team found, skipping test');
        return;
      }

      // Get a venue
      const { data: venue } = await client
        .from('venues')
        .select('id')
        .limit(1)
        .single();

      if (!venue) {
        console.warn('⚠️ No venue found, skipping test');
        return;
      }

      const { error } = await client
        .from('teams')
        .update({ home_venue_id: venue.id })
        .eq('id', testTeamId);

      expect(error).toBeNull();
    });

    it('should allow updating team status', async () => {
      if (!testTeamId) {
        console.warn('⚠️ No test team found, skipping test');
        return;
      }

      const { data: before } = await client
        .from('teams')
        .select('status')
        .eq('id', testTeamId)
        .single();

      const { error } = await client
        .from('teams')
        .update({ status: 'active' })
        .eq('id', testTeamId);

      expect(error).toBeNull();

      // Restore original status
      if (before) {
        await client
          .from('teams')
          .update({ status: before.status })
          .eq('id', testTeamId);
      }
    });
  });

  describe('INSERT Operations - Operator Features', () => {
    it('should allow creating a new team', async () => {
      if (!testSeasonId || !testLeagueId) {
        console.warn('⚠️ No test season/league found, skipping test');
        return;
      }

      // Get a member to be captain
      const { data: member } = await client
        .from('members')
        .select('id')
        .limit(1)
        .single();

      if (!member) {
        console.warn('⚠️ No member found, skipping test');
        return;
      }

      const { data: newTeam, error } = await client
        .from('teams')
        .insert({
          season_id: testSeasonId,
          league_id: testLeagueId,
          captain_id: member.id,
          team_name: `Test Team ${Date.now()}`,
          roster_size: 5,
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(newTeam).toBeDefined();
      expect(newTeam?.team_name).toContain('Test Team');

      // Clean up
      if (newTeam) {
        await client
          .from('teams')
          .delete()
          .eq('id', newTeam.id);
      }
    });
  });

  describe('DELETE Operations', () => {
    it('should allow deleting a team with no matches', async () => {
      if (!testSeasonId || !testLeagueId) {
        console.warn('⚠️ No test season/league found, skipping test');
        return;
      }

      // Create a test team with no matches
      const { data: member } = await client
        .from('members')
        .select('id')
        .limit(1)
        .single();

      if (!member) return;

      const { data: testTeam } = await client
        .from('teams')
        .insert({
          season_id: testSeasonId,
          league_id: testLeagueId,
          captain_id: member.id,
          team_name: `Delete Test ${Date.now()}`,
          roster_size: 5,
        })
        .select()
        .single();

      if (!testTeam) {
        console.warn('⚠️ Could not create test team, skipping test');
        return;
      }

      // Hard delete works because no matches reference this team
      const { error } = await client
        .from('teams')
        .delete()
        .eq('id', testTeam.id);

      expect(error).toBeNull();

      // Verify deletion
      const { data: deleted } = await client
        .from('teams')
        .select('*')
        .eq('id', testTeam.id)
        .single();

      expect(deleted).toBeNull();
    });

    it('should refuse to delete a team that has matches (FK RESTRICT)', async () => {
      if (!testSeasonId || !testLeagueId) {
        console.warn('⚠️ No test season/league found, skipping test');
        return;
      }

      const { data: member } = await client
        .from('members')
        .select('id')
        .limit(1)
        .single();

      if (!member) return;

      // Need a season_week to attach a match to
      const { data: seasonWeek } = await client
        .from('season_weeks')
        .select('id')
        .eq('season_id', testSeasonId)
        .limit(1)
        .single();

      if (!seasonWeek) {
        console.warn('⚠️ No season_week available, skipping test');
        return;
      }

      // Create a test team
      const { data: testTeam } = await client
        .from('teams')
        .insert({
          season_id: testSeasonId,
          league_id: testLeagueId,
          captain_id: member.id,
          team_name: `Restrict Test ${Date.now()}`,
          roster_size: 5,
        })
        .select()
        .single();

      if (!testTeam) {
        console.warn('⚠️ Could not create test team, skipping test');
        return;
      }

      // Create a match referencing the team. The auto_create_match_lineups
      // trigger fires here, also creating a match_lineups row pointing at
      // the team — so this single match exercises both the matches FK
      // RESTRICT and the match_lineups FK RESTRICT.
      const { data: testMatch, error: matchInsertError } = await client
        .from('matches')
        .insert({
          season_id: testSeasonId,
          season_week_id: seasonWeek.id,
          home_team_id: testTeam.id,
          match_number: 9999,
          status: 'scheduled',
        })
        .select()
        .single();

      if (matchInsertError || !testMatch) {
        // Roll back the team insert before bailing
        await client.from('teams').delete().eq('id', testTeam.id);
        console.warn('⚠️ Could not create test match, skipping test');
        return;
      }

      // Attempt to delete the team — must be refused under FK RESTRICT
      const { error: deleteError } = await client
        .from('teams')
        .delete()
        .eq('id', testTeam.id);

      expect(deleteError).not.toBeNull();
      // Error code 23503 = foreign_key_violation
      expect(deleteError?.code).toBe('23503');

      // Confirm the team still exists
      const { data: stillThere } = await client
        .from('teams')
        .select('id')
        .eq('id', testTeam.id)
        .single();
      expect(stillThere?.id).toBe(testTeam.id);

      // Clean up: delete the match first (cascades match_lineups + match_games),
      // then the team.
      await client.from('matches').delete().eq('id', testMatch.id);
      await client.from('teams').delete().eq('id', testTeam.id);
    });
  });
});

describe('Team Players Table - RLS Tests', () => {
  let client: SupabaseClient<Database>;
  let testTeamId: string;
  let testMemberId: string;

  beforeAll(async () => {
    client = createTestClient();

    // Get a test team and member
    const { data: teamPlayer } = await client
      .from('team_players')
      .select('team_id, member_id')
      .limit(1)
      .single();

    if (teamPlayer) {
      testTeamId = teamPlayer.team_id;
      testMemberId = teamPlayer.member_id;
    }
  });

  describe('SELECT Operations', () => {
    it('should allow viewing all team rosters', async () => {
      const { data, error } = await client
        .from('team_players')
        .select('*')
        .limit(10);

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should allow viewing roster with player details', async () => {
      const { data, error } = await client
        .from('team_players')
        .select(`
          *,
          member:members(first_name, last_name, skill_level:role)
        `)
        .limit(5);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('should allow filtering by team', async () => {
      if (!testTeamId) {
        console.warn('⚠️ No test team found, skipping test');
        return;
      }

      const { data, error } = await client
        .from('team_players')
        .select('*')
        .eq('team_id', testTeamId);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });
  });

  describe('INSERT Operations - Adding Players to Roster', () => {
    it('should allow adding a player to a team', async () => {
      if (!testTeamId) {
        console.warn('⚠️ No test team found, skipping test');
        return;
      }

      // Get the season for this team
      const { data: team } = await client
        .from('teams')
        .select('season_id')
        .eq('id', testTeamId)
        .single();

      if (!team) return;

      // Get a member not on this team
      const { data: existingPlayers } = await client
        .from('team_players')
        .select('member_id')
        .eq('team_id', testTeamId);

      const excludeIds = existingPlayers?.map(p => p.member_id) ?? [];

      const { data: newMember } = await client
        .from('members')
        .select('id')
        .not('id', 'in', `(${excludeIds.join(',')})`)
        .limit(1)
        .single();

      if (!newMember) {
        console.warn('⚠️ No available member found, skipping test');
        return;
      }

      const { data: newPlayer, error } = await client
        .from('team_players')
        .insert({
          team_id: testTeamId,
          member_id: newMember.id,
          season_id: team.season_id,
          is_captain: false,
          skill_level: 5,
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(newPlayer).toBeDefined();

      // Clean up
      if (newPlayer) {
        await client
          .from('team_players')
          .delete()
          .eq('id', newPlayer.id);
      }
    });
  });

  describe('UPDATE Operations - Roster Management', () => {
    it('should allow updating player skill level', async () => {
      if (!testTeamId || !testMemberId) {
        console.warn('⚠️ No test data found, skipping test');
        return;
      }

      const { data: player } = await client
        .from('team_players')
        .select('id, skill_level')
        .eq('team_id', testTeamId)
        .eq('member_id', testMemberId)
        .single();

      if (!player) return;

      const newSkillLevel = player.skill_level === 5 ? 6 : 5;
      const { error } = await client
        .from('team_players')
        .update({ skill_level: newSkillLevel })
        .eq('id', player.id);

      expect(error).toBeNull();

      // Restore original
      await client
        .from('team_players')
        .update({ skill_level: player.skill_level })
        .eq('id', player.id);
    });

    it('should allow updating player status', async () => {
      if (!testTeamId || !testMemberId) {
        console.warn('⚠️ No test data found, skipping test');
        return;
      }

      const { data: player } = await client
        .from('team_players')
        .select('id, status')
        .eq('team_id', testTeamId)
        .eq('member_id', testMemberId)
        .single();

      if (!player) return;

      const { error } = await client
        .from('team_players')
        .update({ status: 'active' })
        .eq('id', player.id);

      expect(error).toBeNull();

      // Restore original
      await client
        .from('team_players')
        .update({ status: player.status })
        .eq('id', player.id);
    });
  });

  describe('DELETE Operations - Removing Players', () => {
    it('should allow removing a player from roster', async () => {
      if (!testTeamId) {
        console.warn('⚠️ No test team found, skipping test');
        return;
      }

      // Create a test player first
      const { data: team } = await client
        .from('teams')
        .select('season_id')
        .eq('id', testTeamId)
        .single();

      if (!team) return;

      const { data: member } = await client
        .from('members')
        .select('id')
        .limit(1)
        .single();

      if (!member) return;

      const { data: testPlayer } = await client
        .from('team_players')
        .insert({
          team_id: testTeamId,
          member_id: member.id,
          season_id: team.season_id,
          skill_level: 5,
        })
        .select()
        .single();

      if (!testPlayer) return;

      // Delete them
      const { error } = await client
        .from('team_players')
        .delete()
        .eq('id', testPlayer.id);

      expect(error).toBeNull();

      // Verify deletion
      const { data: deleted } = await client
        .from('team_players')
        .select('*')
        .eq('id', testPlayer.id)
        .single();

      expect(deleted).toBeNull();
    });
  });
});
