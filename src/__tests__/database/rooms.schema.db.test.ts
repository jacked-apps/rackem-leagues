/**
 * @fileoverview Schema tests for the Game Room (Unit 1): the shape the whole
 * design leans on. Written before the RPC tests on purpose — if any of these
 * fail, nothing downstream is trustworthy.
 *
 *   - rooms + room_phones are in the realtime publication with REPLICA
 *     IDENTITY FULL (without both, filtered UPDATE/DELETE events never reach
 *     the other devices — the coin flip's result and a race's rollback would
 *     silently not sync).
 *   - room_phones cascades from rooms (deleting a room leaves nothing).
 *   - one row per DEVICE per room (UNIQUE room_id + device_id).
 *   - the room_validate_tables contract check refuses every way a game table
 *     can be wrong, and names what is missing.
 *   - nothing is callable by anon.
 *
 * Runs in the `db` vitest project (sequential) via raw pg.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { executeSql, closePostgresPool } from '@/test/dbTestUtils';
import {
  GOOD_TABLE,
  BAD_TABLES,
  createRoomFixtureTables,
  dropRoomFixtureTables,
  type Jsonb,
} from './roomsFixtures';

async function validate(tables: string[] | null): Promise<Jsonb | null> {
  const rows = await executeSql(`SELECT public.room_validate_tables($1::text[]) AS r`, [tables]);
  return rows[0].r;
}

describe('Game Room schema (Unit 1)', () => {
  beforeAll(async () => {
    await createRoomFixtureTables();
  });

  afterAll(async () => {
    await dropRoomFixtureTables();
    await closePostgresPool();
  });

  it('rooms and room_phones are on the supabase_realtime publication', async () => {
    const rows = await executeSql(
      `SELECT tablename FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename IN ('rooms', 'room_phones')`
    );
    expect(rows.map((r: { tablename: string }) => r.tablename).sort()).toEqual([
      'room_phones',
      'rooms',
    ]);
  });

  it('rooms and room_phones have REPLICA IDENTITY FULL', async () => {
    const rows = await executeSql(
      `SELECT relname, relreplident FROM pg_class WHERE relname IN ('rooms', 'room_phones')`
    );
    for (const r of rows) expect(r.relreplident, r.relname).toBe('f');
  });

  it('room_phones.room_id cascades on room delete and (room_id, device_id) is unique', async () => {
    const fk = await executeSql(
      `SELECT confdeltype FROM pg_constraint
        WHERE conname = 'room_phones_room_id_fkey' AND confrelid = 'public.rooms'::regclass`
    );
    expect(fk[0].confdeltype).toBe('c');

    const uq = await executeSql(
      `SELECT contype FROM pg_constraint WHERE conname = 'room_phones_room_device_key'`
    );
    expect(uq[0].contype).toBe('u');
  });

  it('room_validate_tables accepts a table that meets the whole contract', async () => {
    expect(await validate([GOOD_TABLE])).toBeNull();
  });

  it('room_validate_tables refuses more than the cap, duplicates, and reserved names', async () => {
    const four = [GOOD_TABLE, BAD_TABLES.noFk, BAD_TABLES.textId, BAD_TABLES.unpublished];
    expect(await validate(four)).toMatchObject({ ok: false, reason: 'too_many_tables', max: 3 });
    expect(await validate([GOOD_TABLE, GOOD_TABLE])).toMatchObject({
      ok: false,
      reason: 'duplicate_table',
      table: GOOD_TABLE,
    });
    expect(await validate(['room_phones'])).toMatchObject({ ok: false, reason: 'table_reserved' });
    expect(await validate(['rooms'])).toMatchObject({ ok: false, reason: 'table_reserved' });
    expect(await validate(null)).toMatchObject({ ok: false, reason: 'no_tables' });
  });

  it('room_validate_tables names exactly what a bad table is missing', async () => {
    expect(await validate(['no_such_table'])).toMatchObject({
      ok: false,
      reason: 'table_not_ready',
      table: 'no_such_table',
      missing: 'table',
    });
    expect(await validate([BAD_TABLES.textId])).toMatchObject({ missing: 'room_id_uuid' });
    expect(await validate([BAD_TABLES.noFk])).toMatchObject({ missing: 'cascade_fk' });
    expect(await validate([BAD_TABLES.unpublished])).toMatchObject({ missing: 'publication' });
    expect(await validate([BAD_TABLES.defaultReplica])).toMatchObject({ missing: 'replica_identity' });
  });

  it('no room RPC is executable by anon; the client-facing ones are by authenticated', async () => {
    const sigs = [
      'public.create_room(text,text[],uuid,jsonb,boolean)',
      'public.join_room(uuid,uuid)',
      'public.room_heartbeat(uuid,uuid)',
      'public.set_room_game(uuid,text,text[],jsonb)',
      'public.set_room_settings(uuid,jsonb)',
      'public.set_room_shared(uuid,boolean)',
      'public.close_room(uuid)',
      'public.get_room_by_token(uuid)',
      'public.get_room(uuid)',
    ];
    for (const sig of sigs) {
      const rows = await executeSql(
        `SELECT has_function_privilege('anon', $1, 'EXECUTE') AS anon,
                has_function_privilege('authenticated', $1, 'EXECUTE') AS authed`,
        [sig]
      );
      expect(rows[0].anon, sig).toBe(false);
      expect(rows[0].authed, sig).toBe(true);
    }
    // Internal helpers: not even authenticated.
    const helper = await executeSql(
      `SELECT has_function_privilege('authenticated', 'public.room_validate_tables(text[])', 'EXECUTE') AS authed`
    );
    expect(helper[0].authed).toBe(false);
  });
});
