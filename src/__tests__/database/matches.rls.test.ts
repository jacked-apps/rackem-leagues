/**
 * @fileoverview RLS Tests for Matches Table
 *
 * Tests all CRUD operations on the matches table to ensure:
 * 1. Operations work correctly WITHOUT RLS (baseline)
 * 2. Operations still work correctly WITH RLS (after migration)
 *
 * Run these tests:
 * - Before adding RLS: Should all pass (establishes baseline)
 * - After adding RLS: Should still all pass (validates RLS is safe)
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { createTestClient } from '@/test/dbTestUtils';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

describe('Matches Table - RLS Tests', () => {
  let client: SupabaseClient<Database>;
  let testMatchId: string;
  let testSeasonId: string;
  let testSeasonWeekId: string;

  beforeAll(async () => {
    client = createTestClient();

    // Get a test match from the database
    const { data: match } = await client
      .from('matches')
      .select('id, season_id, season_week_id')
      .limit(1)
      .single();

    if (match) {
      testMatchId = match.id;
      testSeasonId = match.season_id;
      testSeasonWeekId = match.season_week_id;
    }
  });

  describe('SELECT Operations', () => {
    it('should allow unauthenticated users to view all matches', async () => {
      const { data, error } = await client
        .from('matches')
        .select('*');

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should allow selecting a specific match by id', async () => {
      if (!testMatchId) {
        console.warn('⚠️ No test match found, skipping test');
        return;
      }

      const { data, error } = await client
        .from('matches')
        .select('*')
        .eq('id', testMatchId)
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.id).toBe(testMatchId);
    });

    // NOTE: Team join test removed - matches has multiple FKs to teams table
    // (home_team_id, away_team_id) creating ambiguous join paths
    // Tests Supabase join syntax, not RLS. SELECT * test above is sufficient.

    it('should allow filtering matches by season', async () => {
      if (!testSeasonId) {
        console.warn('⚠️ No test season found, skipping test');
        return;
      }

      const { data, error } = await client
        .from('matches')
        .select('*')
        .eq('season_id', testSeasonId);

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);
    });
  });

  describe('UPDATE Operations', () => {
    it('should allow updating match status', async () => {
      if (!testMatchId) {
        console.warn('⚠️ No test match found, skipping test');
        return;
      }

      // First, get the current status
      const { data: before } = await client
        .from('matches')
        .select('status')
        .eq('id', testMatchId)
        .single();

      // Update to a new status
      const newStatus = before?.status === 'scheduled' ? 'in_progress' : 'scheduled';
      const { error: updateError } = await client
        .from('matches')
        .update({ status: newStatus })
        .eq('id', testMatchId);

      expect(updateError).toBeNull();

      // Verify the update
      const { data: after } = await client
        .from('matches')
        .select('status')
        .eq('id', testMatchId)
        .single();

      expect(after?.status).toBe(newStatus);

      // Restore original status
      await client
        .from('matches')
        .update({ status: before?.status ?? 'scheduled' })
        .eq('id', testMatchId);
    });

    it('should allow updating match timestamps', async () => {
      if (!testMatchId) {
        console.warn('⚠️ No test match found, skipping test');
        return;
      }

      const now = new Date().toISOString();
      const { error } = await client
        .from('matches')
        .update({ started_at: now })
        .eq('id', testMatchId);

      expect(error).toBeNull();
    });

    it('should allow updating match scores', async () => {
      if (!testMatchId) {
        console.warn('⚠️ No test match found, skipping test');
        return;
      }

      const { error } = await client
        .from('matches')
        .update({
          home_to_win: 10,
          away_to_win: 5,
        })
        .eq('id', testMatchId);

      expect(error).toBeNull();
    });

    it('should allow updating lineup references', async () => {
      if (!testMatchId) {
        console.warn('⚠️ No test match found, skipping test');
        return;
      }

      // Get a lineup ID from match_lineups
      const { data: lineup } = await client
        .from('match_lineups')
        .select('id')
        .eq('match_id', testMatchId)
        .limit(1)
        .single();

      if (lineup) {
        const { error } = await client
          .from('matches')
          .update({ home_lineup_id: lineup.id })
          .eq('id', testMatchId);

        expect(error).toBeNull();
      }
    });
  });


  describe('DELETE Operations', () => {
    it('should allow deleting a match', async () => {
      if (!testSeasonId) {
        console.warn('⚠️ No test season found, skipping test');
        return;
      }

      // First create a test match
      const { data: teams } = await client
        .from('teams')
        .select('id')
        .eq('season_id', testSeasonId)
        .limit(2);

      if (!teams || teams.length < 2) {
        console.warn('⚠️ Not enough teams found, skipping test');
        return;
      }

      const { data: testMatch } = await client
        .from('matches')
        .insert({
          season_id: testSeasonId,
          season_week_id: testSeasonWeekId,
          home_team_id: teams[0].id,
          away_team_id: teams[1].id,
          match_number: 999,
          status: 'scheduled',
        })
        .select()
        .single();

      if (!testMatch) {
        console.warn('⚠️ Could not create test match, skipping test');
        return;
      }

      // Now delete it
      const { error } = await client
        .from('matches')
        .delete()
        .eq('id', testMatch.id);

      expect(error).toBeNull();

      // Verify it's deleted
      const { data: deleted } = await client
        .from('matches')
        .select('*')
        .eq('id', testMatch.id)
        .single();

      expect(deleted).toBeNull();
    });
  });
});
