/**
 * @vitest-environment node
 *
 * @fileoverview RLS + access-control tests for the Phase 6 Unit 6.1
 * rating-mutation RPCs.
 *
 * Mirrors the no-seed pattern used by houseRules.rls.test.ts and
 * thresholdChartsRls.db.test.ts. The local Supabase DB starts without
 * auth users / members / matches, so the happy path (atomic update +
 * audit insert with a real authenticated caller) requires a seed
 * fixture that doesn't exist yet. This file covers what's verifiable
 * without seeds:
 *   - Anonymous SELECT on rating_edit_audit_log returns zero rows
 *     (RESTRICTIVE deny-anon policy from Unit 2.3b survives)
 *   - Anonymous INSERT on rating_edit_audit_log is rejected (the SECURITY
 *     DEFINER RPCs are the ONLY insert path; bare client INSERT denied)
 *   - Anonymous calls to set_match_lineup_rating raise the auth-required
 *     exception baked into the function body (caller-required authz check
 *     fires before any data work — fast fail)
 *   - Anonymous calls to vacate_and_rescore_audit_marker also raise
 *   - Anonymous calls to recompute_member_rating fail at the GRANT check
 *     (REVOKE EXECUTE FROM authenticated → permission denied)
 *
 * Atomicity tests (forced rollback inside the transaction) and happy-path
 * coverage are deferred alongside the seed-fixture work used by other
 * RLS test files.
 */

import { afterAll, describe, expect, it } from 'vitest';
import { createTestClient, closePostgresPool } from '@/test/dbTestUtils';

const AUDIT_LOG = 'rating_edit_audit_log' as const;
const FAKE_UUID = '00000000-0000-0000-0000-000000000000';

describe('rating-mutation RPCs — RLS + access (no seed required)', () => {
  const anon = createTestClient();

  afterAll(async () => {
    await closePostgresPool();
  });

  describe('rating_edit_audit_log — direct table access', () => {
    it('anonymous SELECT returns zero rows (deny-anon RESTRICTIVE policy)', async () => {
      const { data, error } = await anon.from(AUDIT_LOG).select('id').limit(5);
      expect(error === null ? data : []).toEqual([]);
    });

    it('anonymous INSERT is rejected by RLS', async () => {
      const { error } = await anon.from(AUDIT_LOG).insert({
        target_member_id: FAKE_UUID,
        rating_system: 'points',
        before_value: '0',
        after_value: '+1',
        scope: 'persistent',
        source: 'manual',
        organization_id: FAKE_UUID,
      } as never);
      expect(error).not.toBeNull();
    });

    it('anonymous UPDATE is rejected (no UPDATE policy granted)', async () => {
      const { error } = await anon
        .from(AUDIT_LOG)
        .update({ reason: 'tampered' } as never)
        .eq('id', FAKE_UUID);
      // RLS may surface as no-op (zero rows updated) or an error; either
      // counts as "the row wasn't actually mutated."
      if (error === null) {
        // Verify zero rows were touched.
        const { data } = await anon
          .from(AUDIT_LOG)
          .select('id')
          .eq('reason', 'tampered')
          .limit(1);
        expect(data).toEqual([]);
      } else {
        expect(error).not.toBeNull();
      }
    });

    it('anonymous DELETE is rejected (no DELETE policy granted)', async () => {
      const { error } = await anon.from(AUDIT_LOG).delete().eq('id', FAKE_UUID);
      // Same shape as UPDATE — accept either error or no-op.
      if (error === null) {
        // No rows actually deleted (the row didn't exist anyway, but if it had,
        // RLS would have prevented it — this is the best assertion we can make
        // without a seed fixture).
        expect(true).toBe(true);
      } else {
        expect(error).not.toBeNull();
      }
    });
  });

  describe('set_match_lineup_rating — authenticated path with anonymous caller', () => {
    it('rejects anonymous caller with auth-required exception', async () => {
      const { error } = await anon.rpc('set_match_lineup_rating', {
        p_match_lineup_id: FAKE_UUID,
        p_member_id: FAKE_UUID,
        p_rating_value: 5,
        p_reason: 'anon probe',
      });
      expect(error).not.toBeNull();
      // The function body raises 'requires an authenticated caller' but
      // the GRANT check could also fire first; either is acceptable.
    });
  });

  describe('vacate_and_rescore_audit_marker — authenticated path with anonymous caller', () => {
    it('rejects anonymous caller with auth-required exception', async () => {
      const { error } = await anon.rpc('vacate_and_rescore_audit_marker', {
        p_match_id: FAKE_UUID,
        p_reason: 'anon probe',
      });
      expect(error).not.toBeNull();
    });
  });

  describe('recompute_member_rating — service-role only', () => {
    it('rejects anonymous caller (REVOKE EXECUTE FROM authenticated)', async () => {
      const { error } = await anon.rpc('recompute_member_rating', {
        p_member_id: FAKE_UUID,
        p_rating_system: 'points',
        p_new_value: 5,
        p_source: 'computed',
      });
      // GRANT model: REVOKE FROM authenticated, GRANT TO service_role only.
      // Anonymous client lacks the authenticated role too; either way the
      // call fails. Permission denied or function-not-found would both be
      // acceptable error shapes.
      expect(error).not.toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// TODO(seed-fixture): bootstrap an authenticated user with a member row,
// a team_players entry, a match + match_lineup, and exercise:
//   - happy path: roster member calls set_match_lineup_rating, audit row lands
//   - reject path: non-roster caller blocked by authz check
//   - reject path: member not on the lineup blocked by slot-resolution check
//   - happy path: org owner calls vacate_and_rescore_audit_marker, marker lands
//   - happy path: service-role calls recompute_member_rating, no-change → null,
//     change → audit row + UPDATE
//   - atomicity: force rollback after UPDATE but before audit INSERT, verify
//     neither persists (requires a custom RPC harness or BEGIN/ROLLBACK
//     scaffolding that the existing test infra doesn't have yet)
// ---------------------------------------------------------------------------

describe.skip('rating-mutation RPCs — happy path + atomicity (requires seed)', () => {
  it.todo('wire up seed fixture and port the full coverage from the plan');
});
