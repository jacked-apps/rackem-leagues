// @vitest-environment jsdom
//
// jsdom env required: multi-step supabase-js INSERTs.
/**
 * @fileoverview Tests for createSeasonAnnouncementsChat()
 *
 * Lives in src/api/mutations/autoConversations.ts. One announcements
 * channel per season; every distinct rostered player is a participant
 * with cannot_leave=true.
 *
 * Run: pnpm test:run src/__tests__/database/messaging-phase1-createSeasonAnnouncementsChat
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { executeSql } from '@/test/dbTestUtils';
import { createSeasonAnnouncementsChat } from '@/api/mutations/autoConversations';

describe('createSeasonAnnouncementsChat()', () => {
  let seasonId: string;
  let expectedPlayerIds: string[];

  beforeAll(async () => {
    const rows = await executeSql(`
      SELECT s.id AS season_id
      FROM seasons s
      ORDER BY s.start_date ASC
      LIMIT 1
    `);
    expect(rows.length).toBe(1);
    seasonId = rows[0].season_id;

    const players = await executeSql(
      `SELECT DISTINCT tp.member_id
         FROM team_players tp
         JOIN teams t ON t.id = tp.team_id
        WHERE t.season_id = $1`,
      [seasonId]
    );
    expectedPlayerIds = players.map((r: { member_id: string }) => r.member_id);
    expect(expectedPlayerIds.length).toBeGreaterThan(0);
  });

  beforeEach(async () => {
    await executeSql(
      `DELETE FROM conversations
        WHERE scope_type = 'season' AND scope_id = $1
          AND conversation_type = 'announcements' AND auto_managed = TRUE`,
      [seasonId]
    );
  });

  afterAll(async () => {
    await executeSql(
      `DELETE FROM conversations
        WHERE scope_type = 'season' AND scope_id = $1
          AND conversation_type = 'announcements' AND auto_managed = TRUE`,
      [seasonId]
    );
  });

  it('creates an announcements conversation scoped to the season', async () => {
    const result = await createSeasonAnnouncementsChat({ seasonId });
    expect(result.created).toBe(true);

    const convs = await executeSql(
      `SELECT title, conversation_type, scope_type, scope_id, auto_managed
         FROM conversations WHERE id = $1`,
      [result.conversationId]
    );
    expect(convs[0].conversation_type).toBe('announcements');
    expect(convs[0].scope_type).toBe('season');
    expect(convs[0].scope_id).toBe(seasonId);
    expect(convs[0].auto_managed).toBe(true);
    expect(convs[0].title).toContain('Announcements');
  });

  it('every distinct rostered player is a participant', async () => {
    const result = await createSeasonAnnouncementsChat({ seasonId });

    const participants = await executeSql(
      `SELECT user_id FROM conversation_participants WHERE conversation_id = $1`,
      [result.conversationId]
    );
    const participantIds = new Set(
      participants.map((p: { user_id: string }) => p.user_id)
    );

    for (const playerId of expectedPlayerIds) {
      expect(participantIds.has(playerId)).toBe(true);
    }
    expect(participantIds.size).toBe(expectedPlayerIds.length);
  });

  it('all participants have cannot_leave=true (players cannot leave announcements)', async () => {
    const result = await createSeasonAnnouncementsChat({ seasonId });

    const rows = await executeSql(
      `SELECT cannot_leave FROM conversation_participants WHERE conversation_id = $1`,
      [result.conversationId]
    );
    for (const row of rows) {
      expect(row.cannot_leave).toBe(true);
    }
  });

  it('posts an opening system message', async () => {
    const result = await createSeasonAnnouncementsChat({ seasonId });

    const messages = await executeSql(
      `SELECT is_system, sender_id, content
         FROM messages WHERE conversation_id = $1`,
      [result.conversationId]
    );
    expect(messages.length).toBe(1);
    expect(messages[0].is_system).toBe(true);
    expect(messages[0].sender_id).toBeNull();
    expect(messages[0].content).toContain('Season announcements');
  });

  it('is idempotent', async () => {
    const first = await createSeasonAnnouncementsChat({ seasonId });
    const second = await createSeasonAnnouncementsChat({ seasonId });

    expect(second.created).toBe(false);
    expect(second.conversationId).toBe(first.conversationId);

    const count = await executeSql(
      `SELECT COUNT(*)::int AS n FROM conversation_participants WHERE conversation_id = $1`,
      [first.conversationId]
    );
    expect(count[0].n).toBe(expectedPlayerIds.length);

    const msgCount = await executeSql(
      `SELECT COUNT(*)::int AS n FROM messages WHERE conversation_id = $1`,
      [first.conversationId]
    );
    expect(msgCount[0].n).toBe(1);
  });

  it('throws when season does not exist', async () => {
    const bogusSeasonId = '00000000-0000-0000-0000-000000000000';
    await expect(
      createSeasonAnnouncementsChat({ seasonId: bogusSeasonId })
    ).rejects.toThrow(/Season not found/);
  });
});
