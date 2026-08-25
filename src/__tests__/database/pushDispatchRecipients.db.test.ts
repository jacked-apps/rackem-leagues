/**
 * @fileoverview DB tests for get_push_recipients (Unit 7) — the push recipient
 * policy. Verifies the selection rules: v1 pushes only the 'direct' kind, honors
 * mute (notification_mode != 'all'), skips left/blocked/push-off members and the
 * sender, requires a device, and is data-driven via push_type_policy.
 *
 * Creates its own members/conversations (never shared seed rows) so it stays
 * isolation-safe on the shared local Postgres.
 *
 * See: docs/plans/2026-08-18-001-feat-message-push-notifications-plan.md (Unit 7)
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { executeSql, closePostgresPool } from '@/test/dbTestUtils';

async function createMember(): Promise<string> {
  const rows = await executeSql(
    `INSERT INTO public.members
       (first_name, last_name, phone, email, address, city, state, zip_code, date_of_birth)
     VALUES ('Push', 'Disp', '0000000000',
             'pushdisp-' || gen_random_uuid() || '@example.test',
             '1 Test St', 'Testville', 'TX', '00000', '1990-01-01')
     RETURNING id`
  );
  return rows[0].id;
}

async function addSubscription(memberId: string): Promise<void> {
  await executeSql(
    `INSERT INTO public.push_subscriptions (member_id, endpoint, p256dh, auth)
     VALUES ($1, $2, 'p256dh', 'auth')`,
    [memberId, `https://push.example/disp-${Date.now()}-${Math.random().toString(36).slice(2)}`]
  );
}

// Tracked so afterEach can tear conversations (and their messages/participants) down.
const convIds: string[] = [];

async function createConversation(
  kind: 'direct' | 'team_chat'
): Promise<string> {
  const rows =
    kind === 'direct'
      ? await executeSql(
          `INSERT INTO public.conversations (auto_managed, conversation_type, scope_type)
           VALUES (false, NULL, 'none') RETURNING id`
        )
      : await executeSql(
          `INSERT INTO public.conversations (auto_managed, conversation_type, scope_type, scope_id)
           VALUES (true, 'team_chat', 'team', gen_random_uuid()) RETURNING id`
        );
  convIds.push(rows[0].id);
  return rows[0].id;
}

async function addParticipant(
  convId: string,
  memberId: string,
  opts: { notificationMode?: string; left?: boolean } = {}
): Promise<void> {
  await executeSql(
    `INSERT INTO public.conversation_participants (conversation_id, user_id, notification_mode)
     VALUES ($1, $2, $3)`,
    [convId, memberId, opts.notificationMode ?? 'all']
  );
  if (opts.left) {
    // Set left_at AFTER insert so it satisfies the left_at >= joined_at CHECK.
    await executeSql(
      `UPDATE public.conversation_participants SET left_at = now()
       WHERE conversation_id = $1 AND user_id = $2`,
      [convId, memberId]
    );
  }
}

async function postMessage(convId: string, senderId: string): Promise<string> {
  const rows = await executeSql(
    `INSERT INTO public.messages (conversation_id, sender_id, content, is_system)
     VALUES ($1, $2, 'you coming tonight?', false) RETURNING id`,
    [convId, senderId]
  );
  return rows[0].id;
}

async function recipientMemberIds(messageId: string): Promise<string[]> {
  const rows = await executeSql(
    `SELECT member_id FROM public.get_push_recipients($1)`,
    [messageId]
  );
  return rows.map((r: { member_id: string }) => r.member_id).sort();
}

describe('get_push_recipients (v1 policy)', () => {
  let sender: string;
  let r1: string; // recipient with a device
  let r2: string; // recipient with a device
  let r3: string; // recipient WITHOUT a device
  const memberIds: string[] = [];

  beforeAll(async () => {
    sender = await createMember();
    r1 = await createMember();
    r2 = await createMember();
    r3 = await createMember();
    memberIds.push(sender, r1, r2, r3);
    await addSubscription(r1);
    await addSubscription(r2);
    // r3 intentionally has no subscription.
  });

  afterEach(async () => {
    // Tear down conversations created by the test (cascades messages + participants).
    for (const id of convIds.splice(0)) {
      await executeSql(`DELETE FROM public.messages WHERE conversation_id = $1`, [id]);
      await executeSql(`DELETE FROM public.conversation_participants WHERE conversation_id = $1`, [id]);
      await executeSql(`DELETE FROM public.conversations WHERE id = $1`, [id]);
    }
  });

  afterAll(async () => {
    // Members cascade-delete their subscriptions.
    if (memberIds.length) {
      await executeSql(`DELETE FROM public.members WHERE id = ANY($1::uuid[])`, [memberIds]);
    }
    await closePostgresPool();
  });

  it('direct chat: selects the non-sender participants who have a device', async () => {
    const conv = await createConversation('direct');
    await addParticipant(conv, sender);
    await addParticipant(conv, r1);
    await addParticipant(conv, r2);
    const msg = await postMessage(conv, sender);

    const got = await recipientMemberIds(msg);
    expect(got).toEqual([r1, r2].sort());
    expect(got).not.toContain(sender); // sender never notified for their own message
  });

  it('excludes participants whose notification_mode is not "all" (mute/mentions)', async () => {
    const conv = await createConversation('direct');
    await addParticipant(conv, sender);
    await addParticipant(conv, r1, { notificationMode: 'none' });
    await addParticipant(conv, r2, { notificationMode: 'mentions' });
    const msg = await postMessage(conv, sender);

    expect(await recipientMemberIds(msg)).toEqual([]);
  });

  it('excludes a participant who has left (left_at set)', async () => {
    const conv = await createConversation('direct');
    await addParticipant(conv, sender);
    await addParticipant(conv, r1, { left: true });
    await addParticipant(conv, r2);
    const msg = await postMessage(conv, sender);

    expect(await recipientMemberIds(msg)).toEqual([r2]);
  });

  it('excludes a member with push_enabled = false', async () => {
    const conv = await createConversation('direct');
    await addParticipant(conv, sender);
    await addParticipant(conv, r1);
    await addParticipant(conv, r2);
    const msg = await postMessage(conv, sender);

    await executeSql(`UPDATE public.members SET push_enabled = false WHERE id = $1`, [r1]);
    try {
      expect(await recipientMemberIds(msg)).toEqual([r2]);
    } finally {
      await executeSql(`UPDATE public.members SET push_enabled = NULL WHERE id = $1`, [r1]);
    }
  });

  it('excludes a recipient in a block relationship with the sender (either direction)', async () => {
    const conv = await createConversation('direct');
    await addParticipant(conv, sender);
    await addParticipant(conv, r1);
    await addParticipant(conv, r2);
    const msg = await postMessage(conv, sender);

    await executeSql(
      `INSERT INTO public.blocked_users (blocker_id, blocked_id) VALUES ($1, $2)`,
      [sender, r1]
    );
    try {
      expect(await recipientMemberIds(msg)).toEqual([r2]);
    } finally {
      await executeSql(
        `DELETE FROM public.blocked_users WHERE blocker_id = $1 AND blocked_id = $2`,
        [sender, r1]
      );
    }
  });

  it('skips recipients with zero devices without error', async () => {
    const conv = await createConversation('direct');
    await addParticipant(conv, sender);
    await addParticipant(conv, r3); // no subscription
    await addParticipant(conv, r1); // has a subscription
    const msg = await postMessage(conv, sender);

    expect(await recipientMemberIds(msg)).toEqual([r1]);
  });

  it('is data-driven: a team_chat is silent until push_type_policy enables that kind', async () => {
    const conv = await createConversation('team_chat');
    await addParticipant(conv, sender);
    await addParticipant(conv, r1);
    await addParticipant(conv, r2);
    const msg = await postMessage(conv, sender);

    // v1 seed: team_chat is off → nobody selected.
    expect(await recipientMemberIds(msg)).toEqual([]);

    // Flip the policy row → the same message now selects recipients (no code change).
    await executeSql(
      `UPDATE public.push_type_policy SET push_enabled = true WHERE conversation_kind = 'team_chat'`
    );
    try {
      expect(await recipientMemberIds(msg)).toEqual([r1, r2].sort());
    } finally {
      await executeSql(
        `UPDATE public.push_type_policy SET push_enabled = false WHERE conversation_kind = 'team_chat'`
      );
    }
  });

  it('does not push a system message', async () => {
    const conv = await createConversation('direct');
    await addParticipant(conv, sender);
    await addParticipant(conv, r1);
    // System message: is_system = true requires sender_id NULL (paired CHECK).
    const rows = await executeSql(
      `INSERT INTO public.messages (conversation_id, sender_id, content, is_system)
       VALUES ($1, NULL, 'Sally joined the team', true) RETURNING id`,
      [conv]
    );
    expect(await recipientMemberIds(rows[0].id)).toEqual([]);
  });
});
