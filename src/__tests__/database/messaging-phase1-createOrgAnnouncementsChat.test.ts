// @vitest-environment jsdom
//
// jsdom env required: multi-step supabase-js INSERTs.
/**
 * @fileoverview Tests for createOrgAnnouncementsChat()
 *
 * Lives in src/api/mutations/autoConversations.ts. One announcements
 * channel per organization; every distinct player in ACTIVE seasons under
 * the org is a participant with cannot_leave=true. Past-season players
 * are intentionally excluded.
 *
 * Run: pnpm test:run src/__tests__/database/messaging-phase1-createOrgAnnouncementsChat
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { executeSql } from '@/test/dbTestUtils';
import { createOrgAnnouncementsChat } from '@/api/mutations/autoConversations';

describe('createOrgAnnouncementsChat()', () => {
  let orgId: string;
  let expectedPlayerIds: string[];

  beforeAll(async () => {
    // Pick the first org that has at least one active season + roster.
    const rows = await executeSql(`
      SELECT DISTINCT l.organization_id AS org_id
      FROM leagues l
      JOIN seasons s ON s.league_id = l.id
      JOIN teams t ON t.season_id = s.id
      WHERE s.status = 'active'
      LIMIT 1
    `);
    expect(rows.length).toBe(1);
    orgId = rows[0].org_id;

    const players = await executeSql(
      `SELECT DISTINCT tp.member_id
         FROM team_players tp
         JOIN teams t ON t.id = tp.team_id
         JOIN seasons s ON s.id = t.season_id
         JOIN leagues l ON l.id = s.league_id
        WHERE s.status = 'active' AND l.organization_id = $1`,
      [orgId]
    );
    expectedPlayerIds = players.map((r: { member_id: string }) => r.member_id);
    expect(expectedPlayerIds.length).toBeGreaterThan(0);
  });

  beforeEach(async () => {
    await executeSql(
      `DELETE FROM conversations
        WHERE scope_type = 'organization' AND scope_id = $1
          AND conversation_type = 'announcements' AND auto_managed = TRUE`,
      [orgId]
    );
  });

  afterAll(async () => {
    await executeSql(
      `DELETE FROM conversations
        WHERE scope_type = 'organization' AND scope_id = $1
          AND conversation_type = 'announcements' AND auto_managed = TRUE`,
      [orgId]
    );
  });

  it('creates an announcements conversation scoped to the organization', async () => {
    const result = await createOrgAnnouncementsChat({ organizationId: orgId });
    expect(result.created).toBe(true);

    const convs = await executeSql(
      `SELECT title, conversation_type, scope_type, scope_id, auto_managed
         FROM conversations WHERE id = $1`,
      [result.conversationId]
    );
    expect(convs[0].conversation_type).toBe('announcements');
    expect(convs[0].scope_type).toBe('organization');
    expect(convs[0].scope_id).toBe(orgId);
    expect(convs[0].auto_managed).toBe(true);
    expect(convs[0].title).toContain('Announcements');
  });

  it('every distinct player across active seasons in the org is a participant', async () => {
    const result = await createOrgAnnouncementsChat({ organizationId: orgId });

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

  it('all participants have cannot_leave=true', async () => {
    const result = await createOrgAnnouncementsChat({ organizationId: orgId });

    const rows = await executeSql(
      `SELECT cannot_leave FROM conversation_participants WHERE conversation_id = $1`,
      [result.conversationId]
    );
    for (const row of rows) {
      expect(row.cannot_leave).toBe(true);
    }
  });

  it('posts an opening system message', async () => {
    const result = await createOrgAnnouncementsChat({ organizationId: orgId });

    const messages = await executeSql(
      `SELECT is_system, sender_id, content
         FROM messages WHERE conversation_id = $1`,
      [result.conversationId]
    );
    expect(messages.length).toBe(1);
    expect(messages[0].is_system).toBe(true);
    expect(messages[0].sender_id).toBeNull();
    expect(messages[0].content).toContain('Organization announcements');
  });

  it('is idempotent', async () => {
    const first = await createOrgAnnouncementsChat({ organizationId: orgId });
    const second = await createOrgAnnouncementsChat({ organizationId: orgId });

    expect(second.created).toBe(false);
    expect(second.conversationId).toBe(first.conversationId);

    const partCount = await executeSql(
      `SELECT COUNT(*)::int AS n FROM conversation_participants WHERE conversation_id = $1`,
      [first.conversationId]
    );
    expect(partCount[0].n).toBe(expectedPlayerIds.length);

    const msgCount = await executeSql(
      `SELECT COUNT(*)::int AS n FROM messages WHERE conversation_id = $1`,
      [first.conversationId]
    );
    expect(msgCount[0].n).toBe(1);
  });

  it('throws when organization does not exist', async () => {
    const bogusOrgId = '00000000-0000-0000-0000-000000000000';
    await expect(
      createOrgAnnouncementsChat({ organizationId: bogusOrgId })
    ).rejects.toThrow(/Organization not found/);
  });
});
