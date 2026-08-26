/**
 * @fileoverview Schema tests for the message push-notification foundations
 * (v1 Unit 1): `push_subscriptions`, `members.push_enabled`, and
 * `push_type_policy`.
 *
 * Verifies the greenfield delivery-pipeline schema: per-device subscription
 * rows with a UNIQUE endpoint and member cascade, the per-user global switch
 * defaulting to "never prompted" (NULL), and the per-kind push policy seeded
 * so that ONLY the `direct` kind (personal DMs + manual group chats) is on for
 * v1 — the data-driven phase switch later units and phases rely on.
 *
 * Runs in the `db` vitest project (sequential, jsdom) against the local
 * Postgres via the raw `pg` pool — see src/test/dbTestUtils.ts. Raw SQL is used
 * (not supabase-js) so constraint/FK violations surface as clean throws. The
 * test creates and deletes its OWN member rows (never shared seed rows) so it
 * stays isolation-safe on the shared DB.
 *
 * See: docs/plans/2026-08-18-001-feat-message-push-notifications-plan.md (Unit 1)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { executeSql, closePostgresPool } from '@/test/dbTestUtils';

describe('push notifications schema (v1 Unit 1)', () => {
  // A dedicated throwaway member for the happy-path subscription inserts. Its
  // own row (not a shared seed member) so deleting it can't affect other tests.
  let memberId: string;
  const insertedSubIds: string[] = [];

  // Minimal valid member row — every NOT NULL / no-default column filled. email
  // is uniquified with gen_random_uuid() to avoid collisions across runs.
  async function createTestMember(): Promise<{ id: string; push_enabled: boolean | null }> {
    const rows = await executeSql(
      `INSERT INTO public.members
         (first_name, last_name, phone, email, address, city, state, zip_code, date_of_birth)
       VALUES ('Push', 'Test', '0000000000',
               'push-test-' || gen_random_uuid() || '@example.test',
               '1 Test St', 'Testville', 'TX', '00000', '1990-01-01')
       RETURNING id, push_enabled`
    );
    return rows[0];
  }

  beforeAll(async () => {
    const member = await createTestMember();
    memberId = member.id;
    // push_enabled must default NULL ("never prompted") on a fresh member.
    expect(member.push_enabled).toBeNull();
  });

  afterAll(async () => {
    if (insertedSubIds.length > 0) {
      await executeSql(
        `DELETE FROM public.push_subscriptions WHERE id = ANY($1::uuid[])`,
        [insertedSubIds]
      );
    }
    // Removing the member cascades any leftover subs; keeps the shared DB tidy.
    await executeSql(`DELETE FROM public.members WHERE id = $1`, [memberId]);
    await closePostgresPool();
  });

  // ── push_subscriptions ────────────────────────────────────────────────────

  it('inserts a subscription and finds it by member_id', async () => {
    const rows = await executeSql(
      `INSERT INTO public.push_subscriptions
         (member_id, endpoint, p256dh, auth, user_agent)
       VALUES ($1, $2, 'p256dh-key', 'auth-key', 'Test/1.0')
       RETURNING id, created_at, last_seen_at`,
      [memberId, `https://push.example/ep-${Date.now()}-a`]
    );
    expect(rows.length).toBe(1);
    insertedSubIds.push(rows[0].id);
    expect(rows[0].created_at).toBeTruthy(); // now() default
    expect(rows[0].last_seen_at).toBeNull(); // nullable, no default

    const found = await executeSql(
      `SELECT id FROM public.push_subscriptions WHERE member_id = $1`,
      [memberId]
    );
    expect(found.some((r: { id: string }) => r.id === rows[0].id)).toBe(true);
  });

  it('rejects a duplicate endpoint (UNIQUE upsert key)', async () => {
    const endpoint = `https://push.example/ep-${Date.now()}-dup`;
    const first = await executeSql(
      `INSERT INTO public.push_subscriptions (member_id, endpoint, p256dh, auth)
       VALUES ($1, $2, 'k', 'k') RETURNING id`,
      [memberId, endpoint]
    );
    insertedSubIds.push(first[0].id);

    await expect(
      executeSql(
        `INSERT INTO public.push_subscriptions (member_id, endpoint, p256dh, auth)
         VALUES ($1, $2, 'k2', 'k2')`,
        [memberId, endpoint]
      )
    ).rejects.toThrow();
  });

  it('rejects a non-existent member_id (FK to members)', async () => {
    await expect(
      executeSql(
        `INSERT INTO public.push_subscriptions (member_id, endpoint, p256dh, auth)
         VALUES (gen_random_uuid(), $1, 'k', 'k')`,
        [`https://push.example/ep-${Date.now()}-orphan`]
      )
    ).rejects.toThrow();
  });

  it('cascades: deleting a member removes their subscriptions', async () => {
    // Separate throwaway member so the main memberId stays intact for other tests.
    const victim = await createTestMember();
    await executeSql(
      `INSERT INTO public.push_subscriptions (member_id, endpoint, p256dh, auth)
       VALUES ($1, $2, 'k', 'k')`,
      [victim.id, `https://push.example/ep-${Date.now()}-cascade`]
    );

    await executeSql(`DELETE FROM public.members WHERE id = $1`, [victim.id]);

    const remaining = await executeSql(
      `SELECT id FROM public.push_subscriptions WHERE member_id = $1`,
      [victim.id]
    );
    expect(remaining.length).toBe(0);
  });

  // ── members.push_enabled ──────────────────────────────────────────────────

  it('members.push_enabled defaults NULL and accepts TRUE/FALSE', async () => {
    // Default NULL is asserted in beforeAll on a fresh member; here confirm both
    // explicit values round-trip.
    const on = await executeSql(
      `UPDATE public.members SET push_enabled = true WHERE id = $1 RETURNING push_enabled`,
      [memberId]
    );
    expect(on[0].push_enabled).toBe(true);

    const off = await executeSql(
      `UPDATE public.members SET push_enabled = false WHERE id = $1 RETURNING push_enabled`,
      [memberId]
    );
    expect(off[0].push_enabled).toBe(false);
  });

  // ── push_type_policy ──────────────────────────────────────────────────────

  it('push_type_policy seeds only the direct kind as push_enabled', async () => {
    const rows = await executeSql(
      `SELECT conversation_kind, push_enabled FROM public.push_type_policy
        ORDER BY conversation_kind`
    );
    const policy = Object.fromEntries(
      rows.map((r: { conversation_kind: string; push_enabled: boolean }) => [
        r.conversation_kind,
        r.push_enabled,
      ])
    );

    // All five kinds are seeded, and ONLY 'direct' is on for v1.
    expect(policy).toMatchObject({
      direct: true,
      team_chat: false,
      captains_chat: false,
      announcements: false,
      match_chat: false,
    });
  });
});
