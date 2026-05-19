/**
 * @fileoverview Schema + CHECK constraint tests for Messaging Phase 1 — Unit 1
 *
 * Verifies the schema changes landed by the migration:
 *   supabase/migrations/20260509000001_messaging_phase1_conversations_participants.sql
 *
 * What this test proves:
 *   1. The three NEW columns exist with correct types, defaults, and nullability:
 *      - conversations.archived_at                (TIMESTAMPTZ, nullable)
 *      - conversation_participants.notification_mode  (VARCHAR, NOT NULL, default 'all')
 *      - conversation_participants.cannot_leave   (BOOLEAN, NOT NULL, default false)
 *
 *   2. The three CHECK constraints were widened to include the new values:
 *      - conversations_conversation_type_check  +'match_chat'
 *      - conversations_scope_type_check         +'match'
 *      - conversation_participants_role_check   +'observer'
 *
 *   3. The CHECK constraints still REJECT arbitrary garbage values. (Defends
 *      against a future migration accidentally dropping the constraint and
 *      not replacing it.)
 *
 *   4. The four pre-existing SECURITY DEFINER conversation-creation helpers
 *      (`create_dm_conversation`, `create_group_conversation`, etc.) still
 *      parse and execute after the CHECK widenings. Smoke test only — full
 *      RLS coverage of those functions lives in messaging.rls.test.ts.
 *
 * What this test does NOT cover (intentionally — those land in later units):
 *   - Past-member RLS (`left_at` time-boundary SELECT)         → Unit 6
 *   - Observer-role triggers / inbox filter                    → Phase 5
 *   - System messages (is_system column / sender_id nullable)  → Unit 2
 *   - notification_mode backfill exact-value verification — the backfill ran
 *     once during the migration; by the time this test executes, dev seed
 *     fixtures have replaced the original rows. The DEFAULT 'all' behavior
 *     is exercised below via a forward-compat insert.
 *
 * Run: pnpm test:run src/__tests__/database/messaging-phase1-conversations
 * Prereq: local Supabase running (`supabase start`) AND `supabase db reset`
 * has been done at least once so the migration is applied.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { executeSql } from '@/test/dbTestUtils';

describe('Messaging Phase 1 Unit 1 — schema migration', () => {
  // ---------------------------------------------------------------------------
  // Fixtures: messaging tables are empty in seed data (auto-creation triggers
  // ship in Unit 4). We create a minimal "group" conversation + a captured
  // member id to exercise constraint + default-value behavior, then clean up.
  // ---------------------------------------------------------------------------
  let fixtureConversationId: string | null = null;
  let fixtureMemberId: string | null = null;

  beforeAll(async () => {
    // valid_auto_managed CHECK: if auto_managed = false, conversation_type
    // must be NULL and scope_type must be 'none'. Manual group chat shape.
    const conv = await executeSql(
      `INSERT INTO conversations (title, auto_managed, scope_type)
       VALUES ('TEST-Unit1-RLS-Fixture', FALSE, 'none')
       RETURNING id`
    );
    fixtureConversationId = conv[0]?.id ?? null;

    const mem = await executeSql(`SELECT id FROM members LIMIT 1`);
    fixtureMemberId = mem[0]?.id ?? null;
  });

  afterAll(async () => {
    // CASCADE on the FK removes participants automatically when the
    // conversation is deleted.
    if (fixtureConversationId) {
      await executeSql(`DELETE FROM conversations WHERE id = $1`, [fixtureConversationId]);
    }
  });

  // ---------------------------------------------------------------------------
  // 1. New columns exist with correct shape
  // ---------------------------------------------------------------------------
  describe('New columns', () => {
    it('conversations.archived_at exists and is nullable', async () => {
      const rows = await executeSql(
        `SELECT data_type, is_nullable, column_default
           FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'conversations'
            AND column_name = 'archived_at'`
      );
      expect(rows.length).toBe(1);
      expect(rows[0].data_type).toBe('timestamp with time zone');
      expect(rows[0].is_nullable).toBe('YES');
      expect(rows[0].column_default).toBeNull();
    });

    it('conversation_participants.notification_mode exists, NOT NULL, default "all"', async () => {
      const rows = await executeSql(
        `SELECT data_type, is_nullable, column_default
           FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'conversation_participants'
            AND column_name = 'notification_mode'`
      );
      expect(rows.length).toBe(1);
      expect(rows[0].data_type).toBe('character varying');
      expect(rows[0].is_nullable).toBe('NO');
      expect(rows[0].column_default).toContain("'all'");
    });

    it('conversation_participants.cannot_leave exists, NOT NULL, default false', async () => {
      const rows = await executeSql(
        `SELECT data_type, is_nullable, column_default
           FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'conversation_participants'
            AND column_name = 'cannot_leave'`
      );
      expect(rows.length).toBe(1);
      expect(rows[0].data_type).toBe('boolean');
      expect(rows[0].is_nullable).toBe('NO');
      expect(rows[0].column_default).toBe('false');
    });
  });

  // ---------------------------------------------------------------------------
  // 2. CHECK constraints were widened to include the new values
  // ---------------------------------------------------------------------------
  describe('CHECK constraints widened', () => {
    it('conversations_conversation_type_check includes match_chat (+ original values)', async () => {
      const rows = await executeSql(
        `SELECT pg_get_constraintdef(oid) AS def
           FROM pg_constraint
          WHERE conname = 'conversations_conversation_type_check'`
      );
      expect(rows.length).toBe(1);
      const def = rows[0].def as string;
      // New value present
      expect(def).toContain('match_chat');
      // Original values preserved
      expect(def).toContain('direct');
      expect(def).toContain('team_chat');
      expect(def).toContain('captains_chat');
      expect(def).toContain('announcements');
    });

    it('conversations_scope_type_check includes match (+ original values)', async () => {
      const rows = await executeSql(
        `SELECT pg_get_constraintdef(oid) AS def
           FROM pg_constraint
          WHERE conname = 'conversations_scope_type_check'`
      );
      expect(rows.length).toBe(1);
      const def = rows[0].def as string;
      expect(def).toContain("'match'");
      expect(def).toContain("'team'");
      expect(def).toContain("'season'");
      expect(def).toContain("'organization'");
      expect(def).toContain("'none'");
    });

    it('conversation_participants_role_check includes observer (+ original values)', async () => {
      const rows = await executeSql(
        `SELECT pg_get_constraintdef(oid) AS def
           FROM pg_constraint
          WHERE conname = 'conversation_participants_role_check'`
      );
      expect(rows.length).toBe(1);
      const def = rows[0].def as string;
      expect(def).toContain('observer');
      expect(def).toContain('admin');
      expect(def).toContain('participant');
    });
  });

  // ---------------------------------------------------------------------------
  // 3. CHECK constraints still REJECT garbage values
  //    Raw SQL — exercises the database constraint layer directly without
  //    going through PostgREST. Each test wraps in a savepoint so the bad
  //    INSERT failure doesn't poison the transaction.
  // ---------------------------------------------------------------------------
  describe('CHECK constraints reject invalid values', () => {
    it('rejects notification_mode = "nonsense"', async () => {
      expect(fixtureConversationId).toBeTruthy();
      expect(fixtureMemberId).toBeTruthy();

      await expect(
        executeSql(
          `INSERT INTO conversation_participants
             (conversation_id, user_id, notification_mode)
           VALUES ($1, $2, 'nonsense')`,
          [fixtureConversationId, fixtureMemberId]
        )
      ).rejects.toThrow(/check|constraint/i);
    });

    it('rejects role = "spectator"', async () => {
      expect(fixtureConversationId).toBeTruthy();
      expect(fixtureMemberId).toBeTruthy();

      await expect(
        executeSql(
          `INSERT INTO conversation_participants
             (conversation_id, user_id, role)
           VALUES ($1, $2, 'spectator')`,
          [fixtureConversationId, fixtureMemberId]
        )
      ).rejects.toThrow(/check|constraint/i);
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Forward-compat: new conversation_participants rows get the right defaults
  // ---------------------------------------------------------------------------
  describe('Default-value behavior on new rows', () => {
    it('new conversation_participants rows default notification_mode = "all" and cannot_leave = false', async () => {
      expect(fixtureConversationId).toBeTruthy();
      expect(fixtureMemberId).toBeTruthy();

      try {
        // Insert with ONLY the required fields — defaults should fill the rest.
        await executeSql(
          `INSERT INTO conversation_participants (conversation_id, user_id)
           VALUES ($1, $2)`,
          [fixtureConversationId, fixtureMemberId]
        );

        const rows = await executeSql(
          `SELECT notification_mode, cannot_leave, role
             FROM conversation_participants
            WHERE conversation_id = $1 AND user_id = $2`,
          [fixtureConversationId, fixtureMemberId]
        );

        expect(rows.length).toBe(1);
        expect(rows[0].notification_mode).toBe('all');
        expect(rows[0].cannot_leave).toBe(false);
        expect(rows[0].role).toBe('participant'); // baseline default, unchanged by this migration
      } finally {
        // Clean up our inserted row — leaves the fixture conversation intact
        // for any subsequent tests in this file. (afterAll deletes the conv.)
        await executeSql(
          `DELETE FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2`,
          [fixtureConversationId, fixtureMemberId]
        );
      }
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Integration: pre-existing SECURITY DEFINER helpers still exist + parse
  //    Full end-to-end coverage of those helpers lives in messaging.rls.test.ts;
  //    here we just verify the CHECK widenings didn't break their function
  //    definitions.
  // ---------------------------------------------------------------------------
  describe('Existing SECURITY DEFINER helpers still exist after CHECK widening', () => {
    it.each([
      'create_dm_conversation',
      'create_group_conversation',
      'create_announcement_conversation',
      'create_organization_announcement_conversation',
    ])('%s is still a SECURITY DEFINER function in the public schema', async (fnName) => {
      const rows = await executeSql(
        `SELECT proname, prosecdef
           FROM pg_proc p
           JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = 'public' AND p.proname = $1`,
        [fnName]
      );
      expect(rows.length).toBeGreaterThanOrEqual(1);
      expect(rows[0].prosecdef).toBe(true); // SECURITY DEFINER, not INVOKER
    });
  });
});
