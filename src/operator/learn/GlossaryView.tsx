/**
 * @fileoverview GlossaryView — the Phase 1 Glossary surface on the Learn hub.
 *
 * Three states (per the plan's design spec):
 *   - Empty query: full alphabetical browse, grouped by first-letter headers.
 *   - Query with results: filtered results only; browse hidden.
 *   - Query with no matches: short message + browse stays visible below.
 *
 * Deep-link behavior: on mount + on hashchange, reads `window.location.hash`,
 * scrolls the matching entry into view, and highlights it for ~1.5s using a
 * semantic accent token so it works in dark mode.
 *
 * Search is plain substring on canonical + aliases (per the `useRulebookSearch`
 * precedent); upgrade path to Fuse.js when zero-result rates tell us we need it.
 */

import { useEffect, useMemo, useRef, useState } from 'react';

import {
  getAllGlossaryEntries,
  searchGlossary,
  type GlossaryEntry as GlossaryEntryType,
} from '@/glossary';
import { GlossaryEntryView } from './GlossaryEntry';

const HIGHLIGHT_MS = 1500;

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
  const [highlightedSlug, setHighlightedSlug] = useState<string | null>(null);
  const highlightTimeout = useRef<number | null>(null);

  const trimmed = query.trim();
  const all = useMemo(() => getAllGlossaryEntries(), []);
  const grouped = useMemo(() => groupByLetter(all), [all]);
  const results = useMemo(() => searchGlossary(trimmed), [trimmed]);

  const isBrowse = trimmed.length === 0;
  const hasResults = results.length > 0;

  // Deep-link scroll + highlight on mount and on hashchange.
  useEffect(() => {
    function handleHash() {
      const slug = window.location.hash.slice(1);
      if (!slug) return;
      setHighlightedSlug(slug);
      // Wait one frame so the entry's DOM node exists post-layout.
      requestAnimationFrame(() => {
        const el = document.getElementById(slug);
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      if (highlightTimeout.current) {
        window.clearTimeout(highlightTimeout.current);
      }
      highlightTimeout.current = window.setTimeout(() => {
        setHighlightedSlug(null);
      }, HIGHLIGHT_MS);
    }
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => {
      window.removeEventListener('hashchange', handleHash);
      if (highlightTimeout.current) {
        window.clearTimeout(highlightTimeout.current);
      }
    };
  }, []);

  return (
    <div className="space-y-6">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder='Search by name or alias (try "golden break")…'
        aria-label="Search glossary"
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      />

      {isBrowse && (
        <BrowseList
          grouped={grouped}
          highlightedSlug={highlightedSlug}
        />
      )}

      {!isBrowse && hasResults && (
        <SearchResults
          results={results}
          highlightedSlug={highlightedSlug}
        />
      )}

      {!isBrowse && !hasResults && (
        <div className="space-y-6">
          <p className="text-muted-foreground">
            No glossary terms match &ldquo;{trimmed}&rdquo;. Try a shorter
            search, or browse below.
          </p>
          <BrowseList
            grouped={grouped}
            highlightedSlug={highlightedSlug}
          />
        </div>
      )}
    </div>
  );
}

interface BrowseListProps {
  grouped: [string, GlossaryEntryType[]][];
  highlightedSlug: string | null;
}

function BrowseList({ grouped, highlightedSlug }: BrowseListProps) {
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
                isHighlighted={highlightedSlug === entry.slug}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

interface SearchResultsProps {
  results: ReturnType<typeof searchGlossary>;
  highlightedSlug: string | null;
}

function SearchResults({ results, highlightedSlug }: SearchResultsProps) {
  return (
    <div className="space-y-8">
      {results.map((r) => (
        <div key={r.entry.slug}>
          {r.matchType === 'alias' && r.matchedAlias && (
            <p className="mb-1 text-sm text-muted-foreground">
              &ldquo;{r.matchedAlias}&rdquo; → <strong>{r.entry.canonicalName}</strong>
            </p>
          )}
          <GlossaryEntryView
            entry={r.entry}
            isHighlighted={highlightedSlug === r.entry.slug}
          />
        </div>
      ))}
    </div>
  );
}
