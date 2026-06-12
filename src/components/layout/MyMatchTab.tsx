/**
 * @fileoverview The "My Match" bottom-nav tab — the always-visible express lane
 * into a player's current match. Repurposes the old "Live" tab slot.
 *
 * Unlike the other tabs (plain links), this one is state-driven by
 * `useMyMatchSurfaces`:
 *   - Tiers 1–3 (live / today / past-due makeup) → a Link straight to the
 *     resolved match's lineup page (which forwards to scoring when locked).
 *   - Tier 1 only → an accent "live" dot on the icon (distinct from the
 *     Messages count badge's palette).
 *   - Tier 4 / error → a non-navigating button that dims and toasts on tap.
 *   - Hydrating (first load) → neutral, and tap is a silent no-op so a
 *     reload mid-match never flashes a misleading "no matches" toast.
 *
 * Rendered by `BottomTabBar`; consumes the shared `useMyMatchSurfaces` contract.
 */

import { Link, useLocation } from 'react-router-dom';
import { Radio } from 'lucide-react';
import { toast } from 'sonner';
import { useMyMatchSurfaces } from '@/api/hooks/useMyMatchSurfaces';

/** Routes that highlight the My Match tab as active. */
const ACTIVE_PATTERNS = [
  /^\/my-match/,
  /^\/match\/[^/]+\/lineup/,
  /^\/match\/[^/]+\/score/,
];

/** Shared tab layout — matches the generic BottomTabBar links. */
const TAB_BASE =
  'flex flex-1 flex-col items-center justify-center gap-0.5 text-xs text-primary transition-colors';

const LABEL = 'My Match';

/**
 * @param memberId - The current user's `members.id` (`member?.id`). Null when
 *   logged out / pre-hydration → resolves to the Tier-4 no-op posture.
 */
export function MyMatchTab({ memberId }: { memberId: string | null | undefined }) {
  const location = useLocation();
  const { destinationMatchId, showLiveDot, isHydrating, isError } =
    useMyMatchSurfaces(memberId);
  const isActive = ACTIVE_PATTERNS.some((p) => p.test(location.pathname));

  const icon = (
    <span className="relative">
      <Radio className="h-5 w-5" />
      {showLiveDot ? (
        <span
          className="absolute -right-1 -top-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-background"
          aria-hidden="true"
        />
      ) : null}
    </span>
  );

  // Actionable (a match to go to): a Link to its lineup page. The lineup page's
  // MatchPhaseGuard forwards to scoring when the lineup is locked.
  if (destinationMatchId) {
    return (
      <Link
        to={`/match/${destinationMatchId}/lineup`}
        aria-label={showLiveDot ? `${LABEL}, live match in progress` : LABEL}
        aria-current={isActive ? 'page' : undefined}
        className={`${TAB_BASE} ${isActive ? 'font-semibold' : 'opacity-60'}`}
      >
        {icon}
        <span>{LABEL}</span>
      </Link>
    );
  }

  // Not actionable. Hydrating → silent no-op; Tier 4 / error → dim + toast.
  // A <button> (not a disabled <Link>) so keyboard Enter can't navigate.
  const handleClick = () => {
    if (isHydrating) return;
    if (isError) toast.error("Couldn't check your matches.");
    else toast('No current matches');
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={LABEL}
      aria-disabled={isHydrating ? undefined : 'true'}
      className={`${TAB_BASE} opacity-60`}
    >
      {icon}
      <span>{LABEL}</span>
    </button>
  );
}
