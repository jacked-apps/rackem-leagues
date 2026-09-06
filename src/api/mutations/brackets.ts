/**
 * @fileoverview Write operations for the tournament bracket tool (Free Tier v1).
 *
 * Plain async functions calling supabase (mirrors mutations/leagues.ts); the
 * two multi-row / atomic operations (start, advance) delegate to SECURITY
 * DEFINER RPCs (start_bracket, advance_bracket_winner) so persistence is
 * transactional and advancement is race-guarded.
 *
 * Seeding-mode resolution happens HERE (once) before generation, so a persisted
 * bracket is never re-derived — "random" is frozen into the stored seed order.
 */

import { supabase } from '@/supabaseClient';
import { generateBracket } from '@/utils/bracket/generateBracket';
import type { BracketFormat, SeedingMode, GeneratedMatch } from '@/types/bracket';
import type { BracketRow } from '@/api/queries/brackets';

/** A participant name as entered by the organizer, in their listed order. */
export interface NewParticipant {
  displayName: string;
  /** Reserved paid-aware hook — a real member id, or null (free tier). */
  memberId?: string | null;
}

export interface CreateBracketParams {
  name: string;
  format: BracketFormat;
  seedingMode: SeedingMode;
  grandFinalReset?: boolean;
  /** The creating member's id (from useCurrentMember) → brackets.created_by. */
  createdBy: string;
  // ── Paid tier (all optional; omitted = a free tournament) ──────────────────
  /** Checked premium features. Non-empty ⇒ the DB forces tier='paid'. */
  premiumFeatures?: string[];
  /** The tournament's game type (e.g. 'eight_ball'), or null. */
  gameType?: string | null;
  /** The player card-on-file (payment_methods.id) charged at Start, or null. */
  paymentMethodId?: string | null;
}

/**
 * Opportunistic janitor: hard-delete (cascade) closed or long-idle brackets so
 * the ephemeral tool never accumulates rows. Best-effort — a sweep failure must
 * not block creating a bracket, so errors are swallowed.
 */
export async function sweepStaleBrackets(): Promise<void> {
  try {
    await supabase.rpc('sweep_stale_brackets', { p_idle_days: 7 });
  } catch {
    // Non-fatal: cleanup is opportunistic, creation proceeds regardless.
  }
}

/**
 * Create a bracket in `setup` status. Participants + tree come later (via
 * setParticipants → startBracket). share_token is DB-generated.
 *
 * Sweeps stale brackets first (cleanup-on-create) — the ephemeral tool's
 * janitor, so nothing lingers without any scheduled job.
 */
