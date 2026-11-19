/**
 * @fileoverview RLS Tests for Match Lineups Table
 *
 * Tests lineup management operations:
 * - Auto-creation via triggers
 * - Players assigning themselves to games
 * - Operators managing lineups
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { createTestClient, executeSql, requireSeed } from '@/test/dbTestUtils';
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
      requireSeed(testLineupId, 'No test lineup found');

      const { data, error } = await client
        .from('match_lineups')
        .select('*')
        .eq('id', testLineupId)
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('should allow viewing lineups for a match', async () => {
      requireSeed(testMatchId, 'No test match found');

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
      requireSeed(testMatchId, 'No test match found');

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

      requireSeed(seedMatch?.home_team_id, 'seedMatch?.home_team_id is required');
      requireSeed(seedMatch?.away_team_id, 'seedMatch?.away_team_id is required');

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

      requireSeed(throwawayMatch, 'throwawayMatch is required');

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
    // Rewritten 2026-11-17: this used to read `preferences.league_id` and
    // `preference_action`, columns preferences no longer has. The query
    // errored, the test returned early, and it "passed" for months. It now
    // makes its own row (preferences are keyed by entity, and the seed has
    // none), updates it through the app's client, and reads the value back.
    it('should allow updating preferences', async () => {
      const [row] = await executeSql(
        `INSERT INTO public.preferences (entity_type, entity_id, profanity_filter_enabled)
         VALUES ('league', gen_random_uuid(), false) RETURNING id`,
      );
      try {
        const { error } = await client
          .from('preferences')
          .update({ profanity_filter_enabled: true })
          .eq('id', row.id);
        expect(error).toBeNull();

        const [after] = await executeSql('SELECT profanity_filter_enabled FROM public.preferences WHERE id = $1', [row.id]);
        expect(after.profanity_filter_enabled).toBe(true);
      } finally {
        await executeSql('DELETE FROM public.preferences WHERE id = $1', [row.id]);
      }
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
      requireSeed(testOrgId, 'No test organization found');

      const { data, error } = await client
        .from('operator_blackout_preferences')
        .select('*')
        .eq('organization_id', testOrgId);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });
  });

  describe('Operator Blackout Preferences - INSERT/UPDATE Operations', () => {
    // Rewritten 2026-11-17: this used to update `blackout_name`, a column
    // the table doesn't have, and returned early (passing) because the seed
    // has no blackout rows. It now makes its own row and checks the update.
    it('should allow updating blackout preferences', async () => {
      requireSeed(testOrgId, 'No test organization found');
      const [row] = await executeSql(
        `INSERT INTO public.operator_blackout_preferences (organization_id, preference_action, preference_type, custom_name, custom_start_date, custom_end_date)
         VALUES ($1, 'blackout', 'custom', 'RLS test blackout', '2099-12-24', '2099-12-26') RETURNING id`,
        [testOrgId],
      );
      try {
        const { error } = await client
          .from('operator_blackout_preferences')
          .update({ custom_name: 'Updated Blackout' })
          .eq('id', row.id);
        expect(error).toBeNull();

        const [after] = await executeSql('SELECT custom_name FROM public.operator_blackout_preferences WHERE id = $1', [row.id]);
        expect(after.custom_name).toBe('Updated Blackout');
      } finally {
        await executeSql('DELETE FROM public.operator_blackout_preferences WHERE id = $1', [row.id]);
      }
    });
  });
});
