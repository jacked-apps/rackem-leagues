/**
 * @fileoverview DB tests for remove_premium_feature — taking a feature back off.
 *
 * The allowance is the whole design: a few uses are the demo, and removal locks
 * once the feature has actually earned its keep. Without a limit an organizer
 * could track fees all night and drop the feature before the bill.
 *
 * Runs in the `db` vitest project (sequential) against local Postgres via raw pg.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { executeSql, closePostgresPool } from '@/test/dbTestUtils';

describe('remove_premium_feature', () => {
  let organizerId: string;
  const bracketIds: string[] = [];

  async function makeBracket(features: string[], status = 'setup') {
    const rows = await executeSql(
      `INSERT INTO public.brackets (name, format, created_by, status, tier, premium_features)
       VALUES ('Remove Test', 'single_elimination', $1, $2, 'paid', $3::text[]) RETURNING id`,
      [organizerId, status, features]
    );
    bracketIds.push(rows[0].id);
    return rows[0].id as string;
  }

  /** Mark `n` players paid, i.e. actually use the tracker. */
  async function markPaid(bracketId: string, n: number) {
    await executeSql(
      `INSERT INTO public.bracket_hopper (bracket_id, display_name, status, paid_status, added_via)
       SELECT $1, 'Player ' || g, 'official', 'paid', 'search' FROM generate_series(1, $2) g`,
      [bracketId, n]
    );
  }

  async function remove(bracketId: string, feature: string) {
    const rows = await executeSql(
      `SELECT public.remove_premium_feature($1::uuid, $2::text) AS r`,
      [bracketId, feature]
    );
    return rows[0].r as Record<string, unknown>;
  }

  async function featuresOf(bracketId: string) {
    const rows = await executeSql(
      `SELECT premium_features, tier FROM public.brackets WHERE id = $1`,
      [bracketId]
    );
    return rows[0];
  }

  beforeAll(async () => {
    const m = await executeSql(`SELECT id FROM public.members LIMIT 1`);
    organizerId = m[0].id;
  });

  afterAll(async () => {
    if (bracketIds.length > 0) {
      await executeSql(`DELETE FROM public.brackets WHERE id = ANY($1::uuid[])`, [bracketIds]);
    }
    await closePostgresPool();
  });

  it('takes an unused feature back off — a mis-tap is recoverable', async () => {
    const id = await makeBracket(['real_players', 'payment_tracker']);
    expect((await remove(id, 'payment_tracker')).ok).toBe(true);
    expect((await featuresOf(id)).premium_features).toEqual(['real_players']);
  });

  it('still allows removal inside the free allowance', async () => {
    // Five is the demo — trivial to track by hand, and not worth charging for.
    const id = await makeBracket(['real_players', 'payment_tracker']);
    await markPaid(id, 5);

    expect((await remove(id, 'payment_tracker')).ok).toBe(true);
  });

  it('locks it in once used beyond the allowance', async () => {
    const id = await makeBracket(['real_players', 'payment_tracker']);
    await markPaid(id, 6);

    const result = await remove(id, 'payment_tracker');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('in_use');
    expect(result.used).toBe(6);
    // And it really is still on the bill.
    expect((await featuresOf(id)).premium_features).toContain('payment_tracker');
  });

  it('counts only players actually marked paid, not everyone added', async () => {
    const id = await makeBracket(['payment_tracker']);
    await executeSql(
      `INSERT INTO public.bracket_hopper (bracket_id, display_name, status, paid_status, added_via)
       SELECT $1, 'Unpaid ' || g, 'official', 'unpaid', 'search' FROM generate_series(1, 20) g`,
      [id]
    );

    // Twenty players, nobody marked paid — the feature has not been used.
    expect((await remove(id, 'payment_tracker')).ok).toBe(true);
  });

  it('returns the tournament to free when its last feature comes off', async () => {
    const id = await makeBracket(['payment_tracker']);
    await remove(id, 'payment_tracker');

    const row = await featuresOf(id);
    expect(row.premium_features).toEqual([]);
    expect(row.tier).toBe('free'); // satisfies the premium-implies-paid constraint
  });

  it('treats removing something not there as a no-op', async () => {
    const id = await makeBracket(['real_players']);
    const result = await remove(id, 'payment_tracker');
    expect(result.ok).toBe(true);
    expect(result.already_off).toBe(true);
  });

  it('refuses once the tournament has started', async () => {
    const id = await makeBracket(['real_players', 'payment_tracker'], 'live');
    expect((await remove(id, 'payment_tracker')).reason).toBe('not_setup');
  });
});
