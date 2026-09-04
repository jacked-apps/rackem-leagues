/**
 * @fileoverview Pure view-model for rendering a bracket (Unit 5).
 *
 * Turns the raw participant + match rows into a display shape the renderer
 * consumes — resolved names per slot, winner highlighting, and matches grouped
 * by side and round. Kept pure + data-derived: the renderer recomputes this
 * from the fetched rows on every render, so a missed realtime event only
 * delays, never corrupts. Both the authed organizer view and the public share
 * view feed it (their row shapes are structurally identical for these fields).
 */

import type { MatchSide, MatchStatus, MatchSlot } from '@/types/bracket';

/** The minimal participant shape the view-model needs (rows + share both fit). */
export interface ViewParticipant {
  id: string;
  display_name: string;
  seed: number;
}

/** The minimal match shape the view-model needs (rows + share both fit). */
export interface ViewMatch {
  id: string;
  round: number;
  side: string;
  slot: number;
  home_participant_id: string | null;
  away_participant_id: string | null;
  winner_participant_id: string | null;
  status: string;
  in_progress: boolean;
  is_reset_match: boolean;
}

/** One slot (home/away) of a rendered match. */
export interface SlotView {
  participantId: string | null;
  /** Resolved display name, or null when the slot is not yet filled (TBD). */
  name: string | null;
  isWinner: boolean;
}

/** A rendered match. */
export interface MatchView {
  id: string;
  round: number;
  side: MatchSide;
  slot: number;
  status: MatchStatus;
  /** Organizer marked this ready match as being played now (vs. on deck). */
  inProgress: boolean;
  isResetMatch: boolean;
  home: SlotView;
  away: SlotView;
}

/** Matches grouped by side, each side an array of rounds (round → matches). */
export interface BracketView {
  winners: MatchView[][];
  losers: MatchView[][];
  grandFinal: MatchView[];
  hasLosers: boolean;
}

/** Build a name lookup from participants. */
function nameById(participants: ViewParticipant[]): Map<string, string> {
  return new Map(participants.map((p) => [p.id, p.display_name]));
}

/** Resolve one slot to a display view. */
function slot(
  participantId: string | null,
  winnerId: string | null,
  names: Map<string, string>
): SlotView {
  return {
    participantId,
    name: participantId ? (names.get(participantId) ?? 'Unknown') : null,
    isWinner: participantId !== null && participantId === winnerId,
  };
}

/** Turn one raw match into a MatchView. */
export function toMatchView(m: ViewMatch, names: Map<string, string>): MatchView {
  return {
    id: m.id,
    round: m.round,
    side: m.side as MatchSide,
    slot: m.slot,
    status: m.status as MatchStatus,
    inProgress: m.in_progress,
    isResetMatch: m.is_reset_match,
    home: slot(m.home_participant_id, m.winner_participant_id, names),
    away: slot(m.away_participant_id, m.winner_participant_id, names),
  };
}

/** Group a side's matches into an array indexed by round (1-based → 0-based). */
function toRounds(matches: MatchView[]): MatchView[][] {
  if (matches.length === 0) return [];
  const maxRound = Math.max(...matches.map((m) => m.round));
  const rounds: MatchView[][] = Array.from({ length: maxRound }, () => []);
  for (const m of matches) rounds[m.round - 1].push(m);
  for (const r of rounds) r.sort((a, b) => a.slot - b.slot);
  return rounds;
}

/**
 * Build the full renderable bracket view from raw rows.
 */
export function buildBracketView(
  participants: ViewParticipant[],
  matches: ViewMatch[]
): BracketView {
  const names = nameById(participants);
  const views = matches.map((m) => toMatchView(m, names));

  const winners = views.filter((m) => m.side === 'winners');
  const losers = views.filter((m) => m.side === 'losers');
  const grandFinal = views
    .filter((m) => m.side === 'grand_final')
    .sort((a, b) => Number(a.isResetMatch) - Number(b.isResetMatch));

  return {
    winners: toRounds(winners),
    losers: toRounds(losers),
    grandFinal,
    hasLosers: losers.length > 0,
  };
}

/** A slot the organizer can tap to record the winner (ready + filled). */
export function isSlotPickable(match: MatchView, which: MatchSlot): boolean {
  if (match.status !== 'ready') return false;
  const s = which === 'home' ? match.home : match.away;
  return s.participantId !== null;
}

/**
 * The tournament champion's name, or null if not yet decided. The champion is
 * the winner of the terminal match: the grand final (preferring an activated
 * reset match) for double-elim, or the last winners-bracket match for single.
 */
export function championName(view: BracketView): string | null {
  const terminal =
    view.grandFinal.length > 0
      ? // Prefer a completed reset decider; else the plain grand final.
        view.grandFinal.find((m) => m.isResetMatch && m.status === 'complete') ??
        view.grandFinal.find((m) => !m.isResetMatch)
      : lastWinnersMatch(view);

  if (!terminal || terminal.status !== 'complete') return null;
  if (terminal.home.isWinner) return terminal.home.name;
  if (terminal.away.isWinner) return terminal.away.name;
  return null;
}

/** The single-elimination final (last winners round's only match). */
function lastWinnersMatch(view: BracketView): MatchView | undefined {
  const lastRound = view.winners[view.winners.length - 1];
  return lastRound?.[0];
}
