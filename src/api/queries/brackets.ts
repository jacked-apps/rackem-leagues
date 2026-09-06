/**
 * @fileoverview Read queries for the tournament bracket tool (Free Tier v1).
 *
 * Two reads live here:
 *  - getBracket(id): the authed organizer's full view (direct table selects).
 *  - getBracketShare(shareToken): the PUBLIC read, via the get_bracket_share
 *    SECURITY DEFINER RPC — names only, the authorization boundary while RLS is
 *    off (mirrors getTeamJoinView). Kept in this same file per review (no
 *    single-export share file).
 */

import { supabase } from '@/supabaseClient';
import type { Tables } from '@/types/database.types';

export type BracketRow = Tables<'brackets'>;
export type BracketParticipantRow = Tables<'bracket_participants'>;
export type BracketMatchRow = Tables<'bracket_matches'>;

/**
 * A hopper entry as returned by the `get_bracket_hopper` RPC — the hopper row
 * plus (for registered players) the joined member fields for display +
 * same-name disambiguation. Walk-ups have `member_id` NULL and null member fields.
 */
export interface HopperEntry {
  id: string;
  member_id: string | null;
  display_name: string;
  status: 'hopper' | 'official';
  paid_status: 'paid' | 'unpaid' | null;
  added_via: 'search' | 'link' | 'qr' | null;
  seed: number | null;
  created_at: string;
  nickname: string | null;
  first_name: string | null;
  last_name: string | null;
  system_player_number: number | null;
  city: string | null;
  state: string | null;
}

/** The organizer's read of a bracket's hopper (via the projected SECURITY DEFINER RPC). */
export async function getBracketHopper(bracketId: string): Promise<HopperEntry[]> {
  const { data, error } = await supabase.rpc('get_bracket_hopper', {
    p_bracket_id: bracketId,
  });
  if (error) throw new Error(`Failed to load hopper: ${error.message}`);
  return (data as HopperEntry[] | null) ?? [];
}

/**
 * A past player from the organizer's sticky roster — either a registered member
 * (`bracket_roster`, joined to their member record for display) or a remembered
 * walk-up name (`bracket_walkup_roster`).
 *
 * The two kinds are told apart the same way as everywhere else in this feature:
 * `member_id` set = registered; `member_id` NULL = walk-up, whose entire
 * identity is `display_name`.
 */
export interface RosterPlayer {
  member_id: string | null;
  /** The walk-up's typed name; null for a registered player (use their member fields). */
  display_name: string | null;
  nickname: string | null;
  first_name: string | null;
  last_name: string | null;
  system_player_number: number | null;
  city: string | null;
  state: string | null;
  first_seen_at: string;
}

/**
 * The organizer's past players for this bracket — registered members and
 * remembered walk-ups in one list — EXCLUDING anyone already in its hopper. The
 * RPC does that filtering, which is what keeps the hopper screen's three groups
 * free of duplicates (a past player who links in leaves this list and shows up
 * as a candidate instead). Walk-ups are matched by trimmed, case-insensitive
 * name, since that is the only identity they have.
 */
export async function getBracketRoster(bracketId: string): Promise<RosterPlayer[]> {
  const { data, error } = await supabase.rpc('get_bracket_roster', {
    p_bracket_id: bracketId,
  });
  if (error) throw new Error(`Failed to load past players: ${error.message}`);
  return (data as RosterPlayer[] | null) ?? [];
}

/** The organizer's full bracket view: the bracket + its participants + matches. */
export interface BracketDetail {
  bracket: BracketRow;
  participants: BracketParticipantRow[];
  matches: BracketMatchRow[];
}

/**
 * Fetch a bracket with its participants and match tree (authed organizer view).
 *
 * @throws if any read errors, or if the bracket does not exist.
 */
export async function getBracket(bracketId: string): Promise<BracketDetail> {
  const [bracketRes, participantsRes, matchesRes] = await Promise.all([
    supabase.from('brackets').select('*').eq('id', bracketId).single(),
    supabase
      .from('bracket_participants')
      .select('*')
      .eq('bracket_id', bracketId)
      .order('seed'),
    supabase.from('bracket_matches').select('*').eq('bracket_id', bracketId),
  ]);

  if (bracketRes.error) throw bracketRes.error;
  if (participantsRes.error) throw participantsRes.error;
  if (matchesRes.error) throw matchesRes.error;

  return {
    bracket: bracketRes.data,
    participants: participantsRes.data ?? [],
    matches: matchesRes.data ?? [],
  };
}

/**
 * List a member's own brackets (newest first), excluding closed tombstones
 * (those are effectively ended and get swept). Backs the brackets index page.
 */
export async function getBracketsByCreator(memberId: string): Promise<BracketRow[]> {
  const { data, error } = await supabase
    .from('brackets')
    .select('*')
    .eq('created_by', memberId)
    .neq('status', 'closed')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/** One participant in the public share payload (names only — no member_id). */
export interface BracketShareParticipant {
  id: string;
  display_name: string;
  seed: number;
}

/** One match in the public share payload. */
export interface BracketShareMatch {
  id: string;
  round: number;
  side: 'winners' | 'losers' | 'grand_final';
  slot: number;
  home_participant_id: string | null;
  away_participant_id: string | null;
  winner_participant_id: string | null;
  next_match_id: string | null;
  next_match_slot: 'home' | 'away' | null;
  loser_next_match_id: string | null;
  loser_next_match_slot: 'home' | 'away' | null;
  status: 'pending' | 'ready' | 'complete';
  in_progress: boolean;
  is_reset_match: boolean;
}

/** The public share payload from get_bracket_share. `found:false` → not-found. */
export interface BracketShareView {
  found: boolean;
  bracket: {
    id: string;
    name: string;
    format: 'single_elimination' | 'double_elimination';
    status: 'setup' | 'live' | 'complete' | 'closed';
    grand_final_reset: boolean;
  } | null;
  participants: BracketShareParticipant[];
  matches: BracketShareMatch[];
}

const SHARE_NOT_FOUND: BracketShareView = {
  found: false,
  bracket: null,
  participants: [],
  matches: [],
};

/**
 * Resolve a public share token to the read-only, names-only bracket view.
 *
 * Uses the get_bracket_share RPC (the authorization boundary while RLS is off).
 * An unknown/swept token resolves to `{ found: false }` — the page renders an
 * ended/invalid state, never an error.
 *
 * @throws only if the RPC itself errors (network / unexpected DB error).
 */
export async function getBracketShare(shareToken: string): Promise<BracketShareView> {
  const { data, error } = await supabase.rpc('get_bracket_share', {
    p_share_token: shareToken,
  });

  if (error) throw error;
  if (!data) return SHARE_NOT_FOUND;

  return { ...SHARE_NOT_FOUND, ...(data as unknown as BracketShareView) };
}
