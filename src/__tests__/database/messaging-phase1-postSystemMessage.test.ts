// @vitest-environment jsdom
//
// jsdom env required for this file: the default happy-dom env mangles
// Content-Type on POST requests, which makes any supabase-js .insert() call
// fail with "Content-Type not acceptable: text/plain" from PostgREST. jsdom's
// fetch implementation handles the headers correctly so we can test the real
// function path. See: memory/project_happy_dom_supabase_insert_limit.md
/**
 * @fileoverview Tests for the postSystemMessage() helper.
 *
 * The function lives in src/api/mutations/messages.ts. It posts a row with
 * `is_system = true` and `sender_id = null` — used by trigger flows (Units
 * 4 + 5) and any future TS-side narration path.
 *
 * Run: pnpm test:run src/__tests__/database/messaging-phase1-postSystemMessage
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { executeSql } from '@/test/dbTestUtils';
import { postSystemMessage } from '@/api/mutations/messages';

describe('postSystemMessage()', () => {
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
      // CASCADE removes any system messages we posted into the fixture.
      await executeSql(`DELETE FROM conversations WHERE id = $1`, [fixtureConversationId]);
    }
  });

  it('inserts a row with is_system = true and sender_id = null', async () => {
    expect(fixtureConversationId).toBeTruthy();

    const message = await postSystemMessage({
      conversationId: fixtureConversationId!,
      content: 'Sally Anderson joined the team.',
    });

    expect(message).toBeTruthy();
    expect(message!.is_system).toBe(true);
    expect(message!.sender_id).toBeNull();
    expect(message!.content).toBe('Sally Anderson joined the team.');
    expect(message!.conversation_id).toBe(fixtureConversationId);
  });

  it('preserves multi-word content verbatim (no transformation)', async () => {
    expect(fixtureConversationId).toBeTruthy();

    const longContent = 'Match rescheduled to Thursday 7pm at Sam\'s Billiards (rain).';
    const message = await postSystemMessage({
      conversationId: fixtureConversationId!,
      content: longContent,
    });

    expect(message!.content).toBe(longContent);
  });

  it('throws when conversation_id does not exist (FK violation)', async () => {
    const bogusConversationId = '00000000-0000-0000-0000-000000000000';

    await expect(
      postSystemMessage({
        conversationId: bogusConversationId,
        content: 'this should fail',
      })
    ).rejects.toThrow(/Failed to post system message/);
  });

  it('inserted system messages are visible via direct SQL query', async () => {
    expect(fixtureConversationId).toBeTruthy();

    await postSystemMessage({
      conversationId: fixtureConversationId!,
      content: 'visibility-check system message',
    });

    const rows = await executeSql(
      `SELECT id, is_system, sender_id, content
         FROM messages
        WHERE conversation_id = $1
          AND content = 'visibility-check system message'`,
      [fixtureConversationId]
    );

    expect(rows.length).toBe(1);
    expect(rows[0].is_system).toBe(true);
    expect(rows[0].sender_id).toBeNull();
  });
});
