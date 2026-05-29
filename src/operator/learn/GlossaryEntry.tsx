/**
 * @fileoverview GlossaryEntryView — renders a single glossary entry on the
 * Learn hub.
 *
 * Layout (per the plan's Entry display spec):
 *   - Canonical name as heading (with id=slug so deep links work)
 *   - Aliases as a small subtitle ("also called: …")
 *   - Short def as lead paragraph
 *   - Long def below (always visible — this IS the deep-dive surface)
 *   - Related slugs as inline `#<slug>` links
 *   - l1_anchor is NOT shown — internal audit field only
 *
 * Highlight pulse uses a semantic token (bg-accent/30 fading to transparent)
 * so dark mode works without literal Tailwind shades.
 */

import type { GlossaryEntry } from '@/glossary';

interface GlossaryEntryViewProps {
  entry: GlossaryEntry;
  isHighlighted: boolean;
}

function slugToLabel(slug: string): string {
  return slug.replace(/-/g, ' ');
}

export function GlossaryEntryView({ entry, isHighlighted }: GlossaryEntryViewProps) {
  return (
    <article
      id={entry.slug}
      className={`scroll-mt-24 rounded-md p-3 transition-colors duration-1000 ${
        isHighlighted ? 'bg-accent/30' : 'bg-transparent'
      }`}
    >
      <h3 className="text-2xl font-semibold text-foreground">
        {entry.canonicalName}
      </h3>
      {entry.aliases.length > 0 && (
        <p className="mt-1 text-sm text-muted-foreground">
          also called: {entry.aliases.join(', ')}
        </p>
      )}
      <p className="mt-3 text-foreground">{entry.shortDef}</p>
      <div className="mt-4 space-y-3 text-foreground">{entry.longDef}</div>
      {entry.related.length > 0 && (
        <p className="mt-4 text-sm text-muted-foreground">
          <span className="font-medium">Related:</span>{' '}
          {entry.related.map((slug, i) => (
            <span key={slug}>
              <a
                href={`#${slug}`}
                className="text-info hover:underline"
              >
                {slugToLabel(slug)}
              </a>
              {i < entry.related.length - 1 ? ', ' : ''}
            </span>
          ))}
        </p>
      )}
    </article>
  );
}
