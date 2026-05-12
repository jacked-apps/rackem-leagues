/**
 * @fileoverview RLS tests for the preferences table.
 *
 * Phase 2 of the scoring event registry rework added RLS to preferences
 * for the first time. Before Phase 2 the table had GRANT ALL TO authenticated
 * with no row-level policies — any authenticated user could upsert any
 * league's or org's preferences via direct PostgREST call. This left the
 * new enabled_events column open to tampering by non-LO members.
 *
 * The new policies gate INSERT/UPDATE/DELETE through
 * can_write_preferences(entity_type, entity_id) SECURITY DEFINER, which
 * checks that the caller is owner/admin of:
 *   entity_type='organization' → the org directly
 *   entity_type='league'       → leagues.organization_id transitively
 *
 * SELECT remains open (matches the existing match_games posture; the
 * resolved view exposes preference values to all authenticated readers).
 *
 * Coverage:
 *   - SELECT open to anon and authenticated
 *   - INSERT blocked for anon (no auth.uid)
 *   - service role bypasses RLS (used for test data setup)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestClient, createServiceClient, closePostgresPool } from '@/test/dbTestUtils';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

describe('preferences Table - RLS Tests', () => {
  let anonClient: SupabaseClient<Database>;
  let serviceClient: SupabaseClient<Database>;
  let testLeagueId: string | null = null;

  beforeAll(async () => {
    anonClient = createTestClient();
    serviceClient = createServiceClient();

    const { data: league } = await serviceClient
      .from('leagues')
      .select('id')
      .limit(1)
      .single();

    if (league) {
      testLeagueId = league.id;
    }
  });

  afterAll(async () => {
    await closePostgresPool();
  });

  describe('SELECT (open to anon + authenticated)', () => {
    it('anon can SELECT preference rows', async () => {
      const { error } = await anonClient.from('preferences').select('*').limit(10);
      expect(error).toBeNull();
    });

    it('anon can filter by entity scope', async () => {
      if (!testLeagueId) {
        console.warn('⚠️ No test league found, skipping');
        return;
      }
      const { error } = await anonClient
        .from('preferences')
        .select('*')
        .eq('entity_type', 'league')
        .eq('entity_id', testLeagueId);
      expect(error).toBeNull();
    });
  });

  describe('INSERT/UPDATE authorization gate', () => {
    it('anon (unauthenticated) is BLOCKED from inserting a preferences row', async () => {
      if (!testLeagueId) {
        console.warn('⚠️ No test league found, skipping');
        return;
      }

      const { error } = await anonClient.from('preferences').insert({
        entity_type: 'league',
        entity_id: testLeagueId,
        enabled_events: { golden_break: false },
      });

      // can_write_preferences returns false for anon (no auth.uid) → RLS
      // blocks the INSERT. Error is the expected outcome.
      expect(error).not.toBeNull();
    });

    it('anon (unauthenticated) is BLOCKED from updating preferences', async () => {
      if (!testLeagueId) return;

      const { error } = await anonClient
        .from('preferences')
        .update({ enabled_events: { tampered: true } })
        .eq('entity_type', 'league')
        .eq('entity_id', testLeagueId);

      expect(error).not.toBeNull();
    });

    it('service role bypasses RLS and can upsert (test setup path)', async () => {
      if (!testLeagueId) return;

      // First read what's there so we can restore it.
      const { data: before } = await serviceClient
        .from('preferences')
        .select('enabled_events')
        .eq('entity_type', 'league')
        .eq('entity_id', testLeagueId)
        .maybeSingle();

      const { error } = await serviceClient
        .from('preferences')
        .upsert(
          {
            entity_type: 'league',
            entity_id: testLeagueId,
            enabled_events: { test_marker: true },
          },
          { onConflict: 'entity_type,entity_id' },
        );

      expect(error).toBeNull();

      // Restore
      await serviceClient
        .from('preferences')
        .update({
          enabled_events:
            (before?.enabled_events as Record<string, boolean> | null) ?? {},
        })
        .eq('entity_type', 'league')
        .eq('entity_id', testLeagueId);
    });
  });

  describe('enabled_events column shape', () => {
    it('NEVER stores NULL — column is NOT NULL with default empty jsonb', async () => {
      const { data, error } = await serviceClient
        .from('preferences')
        .select('enabled_events')
        .limit(5);

      expect(error).toBeNull();
      if (data) {
        for (const row of data) {
          expect(row.enabled_events).not.toBeNull();
        }
      }
    });
  });
});
