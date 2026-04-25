/**
 * @fileoverview PlaceholderBadge
 *
 * Small visual marker shown next to a placeholder player's name. Tells
 * everyone reading a roster, lineup, or scoring screen "this person
 * doesn't have a claimed account yet" — without making it sound like a
 * failure. Many placeholders are intentional and permanent (per Ed's
 * model: some players will never want an app account; their stats stay
 * captain-kept forever).
 *
 * Universal single-variant component on purpose. The has-stats vs
 * no-stats distinction stays in the LO Placeholders card where it
 * drives triage; for everyone else this is just an identifier tag.
 *
 * Used by PlayerNameLink so it propagates everywhere player names
 * render without needing audits of individual surfaces.
 */

import React from 'react';

interface PlaceholderBadgeProps {
  /** 'sm' for compact rows, 'md' as the default. Keeps narrow cells
   *  (live-scoring rows, lineup chips) readable without breaking layout. */
  size?: 'sm' | 'md';
  className?: string;
}

export const PlaceholderBadge: React.FC<PlaceholderBadgeProps> = ({
  size = 'md',
  className = '',
}) => (
  <span
    className={`inline-flex items-center rounded-full bg-gray-200 text-gray-700 font-medium align-middle ${
      size === 'sm' ? 'px-1.5 py-0 text-[10px]' : 'px-2 py-0.5 text-xs'
    } ${className}`}
    title="Placeholder — this player hasn't registered an account yet"
  >
    Placeholder
  </span>
);