export async function createBracket(params: CreateBracketParams): Promise<BracketRow> {
  await sweepStaleBrackets();

  const premiumFeatures = params.premiumFeatures ?? [];
  const { data, error } = await supabase
    .from('brackets')
    .insert({
      name: params.name,
      format: params.format,
      seeding_mode: params.seedingMode,
      grand_final_reset: params.grandFinalReset ?? false,
      created_by: params.createdBy,
      // Paid tier: any premium feature checked ⇒ paid (the DB CHECK also enforces this).
      tier: premiumFeatures.length > 0 ? 'paid' : 'free',
      premium_features: premiumFeatures,
      game_type: params.gameType ?? null,
      payment_method_id: params.paymentMethodId ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create bracket: ${error.message}`);
  return data;
}

/**
 * Resolve the listed participants into a seed order per the bracket's seeding
 * mode, then persist them (seed 1..N). Replaces any existing participants.
 *
 * - seeded: keep the organizer's listed order (seed = position).
 * - random: Fisher–Yates shuffle, frozen here so it's never re-derived.
 *
 * @param shuffle injectable RNG-order for deterministic tests; defaults to a
 *   real shuffle. Returns a new array; does not mutate the input.
 */
export async function setParticipants(
  bracketId: string,
  participants: NewParticipant[],
  seedingMode: SeedingMode,
  shuffle: <T>(items: T[]) => T[] = fisherYates
): Promise<void> {
  const ordered = seedingMode === 'random' ? shuffle(participants) : participants;

  const rows = ordered.map((p, i) => ({
    bracket_id: bracketId,
    display_name: p.displayName,
    seed: i + 1,
    member_id: p.memberId ?? null,
  }));

  // Replace-then-insert (setup phase only; disposable data, no history).
  const del = await supabase.from('bracket_participants').delete().eq('bracket_id', bracketId);
  if (del.error) throw new Error(`Failed to reset participants: ${del.error.message}`);

  const ins = await supabase.from('bracket_participants').insert(rows);
  if (ins.error) throw new Error(`Failed to set participants: ${ins.error.message}`);

  await touchBracket(bracketId);
}

/**
 * Generate the match tree from the persisted participants and go live, in one
 * atomic RPC call. The engine works on seed positions; the RPC maps seeds →
 * participant uuids and its own local keys → match uuids.
 */
export async function startBracket(
  bracketId: string,
  format: BracketFormat,
  grandFinalReset: boolean,
  participantCount: number
): Promise<void> {
  const tree = generateBracket(participantCount, { format, grandFinalReset });

  const { error } = await supabase.rpc('start_bracket', {
    p_bracket_id: bracketId,
    p_matches: tree.map(toRpcMatch),
  });
  if (error) throw new Error(`Failed to start bracket: ${error.message}`);
}

/**
 * Charge-at-checkout seam (A3). Records the (currently $0) charge for a paid
 * tournament at Start — sets `charged_at` + `charge_amount_cents`.
 *
 * THIS is the single spot Jack swaps for a real charge: charge
 * `brackets.payment_method_id` for `amountCents` via Stripe, then record it. $0
 * mock today — no money moves, we just record that checkout happened. Called
 * AFTER a successful start, so a failed start can never leave a
 * charged-but-not-started bracket (real-money ordering; harmless at $0).
 */
export async function chargeForStart(bracketId: string, amountCents: number): Promise<void> {
  // TODO(payments): real charge of brackets.payment_method_id for amountCents (Stripe).
  //   Beta comp: if the card's token is a MOCK (tok_mock_%), SKIP the charge and
  //   mark paid — beta users grandfather in free. See LIST_FOR_ED.md.
  const { error } = await supabase
    .from('brackets')
    .update({ charged_at: new Date().toISOString(), charge_amount_cents: amountCents })
    .eq('id', bracketId);
  if (error) throw new Error(`Failed to record charge: ${error.message}`);
}

/**
 * Record a match winner (the guarded advance). Returns true if it advanced,
 * false if it was a no-op (already decided / not ready — the concurrency +
 * idempotency guard in advance_bracket_winner).
 */
export async function advanceWinner(
  matchId: string,
  winnerParticipantId: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc('advance_bracket_winner', {
    p_match_id: matchId,
    p_winner_participant_id: winnerParticipantId,
  });
  if (error) throw new Error(`Failed to advance winner: ${error.message}`);
  return data === true;
}

/**
 * Mark a ready match as being played now (or back to on-deck). Organizer aid
 * only — informational, does not gate scoring. A simple flag update.
 */
export async function setMatchInProgress(
  matchId: string,
  inProgress: boolean
): Promise<void> {
  const { error } = await supabase
    .from('bracket_matches')
    .update({ in_progress: inProgress })
    .eq('id', matchId);
  if (error) throw new Error(`Failed to update match: ${error.message}`);
}

/**
 * Entry-fee tracker (the `payment_tracker` feature): flip a player's
 * organizer-asserted paid/unpaid flag. Cash is collected outside the app — this
 * is just the checklist. Bumps the bracket's activity so it isn't swept mid-use.
 */
export async function setEntryFeePaid(
  participantId: string,
  bracketId: string,
  paid: boolean
): Promise<void> {
  const { error } = await supabase
    .from('bracket_participants')
    .update({ entry_fee_paid: paid })
    .eq('id', participantId);
  if (error) throw new Error(`Failed to update entry-fee status: ${error.message}`);
  await touchBracket(bracketId);
}

// ── Hopper management (Phase C) ──────────────────────────────────────────────

/** Result of a self-add join (join_bracket_hopper RPC). */
export interface JoinHopperResult {
  ok: boolean;
  reason?: 'not_found' | 'not_accepting' | 'not_signed_in' | 'name_taken';
  status?: string;
  /** For `name_taken`: the name the caller tried to join under. */
  name?: string;
  /** True when the caller was already in this hopper — a silent no-op. */
  already_in?: boolean;
  bracket_id?: string;
  bracket_name?: string;
}

/**
 * Postgres unique-violation code. A name collision in the hopper surfaces as a
 * raw constraint error, which is useless to an organizer, so callers translate
 * it into the sentence that says what to do about it.
 */
const UNIQUE_VIOLATION = '23505';

/**
 * Self-add: the signed-in caller adds THEMSELVES to a tournament's hopper via its
 * join_token (from a scanned QR / opened link). Records only the caller's own
 * identity; a repeat join is a no-op.
 */
export async function joinHopper(
  joinToken: string,
  via: 'link' | 'qr' = 'link'
): Promise<JoinHopperResult> {
  const { data, error } = await supabase.rpc('join_bracket_hopper', {
    p_join_token: joinToken,
    p_via: via,
  });
  if (error) throw new Error(`Failed to join: ${error.message}`);
  return data as JoinHopperResult;
}

export interface SelfWalkupResult {
  ok: boolean;
  reason?: 'name_required' | 'name_too_long' | 'not_found' | 'not_accepting' | 'full' | 'name_taken';
  name?: string;
  max?: number;
  status?: string;
  bracket_name?: string;
}

/**
 * Anonymous self-add: someone with no account types their name on the
 * tournament page and lands in the waiting room.
 *
 * Every rule (setup only, entry cap, name length, one name per tournament) is
 * enforced by the RPC, not here — an input box is trivially bypassed. Failures
 * come back as a `reason` for the page to phrase, never as a thrown error,
 * because losing a name race is an ordinary outcome rather than a fault.
 */
export async function addSelfAsWalkup(
  joinToken: string,
  displayName: string
): Promise<SelfWalkupResult> {
  const { data, error } = await supabase.rpc('add_self_as_walkup', {
    p_join_token: joinToken,
    p_display_name: displayName,
  });
  if (error) throw new Error(`Could not add your name: ${error.message}`);
  return data as SelfWalkupResult;
}

/**
 * Add a WALK-UP to the hopper (member_id NULL — a disposable tournament entrant).
 *
 * A name can only appear once per tournament (first come, first served), so a
 * collision is an expected outcome here rather than a fault — it gets the
 * plain-language message instead of a constraint error.
 */
export async function addWalkupToHopper(
  bracketId: string,
  displayName: string,
  addedVia: 'search' | 'link' | 'qr' = 'search'
): Promise<void> {
  const name = displayName.trim();
  const { error } = await supabase.from('bracket_hopper').insert({
    bracket_id: bracketId,
    display_name: name,
    added_via: addedVia,
  });
  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      throw new Error(`${name} is already on this list — use a different name.`);
    }
    throw new Error(`Failed to add walk-up: ${error.message}`);
  }
  await touchBracket(bracketId);
}

/**
 * Add a REGISTERED player (a real member) to the hopper.
 *
 * Same one-name-per-tournament rule as a walk-up, but the remedy differs: this
 * player's name comes from their profile, so they change their nickname there
 * rather than the organizer picking a different one for them.
 */
export async function addRegisteredToHopper(
  bracketId: string,
  memberId: string,
  displayName: string,
  addedVia: 'search' | 'link' | 'qr' = 'search'
): Promise<void> {
  const { error } = await supabase.from('bracket_hopper').insert({
    bracket_id: bracketId,
    member_id: memberId,
    display_name: displayName.trim(),
    added_via: addedVia,
  });
  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      throw new Error(
        `Someone is already on this list as ${displayName.trim()}. They'll need to change their nickname in their profile first.`
      );
    }
    throw new Error(`Failed to add player: ${error.message}`);
  }
  await touchBracket(bracketId);
}

