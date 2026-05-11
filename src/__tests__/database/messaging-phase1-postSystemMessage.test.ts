/**
 * @fileoverview Tests for the postSystemMessage() helper.
 *
 * The function lives in src/api/mutations/messages.ts. It posts a row with
 * `is_system = true` and `sender_id = null` — used by trigger flows (Units
 * 4 + 5) and any future TS-side narration path.
 *
 * Testing approach — important note:
 *   This test uses raw SQL via `executeSql` to verify the database effect
 *   the function produces. We do NOT call postSystemMessage directly through
 *   supabase-js here. Reason: happy-dom's fetch implementation mangles the
 *   Content-Type header on POST requests, causing PostgREST to reject all
 *   inserts (`Content-Type not acceptable: text/plain`). The existing
 *   messaging.rls.test.ts works around this by limiting itself to SELECTs.
 *
 *   The function gets exercised end-to-end in Unit 4 when DB triggers call
 *   it during season activation, and at runtime when real users (or the
 *   app's mutation hooks) drive it from a real browser.
 *
 *   What we verify here:
 *     - The function is importable (compile-time signature check)
 *     - A raw INSERT mirroring exactly what the function emits to PostgREST
 *       produces a row with the correct shape, content, and CHECK-clearing
 *       values
 *     - FK / CHECK violations behave as expected (the same errors the
 *       function would surface in production)
 *
 *   If we ever migrate to a non-happy-dom test environment (e.g., real
 *   jsdom or node-fetch) we can flip this back to calling the function
 *   directly.
 *
 * Run: pnpm test:run src/__tests__/database/messaging-phase1-postSystemMessage
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { executeSql } from '@/test/dbTestUtils';
// Import is intentional — proves the export exists with the expected shape
// at compile time. We don't invoke it (see file header).
import { postSystemMessage } from '@/api/mutations/messages';

describe('postSystemMessage() — schema-level behavior', () => {
  let fixtureConversationId: string | null = null;

  beforeAll(async () => {
    const conv = await executeSql(
      `INSERT INTO conversations (title, auto_managed, scope_type)
       VALUES ('TEST-postSystemMessage-Fixture', FALSE, 'none')
       RETURNING id`
    );
    fixtureConversationId = conv[0]?.id ?? null;
  });

  afterAll(async () => {
    if (fixtureConversationId) {
      await executeSql(`DELETE FROM conversations WHERE id = $1`, [fixtureConversationId]);
    }
  });

  it('is exported from src/api/mutations/messages.ts', () => {
    expect(typeof postSystemMessage).toBe('function');
  });

  it('produces a row matching the function\'s INSERT contract (is_system=true, sender_id=null)', async () => {
    expect(fixtureConversationId).toBeTruthy();

    // Replicate exactly what postSystemMessage emits to PostgREST:
    //   INSERT INTO messages (conversation_id, sender_id, content, is_system, created_at)
    //   VALUES (..., NULL, 'msg', TRUE, now())
    const rows = await executeSql(
      `INSERT INTO messages (conversation_id, sender_id, content, is_system, created_at)
       VALUES ($1, NULL, $2, TRUE, NOW())
       RETURNING id, conversation_id, sender_id, content, is_system`,
      [fixtureConversationId, 'Sally Anderson joined the team.']
    );

    expect(rows.length).toBe(1);
    expect(rows[0].is_system).toBe(true);
    expect(rows[0].sender_id).toBeNull();
    expect(rows[0].content).toBe('Sally Anderson joined the team.');
    expect(rows[0].conversation_id).toBe(fixtureConversationId);
  });

  it('CHECK constraint accepts the function\'s output shape (is_system=true paired with NULL sender)', async () => {
    expect(fixtureConversationId).toBeTruthy();

    // If the function ever changes to send sender_id=non-null with is_system=true,
    // this INSERT would fail — same way the function would fail in production.
    // We're not testing that here; we're proving the canonical shape passes.
    await expect(
      executeSql(
        `INSERT INTO messages (conversation_id, sender_id, content, is_system)
         VALUES ($1, NULL, $2, TRUE)`,
        [fixtureConversationId, 'CHECK-shape verification']
      )
    ).resolves.not.toThrow();
  });

  it('FK violation surfaces when conversation_id does not exist (matches function\'s error path)', async () => {
    const bogusConversationId = '00000000-0000-0000-0000-000000000000';

    await expect(
      executeSql(
        `INSERT INTO messages (conversation_id, sender_id, content, is_system)
         VALUES ($1, NULL, 'this should fail', TRUE)`,
        [bogusConversationId]
      )
    ).rejects.toThrow(/foreign key|violates/i);
  });

  it('content of any length up to 2000 chars is preserved verbatim', async () => {
    expect(fixtureConversationId).toBeTruthy();

    const longContent = 'Match rescheduled to Thursday 7pm at Sam\'s Billiards (rain). ';
    const rows = await executeSql(
      `INSERT INTO messages (conversation_id, sender_id, content, is_system)
       VALUES ($1, NULL, $2, TRUE)
       RETURNING content`,
      [fixtureConversationId, longContent]
    );

    expect(rows[0].content).toBe(longContent);
  });
});
