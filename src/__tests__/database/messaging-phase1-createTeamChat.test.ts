// @vitest-environment jsdom
//
// jsdom env required: createTeamChat performs multiple supabase-js INSERTs
// (conversation, participants, opening system message). happy-dom mangles
// Content-Type on POSTs. See memory/project_happy_dom_supabase_insert_limit.md.
/**
 * @fileoverview Tests for createTeamChat()
 *
 * Lives in src/api/mutations/autoConversations.ts. Idempotently creates the
 * auto-managed team chat for a given team — populates participants from the
 * roster, sets captain's cannot_leave flag, posts an opening system message.
 *
 * Covered:
 *   1. Happy path: a fresh call creates the chat, all roster members appear
 *      as participants, captain has cannot_leave=true.
 *   2. Idempotency: a second call returns the same conversation with
 *      created=false and does NOT duplicate participants or system messages.
 *   3. Opening system message exists with is_system=true and NULL sender.
 *   4. Error: missing team rejects.
 *   5. Error: team belongs to a different season — refuses to create.
 *
 * Run: pnpm test:run src/__tests__/database/messaging-phase1-createTeamChat
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { executeSql } from '@/test/dbTestUtils';
import { createTeamChat } from '@/api/mutations/autoConversations';

describe('createTeamChat()', () => {
  // Use the seeded "3v3 old school" league's Team 1 as the test target.
  // Falls back to whatever first team we can find if the named one doesn't
  // exist (e.g., if a future seed renames things).
  let seasonId: string;
  let teamId: string;
  let captainMemberId: string;
  let rosterMemberIds: string[];

  beforeAll(async () => {
    const rows = await executeSql(`
      SELECT t.id AS team_id, t.season_id, t.captain_id
      FROM teams t
      WHERE t.captain_id IS NOT NULL
      ORDER BY t.created_at ASC
      LIMIT 1
    `);
    expect(rows.length).toBe(1);
    teamId = rows[0].team_id;
    seasonId = rows[0].season_id;
    captainMemberId = rows[0].captain_id;

    const roster = await executeSql(
      `SELECT member_id FROM team_players WHERE team_id = $1`,
      [teamId]
    );
    rosterMemberIds = roster.map((r: { member_id: string }) => r.member_id);
    expect(rosterMemberIds.length).toBeGreaterThan(0);
  });

  beforeEach(async () => {
    // Clean any leftover auto-managed team chat for this team — keeps each
    // test independent. CASCADE removes participants and messages.
    await executeSql(
      `DELETE FROM conversations
        WHERE scope_type = 'team' AND scope_id = $1 AND auto_managed = TRUE`,
      [teamId]
    );
  });

  afterAll(async () => {
    // Final cleanup
    await executeSql(
      `DELETE FROM conversations
        WHERE scope_type = 'team' AND scope_id = $1 AND auto_managed = TRUE`,
      [teamId]
    );
  });

  it('creates the team chat fresh on first call', async () => {
    const result = await createTeamChat({ seasonId, teamId });

    expect(result.created).toBe(true);
    expect(result.conversationId).toBeTruthy();

    // Verify the conversation row landed with the expected shape
    const convs = await executeSql(
      `SELECT id, title, auto_managed, conversation_type, scope_type, scope_id
         FROM conversations WHERE id = $1`,
      [result.conversationId]
    );
    expect(convs.length).toBe(1);
    expect(convs[0].auto_managed).toBe(true);
    expect(convs[0].conversation_type).toBe('team_chat');
    expect(convs[0].scope_type).toBe('team');
    expect(convs[0].scope_id).toBe(teamId);
    expect(convs[0].title).toContain('Team Chat');
  });

  it('populates participants from the team roster', async () => {
    const result = await createTeamChat({ seasonId, teamId });

    const participants = await executeSql(
      `SELECT user_id, cannot_leave
         FROM conversation_participants
        WHERE conversation_id = $1`,
      [result.conversationId]
    );

    const participantIds = participants.map((p: { user_id: string }) => p.user_id).sort();
    const expectedIds = [...rosterMemberIds].sort();
    expect(participantIds).toEqual(expectedIds);
  });

  it('sets cannot_leave = true on the captain\'s participant row', async () => {
    const result = await createTeamChat({ seasonId, teamId });

    const captainRow = await executeSql(
      `SELECT cannot_leave FROM conversation_participants
        WHERE conversation_id = $1 AND user_id = $2`,
      [result.conversationId, captainMemberId]
    );
    expect(captainRow.length).toBe(1);
    expect(captainRow[0].cannot_leave).toBe(true);

    // And cannot_leave = false for non-captain roster members
    const otherRows = await executeSql(
      `SELECT cannot_leave FROM conversation_participants
        WHERE conversation_id = $1 AND user_id != $2`,
      [result.conversationId, captainMemberId]
    );
    for (const row of otherRows) {
      expect(row.cannot_leave).toBe(false);
    }
  });

  it('posts an opening system message', async () => {
    const result = await createTeamChat({ seasonId, teamId });

    const messages = await executeSql(
      `SELECT is_system, sender_id, content
         FROM messages
        WHERE conversation_id = $1`,
      [result.conversationId]
    );
    expect(messages.length).toBe(1);
    expect(messages[0].is_system).toBe(true);
    expect(messages[0].sender_id).toBeNull();
    expect(messages[0].content).toBe('Team chat created.');
  });

  it('is idempotent — second call returns existing chat with created=false', async () => {
    const first = await createTeamChat({ seasonId, teamId });
    expect(first.created).toBe(true);

    const second = await createTeamChat({ seasonId, teamId });
    expect(second.created).toBe(false);
    expect(second.conversationId).toBe(first.conversationId);

    // No duplicate participants or messages
    const participantCount = await executeSql(
      `SELECT COUNT(*)::int AS n FROM conversation_participants
        WHERE conversation_id = $1`,
      [first.conversationId]
    );
    expect(participantCount[0].n).toBe(rosterMemberIds.length);

    const messageCount = await executeSql(
      `SELECT COUNT(*)::int AS n FROM messages WHERE conversation_id = $1`,
      [first.conversationId]
    );
    expect(messageCount[0].n).toBe(1);
  });

  it('throws when team does not exist', async () => {
    const bogusTeamId = '00000000-0000-0000-0000-000000000000';
    await expect(
      createTeamChat({ seasonId, teamId: bogusTeamId })
    ).rejects.toThrow(/Team not found/);
  });

  it('throws when the team belongs to a different season than the caller specified', async () => {
    const bogusSeasonId = '00000000-0000-0000-0000-000000000000';
    await expect(
      createTeamChat({ seasonId: bogusSeasonId, teamId })
    ).rejects.toThrow(/belongs to season/);
  });
});
