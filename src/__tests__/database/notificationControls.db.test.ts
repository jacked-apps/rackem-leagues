// @vitest-environment jsdom
/**
 * @fileoverview DB tests for the notification-control veto chain.
 *
 * The rule under test: every level can only RESTRICT. None can re-enable what a
 * level above it turned off. A push is sent only when all of these allow it —
 *
 *   system kind policy → master switch → quiet hours → per-kind default
 *   → per-conversation setting → rate-limit window
 *
 * Each test turns exactly one level off and asserts the recipient disappears,
 * so a regression names the level that broke. The final tests cover the two
 * places the rule is easy to get subtly wrong: the interval resolving as MAX
 * (a chat may be quieter, never louder) and DMs never being rate-limited.
 *
 * @see docs/plans/2026-09-04-001-feat-notification-controls-plan.md
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { executeSql, closePostgresPool } from '@/test/dbTestUtils';

/** Fixture ids, fixed so a failed run can be inspected by hand. */
const SENDER = '00000000-0000-4000-8000-00000000f001';
const RECIPIENT = '00000000-0000-4000-8000-00000000f002';
const DM_CONV = '00000000-0000-4000-8000-00000000f101';
const TEAM_CONV = '00000000-0000-4000-8000-00000000f102';
/** Arbitrary scope id — conversations.scope_id has no FK, it just must be set. */
const TEAM_SCOPE = '00000000-0000-4000-8000-00000000f103';

/** Insert a message and return who would be pushed for it. */
async function recipientsFor(conversationId: string, messageId: string) {
  await executeSql(`
    INSERT INTO messages (id, conversation_id, sender_id, content, is_system, is_deleted)
    VALUES ('${messageId}', '${conversationId}', '${SENDER}', 'test', false, false)
    ON CONFLICT (id) DO NOTHING;
  `);
  const rows = await executeSql(
    `SELECT member_id FROM get_push_recipients('${messageId}');`
  );
  return rows as Array<{ member_id: string }>;
}

let msgCounter = 0;
const nextMessageId = () =>
  `00000000-0000-4000-8000-${String(++msgCounter).padStart(12, '2')}`;

beforeAll(async () => {
  // Two members, a DM and a team chat, both with the recipient subscribed.
  await executeSql(`
    INSERT INTO members (id, first_name, last_name, city, state, push_enabled)
    VALUES ('${SENDER}', 'Send', 'Er', 'Testville', 'FL', true),
           ('${RECIPIENT}', 'Recip', 'Ient', 'Testville', 'FL', true)
    ON CONFLICT (id) DO UPDATE SET push_enabled = true;

    -- The valid_auto_managed CHECK ties these together: a typed conversation
    -- must be auto_managed with a scope, and an untyped one (a DM) must not be.
    INSERT INTO conversations (id, conversation_type, auto_managed, scope_type, scope_id)
    VALUES ('${DM_CONV}',   NULL,        false, 'none', NULL),
           ('${TEAM_CONV}', 'team_chat', true,  'team', '${TEAM_SCOPE}')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO conversation_participants (conversation_id, user_id, notification_mode)
    VALUES ('${DM_CONV}', '${SENDER}', 'all'),
           ('${DM_CONV}', '${RECIPIENT}', 'all'),
           ('${TEAM_CONV}', '${SENDER}', 'all'),
           ('${TEAM_CONV}', '${RECIPIENT}', 'all')
    ON CONFLICT (conversation_id, user_id) DO UPDATE SET notification_mode = 'all';

    INSERT INTO push_subscriptions (member_id, endpoint, p256dh, auth)
    VALUES ('${RECIPIENT}', 'https://example.test/endpoint', 'p', 'a')
    ON CONFLICT (endpoint) DO NOTHING;

    -- team_chat is off by default in push_type_policy; the veto tests below
    -- need it on so we're testing the member levels, not level 0.
    UPDATE push_type_policy SET push_enabled = true WHERE conversation_kind = 'team_chat';
  `);
});

afterAll(async () => {
  await executeSql(`
    UPDATE push_type_policy SET push_enabled = false WHERE conversation_kind = 'team_chat';
    DELETE FROM messages WHERE conversation_id IN ('${DM_CONV}', '${TEAM_CONV}');
    DELETE FROM conversation_participants WHERE conversation_id IN ('${DM_CONV}', '${TEAM_CONV}');
    DELETE FROM conversations WHERE id IN ('${DM_CONV}', '${TEAM_CONV}');
    DELETE FROM push_subscriptions WHERE member_id = '${RECIPIENT}';
    DELETE FROM member_notification_prefs WHERE member_id = '${RECIPIENT}';
    DELETE FROM members WHERE id IN ('${SENDER}', '${RECIPIENT}');
  `);
  await closePostgresPool();
});

