/**
 * @fileoverview GlossaryView — the Phase 1 Glossary surface on the Learn hub.
 *
 * Three modes (resolved by URL hash + current search query):
 *   - **Single-entry mode** (URL hash set, no active search) — shows only
 *     the entry the user deep-linked to. Reached by clicking "Learn more →"
 *     from a wizard's GlossaryInfoButton popover. NOT a dump of the entire
 *     glossary.
 *   - **Search mode** (search input non-empty) — filtered results only.
 *     Alias matches render the alias-arrow subtitle.
 *   - **Browse mode** (no hash, no search) — full alphabetical glossary
 *     grouped by first-letter headers. Reached by clicking "Learn" in the
 *     sidebar or by clicking "Browse all terms →" from a single-entry view.
 */

import { useEffect, useMemo, useState } from 'react';

import {
  getAllGlossaryEntries,
  searchGlossary,
  type GlossaryEntry as GlossaryEntryType,
} from '@/glossary';
import { GlossaryEntryView } from './GlossaryEntry';

function groupByLetter(
  entries: readonly GlossaryEntryType[],
): [string, GlossaryEntryType[]][] {
  const map = new Map<string, GlossaryEntryType[]>();
  for (const entry of entries) {
    const first = entry.canonicalName.charAt(0).toUpperCase();
    const key = /^[A-Z]$/.test(first) ? first : '#';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(entry);
  }
  return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
}

export function GlossaryView() {
  const [query, setQuery] = useState('');
  const [landedSlug, setLandedSlug] = useState<string | null>(null);

  const trimmed = query.trim();
  const all = useMemo(() => getAllGlossaryEntries(), []);
  const grouped = useMemo(() => groupByLetter(all), [all]);
  const results = useMemo(() => searchGlossary(trimmed), [trimmed]);

  // Read the URL hash on mount and on every hashchange. The hash carries the
  // slug the user deep-linked to, which selects single-entry mode.
  useEffect(() => {
    function readHash() {
      const slug = window.location.hash.slice(1);
      setLandedSlug(slug || null);
      if (slug) {
        // Clear any active search so the target entry actually shows.
        // Without this, clicking a hash link inside a search-filtered
        // result kept the page in search mode and the new hash had no
        // matching entry to scroll to.
        setQuery('');
        // Scroll the page to top so the entry is the first thing visible.
        requestAnimationFrame(() => {
          window.scrollTo({ top: 0, behavior: 'auto' });
        });
      }
    }
    readHash();
    window.addEventListener('hashchange', readHash);
    return () => window.removeEventListener('hashchange', readHash);
  }, []);

  const isSearching = trimmed.length > 0;
  const landedEntry = landedSlug
    ? all.find((e) => e.slug === landedSlug)
    : null;
  const isSingleEntry = !isSearching && landedEntry != null;
  const hasResults = results.length > 0;

  function browseAll() {
    setLandedSlug(null);
    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }

  return (
    <div className="space-y-6">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder='Search by name or alias (try "fargo rating")…'
        aria-label="Search glossary"
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      />

      {isSingleEntry && landedEntry && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => window.history.back()}
              className="text-sm text-info hover:underline"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={browseAll}
              className="text-sm text-muted-foreground hover:text-info hover:underline"
            >
              Browse all terms →
            </button>
          </div>
          <GlossaryEntryView entry={landedEntry} isHighlighted={false} />
        </div>
      )}

      {isSearching && hasResults && (
        <SearchResults results={results} />
      )}

      {isSearching && !hasResults && (
        <div className="space-y-6">
          <p className="text-muted-foreground">
            No glossary terms match &ldquo;{trimmed}&rdquo;. Try a shorter
            search, or browse below.
          </p>
          <BrowseList grouped={grouped} />
        </div>
      )}

      {!isSearching && !isSingleEntry && (
        <BrowseList grouped={grouped} />
      )}
    </div>
  );
}

function BrowseList({
  grouped,
}: {
  grouped: [string, GlossaryEntryType[]][];
}) {
  return (
    <div className="space-y-10">
      {grouped.map(([letter, entries]) => (
        <section key={letter} aria-labelledby={`letter-${letter}`}>
          <h2
            id={`letter-${letter}`}
            className="mb-4 border-b border-border pb-1 text-xl font-semibold text-foreground"
          >
            {letter}
          </h2>
          <div className="space-y-8">
            {entries.map((entry) => (
              <GlossaryEntryView
                key={entry.slug}
                entry={entry}
                isHighlighted={false}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function SearchResults({
  results,
}: {
  results: ReturnType<typeof searchGlossary>;
}) {
  return (
    <div className="space-y-8">
      {results.map((r) => (
        <div key={r.entry.slug}>
          {r.matchType === 'alias' && r.matchedAlias && (
            <p className="mb-1 text-sm text-muted-foreground">
              &ldquo;{r.matchedAlias}&rdquo; →{' '}
              <strong>{r.entry.canonicalName}</strong>
            </p>
          )}
          <GlossaryEntryView entry={r.entry} isHighlighted={false} />
        </div>
      ))}
    </div>
  );
}
