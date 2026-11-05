/**
 * @fileoverview The small uppercase heading used by the menu's fixed sections
 * (Favorites, Operator). Folds use the same look on their trigger button.
 */

import type { ReactNode } from 'react';

export function NavSectionHeading({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </h3>
  );
}
