/**
 * @fileoverview Tournament entrant identity (Unit B1) — resolve a hopper entry
 * (± its joined member) into a display-ready identity.
 *
 * Two kinds (see participantKind): a REGISTERED player shows their account
 * identity (nickname-primary, with player number + home for same-name
 * disambiguation); a WALK-UP shows only the typed display_name (a disposable
 * tournament-scoped entrant — no global account). Pure + guarded: never throws on
 * missing data (live-scoring safety ethos).
 */

import { participantKind, type ParticipantKind } from './participantKind';

/** The minimal hopper-entry shape needed to resolve identity. */
export interface EntryRow {
  member_id: string | null;
  display_name: string | null;
}

/** Optional joined member fields for a registered player. */
export interface EntryMember {
  nickname: string | null;
  first_name: string | null;
  last_name: string | null;
  system_player_number: number | null;
  city: string | null;
  state: string | null;
}

/** A resolved, display-ready participant identity. */
export interface ParticipantIdentity {
  kind: ParticipantKind;
  /** Primary label — nickname for a registered player, else the typed name. */
  displayName: string;
  /** Same-name disambiguators (registered only; null for walk-ups). */
  playerNumber: number | null;
  home: string | null;
}

const FALLBACK_NAME = 'Player';

/**
 * Resolve a hopper entry (+ optional joined member) into a display identity.
 * Registered → nickname (or full name) + number + home. Walk-up (or a registered
 * row whose member wasn't loaded) → the typed name only. Never throws.
 */
export function resolveParticipantIdentity(
  entry: EntryRow,
  member?: EntryMember | null
): ParticipantIdentity {
  const kind = participantKind(entry);

  if (kind === 'registered' && member) {
    const fullName = [member.first_name, member.last_name]
      .filter(Boolean)
      .join(' ')
      .trim();
    const displayName =
      member.nickname?.trim() || fullName || entry.display_name?.trim() || FALLBACK_NAME;
    const home = [member.city, member.state].filter(Boolean).join(', ') || null;
    return { kind, displayName, playerNumber: member.system_player_number ?? null, home };
  }

  return {
    kind,
    displayName: entry.display_name?.trim() || FALLBACK_NAME,
    playerNumber: null,
    home: null,
  };
}
