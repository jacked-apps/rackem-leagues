/**
 * @fileoverview DB tests for the message push-dispatch trigger (Unit 8).
 *
 * Verifies the AFTER INSERT trigger on `messages`: a real user message enqueues
 * exactly one pg_net dispatch request (carrying the message_id + the
 * X-Dispatch-Secret header); a system message does not; a disabled config skips;
 * and — critically — the message insert always succeeds regardless.
 *
 * "A request was created" is measured as the SUM of net.http_request_queue +
 * net._http_response rows, which is invariant to the pg_net worker moving a row
 * from the queue to the response table — so the assertion isn't racy.
 *
 * Mutates the single-row push_dispatch_config; saves and restores it. Uses its
 * own member/conversation rows.
 *
 * See: docs/plans/2026-08-18-001-feat-message-push-notifications-plan.md (Unit 8)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { executeSql, closePostgresPool } from '@/test/dbTestUtils';

const TEST_SECRET = 'test-dispatch-secret-xyz';

async function requestSum(): Promise<number> {
  const rows = await executeSql(
    `SELECT (SELECT count(*) FROM net.http_request_queue)
          + (SELECT count(*) FROM net._http_response) AS n`
  );
  return Number(rows[0].n);
}

async function insertMessage(
  convId: string,
  senderId: string | null,
  isSystem: boolean
): Promise<string> {
  const rows = await executeSql(
    `INSERT INTO public.messages (conversation_id, sender_id, content, is_system)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [convId, senderId, isSystem ? 'Sally joined' : 'hello there', isSystem]
  );
  return rows[0].id;
}

describe('message push-dispatch trigger', () => {
  let sender: string;
  let convId: string;
  let originalConfig: {
    function_url: string;
    shared_secret: string;
    enabled: boolean;
  };

  beforeAll(async () => {
    // Save the real config, then point the trigger at a harmless dummy URL with
    // a known secret so we don't hammer the real function during the test.
    const cfg = await executeSql(
      `SELECT function_url, shared_secret, enabled FROM public.push_dispatch_config LIMIT 1`
    );
    originalConfig = cfg[0];
    await executeSql(
      `UPDATE public.push_dispatch_config
         SET function_url = 'http://127.0.0.1:9/dispatch-test',
             shared_secret = $1,
             enabled = true`,
      [TEST_SECRET]
    );

    const m = await executeSql(
      `INSERT INTO public.members
         (first_name, last_name, phone, email, address, city, state, zip_code, date_of_birth)
       VALUES ('Trig', 'Test', '0000000000',
               'trig-' || gen_random_uuid() || '@example.test',
               '1 St', 'Town', 'TX', '00000', '1990-01-01')
       RETURNING id`
    );
    sender = m[0].id;
    const c = await executeSql(
      `INSERT INTO public.conversations (auto_managed, conversation_type, scope_type)
       VALUES (false, NULL, 'none') RETURNING id`
    );
    convId = c[0].id;
  });

  afterAll(async () => {
    await executeSql(`DELETE FROM public.messages WHERE conversation_id = $1`, [convId]);
    await executeSql(`DELETE FROM public.conversations WHERE id = $1`, [convId]);
    await executeSql(`DELETE FROM public.members WHERE id = $1`, [sender]);
    // Restore the real config.
    await executeSql(
      `UPDATE public.push_dispatch_config
         SET function_url = $1, shared_secret = $2, enabled = $3`,
      [originalConfig.function_url, originalConfig.shared_secret, originalConfig.enabled]
    );
    await closePostgresPool();
  });

  it('a real message enqueues one dispatch request with the message_id + secret header', async () => {
    const before = await requestSum();
    const messageId = await insertMessage(convId, sender, false);
    const after = await requestSum();
    expect(after - before).toBe(1);

    // The request should carry our message_id and the dispatch secret. Checked
    // immediately, so it is still in the queue (the worker runs out-of-band).
    // body is bytea (raw request bytes) — decode to inspect the JSON.
    const rows = await executeSql(
      `SELECT convert_from(body, 'utf8')::jsonb AS body_json, headers
         FROM net.http_request_queue
        WHERE convert_from(body, 'utf8')::jsonb ->> 'message_id' = $1`,
      [messageId]
    );
    expect(rows.length).toBe(1);
    expect(rows[0].body_json.message_id).toBe(messageId);
    expect(rows[0].headers['X-Dispatch-Secret']).toBe(TEST_SECRET);
  });

  it('a system message does not enqueue a dispatch request', async () => {
    const before = await requestSum();
    await insertMessage(convId, null, true); // is_system = true, sender NULL
    const after = await requestSum();
    expect(after - before).toBe(0);
  });

  it('skips dispatch when the config is disabled', async () => {
    await executeSql(`UPDATE public.push_dispatch_config SET enabled = false`);
    try {
      const before = await requestSum();
      await insertMessage(convId, sender, false);
      const after = await requestSum();
      expect(after - before).toBe(0);
    } finally {
      await executeSql(`UPDATE public.push_dispatch_config SET enabled = true`);
    }
  });

  it('the message insert still succeeds even if dispatch config points nowhere', async () => {
    await executeSql(
      `UPDATE public.push_dispatch_config SET function_url = 'http://nonexistent.invalid/x'`
    );
    try {
      const id = await insertMessage(convId, sender, false);
      expect(id).toBeTruthy(); // insert committed despite the doomed dispatch
    } finally {
      await executeSql(
        `UPDATE public.push_dispatch_config SET function_url = 'http://127.0.0.1:9/dispatch-test'`
      );
    }
  });
});
