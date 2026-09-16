/**
 * @fileoverview Participant kind (Unit B2) — the single branch point every later
 * paid feature reads. Derived, not stored: a tournament entrant is `registered`
 * if it links to a real account (`member_id` present), else a `walkup` (a
 * disposable tournament-scoped entrant identified by name only).
 */

export type ParticipantKind = 'registered' | 'walkup';

/** `registered` when a member is linked, else `walkup`. */
export function participantKind(entry: { member_id: string | null }): ParticipantKind {
  return entry.member_id ? 'registered' : 'walkup';
}
