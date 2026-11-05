/**
 * @fileoverview NavIdentityHeader — the top of the menu: the logo (home link)
 * and, when signed in, the avatar + name row that opens /profile. Shared by
 * the desktop sidebar and the phone drawer so the two stay identical.
 *
 * The logo swaps with the theme. It's width-driven (80%) so the wide wordmark
 * fills the menu; PNG rather than SVG because the SVGs still carry
 * whitespace-heavy 512×512 viewBoxes.
 */

import { Link } from 'react-router-dom';
import { useUser } from '@/context/useUser';
import { useUserProfile } from '@/api/hooks/useUserProfile';
import { MaybeSheetClose } from './NavRow';
import { computeInitials, displayNameOf } from './navHelpers';

/** @param inSheet True in the drawer, so a tap closes it. */
export function NavIdentityHeader({ inSheet }: { inSheet?: boolean }) {
  const { isLoggedIn } = useUser();
  const { member } = useUserProfile();
  const displayName = displayNameOf(member);

  return (
    <>
      <MaybeSheetClose inSheet={inSheet}>
        <Link
          to={isLoggedIn ? '/my-teams' : '/'}
          aria-label="Rack 'Em Leagues — home"
          className="flex items-center justify-center border-b px-3 py-3 transition-opacity hover:opacity-80"
        >
          <img src="/logo-main.png" alt="Rack 'Em Leagues" className="block h-auto w-4/5 dark:hidden" />
          <img src="/logo-main-dark.png" alt="Rack 'Em Leagues" className="hidden h-auto w-4/5 dark:block" />
        </Link>
      </MaybeSheetClose>

      {isLoggedIn ? (
        <MaybeSheetClose inSheet={inSheet}>
          <Link
            to="/profile"
            aria-label={`${displayName} — open profile`}
            className="flex items-center gap-3 border-b px-4 py-3 text-primary transition-colors hover:bg-primary/10"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-xs font-semibold text-primary">
              {computeInitials(member?.first_name, member?.last_name)}
            </span>
            <span className="truncate text-sm font-medium">{displayName}</span>
          </Link>
        </MaybeSheetClose>
      ) : null}
    </>
  );
}
