/**
 * @fileoverview RLS Tests for the game_events table.
 *
 * game_events is the row-per-event store that replaces the 4 boolean columns
 * dropped from match_games (break_and_run, golden_break, runout,
 * win_by_forfeit) in Branch B Phase 1.
 *
 * Authorization is enforced by the can_write_game_event(target_game_id)
 * SECURITY DEFINER function — two-tier check:
 *   (a) caller is on the locked match lineup as a scorer, OR
 *   (b) caller is owner/admin of the league's organization.
 *
 * The org-admin branch mirrors can_write_house_rule_org. The scorer-on-lineup
 * branch is novel — no prior precedent in this codebase. Phase 1 ships smoke
 * coverage (anon read, anon write blocked, FK cascade); deeper authenticated
 * scenario coverage (cross-team blocked, unlocked-lineup blocked, LO of other
 * org blocked) lands in Unit 10 polish where it can lean on the dev seed's
 * test users.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { createTestClient, createServiceClient } from '@/test/dbTestUtils';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

describe('game_events Table - RLS Tests', () => {
  let anonClient: SupabaseClient<Database>;
  let serviceClient: SupabaseClient<Database>;
  let testGameId: string | null = null;
  let testMatchId: string | null = null;

  beforeAll(async () => {
    anonClient = createTestClient();
    serviceClient = createServiceClient();

    // Find a test game from existing seed data.
    const { data: game } = await serviceClient
      .from('match_games')
      .select('id, match_id')
      .limit(1)
      .single();

    if (game) {
      testGameId = game.id;
      testMatchId = game.match_id;
    }
  });

  describe('SELECT (open to anon)', () => {
    it('anon can SELECT game_events rows', async () => {
      const { error } = await anonClient
        .from('game_events')
        .select('*')
        .limit(10);

      // No error means SELECT is open. Empty data is fine.
      expect(error).toBeNull();
    });

    it('anon can filter by match_id (realtime channel scope)', async () => {
      if (!testMatchId) {
        console.warn('⚠️ No test match found, skipping');
        return;
      }

      const { error } = await anonClient
        .from('game_events')
        .select('*')
        .eq('match_id', testMatchId);

      expect(error).toBeNull();
    });
  });

  describe('INSERT authorization gate', () => {
    it('anon (unauthenticated) is BLOCKED from inserting game_events', async () => {
      if (!testGameId || !testMatchId) {
        console.warn('⚠️ No test game found, skipping');
        return;
      }

      const { error } = await anonClient.from('game_events').insert({
        game_id: testGameId,
        match_id: testMatchId,
        event_name: 'break_and_run',
        attributed_player_id: null,
      });

      // Anon has no auth.uid() → can_write_game_event returns false → RLS
      // blocks the INSERT. Error is the expected outcome.
      expect(error).not.toBeNull();
    });

    it('service role bypasses RLS and can insert (test setup path)', async () => {
      if (!testGameId || !testMatchId) {
        console.warn('⚠️ No test game found, skipping');
        return;
      }

      const { data, error } = await serviceClient
        .from('game_events')
        .insert({
          game_id: testGameId,
          match_id: testMatchId,
          event_name: 'break_and_run',
          attributed_player_id: null,
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();

      // Cleanup
      if (data) {
        await serviceClient.from('game_events').delete().eq('id', data.id);
      }
    });
  });

  describe('FK cascade behavior', () => {
    it('deleting a match_games row cascades to delete its game_events rows', async () => {
      if (!testMatchId) {
        console.warn('⚠️ No test match found, skipping');
        return;
      }

      // Create a synthetic game in this match using the service client.
      const { data: newGame, error: gameError } = await serviceClient
        .from('match_games')
        .insert({
          match_id: testMatchId,
          game_number: 9999,
          is_tiebreaker: true,
          game_type: 'eight_ball',
          home_action: 'breaks',
          away_action: 'racks',
          confirmed_by_home: false,
          confirmed_by_away: false,
        })
        .select()
        .single();

      if (gameError || !newGame) {
        console.warn('⚠️ Could not create synthetic test game, skipping');
        return;
      }

      // Insert a game_events row referencing it.
      await serviceClient.from('game_events').insert({
        game_id: newGame.id,
        match_id: testMatchId,
        event_name: 'break_and_run',
      });

      // Delete the match_games row.
      await serviceClient.from('match_games').delete().eq('id', newGame.id);

      // The game_events row should be gone via ON DELETE CASCADE.
      const { data: orphaned } = await serviceClient
        .from('game_events')
        .select('id')
        .eq('game_id', newGame.id);

      expect(orphaned).toEqual([]);
    });
  });
});
