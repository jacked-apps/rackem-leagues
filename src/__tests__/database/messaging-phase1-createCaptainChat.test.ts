// @vitest-environment jsdom
//
// jsdom env required: multi-step supabase-js INSERTs. See
// memory/project_happy_dom_supabase_insert_limit.md.
/**
 * @fileoverview Tests for createCaptainChat()
 *
 * Lives in src/api/mutations/autoConversations.ts. One captain's chat per
 * (league, season). Members = team captains for that season UNION org staff,
 * deduped, captains get cannot_leave=true and staff-only members get
 * cannot_leave=false.
 *
 * Covered:
 *   1. Fresh creation produces a captains_chat conversation scoped to the
 *      season, with the expected title shape.
 *   2. All distinct team captains for the season appear as participants.
 *   3. All org staff appear as participants.
 *   4. Captain rule wins for dual captain+staff members (cannot_leave=true).
 *   5. Captains have cannot_leave=true; staff-only have cannot_leave=false.
 *   6. Opening system message exists.
 *   7. Idempotent re-call returns same chat with created=false; no dup
 *      participants or messages.
 *   8. Wrong league rejects.
 *   9. Missing season rejects.
 *
 * Run: pnpm test:run src/__tests__/database/messaging-phase1-createCaptainChat
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { executeSql } from '@/test/dbTestUtils';
import { createCaptainChat } from '@/api/mutations/autoConversations';

describe('createCaptainChat()', () => {
  let seasonId: string;
  let leagueId: string;
  let orgId: string;
  let expectedCaptainIds: string[];
  let expectedStaffIds: string[];

  beforeAll(async () => {
    // Use the first seeded league/season. Pull its captains + the
    // organization's staff so we can assert against the real data shape.
    const seasonRows = await executeSql(`
      SELECT s.id AS season_id, s.league_id, l.organization_id
      FROM seasons s
      JOIN leagues l ON l.id = s.league_id
      ORDER BY s.start_date ASC
      LIMIT 1
    `);
    expect(seasonRows.length).toBe(1);
    seasonId = seasonRows[0].season_id;
    leagueId = seasonRows[0].league_id;
    orgId = seasonRows[0].organization_id;

    const captains = await executeSql(
      `SELECT DISTINCT captain_id FROM teams
        WHERE season_id = $1 AND captain_id IS NOT NULL`,
      [seasonId]
    );
    expectedCaptainIds = captains.map((r: { captain_id: string }) => r.captain_id);

    const staff = await executeSql(
      `SELECT member_id FROM organization_staff WHERE organization_id = $1`,
      [orgId]
    );
    expectedStaffIds = staff.map((r: { member_id: string }) => r.member_id);

    expect(expectedCaptainIds.length).toBeGreaterThan(0);
    expect(expectedStaffIds.length).toBeGreaterThan(0);
  });

  beforeEach(async () => {
    await executeSql(
      `DELETE FROM conversations
        WHERE scope_type = 'season'
          AND scope_id = $1
          AND conversation_type = 'captains_chat'
          AND auto_managed = TRUE`,
      [seasonId]
    );
  });

  afterAll(async () => {
    await executeSql(
      `DELETE FROM conversations
        WHERE scope_type = 'season'
          AND scope_id = $1
          AND conversation_type = 'captains_chat'
          AND auto_managed = TRUE`,
      [seasonId]
    );
  });

  it('creates a captains_chat conversation scoped to the season', async () => {
    const result = await createCaptainChat({ seasonId, leagueId });

    expect(result.created).toBe(true);

    const convs = await executeSql(
      `SELECT title, conversation_type, scope_type, scope_id, auto_managed
         FROM conversations WHERE id = $1`,
      [result.conversationId]
    );
    expect(convs.length).toBe(1);
    expect(convs[0].conversation_type).toBe('captains_chat');
    expect(convs[0].scope_type).toBe('season');
    expect(convs[0].scope_id).toBe(seasonId);
    expect(convs[0].auto_managed).toBe(true);
    expect(convs[0].title).toContain('Captains Chat');
  });

  it('includes every distinct team captain as a participant', async () => {
    const result = await createCaptainChat({ seasonId, leagueId });

    const participants = await executeSql(
      `SELECT user_id FROM conversation_participants WHERE conversation_id = $1`,
      [result.conversationId]
    );
    const participantIds = new Set(
      participants.map((p: { user_id: string }) => p.user_id)
    );

    for (const captainId of expectedCaptainIds) {
      expect(participantIds.has(captainId)).toBe(true);
    }
  });

  it('includes every org staff member as a participant', async () => {
    const result = await createCaptainChat({ seasonId, leagueId });

    const participants = await executeSql(
      `SELECT user_id FROM conversation_participants WHERE conversation_id = $1`,
      [result.conversationId]
    );
    const participantIds = new Set(
      participants.map((p: { user_id: string }) => p.user_id)
    );

    for (const staffId of expectedStaffIds) {
      expect(participantIds.has(staffId)).toBe(true);
    }
  });

  it('captains have cannot_leave=true', async () => {
    const result = await createCaptainChat({ seasonId, leagueId });

    for (const captainId of expectedCaptainIds) {
      const rows = await executeSql(
        `SELECT cannot_leave FROM conversation_participants
          WHERE conversation_id = $1 AND user_id = $2`,
        [result.conversationId, captainId]
      );
      expect(rows.length).toBe(1);
      expect(rows[0].cannot_leave).toBe(true);
    }
  });

  it('staff-only members have cannot_leave=false (D6: staff CAN leave the captain chat)', async () => {
    const result = await createCaptainChat({ seasonId, leagueId });

    const captainSet = new Set(expectedCaptainIds);
    const staffOnly = expectedStaffIds.filter((s) => !captainSet.has(s));

    if (staffOnly.length === 0) {
      // All staff are also captains in this seed — skip without failing
      return;
    }

    for (const staffId of staffOnly) {
      const rows = await executeSql(
        `SELECT cannot_leave FROM conversation_participants
          WHERE conversation_id = $1 AND user_id = $2`,
        [result.conversationId, staffId]
      );
      expect(rows.length).toBe(1);
      expect(rows[0].cannot_leave).toBe(false);
    }
  });

  it('posts an opening system message', async () => {
    const result = await createCaptainChat({ seasonId, leagueId });

    const messages = await executeSql(
      `SELECT is_system, sender_id, content
         FROM messages WHERE conversation_id = $1`,
      [result.conversationId]
    );
    expect(messages.length).toBe(1);
    expect(messages[0].is_system).toBe(true);
    expect(messages[0].sender_id).toBeNull();
    expect(messages[0].content).toBe('Captains chat created.');
  });

  it('is idempotent — second call returns existing chat with created=false', async () => {
    const first = await createCaptainChat({ seasonId, leagueId });
    expect(first.created).toBe(true);

    const second = await createCaptainChat({ seasonId, leagueId });
    expect(second.created).toBe(false);
    expect(second.conversationId).toBe(first.conversationId);

    // No duplicates: dedup count vs participant count
    const expected = new Set([...expectedCaptainIds, ...expectedStaffIds]).size;
    const participantCount = await executeSql(
      `SELECT COUNT(*)::int AS n FROM conversation_participants
        WHERE conversation_id = $1`,
      [first.conversationId]
    );
    expect(participantCount[0].n).toBe(expected);

    const messageCount = await executeSql(
      `SELECT COUNT(*)::int AS n FROM messages WHERE conversation_id = $1`,
      [first.conversationId]
    );
    expect(messageCount[0].n).toBe(1);
  });

  it('throws when season belongs to a different league than caller specified', async () => {
    const bogusLeagueId = '00000000-0000-0000-0000-000000000000';
    await expect(
      createCaptainChat({ seasonId, leagueId: bogusLeagueId })
    ).rejects.toThrow(/belongs to league/);
  });

  it('throws when season does not exist', async () => {
    const bogusSeasonId = '00000000-0000-0000-0000-000000000000';
    await expect(
      createCaptainChat({ seasonId: bogusSeasonId, leagueId })
    ).rejects.toThrow(/Season not found/);
  });
});