/**
 * Admit a hopper entry to the official list (status → 'official'), with the
 * organizer-asserted paid/unpaid flag. The roster trigger records a registered
 * player automatically.
 */
export async function admitHopperEntry(
  entryId: string,
  bracketId: string,
  paidStatus: 'paid' | 'unpaid'
): Promise<void> {
  const { error } = await supabase
    .from('bracket_hopper')
    .update({ status: 'official', paid_status: paidStatus })
    .eq('id', entryId);
  if (error) throw new Error(`Failed to admit entry: ${error.message}`);
  await touchBracket(bracketId);
}

/** Update just the paid/unpaid flag on a hopper entry. */
export async function setHopperPaidStatus(
  entryId: string,
  bracketId: string,
  paidStatus: 'paid' | 'unpaid'
): Promise<void> {
  const { error } = await supabase
    .from('bracket_hopper')
    .update({ paid_status: paidStatus })
    .eq('id', entryId);
  if (error) throw new Error(`Failed to update paid status: ${error.message}`);
  await touchBracket(bracketId);
}

/**
 * Housekeeping: drop ONE person from the organizer's remembered past players.
 *
 * @param target - A registered player (`memberId`) or a remembered walk-up
 *   (`displayName`). The RPC resolves the organizer from the session, so this
 *   can only ever touch the caller's own list.
 * @returns true if a row was removed; false if there was nothing there (a
 *   double tap is a no-op, not an error).
 */
export async function forgetRosterEntry(target: {
  memberId?: string | null;
  displayName?: string | null;
}): Promise<boolean> {
  const { data, error } = await supabase.rpc('forget_bracket_roster_entry', {
    p_member_id: target.memberId ?? undefined,
    p_display_name: target.displayName ?? undefined,
  });
  if (error) throw new Error(`Could not update your past players: ${error.message}`);
  return data === true;
}

