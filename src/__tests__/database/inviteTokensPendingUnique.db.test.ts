/**
 * @fileoverview The "one pending invite" rule must apply to PENDING rows only.
 *
 * `unique_pending_invite` began life as UNIQUE (member_id, email, status),
 * which reads like it constrains pending invites but does not: including
 * `status` in the key constrains every status independently, so a member and
 * email could hold one pending row and one cancelled row — but never two
 * cancelled ones.
 *
 * `ensure_placeholder_invite_token` cancels the previous pending invite each
 * time a placeholder's email changes, so flipping an email back and forth
 * eventually tried to cancel a row whose cancelled twin already existed, and
 * the save died with 23505. An operator hit this by fixing a typo and then
 * changing their mind — and because the old constraint was DEFERRABLE
 * INITIALLY DEFERRED, the error surfaced at COMMIT rather than at the
 * offending statement, which made it read like the save itself was broken.
 *
 * These tests pin both halves: the history may repeat, and the pending rule
 * still holds.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { executeSql, closePostgresPool } from '@/test/dbTestUtils';

/** Placeholder member (no user_id) with an email, so the invite trigger fires. */
async function createPlaceholder(email: string): Promise<string> {
  const rows = await executeSql(
    `INSERT INTO public.members (first_name, last_name, city, state, email)
     VALUES ('Invite', 'Fixture', 'Testville', 'TX', $1)
     RETURNING id`,
    [email]
  );
  return rows[0].id;
}

async function setEmail(memberId: string, email: string): Promise<void> {
  await executeSql(`UPDATE public.members SET email = $2 WHERE id = $1`, [memberId, email]);
}

describe('invite_tokens — the pending-invite rule', () => {
  const created: string[] = [];

  afterEach(async () => {
    if (created.length > 0) {
      await executeSql(`DELETE FROM public.invite_tokens WHERE member_id = ANY($1::uuid[])`, [created]);
      await executeSql(`DELETE FROM public.members WHERE id = ANY($1::uuid[])`, [created]);
      created.length = 0;
    }
    await closePostgresPool();
  });

  it('is a PARTIAL index, restricted to pending rows', async () => {
    // The schema-level guard. A future migration that "simplifies" this back
    // to a plain unique constraint reintroduces the bug, and would otherwise
    // only be noticed by an operator whose save failed.
    const rows = await executeSql(
      `SELECT indexdef FROM pg_indexes WHERE indexname = 'unique_pending_invite'`
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].indexdef).toMatch(/WHERE \(status = 'pending'/);
  });

  it('survives an email changed back and forth, leaving exactly one pending invite', async () => {
    const a = 'invite-flip-a@example.test';
    const b = 'invite-flip-b@example.test';

    const memberId = await createPlaceholder(a);
    created.push(memberId);

    // Four flips: the old constraint failed on the fourth, once a cancelled
    // row existed for the address being cancelled again.
    await setEmail(memberId, b);
    await setEmail(memberId, a);
    await setEmail(memberId, b);
    await setEmail(memberId, a);

    const pending = await executeSql(
      `SELECT email FROM public.invite_tokens
        WHERE member_id = $1 AND status = 'pending'`,
      [memberId]
    );

    // One live invite, addressed to where the member actually is now.
    expect(pending).toHaveLength(1);
    expect(pending[0].email).toBe(a);
  });

  it('still refuses a second PENDING invite for the same member and email', async () => {
    // The rule the index is there for. Relaxing it to pending-only must not
    // have relaxed it into nothing.
    const email = 'invite-dup@example.test';
    const memberId = await createPlaceholder(email);
    created.push(memberId);

    await expect(
      executeSql(
        `INSERT INTO public.invite_tokens (member_id, email, status)
         VALUES ($1, $2, 'pending')`,
        [memberId, email]
      )
    ).rejects.toThrow(/unique_pending_invite|duplicate key/i);
  });
});