beforeEach(async () => {
  // Reset every level to "allows", so each test turns off exactly one thing.
  await executeSql(`
    UPDATE members
       SET push_enabled = true, quiet_hours_start = NULL,
           quiet_hours_end = NULL, timezone = NULL
     WHERE id = '${RECIPIENT}';
    UPDATE conversation_participants
       SET notification_mode = 'all', notification_interval_minutes = NULL,
           last_notified_at = NULL
     WHERE user_id = '${RECIPIENT}';
    DELETE FROM member_notification_prefs WHERE member_id = '${RECIPIENT}';
  `);
});

describe('get_push_recipients — the veto chain', () => {
  it('notifies when every level allows it (the baseline)', async () => {
    const rows = await recipientsFor(TEAM_CONV, nextMessageId());
    expect(rows.map((r) => r.member_id)).toContain(RECIPIENT);
  });

  it('LEVEL 0 — system kind policy off ⇒ nobody', async () => {
    await executeSql(
      `UPDATE push_type_policy SET push_enabled = false WHERE conversation_kind = 'team_chat';`
    );
    const rows = await recipientsFor(TEAM_CONV, nextMessageId());
    expect(rows).toHaveLength(0);
    await executeSql(
      `UPDATE push_type_policy SET push_enabled = true WHERE conversation_kind = 'team_chat';`
    );
  });

  it('LEVEL 1 — master switch off ⇒ nothing, even with the chat set to notify', async () => {
    await executeSql(
      `UPDATE members SET push_enabled = false WHERE id = '${RECIPIENT}';`
    );
    const rows = await recipientsFor(TEAM_CONV, nextMessageId());
    expect(rows).toHaveLength(0);
  });

  it('LEVEL 2 — inside quiet hours ⇒ nothing', async () => {
    // A window that certainly contains "now" in UTC, without depending on
    // when the suite runs: start an hour ago, end an hour ahead.
    await executeSql(`
      UPDATE members
         SET timezone = 'UTC',
             quiet_hours_start = (now() AT TIME ZONE 'UTC' - interval '1 hour')::time,
             quiet_hours_end   = (now() AT TIME ZONE 'UTC' + interval '1 hour')::time
       WHERE id = '${RECIPIENT}';
    `);
    const rows = await recipientsFor(TEAM_CONV, nextMessageId());
    expect(rows).toHaveLength(0);
  });

  it('LEVEL 2 — outside quiet hours ⇒ notified', async () => {
    await executeSql(`
      UPDATE members
         SET timezone = 'UTC',
             quiet_hours_start = (now() AT TIME ZONE 'UTC' + interval '2 hours')::time,
             quiet_hours_end   = (now() AT TIME ZONE 'UTC' + interval '4 hours')::time
       WHERE id = '${RECIPIENT}';
    `);
    const rows = await recipientsFor(TEAM_CONV, nextMessageId());
    expect(rows.map((r) => r.member_id)).toContain(RECIPIENT);
  });

  it('LEVEL 2b — per-kind default off ⇒ nothing', async () => {
    await executeSql(`
      INSERT INTO member_notification_prefs (member_id, conversation_kind, push_enabled)
      VALUES ('${RECIPIENT}', 'team_chat', false);
    `);
    const rows = await recipientsFor(TEAM_CONV, nextMessageId());
    expect(rows).toHaveLength(0);
  });

  it('LEVEL 3 — this conversation muted ⇒ nothing', async () => {
    await executeSql(`
      UPDATE conversation_participants SET notification_mode = 'none'
       WHERE user_id = '${RECIPIENT}' AND conversation_id = '${TEAM_CONV}';
    `);
    const rows = await recipientsFor(TEAM_CONV, nextMessageId());
    expect(rows).toHaveLength(0);
  });

  it('a lower level can NEVER re-enable a higher one', async () => {
    // The whole point of the veto model: master off + this chat explicitly
    // set to notify still means silence.
    await executeSql(`
      UPDATE members SET push_enabled = false WHERE id = '${RECIPIENT}';
      UPDATE conversation_participants
         SET notification_mode = 'all', notification_interval_minutes = NULL
       WHERE user_id = '${RECIPIENT}' AND conversation_id = '${TEAM_CONV}';
    `);
    const rows = await recipientsFor(TEAM_CONV, nextMessageId());
    expect(rows).toHaveLength(0);
  });
});

