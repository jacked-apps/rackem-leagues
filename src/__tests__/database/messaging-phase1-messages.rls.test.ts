/**
 * @fileoverview Schema + CHECK constraint tests for Messaging Phase 1 — Unit 2
 *
 * Verifies the schema changes landed by the migration:
 *   supabase/migrations/20260509000002_messaging_phase1_messages_members.sql
 *
 * What this test proves:
 *   1. messages.is_system exists (BOOLEAN, NOT NULL, default false).
 *   2. messages.sender_id is now NULLABLE (was NOT NULL before this unit).
 *   3. messages_is_system_shape CHECK enforces the (is_system, sender_id)
 *      pairing — invalid combinations are rejected.
 *   4. members.profanity_onboarding_completed_at and members.deleted_at
 *      exist as nullable timestamps.
 *   5. Valid INSERTs work end-to-end: both a system message (NULL sender)
 *      and a user message (non-NULL sender).
 *
 * What this test does NOT cover (intentionally — those land in later units
 * or are blocked by RLS being disabled in dev):
 *   - INSERT RLS preventing authenticated users from setting is_system=true
 *     (the security gate is meaningful only with RLS enabled, which is a
 *     separate dedicated effort)
 *   - Trigger-driven system message posting (Unit 4)
 *   - members.deleted_at NULL→timestamp transition trigger (Unit 5)
 *
 * Run: pnpm test:run src/__tests__/database/messaging-phase1-messages
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { executeSql } from '@/test/dbTestUtils';

describe('Messaging Phase 1 Unit 2 — schema migration', () => {
  // ---------------------------------------------------------------------------
  // Fixtures: a manual conversation + a member id to use as sender. Messaging
  // tables are empty in seed data (auto-creation triggers ship in Unit 4), so
  // we make our own minimal scaffold and clean up after.
  // ---------------------------------------------------------------------------
  let fixtureConversationId: string | null = null;
  let fixtureMemberId: string | null = null;

  beforeAll(async () => {
    const conv = await executeSql(
      `INSERT INTO conversations (title, auto_managed, scope_type)
       VALUES ('TEST-Unit2-Messages-Fixture', FALSE, 'none')
       RETURNING id`
    );
    fixtureConversationId = conv[0]?.id ?? null;

    const mem = await executeSql(`SELECT id FROM members LIMIT 1`);
    fixtureMemberId = mem[0]?.id ?? null;
  });

  afterAll(async () => {
    if (fixtureConversationId) {
      // CASCADE removes any messages we inserted into the fixture.
      await executeSql(`DELETE FROM conversations WHERE id = $1`, [fixtureConversationId]);
    }
  });

  // ---------------------------------------------------------------------------
  // 1. New / changed columns: shape introspection
  // ---------------------------------------------------------------------------
  describe('Column shapes', () => {
    it('messages.is_system exists: BOOLEAN, NOT NULL, default false', async () => {
      const rows = await executeSql(
        `SELECT data_type, is_nullable, column_default
           FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'messages'
            AND column_name = 'is_system'`
      );
      expect(rows.length).toBe(1);
      expect(rows[0].data_type).toBe('boolean');
      expect(rows[0].is_nullable).toBe('NO');
      expect(rows[0].column_default).toBe('false');
    });

    it('messages.sender_id is now nullable (was NOT NULL pre-Unit-2)', async () => {
      const rows = await executeSql(
        `SELECT is_nullable
           FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'messages'
            AND column_name = 'sender_id'`
      );
      expect(rows.length).toBe(1);
      expect(rows[0].is_nullable).toBe('YES');
    });

    it('members.profanity_onboarding_completed_at exists and is nullable', async () => {
      const rows = await executeSql(
        `SELECT data_type, is_nullable, column_default
           FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'members'
            AND column_name = 'profanity_onboarding_completed_at'`
      );
      expect(rows.length).toBe(1);
      expect(rows[0].data_type).toBe('timestamp with time zone');
      expect(rows[0].is_nullable).toBe('YES');
      expect(rows[0].column_default).toBeNull();
    });

    it('members.deleted_at exists and is nullable', async () => {
      const rows = await executeSql(
        `SELECT data_type, is_nullable, column_default
           FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'members'
            AND column_name = 'deleted_at'`
      );
      expect(rows.length).toBe(1);
      expect(rows[0].data_type).toBe('timestamp with time zone');
      expect(rows[0].is_nullable).toBe('YES');
      expect(rows[0].column_default).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // 2. CHECK constraint introspection
  // ---------------------------------------------------------------------------
  describe('messages_is_system_shape CHECK constraint', () => {
    it('exists and pairs is_system with sender_id correctly', async () => {
      const rows = await executeSql(
        `SELECT pg_get_constraintdef(oid) AS def
           FROM pg_constraint
          WHERE conname = 'messages_is_system_shape'`
      );
      expect(rows.length).toBe(1);
      const def = rows[0].def as string;
      // The constraint references both columns
      expect(def).toContain('is_system');
      expect(def).toContain('sender_id');
      // Allows the two valid shapes
      expect(def).toMatch(/is_system\s*=\s*true.*sender_id\s+IS\s+NULL/);
      expect(def).toMatch(/is_system\s*=\s*false.*sender_id\s+IS\s+NOT\s+NULL/);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. CHECK enforcement: invalid shapes rejected at INSERT
  // ---------------------------------------------------------------------------
  describe('CHECK rejects invalid (is_system, sender_id) shapes', () => {
    it('rejects is_system = true WITH a sender_id (system message must have NULL sender)', async () => {
      expect(fixtureConversationId).toBeTruthy();
      expect(fixtureMemberId).toBeTruthy();

      await expect(
        executeSql(
          `INSERT INTO messages (conversation_id, sender_id, content, is_system)
           VALUES ($1, $2, 'should be rejected', true)`,
          [fixtureConversationId, fixtureMemberId]
        )
      ).rejects.toThrow(/check|constraint/i);
    });

    it('rejects is_system = false WITH NULL sender_id (user message must have a sender)', async () => {
      expect(fixtureConversationId).toBeTruthy();

      await expect(
        executeSql(
          `INSERT INTO messages (conversation_id, sender_id, content, is_system)
           VALUES ($1, NULL, 'should be rejected', false)`,
          [fixtureConversationId]
        )
      ).rejects.toThrow(/check|constraint/i);
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Forward-compat: valid INSERTs work
  // ---------------------------------------------------------------------------
  describe('Valid INSERT shapes succeed', () => {
    it('user message: is_system=false (default), sender_id set, succeeds', async () => {
      expect(fixtureConversationId).toBeTruthy();
      expect(fixtureMemberId).toBeTruthy();

      const rows = await executeSql(
        `INSERT INTO messages (conversation_id, sender_id, content)
         VALUES ($1, $2, 'hello from test')
         RETURNING id, is_system, sender_id`,
        [fixtureConversationId, fixtureMemberId]
      );

      expect(rows.length).toBe(1);
      expect(rows[0].is_system).toBe(false); // DEFAULT applied
      expect(rows[0].sender_id).toBe(fixtureMemberId);

      // Cleanup
      await executeSql(`DELETE FROM messages WHERE id = $1`, [rows[0].id]);
    });

    it('system message: is_system=true, sender_id NULL, succeeds', async () => {
      expect(fixtureConversationId).toBeTruthy();

      const rows = await executeSql(
        `INSERT INTO messages (conversation_id, sender_id, content, is_system)
         VALUES ($1, NULL, 'Sally joined the team', true)
         RETURNING id, is_system, sender_id`,
        [fixtureConversationId]
      );

      expect(rows.length).toBe(1);
      expect(rows[0].is_system).toBe(true);
      expect(rows[0].sender_id).toBeNull();

      // Cleanup
      await executeSql(`DELETE FROM messages WHERE id = $1`, [rows[0].id]);
    });
  });
});
