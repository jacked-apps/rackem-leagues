/**
 * @fileoverview Hopper screen grouping (Phase C, Unit C3).
 *
 * Turns the two organizer reads — the hopper (candidates + official entries) and
 * the past-players roster — into the three stacked groups the screen renders,
 * top to bottom:
 *
 *   1. IN THE TOURNAMENT — admitted entries (`status='official'`); what Start seeds.
 *   2. WAITING TO BE ADDED — candidates who scanned/linked in or were added.
 *   3. PAST PLAYERS — the organizer's sticky roster, a one-tap add source.
 *
 * A player appears in exactly ONE group. Groups 1 and 2 can't overlap because a
 * hopper row has a single `status`; group 3 can't overlap either because the
 * `get_bracket_roster` RPC filters out anyone already in this bracket's hopper.
 * So a past player who scans the QR leaves group 3 and appears in group 2.
 *
 * Pure and total — no throws, no fetching — so the grouping is unit-testable
 * away from the query layer.
 */

import type { HopperEntry, RosterPlayer } from '@/api/queries/brackets';
import { resolveParticipantIdentity, type ParticipantIdentity } from './participantIdentity';

/** A hopper entry resolved for display in group 1 or 2. */
export interface HopperRow {
  id: string;
  entry: HopperEntry;
  identity: ParticipantIdentity;
  /** Someone else on this screen shows the same primary name. */
  duplicateName: boolean;
}

/** A past player resolved for display in group 3. */
export interface RosterRow {
  memberId: string;
  player: RosterPlayer;
  identity: ParticipantIdentity;
  duplicateName: boolean;
}

/** The three on-screen groups plus the counts for the sticky header. */
export interface HopperGroups {
  official: HopperRow[];
  waiting: HopperRow[];
  past: RosterRow[];
  counts: { official: number; waiting: number; past: number };
}

/**
 * Build the three groups from the raw reads.
 *
 * @param entries - Every hopper row for the bracket (both statuses).
 * @param roster - Past players not already in the hopper.
 *
 * @example
 * const groups = buildHopperGroups(hopper ?? [], roster ?? []);
 * groups.counts // { official: 8, waiting: 4, past: 23 }
 */
export function buildHopperGroups(
  entries: HopperEntry[],
  roster: RosterPlayer[]
): HopperGroups {
  const official: HopperRow[] = [];
  const waiting: HopperRow[] = [];

  for (const entry of entries) {
    const row: HopperRow = {
      id: entry.id,
      entry,
      identity: resolveParticipantIdentity(entry, entry.member_id ? entry : null),
      duplicateName: false,
    };
    (entry.status === 'official' ? official : waiting).push(row);
  }

  // Seeds are assigned at admit time, so the official list reads in seed order
  // once seeding has run and in arrival order before that.
  official.sort(bySeedThenArrival);
  waiting.sort(byArrival);

  const past: RosterRow[] = roster.map((player) => ({
    memberId: player.member_id,
    player,
    identity: resolveParticipantIdentity(
      { member_id: player.member_id, display_name: null },
      player
    ),
    duplicateName: false,
  }));

  markDuplicateNames([...official, ...waiting, ...past]);

  return {
    official,
    waiting,
    past,
    counts: { official: official.length, waiting: waiting.length, past: past.length },
  };
}

/**
 * Flag every row whose primary name collides with another row ANYWHERE on the
 * screen, so the view can insist on showing the disambiguators (player number +
 * home) — and say so plainly when a walk-up has none to show.
 *
 * Comparison is case- and whitespace-insensitive: "slim" and "Slim " are the
 * same person to an organizer scanning a list, which is exactly the confusion
 * this guards against.
 */
function markDuplicateNames(rows: Array<HopperRow | RosterRow>): void {
  const seen = new Map<string, number>();
  for (const row of rows) {
    const key = row.identity.displayName.trim().toLowerCase();
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  for (const row of rows) {
    const key = row.identity.displayName.trim().toLowerCase();
    row.duplicateName = (seen.get(key) ?? 0) > 1;
  }
}

/** Official entries: seed order when seeded, arrival order until then. */
function bySeedThenArrival(a: HopperRow, b: HopperRow): number {
  const seedA = a.entry.seed;
  const seedB = b.entry.seed;
  if (seedA != null && seedB != null) return seedA - seedB;
  if (seedA != null) return -1;
  if (seedB != null) return 1;
  return byArrival(a, b);
}

/** Oldest first — the order players actually showed up in. */
function byArrival(a: HopperRow, b: HopperRow): number {
  return a.entry.created_at.localeCompare(b.entry.created_at);
}
