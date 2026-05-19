// @vitest-environment jsdom
//
// jsdom env for consistency with other messaging DB-backed tests. This file
// only uses raw SQL via pg.Pool (no supabase-js write paths), so the
// happy-dom Content-Type bug doesn't bite here either way — staying on
// jsdom keeps the suite uniform.
/**
 * @fileoverview Tests for Unit 7 polish migration
 *
 * Migration: supabase/migrations/20260513000001_messaging_phase1_unit7_polish.sql
 *
 * Verifies two changes:
 *
 *   1. `COMMENT ON COLUMN public.members.profanity_filter_enabled` was
 *      reworded to reflect the DOB-optional reality (the baseline wording
 *      "Forced ON for users under 18, optional for adults" assumed DOB
 *      was always collected; in practice DOB is optional, so the comment
 *      needed to mention both the under-18 rule AND the DOB-optional
 *      fallback).
 *
 *   2. `public.increment_unread_count()` now explicitly skips system
 *      messages (`NEW.is_system = TRUE`) before doing the UPDATE. Today
 *      the implicit SQL NULL semantics (`user_id != NULL` evaluates to
 *      NULL → falsy in WHERE) achieve the same result, but the explicit
 *      check makes the intent visible and survives schema changes.
 *
 * Run: pnpm test:run src/__tests__/database/messaging-phase1-unit7-polish
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { executeSql } from '@/test/dbTestUtils';

let conversationId: string;
let memberAId: string; // sender of the regular message
let memberBId: string; // recipient — unread_count should bump on regular, not system

beforeAll(async () => {
  // Two members we can reuse as participants. Pulled from real seed data
  // rather than created here so we don't fight FK constraints on members.
  const members = await executeSql<{ id: string }>(`
    SELECT id FROM members
    WHERE first_name IS NOT NULL AND last_name IS NOT NULL
    ORDER BY created_at ASC
    LIMIT 2
  `);
  if (members.length < 2) {
    throw new Error('Unit 7 polish test needs at least 2 members in seed data');
  }
  memberAId = members[0].id;
  memberBId = members[1].id;

  // Disposable conversation with both as active participants.
  const conv = await executeSql<{ id: string }>(`
    INSERT INTO conversations (title, auto_managed, scope_type)
    VALUES ('TEST-unit7-polish-fixture', FALSE, 'none')
    RETURNING id
  `);
  conversationId = conv[0].id;

  await executeSql(
    `INSERT INTO conversation_participants (conversation_id, user_id, role, cannot_leave, unread_count)
     VALUES ($1, $2, 'participant', FALSE, 0),
            ($1, $3, 'participant', FALSE, 0)`,
    [conversationId, memberAId, memberBId],
  );
});

afterAll(async () => {
  if (conversationId) {
    await executeSql(`DELETE FROM conversations WHERE id = $1`, [conversationId]);
  }
});

beforeEach(async () => {
  // Each test starts with both participants at unread_count = 0.
  await executeSql(
    `UPDATE conversation_participants SET unread_count = 0
     WHERE conversation_id = $1`,
    [conversationId],
  );
});

describe('increment_unread_count() — system-message guard (Unit 7 polish)', () => {
  it('does NOT increment unread_count for any participant on system-message INSERT', async () => {
    await executeSql(
      `INSERT INTO messages (conversation_id, sender_id, content, is_system)
       VALUES ($1, NULL, 'Sally joined the team.', TRUE)`,
      [conversationId],
    );

    const rows = await executeSql<{ user_id: string; unread_count: number }>(
      `SELECT user_id, unread_count
       FROM conversation_participants
       WHERE conversation_id = $1
       ORDER BY user_id`,
      [conversationId],
    );

    expect(rows.length).toBe(2);
    expect(rows[0].unread_count).toBe(0);
    expect(rows[1].unread_count).toBe(0);
  });

  it('still increments unread_count for non-senders on a regular message INSERT', async () => {
    await executeSql(
      `INSERT INTO messages (conversation_id, sender_id, content, is_system)
       VALUES ($1, $2, 'hey', FALSE)`,
      [conversationId, memberAId],
    );

    const aRow = await executeSql<{ unread_count: number }>(
      `SELECT unread_count FROM conversation_participants
       WHERE conversation_id = $1 AND user_id = $2`,
      [conversationId, memberAId],
    );
    const bRow = await executeSql<{ unread_count: number }>(
      `SELECT unread_count FROM conversation_participants
       WHERE conversation_id = $1 AND user_id = $2`,
      [conversationId, memberBId],
    );

    // Sender's own count untouched; recipient's count incremented.
    expect(aRow[0].unread_count).toBe(0);
    expect(bRow[0].unread_count).toBe(1);
  });

  it('handles a mixed sequence (system, regular, system) — only the regular bumps', async () => {
    await executeSql(
      `INSERT INTO messages (conversation_id, sender_id, content, is_system)
       VALUES ($1, NULL, 'first system line', TRUE)`,
      [conversationId],
    );
    await executeSql(
      `INSERT INTO messages (conversation_id, sender_id, content, is_system)
       VALUES ($1, $2, 'real message', FALSE)`,
      [conversationId, memberAId],
    );
    await executeSql(
      `INSERT INTO messages (conversation_id, sender_id, content, is_system)
       VALUES ($1, NULL, 'second system line', TRUE)`,
      [conversationId],
    );

    const bRow = await executeSql<{ unread_count: number }>(
      `SELECT unread_count FROM conversation_participants
       WHERE conversation_id = $1 AND user_id = $2`,
      [conversationId, memberBId],
    );
    expect(bRow[0].unread_count).toBe(1);
  });
});

describe('members.profanity_filter_enabled COMMENT (Unit 7 polish)', () => {
  it('mentions both the known-minor enforcement AND the DOB-optional fallback', async () => {
    const rows = await executeSql<{ description: string | null }>(
      `SELECT pg_catalog.col_description(c.oid, a.attnum) AS description
       FROM pg_catalog.pg_class c
       JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
       JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid
       WHERE n.nspname = 'public'
         AND c.relname = 'members'
         AND a.attname = 'profanity_filter_enabled'`,
    );

    expect(rows.length).toBe(1);
    const description = rows[0].description ?? '';

    // Reworded wording must surface both halves of the rule.
    expect(description.toLowerCase()).toMatch(/minor|under 18|age/);
    expect(description.toLowerCase()).toMatch(/dob|date_of_birth/);
  });
});
