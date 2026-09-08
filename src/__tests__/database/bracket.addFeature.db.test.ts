/**
 * @fileoverview DB tests for add_premium_feature — buying a feature later.
 *
 * The point is the in-app upsell: `premium_features` used to be written once at
 * creation and never again, which froze the decision at the moment the organizer
 * knew least and made an offer impossible to accept.
 *
 * Runs in the `db` vitest project (sequential) against local Postgres via raw pg.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { executeSql, closePostgresPool } from '@/test/dbTestUtils';

describe('add_premium_feature', () => {
  let organizerId: string;
  const bracketIds: string[] = [];

  async function makeBracket(features: string[], status = 'setup') {
    const tier = features.length > 0 ? 'paid' : 'free';
    const rows = await executeSql(
      `INSERT INTO public.brackets (name, format, created_by, status, tier, premium_features)
       VALUES ('Upsell Test', 'single_elimination', $1, $2, $3, $4::text[]) RETURNING id`,
      [organizerId, status, tier, features]
    );
    bracketIds.push(rows[0].id);
    return rows[0].id as string;
  }

  async function add(bracketId: string, feature: string) {
    const rows = await executeSql(
      `SELECT public.add_premium_feature($1::uuid, $2::text) AS r`,
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

  it('adds a feature to a tournament already in setup', async () => {
    const id = await makeBracket(['real_players']);
    expect((await add(id, 'payment_tracker')).ok).toBe(true);

    const row = await featuresOf(id);
    expect(row.premium_features).toEqual(['real_players', 'payment_tracker']);
  });

  it('treats a second add as a no-op, not a fault', async () => {
    const id = await makeBracket(['payment_tracker']);
    const result = await add(id, 'payment_tracker');

    expect(result.ok).toBe(true);
    expect(result.already_had).toBe(true);
    expect((await featuresOf(id)).premium_features).toEqual(['payment_tracker']);
  });

  it('turns a free tournament paid — that is what a feature means', async () => {
    const id = await makeBracket([]);
    await add(id, 'payment_tracker');

    const row = await featuresOf(id);
    expect(row.tier).toBe('paid'); // keeps the tier/features invariant satisfied
  });

  it('refuses once the tournament has started', async () => {
    // The charge is computed from this list AT start, so adding afterwards
    // would change a bill that has already been settled.
    const id = await makeBracket(['real_players'], 'live');
    const result = await add(id, 'payment_tracker');

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('not_setup');
    expect((await featuresOf(id)).premium_features).toEqual(['real_players']);
  });

  it('refuses an empty feature name', async () => {
    const id = await makeBracket(['real_players']);
    expect((await add(id, '   ')).reason).toBe('bad_feature');
  });

  it('reports an unknown tournament rather than erroring', async () => {
    const result = await add('00000000-0000-0000-0000-000000000000', 'payment_tracker');
    expect(result.reason).toBe('not_found');
  });
});
