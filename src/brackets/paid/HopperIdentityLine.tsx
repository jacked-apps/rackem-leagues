/**
 * @fileoverview One player's name block on the hopper screen (Phase C, Unit C3).
 *
 * Nickname-primary: the name a room actually uses is the big bold label, with
 * the player number and home city underneath as the small secondary line. That
 * secondary line is what makes two players called "Slim" tellable apart, so when
 * a name IS shared on this screen the row says so outright — and warns when the
 * player has no number or home to distinguish them by (typical for a walk-up,
 * who has no account at all).
 *
 * Shared by the candidate/official rows and the past-players rows so all three
 * groups read identically.
 */

import type { ParticipantIdentity } from './participantIdentity';

interface HopperIdentityLineProps {
  identity: ParticipantIdentity;
  /** Another player on this screen shows the same name. */
  duplicateName?: boolean;
}

export function HopperIdentityLine({
  identity,
  duplicateName = false,
}: HopperIdentityLineProps) {
  const { displayName, playerNumber, home, kind } = identity;

  // "#1042 · Buffalo, NY", dropping whichever half is missing.
  const details = [playerNumber != null ? `#${playerNumber}` : null, home]
    .filter(Boolean)
    .join(' · ');

  return (
    <span className="min-w-0 flex-1">
      <span className="flex items-center gap-2">
        <span className="truncate font-semibold">{displayName}</span>
        {kind === 'walkup' && (
          <span className="shrink-0 text-xs text-muted-foreground">walk-up</span>
        )}
      </span>

      {details && (
        <span className="block truncate text-xs text-muted-foreground">{details}</span>
      )}

      {/* Only worth saying when the name is actually shared on this screen. */}
      {duplicateName && !details && (
        <span className="block text-xs text-warning">
          Same name as another player — no number or city to tell them apart
        </span>
      )}
    </span>
  );
}
