/**
 * @fileoverview RLS + constraint tests for `rules_page_events`.
 *
 * Runs against the local Supabase instance (`supabase start`, migrations
 * applied). Verifies the three constraints the client relies on:
 *   1. Anonymous INSERT succeeds for each valid event_type.
 *   2. Anonymous INSERT is rejected for an unknown event_type.
 *   3. Over-length `game` / `rule_id` values are rejected.
 *   4. Anonymous SELECT is blocked by RLS (returns zero rows, no error).
 *
 * SELECT under the developer role is verified manually against the
 * Supabase dashboard — wiring a "developer" test user up in this file
 * would require new seed data, which is out of scope for Branch 1.
 */

import { describe, it, expect } from 'vitest';
import { createTestClient } from '@/test/dbTestUtils';

const TABLE = 'rules_page_events';

describe('rules_page_events — RLS + constraints (anonymous client)', () => {
  const client = createTestClient();

  it.each(['page_open', 'search_query', 'deep_link_open'] as const)(
    'anonymous INSERT with event_type="%s" succeeds',
    async (eventType) => {
      const { error } = await client
        .from(TABLE)
        // Database.types.ts doesn't know about the new table yet (it is
        // regenerated manually via `pnpm db:types`). Cast locally.
        .insert({ event_type: eventType } as never);
      expect(error).toBeNull();
    },
  );

  it('INSERT with an unknown event_type is rejected by the check constraint', async () => {
    const { error } = await client
      .from(TABLE)
      .insert({ event_type: 'something_else' } as never);
    expect(error).not.toBeNull();
  });

  it('INSERT with an over-length game slug is rejected', async () => {
    const longSlug = 'a'.repeat(41);
    const { error } = await client
      .from(TABLE)
      .insert({ event_type: 'page_open', game: longSlug } as never);
    expect(error).not.toBeNull();
  });

  it('INSERT with an over-length rule_id is rejected', async () => {
    const longId = 'b'.repeat(41);
    const { error } = await client
      .from(TABLE)
      .insert({ event_type: 'deep_link_open', rule_id: longId } as never);
    expect(error).not.toBeNull();
  });

  it('INSERT with a negative result_count is rejected', async () => {
    const { error } = await client
      .from(TABLE)
      .insert({ event_type: 'search_query', result_count: -1 } as never);
    expect(error).not.toBeNull();
  });

  it('anonymous SELECT returns zero rows (RLS blocks reads)', async () => {
    // Seed a row so we know the table is not empty under service role.
    await client.from(TABLE).insert({ event_type: 'page_open' } as never);

    const { data, error } = await client.from(TABLE).select('*');
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});
