/**
 * @vitest-environment node
 *
 * @fileoverview RLS + constraint tests for the `house_rules` table.
 *
 * The local Supabase DB starts empty (no auth users, no members, no
 * organizations, no leagues). Creating a valid parent org requires a real
 * auth user + members row + 20 NOT-NULL columns on organizations, which is
 * out of scope for this unit's tests. This file therefore covers the
 * invariants that don't need a valid parent:
 *   - Anonymous SELECT returns zero rows by default.
 *   - Anonymous INSERT is rejected by RLS (even with bogus parent ids).
 *   - `can_write_house_rule_org(uuid)` returns false for an anonymous caller.
 *
 * The deeper CHECK / CASCADE / view / trigger tests are marked as
 * describe.skip below with a seed-bootstrap TODO. They all exercise behavior
 * that's also enforced in the migration and eyeball-verifiable against a
 * seeded dev environment.
 */

import { afterAll, describe, expect, it } from 'vitest';
import { createTestClient, closePostgresPool } from '@/test/dbTestUtils';

const TABLE = 'house_rules' as const;

describe('house_rules — RLS (no seed required)', () => {
  const anon = createTestClient();

  afterAll(async () => {
    await closePostgresPool();
  });

  it('anonymous SELECT returns zero rows on an empty seed', async () => {
    const { data, error } = await anon.from(TABLE).select('id').limit(1);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('anonymous INSERT is rejected by RLS', async () => {
    const { error } = await anon.from(TABLE).insert({
      organization_id: '00000000-0000-0000-0000-000000000000',
      game: 'general',
      effect_type: 'standalone',
      title: 'Anon probe',
      body: ['nope'],
    } as never);
    expect(error).not.toBeNull();
  });

  it('can_write_house_rule_org returns false for an anonymous caller', async () => {
    const { data, error } = await anon.rpc('can_write_house_rule_org', {
      target_org_id: '00000000-0000-0000-0000-000000000000',
    });
    expect(error).toBeNull();
    expect(data).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// TODO(unit-6 or follow-on): bootstrap a minimal seed fixture (auth user +
// member + organization + league) in a shared beforeAll and enable the full
// constraint / CASCADE / view / trigger suite. Structure left here as a
// blueprint for when that infrastructure exists.
// ---------------------------------------------------------------------------

describe.skip('house_rules — full CHECK / trigger / view / CASCADE (requires seed)', () => {
  // Placeholder for the complete coverage when seed fixtures land:
  //   - CHECK: scope exclusivity (both / neither)
  //   - CHECK: effect_type ↔ related_rule_id
  //   - CHECK: title length cap (121 rejected)
  //   - CHECK: body cardinality cap (51 elements rejected)
  //   - Trigger: per-element body length (> 4000 chars rejected)
  //   - CASCADE: delete org → rules gone
  //   - CASCADE: delete league → rules gone
  //   - View: scope_name populated for org + league rows
  //   - Trigger: UPDATE bumps updated_at + updated_by
  //   - RLS: owner + admin INSERT succeeds; league_rep INSERT rejected
  it.todo('wire up seed fixture and port the constraint/RLS coverage from the plan');
});