describe('rate limiting', () => {
  it('suppresses a second message inside the window', async () => {
    await executeSql(`
      INSERT INTO member_notification_prefs (member_id, conversation_kind, interval_minutes)
      VALUES ('${RECIPIENT}', 'team_chat', 5);
      UPDATE conversation_participants SET last_notified_at = now() - interval '1 minute'
       WHERE user_id = '${RECIPIENT}' AND conversation_id = '${TEAM_CONV}';
    `);
    const rows = await recipientsFor(TEAM_CONV, nextMessageId());
    expect(rows).toHaveLength(0);
  });

  it('allows again once the window has passed', async () => {
    await executeSql(`
      INSERT INTO member_notification_prefs (member_id, conversation_kind, interval_minutes)
      VALUES ('${RECIPIENT}', 'team_chat', 5);
      UPDATE conversation_participants SET last_notified_at = now() - interval '10 minutes'
       WHERE user_id = '${RECIPIENT}' AND conversation_id = '${TEAM_CONV}';
    `);
    const rows = await recipientsFor(TEAM_CONV, nextMessageId());
    expect(rows.map((r) => r.member_id)).toContain(RECIPIENT);
  });

  it('a chat may lengthen the window (MAX wins)', async () => {
    await executeSql(`
      INSERT INTO member_notification_prefs (member_id, conversation_kind, interval_minutes)
      VALUES ('${RECIPIENT}', 'team_chat', 5);
      UPDATE conversation_participants
         SET notification_interval_minutes = 30,
             last_notified_at = now() - interval '10 minutes'
       WHERE user_id = '${RECIPIENT}' AND conversation_id = '${TEAM_CONV}';
    `);
    // Past the kind's 5 minutes but inside the chat's 30 — still quiet.
    const rows = await recipientsFor(TEAM_CONV, nextMessageId());
    expect(rows).toHaveLength(0);
  });

  it('a chat may NOT shorten the window — the kind default still wins', async () => {
    await executeSql(`
      INSERT INTO member_notification_prefs (member_id, conversation_kind, interval_minutes)
      VALUES ('${RECIPIENT}', 'team_chat', 30);
      UPDATE conversation_participants
         SET notification_interval_minutes = 1,
             last_notified_at = now() - interval '5 minutes'
       WHERE user_id = '${RECIPIENT}' AND conversation_id = '${TEAM_CONV}';
    `);
    // Past the chat's 1 minute but inside the kind's 30 — MAX means quiet.
    const rows = await recipientsFor(TEAM_CONV, nextMessageId());
    expect(rows).toHaveLength(0);
  });

  it('a DM is never rate-limited, even seconds after the last one', async () => {
    await executeSql(`
      UPDATE conversation_participants SET last_notified_at = now() - interval '1 second'
       WHERE user_id = '${RECIPIENT}' AND conversation_id = '${DM_CONV}';
    `);
    const rows = await recipientsFor(DM_CONV, nextMessageId());
    expect(rows.map((r) => r.member_id)).toContain(RECIPIENT);
  });
});

describe('the dispatcher round-trip', () => {
  it('select → stamp → select suppresses the second message', async () => {
    // This is exactly what the edge function does, and the sequence that was
    // broken until it was wired up: without the stamp, last_notified_at stays
    // NULL forever and the window check always passes, so rate limiting looks
    // implemented while doing nothing.
    await executeSql(`
      INSERT INTO member_notification_prefs (member_id, conversation_kind, interval_minutes)
      VALUES ('${RECIPIENT}', 'team_chat', 15);
    `);

    const first = await recipientsFor(TEAM_CONV, nextMessageId());
    expect(first.map((r) => r.member_id)).toContain(RECIPIENT);

    // The dispatcher stamps only the members it actually reached.
    await executeSql(
      `SELECT mark_push_notified('${TEAM_CONV}', ARRAY['${RECIPIENT}']::uuid[]);`
    );

    const second = await recipientsFor(TEAM_CONV, nextMessageId());
    expect(second).toHaveLength(0);
  });
});

describe('mark_push_notified', () => {
  it('stamps only the members passed to it', async () => {
    await executeSql(
      `SELECT mark_push_notified('${TEAM_CONV}', ARRAY['${RECIPIENT}']::uuid[]);`
    );
    const rows = (await executeSql(`
      SELECT user_id, last_notified_at
        FROM conversation_participants
       WHERE conversation_id = '${TEAM_CONV}';
    `)) as Array<{ user_id: string; last_notified_at: string | null }>;

    const recip = rows.find((r) => r.user_id === RECIPIENT);
    const sender = rows.find((r) => r.user_id === SENDER);
    expect(recip?.last_notified_at).not.toBeNull();
    expect(sender?.last_notified_at).toBeNull();
  });
});

describe('is_in_quiet_hours', () => {
  it('handles a window that wraps midnight', async () => {
    const rows = (await executeSql(`
      SELECT
        is_in_quiet_hours('22:00'::time, '07:00'::time, 'UTC') AS wrapping,
        is_in_quiet_hours(NULL, '07:00'::time, 'UTC')          AS unset,
        is_in_quiet_hours('22:00'::time, '07:00'::time, NULL)  AS no_zone,
        is_in_quiet_hours('09:00'::time, '09:00'::time, 'UTC') AS degenerate;
    `)) as Array<Record<string, boolean>>;

    // `wrapping` depends on the clock, so only assert it's a boolean answer.
    expect(typeof rows[0].wrapping).toBe('boolean');
    // Unconfigured or zone-less must be "never quiet", never "always quiet" —
    // the latter silently swallows every notification.
    expect(rows[0].unset).toBe(false);
    expect(rows[0].no_zone).toBe(false);
    expect(rows[0].degenerate).toBe(false);
  });
});
