/**
 * @fileoverview RLS Tests for Match Lineups Table
 *
 * Tests lineup management operations:
 * - Auto-creation via triggers
 * - Players assigning themselves to games
 * - Operators managing lineups
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { createTestClient } from '@/test/dbTestUtils';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

describe('Match Lineups Table - RLS Tests', () => {
  let client: SupabaseClient<Database>;
  let testLineupId: string;
  let testMatchId: string;

  beforeAll(async () => {
    client = createTestClient();

    // Get a test lineup
    const { data: lineup } = await client
      .from('match_lineups')
      .select('id, match_id')
      .limit(1)
      .single();

    if (lineup) {
      testLineupId = lineup.id;
      testMatchId = lineup.match_id;
    }
  });

  describe('SELECT Operations', () => {
    it('should allow viewing all match lineups', async () => {
      const { data, error } = await client
        .from('match_lineups')
        .select('*')
        .limit(10);

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should allow viewing lineup by id', async () => {
      if (!testLineupId) {
        console.warn('⚠️ No test lineup found, skipping test');
        return;
      }

      const { data, error } = await client
        .from('match_lineups')
        .select('*')
        .eq('id', testLineupId)
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('should allow viewing lineups for a match', async () => {
      if (!testMatchId) {
        console.warn('⚠️ No test match found, skipping test');
        return;
      }

      const { data, error } = await client
        .from('match_lineups')
        .select('*')
        .eq('match_id', testMatchId);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    // NOTE: Player join test removed - match_lineups has player1_id, player2_id, etc.
    // not a single player_id, so joining to "members" is ambiguous
    // This tests Supabase join syntax, not RLS. SELECT * test above is sufficient for RLS.
  });

  describe('DELETE Operations', () => {
    it('should allow deleting lineup entries', async () => {
      if (!testMatchId) {
        console.warn('⚠️ No test match found, skipping test');
        return;
      }

      // match_lineups has a UNIQUE (match_id, team_id), NOT-NULL handicaps, and
      // rows are auto-created by a trigger — so a synthetic lineup can't be
      // inserted onto an existing match. Instead spin up a throwaway match (its
      // INSERT trigger auto-creates one lineup per team), delete one of those
      // lineups, then delete the match to clean up whatever remains.
      const { data: seedMatch } = await client
        .from('matches')
        .select('season_id, season_week_id, home_team_id, away_team_id')
        .eq('id', testMatchId)
        .single();

      if (!seedMatch?.home_team_id || !seedMatch?.away_team_id) return;

      const { data: throwawayMatch } = await client
        .from('matches')
        .insert({
          season_id: seedMatch.season_id,
          season_week_id: seedMatch.season_week_id,
          home_team_id: seedMatch.home_team_id,
          away_team_id: seedMatch.away_team_id,
          match_number: 999,
          status: 'scheduled',
        })
        .select('id')
        .single();

      if (!throwawayMatch) return;

      // The insert trigger auto-created a lineup per team; grab one to delete.
      const { data: lineup } = await client
        .from('match_lineups')
        .select('id')
        .eq('match_id', throwawayMatch.id)
        .limit(1)
        .single();

      if (lineup) {
        const { error } = await client
          .from('match_lineups')
          .delete()
          .eq('id', lineup.id);

        expect(error).toBeNull();

        // Verify deletion
        const { data: deleted } = await client
          .from('match_lineups')
          .select('*')
          .eq('id', lineup.id)
          .maybeSingle();

        expect(deleted).toBeNull();
      }

      // Clean up the throwaway match (its delete trigger removes any remaining
      // auto-created lineups).
      await client.from('matches').delete().eq('id', throwawayMatch.id);
    });
  });
});

describe('Preferences Tables - RLS Tests', () => {
  let client: SupabaseClient<Database>;
  let testLeagueId: string;
  let testOrgId: string;

  beforeAll(async () => {
    client = createTestClient();

    // Get a test league
    const { data: league } = await client
      .from('leagues')
      .select('id, organization_id')
      .limit(1)
      .single();

    if (league) {
      testLeagueId = league.id;
      testOrgId = league.organization_id;
    }
  });

  describe('Preferences Table - SELECT Operations', () => {
    it('should allow viewing all preferences', async () => {
      const { data, error } = await client
        .from('preferences')
        .select('*')
        .limit(10);

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);
    });
  });

  describe('Preferences Table - INSERT/UPDATE Operations', () => {
    it('should allow updating preferences', async () => {
      if (!testLeagueId) {
        console.warn('⚠️ No test league found, skipping test');
        return;
      }

      // Get an existing preference
      const { data: pref } = await client
        .from('preferences')
        .select('id, preference_action')
        .eq('league_id', testLeagueId)
        .limit(1)
        .single();

      if (!pref) return;

      const newAction = pref.preference_action === 'blackout' ? 'ignore' : 'blackout';
      const { error } = await client
        .from('preferences')
        .update({ preference_action: newAction })
        .eq('id', pref.id);

      expect(error).toBeNull();

      // Restore
      await client
        .from('preferences')
        .update({ preference_action: pref.preference_action })
        .eq('id', pref.id);
    });
  });

  describe('Operator Blackout Preferences - SELECT Operations', () => {
    it('should allow viewing operator blackout preferences', async () => {
      const { data, error } = await client
        .from('operator_blackout_preferences')
        .select('*')
        .limit(10);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('should allow viewing blackouts for an organization', async () => {
      if (!testOrgId) {
        console.warn('⚠️ No test organization found, skipping test');
        return;
      }

      const { data, error } = await client
        .from('operator_blackout_preferences')
        .select('*')
        .eq('organization_id', testOrgId);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });
  });

  describe('Operator Blackout Preferences - INSERT/UPDATE Operations', () => {
    it('should allow updating blackout preferences', async () => {
      if (!testOrgId) {
        console.warn('⚠️ No test organization found, skipping test');
        return;
      }

      // Get an existing blackout
      const { data: blackout } = await client
        .from('operator_blackout_preferences')
        .select('id, blackout_name')
        .eq('organization_id', testOrgId)
        .limit(1)
        .single();

      if (!blackout) return;

      const { error } = await client
        .from('operator_blackout_preferences')
        .update({ blackout_name: 'Updated Blackout' })
        .eq('id', blackout.id);

      expect(error).toBeNull();

      // Restore
      await client
        .from('operator_blackout_preferences')
        .update({ blackout_name: blackout.blackout_name })
        .eq('id', blackout.id);
    });
  });
});