/** The settings an organizer can change before a tournament starts. */
export interface BracketSettings {
  name: string;
  format: BracketFormat;
  grandFinalReset: boolean;
  gameType: string | null;
}

/**
 * Update a tournament's settings.
 *
 * Guarded to `status = 'setup'` in the WHERE clause, not just the UI: the match
 * tree is generated FROM the format, so changing it after the bracket exists
 * would leave the stored tree describing a tournament that no longer matches
 * its own rules. The guard makes that impossible rather than unlikely.
 */
export async function updateBracketSettings(
  bracketId: string,
  settings: BracketSettings
): Promise<void> {
  const { data, error } = await supabase
    .from('brackets')
    .update({
      name: settings.name.trim(),
      format: settings.format,
      grand_final_reset: settings.grandFinalReset,
      game_type: settings.gameType,
    })
    .eq('id', bracketId)
    .eq('status', 'setup')
    .select('id');

  if (error) throw new Error(`Could not save the tournament: ${error.message}`);
  // No row matched: the status guard rejected it, i.e. it already started.
  if (!data || data.length === 0) {
    throw new Error('This tournament has already started, so its settings are locked.');
  }
  await touchBracket(bracketId);
}

/**
 * Convert a paid tournament's official hopper list into seeded participants,
 * ready for the tree generator. Returns the player count.
 *
 * @param includeWaiting - Also admit everyone still in the waiting room, as
 *   unpaid. The organizer opts into this at Start; it is never automatic,
 *   because a QR on a flyer means the waiting room can hold someone who
 *   scanned out of curiosity and left.
 */
export async function finalizeHopper(
  bracketId: string,
  includeWaiting: boolean
): Promise<number> {
  const { data, error } = await supabase.rpc('finalize_bracket_hopper', {
    p_bracket_id: bracketId,
    p_include_waiting: includeWaiting,
  });
  // The RPC's exceptions are written as organizer-facing sentences
  // ("Add at least 2 players before starting"), so surface them as-is.
  if (error) throw new Error(error.message);
  return (data as number | null) ?? 0;
}

/** Eject an entry from the hopper (delete). The roster (sticky) is untouched. */
export async function ejectHopperEntry(entryId: string, bracketId: string): Promise<void> {
  const { error } = await supabase.from('bracket_hopper').delete().eq('id', entryId);
  if (error) throw new Error(`Failed to eject entry: ${error.message}`);
  await touchBracket(bracketId);
}

/**
 * Reopen a decided match (undo a mis-tapped winner). Clears the winner and
 * pulls the advanced player/loser back out of the next matches. Throws with a
 * user-facing message if a downstream match was already played (reopen that
 * one first). Returns true if it reopened, false if the match wasn't complete.
 */
export async function reopenMatch(matchId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('reopen_bracket_match', {
    p_match_id: matchId,
  });
  if (error) throw new Error(error.message);
  return data === true;
}

/**
 * Close a bracket — a `status='closed'` tombstone (NOT a hard delete). The
 * shared link keeps resolving until the inactivity sweep (Unit 7) removes it.
 */
export async function closeBracket(bracketId: string): Promise<void> {
  const { error } = await supabase
    .from('brackets')
    .update({ status: 'closed', last_activity_at: new Date().toISOString() })
    .eq('id', bracketId);
  if (error) throw new Error(`Failed to close bracket: ${error.message}`);
}

// ── helpers ────────────────────────────────────────────────────────────────

/** Bump last_activity_at so a bracket mid-setup is never swept. */
async function touchBracket(bracketId: string): Promise<void> {
  await supabase
    .from('brackets')
    .update({ last_activity_at: new Date().toISOString() })
    .eq('id', bracketId);
}

/** Map the engine's camelCase match to the snake_case jsonb the RPC expects. */
function toRpcMatch(m: GeneratedMatch) {
  return {
    key: m.key,
    round: m.round,
    side: m.side,
    slot: m.slot,
    home_seed: m.homeSeed,
    away_seed: m.awaySeed,
    winner_seed: m.winnerSeed,
    status: m.status,
    next_match_key: m.nextMatchKey,
    next_match_slot: m.nextMatchSlot,
    loser_next_match_key: m.loserNextMatchKey,
    loser_next_match_slot: m.loserNextMatchSlot,
    is_reset_match: m.isResetMatch,
  };
}

/** Pure Fisher–Yates returning a new array (default shuffle for random seeding). */
function fisherYates<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
