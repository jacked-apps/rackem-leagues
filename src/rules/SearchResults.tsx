/**
 * @fileoverview Render the substring-search results (or the zero-results
 * state) for the current query + game filter.
 *
 * Replaces the TOC region on `/rules` when the debounced query is
 * non-empty. Each hit links to the rule's detail page. When nothing
 * matches, we render the R9b branded empty state with clear actions
 * that the caller wires into its own query / filter state.
 */

import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';

import { SearchSnippet } from './SearchSnippet';
import type { SearchResult, GameFilter } from './useRulebookSearch';
import { ALL_GAMES } from './useRulebookSearch';
import { rulebook } from './useRulebook';
import type { HouseRuleSearchResult } from './searchHouseRules';

type SearchResultsProps = {
  query: string;
  gameFilter: GameFilter;
  results: SearchResult[];
  /** House-rule matches, pre-ordered by caller per R16. Empty when filter off. */
  houseResults?: HouseRuleSearchResult[];
  onClearSearch: () => void;
  onClearFilter: () => void;
};

export function SearchResults({
  query,
  gameFilter,
  results,
  houseResults = [],
  onClearSearch,
  onClearFilter,
}: SearchResultsProps) {
  const hasAny = results.length > 0 || houseResults.length > 0;
  if (!hasAny) {
    return (
      <ZeroResults
        query={query}
        gameFilter={gameFilter}
        onClearSearch={onClearSearch}
        onClearFilter={onClearFilter}
      />
    );
  }

  return (
    <div role="list" aria-label={`Search results for ${query}`} className="space-y-2 py-3">
      {results.map((hit) => {
        const gameName = rulebook.index.games.find((g) => g.slug === hit.rule.game)?.name ?? hit.rule.game;
        return (
          <Link
            key={`csi:${hit.rule.game}:${hit.rule.id}`}
            role="listitem"
            to={`/rules/${hit.rule.game}/${hit.rule.id}`}
            className="block rounded-md border bg-card p-3 transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm text-muted-foreground shrink-0">
                {hit.rule.id}
              </span>
              <span className="font-medium">{hit.rule.heading}</span>
              <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                Official · {gameName}
              </span>
            </div>
            <div className="mt-1">
              <SearchSnippet
                rule={hit.rule}
                query={query}
                matchType={hit.matchType}
                bodyParagraphIndex={hit.bodyParagraphIndex}
              />
            </div>
          </Link>
        );
      })}

      {houseResults.map((hit) => {
        const scopeType = hit.rule.scope_type;
        const scopeId =
          scopeType === 'organization' ? hit.rule.organization_id : hit.rule.league_id;
        return (
          <Link
            key={`house:${hit.rule.id}`}
            role="listitem"
            to={`/rules/house/${scopeType}/${scopeId}/${hit.rule.id}`}
            className="block rounded-md border bg-card p-3 transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm text-muted-foreground shrink-0">
                {hit.rule.related_rule_id ?? hit.rule.id.slice(0, 8)}
              </span>
              <span className="font-medium">{hit.rule.title}</span>
              <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {hit.rule.scope_name}
              </span>
            </div>
            {hit.rule.related_rule_id ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {hit.rule.effect_type === 'override' ? 'Overrides' : 'Enhances'} CSI{' '}
                {hit.rule.related_rule_id.split(':')[1]}
              </p>
            ) : null}
            <div className="mt-1">
              {/* SearchSnippet accepts Rule; HouseRule's `body: string[]` shape matches. */}
              <SearchSnippet
                rule={{
                  id: hit.rule.id,
                  heading: hit.rule.title,
                  game: hit.rule.game,
                  body: hit.rule.body,
                  order: 0,
                }}
                query={query}
                matchType={hit.matchType === 'title' ? 'heading' : 'body'}
                bodyParagraphIndex={hit.bodyParagraphIndex}
              />
            </div>
          </Link>
        );
      })}
    </div>
  );
}

type ZeroResultsProps = {
  query: string;
  gameFilter: GameFilter;
  onClearSearch: () => void;
  onClearFilter: () => void;
};

function ZeroResults({ query, gameFilter, onClearSearch, onClearFilter }: ZeroResultsProps) {
  const isAllGames = gameFilter === ALL_GAMES;
  const gameName = rulebook.index.games.find((g) => g.slug === gameFilter)?.name ?? gameFilter;
  const message = isAllGames
    ? `No rules match "${query}".`
    : `No rules match "${query}" in ${gameName}.`;

  return (
    <div role="status" className="rounded-md border bg-muted/30 p-6 text-center">
      <p className="text-sm">{message}</p>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {!isAllGames && (
          <Button type="button" variant="outline" size="sm" loadingText="none" onClick={onClearFilter}>
            Clear filter
          </Button>
        )}
        <Button type="button" variant="outline" size="sm" loadingText="none" onClick={onClearSearch}>
          Clear search
        </Button>
      </div>
    </div>
  );
}
