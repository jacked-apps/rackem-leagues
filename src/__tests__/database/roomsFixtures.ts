/**
 * @fileoverview Shared fixtures for the Game Room db tests (Unit 1).
 *
 * The room RPCs resolve the caller from `auth.uid()`, so the happy paths run
 * through REAL authenticated supabase-js clients (`operator@test.com` is a
 * league_operator → passes the host gate; `player@test.com` is a plain
 * player → does not). Raw `executeSql` runs as postgres (auth.uid() NULL) and
 * is used for fixtures, ground-truth assertions, and the not-signed-in branch.
 *
 * Fixture game tables: the plug-in contract says a game table must have a uuid
 * `room_id` with a cascade FK to rooms, be in the realtime publication, and
 * have REPLICA IDENTITY FULL. `room_test_widgets` satisfies all of that; the
 * others each break exactly one rule so `room_validate_tables` can be pinned.
 * All are dropped in `dropRoomFixtureTables`.
 *
 * Not a test file (no `.test.` in the name) — vitest's db project only picks up
 * `src/__tests__/database/**\/*.test.ts`.
 */

import { randomUUID } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/types/database.types';
import { executeSql } from '@/test/dbTestUtils';

/** The always-valid fixture game table. */
export const GOOD_TABLE = 'room_test_widgets';

/** Fixture tables that each violate one rule of the plug-in contract. */
export const BAD_TABLES = {
  noFk: 'room_test_nofk',
  textId: 'room_test_textid',
  unpublished: 'room_test_unpublished',
  defaultReplica: 'room_test_defreplica',
} as const;

const PUBLISH = (t: string) => `
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                   WHERE pubname = 'supabase_realtime' AND tablename = '${t}') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE ${t};
    END IF;
  END $$;`;

/** Create every fixture table. Idempotent. */
export async function createRoomFixtureTables(): Promise<void> {
  await executeSql(`
    CREATE TABLE IF NOT EXISTS public.${GOOD_TABLE} (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
      label text
    );
    ${PUBLISH(GOOD_TABLE)}
    ALTER TABLE public.${GOOD_TABLE} REPLICA IDENTITY FULL;

    CREATE TABLE IF NOT EXISTS public.${BAD_TABLES.noFk} (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), room_id uuid NOT NULL
    );
    ${PUBLISH(BAD_TABLES.noFk)}
    ALTER TABLE public.${BAD_TABLES.noFk} REPLICA IDENTITY FULL;

    CREATE TABLE IF NOT EXISTS public.${BAD_TABLES.textId} (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), room_id text NOT NULL
    );
    ${PUBLISH(BAD_TABLES.textId)}
    ALTER TABLE public.${BAD_TABLES.textId} REPLICA IDENTITY FULL;

    CREATE TABLE IF NOT EXISTS public.${BAD_TABLES.unpublished} (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE
    );
    ALTER TABLE public.${BAD_TABLES.unpublished} REPLICA IDENTITY FULL;

    CREATE TABLE IF NOT EXISTS public.${BAD_TABLES.defaultReplica} (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE
    );
    ${PUBLISH(BAD_TABLES.defaultReplica)}
  `);
}

/** Drop every fixture table (dropping a published table also unpublishes it). */
export async function dropRoomFixtureTables(): Promise<void> {
  const all = [GOOD_TABLE, ...Object.values(BAD_TABLES)];
  await executeSql(all.map((t) => `DROP TABLE IF EXISTS public.${t};`).join('\n'));
}

/** Delete every room hosted by these members (cascade clears the rest). */
export async function deleteRoomsHostedBy(memberIds: string[]): Promise<void> {
  await executeSql(`DELETE FROM public.rooms WHERE host_member_id = ANY($1::uuid[])`, [memberIds]);
}

/** A fresh device id — a seat is a device, so tests mint these freely. */
export const newDevice = (): string => randomUUID();

/**
 * A jsonb RPC result as the tests read it. The RPCs return free-form
 * {ok, reason, ...} objects, so the shape is deliberately loose here — the
 * assertions are what pin it.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- jsonb from an RPC; assertions pin the shape
export type Jsonb = Record<string, any>;

/** Call an RPC and hand back its jsonb, throwing on transport errors. */
export async function rpc(
  client: SupabaseClient<Database>,
  fn: string,
  args: Record<string, Json | undefined>
): Promise<Jsonb> {
  // The generated Database type narrows `fn` to known names; the tests pass
  // real names, so the loosened signature here is only about ergonomics.
  const loose = client as unknown as {
    rpc: (name: string, params: unknown) => Promise<{ data: unknown; error: { message: string } | null }>;
  };
  const { data, error } = await loose.rpc(fn, args);
  if (error) throw new Error(`${fn} transport error: ${error.message}`);
  return data as Jsonb;
}

/** Create a room as `client`; returns {room_id, join_token}. Throws unless ok. */
export async function createRoomAs(
  client: SupabaseClient<Database>,
  opts: { shared?: boolean; tables?: string[]; device?: string; game?: string } = {}
): Promise<{ room_id: string; join_token: string; device: string }> {
  const device = opts.device ?? newDevice();
  const r = await rpc(client, 'create_room', {
    p_game_key: opts.game ?? 'test_game',
    p_tables: opts.tables ?? [GOOD_TABLE],
    p_device_id: device,
    p_settings: {},
    p_shared: opts.shared ?? false,
  });
  if (!r.ok) throw new Error(`create_room failed: ${JSON.stringify(r)}`);
  return { room_id: r.room_id, join_token: r.join_token, device };
}
