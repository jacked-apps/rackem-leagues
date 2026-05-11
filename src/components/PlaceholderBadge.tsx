/**
 * @fileoverview PlaceholderBadge
 *
 * Tiny visual marker shown next to a placeholder player's name.
 *
 * Why "PP": this is the internal abbreviation the entire codebase
 * already uses ("the PP", "the PP's history", etc. — see comments
 * throughout members.ts, merge_placeholder_into_member, etc.). Two
 * letters keeps the badge small even on narrow mobile rows where the
 * full word "Placeholder" would crowd out the actual player name.
 *
 * Stands for: Placeholder Player — a real human represented in the
 * system who has not (or will not) register an auth account. Many
 * placeholders are intentional and permanent (Ed's model: some
 * players never want an app; their stats stay captain-kept).
 *
 * The hover tooltip spells out the abbreviation for first-time
 * users — desktop only; mobile has no hover state. The upcoming
 * display-name pass should add a tap-to-explain affordance for
 * mobile (popover, info modal on first session, or small legend on
 * surfaces where placeholders are common).
 *
 * If a later display-name pass changes the visual treatment, this is
 * the only file to edit — everywhere it's used (PlayerNameLink, the
 * three player pickers, etc.) just renders <PlaceholderBadge />.
 */

import React from 'react';

interface PlaceholderBadgeProps {
  /** 'sm' for compact rows (default), 'md' for spacier contexts. */
  size?: 'sm' | 'md';
  className?: string;
}

export const PlaceholderBadge: React.FC<PlaceholderBadgeProps> = ({
  size = 'sm',
  className = '',
}) => (
  <span
    className={`inline-flex items-center rounded-full bg-accent text-foreground font-semibold align-middle leading-none ${
      size === 'sm' ? 'px-1 py-0.5 text-[10px]' : 'px-1.5 py-0.5 text-[11px]'
    } ${className}`}
    title="PP = Placeholder Player — this player hasn't registered an account yet"
  >
    PP
  </span>
);
