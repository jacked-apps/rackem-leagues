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
import { executeSql, closePostgresPool, getPostgresPool } from '@/test/dbTestUtils';

const TEST_SECRET = 'test-dispatch-secret-xyz';

/**
 * Highest pg_net request id seen so far, across the queue and the responses.
 *
 * Counting TOTAL rows in those two tables does not work: pg_net's worker
 * deletes `net._http_response` rows once they age out, so an unrelated
 * garbage collection landing between the before and after reads cancels out
 * the row this test just created and the delta reads zero. That is a real
 * flake, and it is why this file failed intermittently.
 *
 * A high-water mark is immune to it — ids only ever increase, and GC removes
 * OLD rows, never the one just made. Counting ids above the mark counts
 * exactly the requests this test caused.
 */
async function maxRequestId(): Promise<number> {
  const rows = await executeSql(
    `SELECT GREATEST(
              COALESCE((SELECT max(id) FROM net.http_request_queue), 0),
              COALESCE((SELECT max(id) FROM net._http_response), 0)
            ) AS n`
  );
  return Number(rows[0].n);
}

/** How many pg_net requests exist above `mark` — i.e. made since it was taken. */
async function requestsSince(mark: number): Promise<number> {
  const rows = await executeSql(
    `SELECT (SELECT count(*) FROM net.http_request_queue WHERE id > $1)
          + (SELECT count(*) FROM net._http_response    WHERE id > $1) AS n`,
    [mark]
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
    // Everything inside ONE transaction that is rolled back.
    //
    // pg_net's worker moves rows out of net.http_request_queue as soon as it
    // sees them, so inspecting the request after committing is a race the test
    // loses more often than not — the row is already in net._http_response,
    // which does not carry the body. Uncommitted rows are invisible to the
    // worker, so inside the transaction the request is guaranteed to still be
    // there and the assertion is deterministic.
    //
    // Rolling back also means this test dispatches nothing and leaves no queue
    // rows behind, which is how it should have behaved all along.
    const client = await getPostgresPool().connect();
    try {
      await client.query('BEGIN');

      const markRes = await client.query(
        `SELECT GREATEST(
                  COALESCE((SELECT max(id) FROM net.http_request_queue), 0),
                  COALESCE((SELECT max(id) FROM net._http_response), 0)
                ) AS n`
      );
      const mark = Number(markRes.rows[0].n);

      const inserted = await client.query(
        `INSERT INTO public.messages (conversation_id, sender_id, content, is_system)
         VALUES ($1, $2, $3, false) RETURNING id`,
        [convId, sender, 'hello there']
      );
      const messageId = inserted.rows[0].id;

      const rows = await client.query(
        `SELECT convert_from(body, 'utf8')::jsonb AS body_json, headers
           FROM net.http_request_queue
          WHERE id > $1`,
        [mark]
      );

      expect(rows.rows.length).toBe(1);
      expect(rows.rows[0].body_json.message_id).toBe(messageId);
      expect(rows.rows[0].headers['X-Dispatch-Secret']).toBe(TEST_SECRET);
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });

  it('a system message does not enqueue a dispatch request', async () => {
    const mark = await maxRequestId();
    await insertMessage(convId, null, true); // is_system = true, sender NULL
    expect(await requestsSince(mark)).toBe(0);
  });

  it('skips dispatch when the config is disabled', async () => {
    await executeSql(`UPDATE public.push_dispatch_config SET enabled = false`);
    try {
      const mark = await maxRequestId();
      await insertMessage(convId, sender, false);
      expect(await requestsSince(mark)).toBe(0);
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
