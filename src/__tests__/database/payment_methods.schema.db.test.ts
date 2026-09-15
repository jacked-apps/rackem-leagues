/**
 * @fileoverview Schema tests for `payment_methods` — the per-player card-on-file
 * (tournament paid foundation, Phase A).
 *
 * A player's saved card lives in ONE place (owned by member_id) and is reusable
 * for anything they pay for; a paid tournament references the card to charge via
 * brackets.payment_method_id. Verifies: a card persists with defaults, at most one
 * DEFAULT card per member (partial-unique), a non-default second card is allowed,
 * the member FK is enforced, and a bracket's payment_method_id FK nulls out when
 * the card is deleted (ON DELETE SET NULL) so a tournament row never dangles.
 *
 * Uses DISTINCT members for the default-sensitive cases (the one-default-per-member
 * constraint is global per member, so reusing one member across tests collides).
 *
 * Runs in the `db` vitest project (sequential) against local Postgres via raw `pg`.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { executeSql, closePostgresPool } from '@/test/dbTestUtils';

describe('payment_methods schema (per-player card-on-file)', () => {
  let members: string[] = []; // distinct member ids for isolation
  const pmIds: string[] = [];
  const bracketIds: string[] = [];

  async function insertCard(
    memberId: string,
    isDefault: boolean,
    last4 = '4242'
  ): Promise<string> {
    const rows = await executeSql(
      `INSERT INTO public.payment_methods
         (member_id, stripe_payment_method_id, card_last4, card_brand, verified_at, is_default)
       VALUES ($1, 'tok_mock_x', $2, 'visa', now(), $3)
       RETURNING id`,
      [memberId, last4, isDefault]
    );
    pmIds.push(rows[0].id);
    return rows[0].id;
  }

  beforeAll(async () => {
    const rows = await executeSql(`SELECT id FROM public.members LIMIT 5`);
    if (rows.length < 3) {
      throw new Error('payment_methods.schema.db.test needs at least 3 member rows in the seed.');
    }
    members = rows.map((r: { id: string }) => r.id);
  });

  afterAll(async () => {
    if (bracketIds.length > 0) {
      await executeSql(`DELETE FROM public.brackets WHERE id = ANY($1::uuid[])`, [bracketIds]);
    }
    if (pmIds.length > 0) {
      await executeSql(`DELETE FROM public.payment_methods WHERE id = ANY($1::uuid[])`, [pmIds]);
    }
    await closePostgresPool();
  });

  it('saves a card-on-file with defaults (is_default true, created_at set)', async () => {
    const rows = await executeSql(
      `INSERT INTO public.payment_methods (member_id, stripe_payment_method_id, card_last4, card_brand, verified_at)
       VALUES ($1, 'tok_mock_1', '1111', 'mastercard', now())
       RETURNING id, is_default, created_at, card_last4`,
      [members[0]]
    );
    pmIds.push(rows[0].id);
    expect(rows[0].is_default).toBe(true);
    expect(rows[0].created_at).toBeTruthy();
    expect(rows[0].card_last4).toBe('1111');
  });

  it('enforces at most one DEFAULT card per member (partial-unique)', async () => {
    await insertCard(members[1], true); // first default for member[1]
    await expect(insertCard(members[1], true)).rejects.toThrow(); // second default → violation
  });

  it('allows a second NON-default card for the same member', async () => {
    const id = await insertCard(members[1], false, '3333'); // member[1] already has a default
    expect(id).toBeTruthy();
  });

  it('rejects a card for a non-existent member (FK)', async () => {
    await expect(
      executeSql(
        `INSERT INTO public.payment_methods (member_id, card_last4)
         VALUES ('00000000-0000-0000-0000-000000000000', '9999')`
      )
    ).rejects.toThrow();
  });

  it('a bracket references a card, and the FK nulls out when the card is deleted (SET NULL)', async () => {
    const pmId = await insertCard(members[2], true, '5555');

    const bRows = await executeSql(
      `INSERT INTO public.brackets (name, format, created_by, tier, payment_method_id)
       VALUES ('Paid w/ card', 'single_elimination', $1, 'paid', $2)
       RETURNING id, payment_method_id`,
      [members[2], pmId]
    );
    bracketIds.push(bRows[0].id);
    expect(bRows[0].payment_method_id).toBe(pmId);

    // Delete the card → the bracket's reference nulls (never dangles).
    await executeSql(`DELETE FROM public.payment_methods WHERE id = $1`, [pmId]);
    const after = await executeSql(
      `SELECT payment_method_id FROM public.brackets WHERE id = $1`,
      [bRows[0].id]
    );
    expect(after[0].payment_method_id).toBeNull();
  });
});
