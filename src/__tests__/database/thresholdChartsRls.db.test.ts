/**
 * @vitest-environment node
 *
 * @fileoverview RLS tests for threshold_charts + threshold_chart_rows.
 *
 * Mirrors the no-seed pattern used by houseRules.rls.test.ts. The local
 * Supabase DB starts with seeded global charts (from
 * 20260410000003_seed_threshold_charts.sql) but no auth users, members,
 * or organizations. Tests here cover what's verifiable without a seed
 * fixture:
 *   - Anonymous SELECT is rejected (we restricted reads to authenticated)
 *   - Anonymous INSERT is rejected by RLS
 *   - can_write_threshold_chart() returns false for anonymous callers
 *     across all three entity_type branches (global / organization / league)
 *   - can_write_threshold_chart_via_id() returns false for an unknown chart
 *
 * Org-staff INSERT/UPDATE/DELETE coverage (the happy path) requires the
 * same auth-user + member + organization seed fixture house_rules
 * deferred. Tracked alongside that work.
 */

import { afterAll, describe, expect, it } from 'vitest';
import { createTestClient, closePostgresPool } from '@/test/dbTestUtils';

const CHARTS = 'threshold_charts' as const;
const ROWS = 'threshold_chart_rows' as const;

describe('threshold_charts — RLS (no seed required)', () => {
  const anon = createTestClient();

  afterAll(async () => {
    await closePostgresPool();
  });

  it('anonymous SELECT on threshold_charts returns zero rows (authenticated-only)', async () => {
    // The seeded global charts exist on disk but should be invisible to anon.
    const { data, error } = await anon.from(CHARTS).select('id').limit(5);
    // RLS may surface as either an error or an empty result set depending
    // on Postgres version; both forms count as "blocked." Accept either.
    expect(error === null ? data : []).toEqual([]);
  });

  it('anonymous SELECT on threshold_chart_rows returns zero rows', async () => {
    const { data, error } = await anon.from(ROWS).select('id').limit(5);
    expect(error === null ? data : []).toEqual([]);
  });

  it('anonymous INSERT on threshold_charts is rejected by RLS', async () => {
    const { error } = await anon.from(CHARTS).insert({
      entity_type: 'organization',
      entity_id: '00000000-0000-0000-0000-000000000000',
      chart_type: 'percentage',
      lookup_mode: 'exact',
      name: 'Anon probe',
    } as never);
    expect(error).not.toBeNull();
  });

  it('anonymous INSERT on threshold_chart_rows is rejected by RLS', async () => {
    const { error } = await anon.from(ROWS).insert({
      chart_id: '00000000-0000-0000-0000-000000000000',
      comp_1: 0,
      result_1: 0,
    } as never);
    expect(error).not.toBeNull();
  });

  describe('can_write_threshold_chart() permission predicate', () => {
    it('returns false for an anonymous caller on a global chart', async () => {
      const { data, error } = await anon.rpc('can_write_threshold_chart', {
        p_entity_type: 'global',
        p_entity_id: '00000000-0000-0000-0000-000000000000',
      });
      expect(error).toBeNull();
      expect(data).toBe(false);
    });

    it('returns false for an anonymous caller on an organization chart', async () => {
      const { data, error } = await anon.rpc('can_write_threshold_chart', {
        p_entity_type: 'organization',
        p_entity_id: '00000000-0000-0000-0000-000000000000',
      });
      expect(error).toBeNull();
      expect(data).toBe(false);
    });

    it('returns false for an anonymous caller on a league chart', async () => {
      const { data, error } = await anon.rpc('can_write_threshold_chart', {
        p_entity_type: 'league',
        p_entity_id: '00000000-0000-0000-0000-000000000000',
      });
      expect(error).toBeNull();
      expect(data).toBe(false);
    });

    it('returns false for null entity_type / entity_id (defensive)', async () => {
      const { data: nullType } = await anon.rpc('can_write_threshold_chart', {
        p_entity_type: null,
        p_entity_id: '00000000-0000-0000-0000-000000000000',
      });
      const { data: nullId } = await anon.rpc('can_write_threshold_chart', {
        p_entity_type: 'organization',
        p_entity_id: null,
      });
      expect(nullType).toBe(false);
      expect(nullId).toBe(false);
    });

    it('returns false for an unknown entity_type (deny by default)', async () => {
      const { data, error } = await anon.rpc('can_write_threshold_chart', {
        p_entity_type: 'experimental_scope',
        p_entity_id: '00000000-0000-0000-0000-000000000000',
      });
      expect(error).toBeNull();
      expect(data).toBe(false);
    });
  });

  describe('can_write_threshold_chart_via_id() permission predicate', () => {
    it('returns false for an unknown chart id', async () => {
      const { data, error } = await anon.rpc('can_write_threshold_chart_via_id', {
        p_chart_id: '00000000-0000-0000-0000-000000000000',
      });
      expect(error).toBeNull();
      expect(data).toBe(false);
    });

    it('returns false for null chart id', async () => {
      const { data, error } = await anon.rpc('can_write_threshold_chart_via_id', {
        p_chart_id: null,
      });
      expect(error).toBeNull();
      expect(data).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// TODO(seed-fixture): bootstrap auth user + member + organization +
// organization_staff(owner) so we can exercise the happy path:
//   - org owner INSERT/UPDATE/DELETE on org-scoped chart succeeds
//   - org owner UPDATE blocked when target row belongs to another org
//   - league_rep INSERT rejected (only owner/admin)
//   - global chart INSERT/UPDATE/DELETE rejected even for org owner
//     (defense-in-depth — also enforced by prevent_global_chart_modification trigger)
// ---------------------------------------------------------------------------

describe.skip('threshold_charts — full owner/admin coverage (requires seed)', () => {
  it.todo('wire up seed fixture and port the org-staff happy-path coverage');
});
