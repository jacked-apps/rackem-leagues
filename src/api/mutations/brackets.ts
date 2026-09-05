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
