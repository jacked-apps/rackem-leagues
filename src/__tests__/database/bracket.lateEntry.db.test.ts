/**
 * @fileoverview DB tests for add_late_entry — seating a latecomer in a bye.
 *
 * The two conditions are the whole feature: there must be a bye, and its
 * recipient must not have played OR started their next match. Everything else
 * is refusal handling.
 *
 * Plus the sign-up row, which is not cosmetic: the player-facing view builds
 * its lists from `bracket_hopper`, and `JoinHopperPage` wipes a player's
 * remembered name when those lists no longer back it up. A latecomer written
 * only into `bracket_participants` is therefore locked out of the page for a
 * tournament they are actively playing in.
 *
 * Runs in the `db` vitest project (sequential) against local Postgres via raw pg.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { executeSql, closePostgresPool } from '@/test/dbTestUtils';

describe('add_late_entry', () => {
  let organizerId: string;
  const bracketIds: string[] = [];

  /** A live paid bracket with one bye: Slim waiting, an empty seat, feeding R2. */
  async function makeBracketWithBye(tier = 'paid') {
    const b = await executeSql(
      `INSERT INTO public.brackets (name, format, created_by, status, tier, premium_features)
       VALUES ('Late Entry Test', 'single_elimination', $1, 'live', $2,
               CASE WHEN $2 = 'paid' THEN ARRAY['real_players']::text[] ELSE ARRAY[]::text[] END)
       RETURNING id`,
      [organizerId, tier]
    );
    const bracketId = b[0].id as string;
    bracketIds.push(bracketId);

    const p = await executeSql(
      `INSERT INTO public.bracket_participants (bracket_id, display_name, seed, entry_fee_paid)
       VALUES ($1, 'Slim', 1, false) RETURNING id`,
      [bracketId]
    );
    const slimId = p[0].id as string;

    // Round 2 first, so the bye can point at it.
    const r2 = await executeSql(
      `INSERT INTO public.bracket_matches
         (bracket_id, round, side, slot, home_participant_id, status)
       VALUES ($1, 2, 'winners', 0, $2, 'pending') RETURNING id`,
      [bracketId, slimId]
    );
    const nextId = r2[0].id as string;

    const bye = await executeSql(
      `INSERT INTO public.bracket_matches
         (bracket_id, round, side, slot, home_participant_id, winner_participant_id,
          status, next_match_id, next_match_slot)
       VALUES ($1, 1, 'winners', 0, $2, $2, 'complete', $3, 'home') RETURNING id`,
      [bracketId, slimId, nextId]
    );
    return { bracketId, slimId, byeId: bye[0].id as string, nextId };
  }

  async function lateEntry(matchId: string, name: string | null, memberId: string | null = null) {
    const rows = await executeSql(
      `SELECT public.add_late_entry($1::uuid, $2::uuid, $3::text) AS r`,
      [matchId, memberId, name]
    );
    return rows[0].r as Record<string, unknown>;
  }

  beforeAll(async () => {
    const m = await executeSql(`SELECT id FROM public.members LIMIT 1`);
    organizerId = m[0].id;
  });

  afterAll(async () => {
    if (bracketIds.length > 0) {
      await executeSql(`DELETE FROM public.brackets WHERE id = ANY($1::uuid[])`, [bracketIds]);
    }
    await closePostgresPool();
  });

  it('seats a latecomer in the bye and turns it into a real match', async () => {
    const { byeId, nextId, slimId } = await makeBracketWithBye();
    const result = await lateEntry(byeId, 'Rocket');
    expect(result.ok).toBe(true);

    const bye = await executeSql(
      `SELECT home_participant_id, away_participant_id, winner_participant_id, status
         FROM public.bracket_matches WHERE id = $1`,
      [byeId]
    );
    // Both seats filled, nobody has won yet — a game to actually play.
    expect(bye[0].away_participant_id).toBe(result.participant_id);
    expect(bye[0].home_participant_id).toBe(slimId);
    expect(bye[0].winner_participant_id).toBeNull();
    expect(bye[0].status).toBe('ready');

    // Slim is pulled back out of round 2 — he has to earn it now.
    const next = await executeSql(
      `SELECT home_participant_id, status FROM public.bracket_matches WHERE id = $1`,
      [nextId]
    );
    expect(next[0].home_participant_id).toBeNull();
  });

  it('refuses once the bye recipient has PLAYED their next match', async () => {
    const { byeId, nextId } = await makeBracketWithBye();
    await executeSql(`UPDATE public.bracket_matches SET status = 'complete' WHERE id = $1`, [
      nextId,
    ]);

    const result = await lateEntry(byeId, 'Rocket');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('already_played');
  });

  it('refuses once that match has STARTED, even though it is unfinished', async () => {
    // You cannot pull someone off a live table to play a round they passed.
    const { byeId, nextId } = await makeBracketWithBye();
    await executeSql(`UPDATE public.bracket_matches SET in_progress = true WHERE id = $1`, [
      nextId,
    ]);

    const result = await lateEntry(byeId, 'Rocket');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('already_started');
  });

  it('changes nothing when it refuses', async () => {
    const { byeId, nextId } = await makeBracketWithBye();
    await executeSql(`UPDATE public.bracket_matches SET in_progress = true WHERE id = $1`, [
      nextId,
    ]);
    await lateEntry(byeId, 'Rocket');

    const bye = await executeSql(
      `SELECT winner_participant_id, status FROM public.bracket_matches WHERE id = $1`,
      [byeId]
    );
    expect(bye[0].status).toBe('complete'); // still a bye
    expect(bye[0].winner_participant_id).not.toBeNull();
  });

  it('refuses a free tournament — this is a paid extra', async () => {
    const { byeId } = await makeBracketWithBye('free');
    expect((await lateEntry(byeId, 'Rocket')).reason).toBe('not_premium');
  });

  it('refuses a match that is not a bye', async () => {
    const { bracketId, slimId } = await makeBracketWithBye();
    const real = await executeSql(
      `INSERT INTO public.bracket_matches
         (bracket_id, round, side, slot, home_participant_id, away_participant_id, status)
       VALUES ($1, 1, 'winners', 1, $2, $2, 'ready') RETURNING id`,
      [bracketId, slimId]
    );
    expect((await lateEntry(real[0].id, 'Rocket')).reason).toBe('not_a_bye');
  });

  it('refuses a name already in the tournament', async () => {
    const { byeId } = await makeBracketWithBye();
    const result = await lateEntry(byeId, '  slim  ');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('name_taken');
  });

  it('refuses an empty name', async () => {
    const { byeId } = await makeBracketWithBye();
    expect((await lateEntry(byeId, '   ')).reason).toBe('name_required');
  });

  it('seats a registered player under their profile name', async () => {
    const authed = await executeSql(
      `SELECT id, COALESCE(NULLIF(btrim(nickname), ''),
              NULLIF(btrim(concat_ws(' ', first_name, last_name)), ''), 'Player') AS name
         FROM public.members WHERE user_id IS NOT NULL LIMIT 1`
    );
    if (authed.length === 0) return;

    const { byeId } = await makeBracketWithBye();
    const result = await lateEntry(byeId, null, authed[0].id);
    expect(result.ok).toBe(true);
    expect(result.name).toBe(authed[0].name);
  });

  it('gives the latecomer the last seed — seeding is frozen at start', async () => {
    const { bracketId, byeId } = await makeBracketWithBye();
    await lateEntry(byeId, 'Rocket');

    const rows = await executeSql(
      `SELECT display_name, seed FROM public.bracket_participants
        WHERE bracket_id = $1 ORDER BY seed`,
      [bracketId]
    );
    expect(rows[rows.length - 1].display_name).toBe('Rocket');
  });

  // --- the sign-up row -----------------------------------------------------

  it('gives the latecomer a sign-up row, so their own phone can see them', async () => {
    const { bracketId, byeId } = await makeBracketWithBye();
    const result = await lateEntry(byeId, 'Rocket');
    expect(result.ok).toBe(true);

    const hopper = await executeSql(
      `SELECT display_name, status, seed, paid_status, member_id
         FROM public.bracket_hopper
        WHERE bracket_id = $1 AND lower(btrim(display_name)) = 'rocket'`,
      [bracketId]
    );
    // Without this row get_bracket_player_view never lists them, JoinHopperPage
    // concludes they were removed, and add_self_as_walkup refuses to let them
    // back in because the bracket is live.
    expect(hopper.length).toBe(1);
    expect(hopper[0].status).toBe('official');
    expect(hopper[0].paid_status).toBe('unpaid');
    expect(hopper[0].member_id).toBeNull();
  });

  it('shows the latecomer in the player view, not just the bracket', async () => {
    const { bracketId, byeId } = await makeBracketWithBye();
    await executeSql(
      `UPDATE public.brackets SET join_token = gen_random_uuid() WHERE id = $1`,
      [bracketId]
    );
    await lateEntry(byeId, 'Rocket');

    const view = await executeSql(
      `SELECT public.get_bracket_player_view(join_token) AS v
         FROM public.brackets WHERE id = $1`,
      [bracketId]
    );
    const official = (view[0].v as { official: string[] }).official;
    // This is the assertion the bug actually broke — the end-to-end one.
    expect(official).toContain('Rocket');
  });

  it('admits the waiting player rather than colliding with their row', async () => {
    const { bracketId, byeId } = await makeBracketWithBye();
    // Someone who signed up before the start and was never let in. They have a
    // hopper row and no participant row — the likeliest latecomer of all,
    // since they were standing there the whole time.
    await executeSql(
      `INSERT INTO public.bracket_hopper (bracket_id, display_name, status)
       VALUES ($1, 'Rocket', 'hopper')`,
      [bracketId]
    );

    const result = await lateEntry(byeId, 'Rocket');
    expect(result.ok).toBe(true);

    const hopper = await executeSql(
      `SELECT status, seed FROM public.bracket_hopper
        WHERE bracket_id = $1 AND lower(btrim(display_name)) = 'rocket'`,
      [bracketId]
    );
    // One row, promoted — not a second row, and not a unique-violation crash.
    expect(hopper.length).toBe(1);
    expect(hopper[0].status).toBe('official');
    expect(hopper[0].seed).not.toBeNull();
  });

  it('admits a registered player’s waiting row by who they are, not by name', async () => {
    const { bracketId, byeId } = await makeBracketWithBye();
    const member = await executeSql(
      `SELECT id FROM public.members WHERE user_id IS NOT NULL ORDER BY id LIMIT 1`
    );
    const memberId = member[0].id as string;
    // Their sign-up row carries an older name than their profile does now.
    await executeSql(
      `INSERT INTO public.bracket_hopper (bracket_id, member_id, display_name, status)
       VALUES ($1, $2, 'Old Name', 'hopper')`,
      [bracketId, memberId]
    );

    const result = await lateEntry(byeId, null, memberId);
    expect(result.ok).toBe(true);

    const rows = await executeSql(
      `SELECT display_name, status FROM public.bracket_hopper WHERE bracket_id = $1 AND member_id = $2`,
      [bracketId, memberId]
    );
    expect(rows.length).toBe(1);
    expect(rows[0].status).toBe('official');
    // Matched on identity, and the name brought in line with their profile.
    expect(rows[0].display_name).toBe(result.name);
  });

  it('keeps the spelling the PLAYER typed, not the organizer’s', async () => {
    const { bracketId, byeId } = await makeBracketWithBye();
    // The player signed up as "Rocket"; their phone remembers exactly that.
    await executeSql(
      `INSERT INTO public.bracket_hopper (bracket_id, display_name, status)
       VALUES ($1, 'Rocket', 'hopper')`,
      [bracketId]
    );

    // The organizer types it back in lowercase, as people do.
    const result = await lateEntry(byeId, 'rocket');
    expect(result.ok).toBe(true);

    const hopper = await executeSql(
      `SELECT display_name FROM public.bracket_hopper WHERE bracket_id = $1`,
      [bracketId]
    );
    // JoinHopperPage compares the remembered name to this list with an exact
    // string match, so "rocket" here would wipe their note and lock them out
    // just as surely as having no row at all.
    expect(hopper[0].display_name).toBe('Rocket');

    const participant = await executeSql(
      `SELECT display_name FROM public.bracket_participants WHERE id = $1`,
      [result.participant_id]
    );
    // And the bracket agrees with the sign-up list rather than disagreeing.
    expect(participant[0].display_name).toBe('Rocket');
  });

  it('refuses when the name belongs to somebody else’s sign-up row', async () => {
    const { bracketId, byeId } = await makeBracketWithBye();
    const member = await executeSql(
      `SELECT id FROM public.members WHERE user_id IS NOT NULL ORDER BY id LIMIT 1`
    );
    // A REGISTERED player is waiting under this name. A walk-up typing the same
    // name is a different person, so their row must not be handed over.
    await executeSql(
      `INSERT INTO public.bracket_hopper (bracket_id, member_id, display_name, status)
       VALUES ($1, $2, 'Rocket', 'hopper')`,
      [bracketId, member[0].id]
    );

    const result = await lateEntry(byeId, 'Rocket');
    expect(result.ok).toBe(false);
    // Distinct from name_taken: they are on the sign-up list, NOT in the
    // bracket, and an organizer sent looking in the bracket won't find them.
    expect(result.reason).toBe('name_waiting');

    const participants = await executeSql(
      `SELECT count(*)::int AS n FROM public.bracket_participants WHERE bracket_id = $1`,
      [bracketId]
    );
    expect(participants[0].n).toBe(1); // refusal wrote nothing
  });
});
