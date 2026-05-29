/**
 * @fileoverview GlossaryInfoButton — slug-bound wrapper around InfoButton.
 *
 * Reads a single glossary entry by slug and renders it through the
 * existing InfoButton popover: canonical name as the title, shortDef as
 * the body, and a "Learn more →" link that deep-links to the Learn hub
 * (`/operator-learn#<slug>`) in a new tab.
 *
 * Slugs are compile-time enforced via the GlossarySlug union. The runtime
 * defensive lookup is for type-cast bypasses only — in dev we surface a
 * visible error; in prod we degrade to a literal-slug fallback so the page
 * never crashes.
 *
 * Click-propagation guard: the whole component is wrapped in a span that
 * captures clicks and calls stopPropagation. Without this guard, clicking
 * the "?" pill or the "Learn more →" link inside a SelectableCard would
 * bubble to the card's outer button and toggle card selection.
 *
 * @see docs/plans/2026-05-28-001-feat-operator-help-system-phase-1-plan.md (Unit 2)
 */

import { useCallback } from 'react';
import type { CSSProperties } from 'react';

import { InfoButton } from './InfoButton';
import { getGlossaryEntry } from '@/glossary';
import type { GlossarySlug } from '@/glossary';

interface GlossaryInfoButtonProps {
  /** Compile-time-enforced glossary slug. */
  slug: GlossarySlug;
  size?: 'sm' | 'default';
  align?: 'left' | 'right' | 'center';
  label?: string;
  className?: string;
}

/** Inline style for the click-propagation guard span — display:contents so
 *  the wrapper has zero layout impact. */
const GUARD_STYLE: CSSProperties = { display: 'contents' };

export function GlossaryInfoButton({
  slug,
  size,
  align,
  label,
  className,
}: GlossaryInfoButtonProps) {
  const entry = getGlossaryEntry(slug);

  const stop = useCallback(
    (e: React.MouseEvent | React.PointerEvent) => {
      e.stopPropagation();
    },
    [],
  );

  // Defensive: TS guarantees `slug` is a known union member, but a
  // type-cast bypass at the call site could slip an unknown string
  // through. Surface it loudly in dev; degrade gracefully in prod.
  if (!entry) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.error(
        `[GlossaryInfoButton] unknown glossary slug: "${slug}". Add an entry under src/glossary/entries/ or fix the call site.`,
      );
      return (
        <span style={GUARD_STYLE} onClick={stop} onPointerDown={stop}>
          <InfoButton
            title={`⚠ unknown slug: ${slug}`}
            size={size}
            align={align}
            label={label}
            className={className}
          >
            <p className="text-destructive">
              No glossary entry found for slug <code>{slug}</code>. Add it
              under <code>src/glossary/entries/</code> or fix the call site.
            </p>
          </InfoButton>
        </span>
      );
    }
    // eslint-disable-next-line no-console
    console.warn(`[GlossaryInfoButton] unknown glossary slug: "${slug}"`);
    return (
      <span style={GUARD_STYLE} onClick={stop} onPointerDown={stop}>
        <InfoButton
          title={slug}
          size={size}
          align={align}
          label={label}
          className={className}
        >
          <p>{slug}</p>
        </InfoButton>
      </span>
    );
  }

  return (
    <span style={GUARD_STYLE} onClick={stop} onPointerDown={stop}>
      <InfoButton
        title={entry.canonicalName}
        size={size}
        align={align}
        label={label}
        className={className}
      >
        <div>
          <p>{entry.shortDef}</p>
          <div className="mt-4">
            <p className="text-sm font-medium text-foreground">
              Why is this so important?
            </p>
            <a
              href={`/learn#${slug}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={stop}
              className="mt-1 inline-block text-sm text-info hover:underline"
            >
              Learn more →
            </a>
          </div>
        </div>
      </InfoButton>
    </span>
  );
}
