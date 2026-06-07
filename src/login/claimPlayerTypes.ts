/**
 * @fileoverview Shared types for the Claim Player flow.
 *
 * Extracted from `ClaimPlayer` so the page and the terminal-status screens
 * (`ClaimStatusScreen`) share one set of definitions.
 */

/** State machine for the claim process. */
export type ClaimState =
  | 'loading'
  | 'not_authenticated'
  | 'valid'
  | 'expired'
  | 'invalid'
  | 'already_claimed'
  | 'success'
  | 'rejected'
  | 'error';

/** Data returned from get_invite_details(). */
export interface InviteDetails {
  member_id: string;
  placeholder_first_name: string;
  placeholder_last_name: string;
  team_name: string;
  captain_name: string | null;
  expires_at: string;
  status: string;
}

/** Team info for displaying all teams the PP belongs to. */
export interface TeamInfo {
  team_id: string;
  team_name: string;
}

/** Extended placeholder context shown on the confirmation screen — lets the
 * invited user recognize (or reject) the record before any merge fires. */
export interface PlaceholderExtras {
  nickname: string | null;
  hasPlayed: boolean;
  handicap3v3: number | null;
  handicap5v5: number | null;
}

/** Per-account totals returned by the claim Edge Function on success. */
export interface MergeStats {
  teamsJoined: number;
  gamesTransferred: number;
  lineupsTransferred: number;
}
