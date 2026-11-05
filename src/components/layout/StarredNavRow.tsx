/**
 * @fileoverview StarredNavRow — a menu row with a star at its end, used in the
 * Favorites block and in the Extras / Info folds.
 *
 * Tapping the star moves the entry into Favorites (or back to its fold). The
 * star is always visible — a hover-only star doesn't exist on a phone — and
 * is its own 44px tap target, separate from the link, so starring never
 * navigates (and, in the drawer, never closes it: only the link is wrapped in
 * SheetClose).
 *
 * On vs off is a SHAPE difference — filled star vs outline — not a colour one
 * (Ed is colourblind), and the button says "Add …" / "Remove …" to screen
 * readers, with `aria-pressed` for the state.
 */

import { Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NavRow } from './NavRow';

interface StarredNavRowProps {
  /** Route the row links to. */
  to: string;
  /** Visible text, including any "(N)" / "(New)" marker. */
  label: string;
  /** Plain entry name for the star's accessible label ("Rules"). */
  name: string;
  /** Whether this entry is currently a favorite (filled star). */
  starred: boolean;
  /** Star ↔ un-star this entry. */
  onToggleStar: () => void;
  /** True in the drawer, so a tap on the LINK closes it. */
  inSheet?: boolean;
}

export function StarredNavRow({ to, label, name, starred, onToggleStar, inSheet }: StarredNavRowProps) {
  return (
    <NavRow
      to={to}
      label={label}
      inSheet={inSheet}
      trailing={
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-pressed={starred}
          aria-label={starred ? `Remove ${name} from favorites` : `Add ${name} to favorites`}
          onClick={onToggleStar}
          className="size-11 shrink-0 text-muted-foreground"
        >
          <Star className={starred ? 'fill-current' : ''} aria-hidden="true" />
        </Button>
      }
    />
  );
}
