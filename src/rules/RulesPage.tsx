/**
 * @fileoverview The `/rules` landing page.
 *
 * Layout (mobile-first, top → bottom):
 *   1. PageHeader — app-standard header with back-to-home.
 *   2. Game-picker filter chips — main games (8/9/10-Ball) always visible,
 *      plus a "More games ▾" disclosure that expands a secondary chip row
 *      for the less-common games, and an "All games" chip.
 *   3. Search input — sticky below the chip row.
 *   4. Content — either the selected game's TOC or the cover-to-cover
 *      accordion when "All games" is active.
 *   5. Attribution footer (R11).
 *
 * Selection is persisted to `localStorage` under `rackem:rules:lastGame` so
 * returning users land on the game they were reading last. If the stored
 * slug is in the "other games" group, the secondary chip row opens on
 * mount so the active selection is visible.
 *
 * The search input is rendered but typing does not swap to a results list
 * yet — `SearchResults` lands in Unit 4 and will replace the TOC/accordion
 * region when the debounced query is non-empty.
 */

import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';

import { PageHeader } from '@/components/PageHeader';
import { FilterChip } from '@/components/ui/filter-chip';

import { AllGamesAccordion } from './AllGamesAccordion';
import { Attribution } from './Attribution';
import { GameTOC } from './GameTOC';
import { SearchInput } from './SearchInput';
import { rulebook } from './useRulebook';

const LAST_GAME_KEY = 'rackem:rules:lastGame';
const ALL_GAMES_VALUE = 'all';
// Always-visible chips: General Rules (applies across every game) plus the
// three most common games. Everything else is tucked behind "More games".
const MAIN_GAME_SLUGS = ['general', '8-ball', '9-ball', '10-ball'] as const;

/** True iff the slug is one of the primary games always visible in the top row. */
function isMainGame(slug: string): boolean {
  return (MAIN_GAME_SLUGS as readonly string[]).includes(slug);
}

/** Valid game slug from storage, or the configured default. */
function readInitialTab(): string {
  const known = new Set(rulebook.index.games.map((g) => g.slug));
  known.add(ALL_GAMES_VALUE);
  try {
    const stored = window.localStorage.getItem(LAST_GAME_KEY);
    if (stored && known.has(stored)) return stored;
  } catch {
    // localStorage unavailable (private mode, quota, sandbox) — fall through.
  }
  return rulebook.index.defaultGame;
}

export default function RulesPage() {
  const [tab, setTab] = useState<string>(() => readInitialTab());
  // If the initial tab is an "other" game, the secondary chip row opens so
  // the active selection is visible.
  const [showMore, setShowMore] = useState<boolean>(
    () => !isMainGame(tab) && tab !== ALL_GAMES_VALUE,
  );
  // Debounced query state. Unit 4 wires this into SearchResults.
  const [, setQuery] = useState('');

  // Persist selection on change (best-effort; ignore storage failures).
  useEffect(() => {
    try {
      window.localStorage.setItem(LAST_GAME_KEY, tab);
    } catch {
      /* ignore */
    }
  }, [tab]);

  const mainGames = rulebook.index.games.filter((g) => isMainGame(g.slug));
  const otherGames = rulebook.index.games.filter(
    (g) => !isMainGame(g.slug) && g.slug !== ALL_GAMES_VALUE,
  );
  const activeGame = rulebook.index.games.find((g) => g.slug === tab);
  const activeRules = activeGame ? rulebook.rulesByGame[activeGame.slug] ?? [] : [];

  return (
    <div>
      <PageHeader backTo="/" backLabel="Home" title="Official Rules" />

      <div className="mx-auto max-w-3xl p-4">
        {/* Game picker — main chips, a disclosure, and "All games". */}
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by game">
          {mainGames.map((game) => (
            <FilterChip
              key={game.slug}
              active={tab === game.slug}
              onClick={() => setTab(game.slug)}
            >
              {game.name}
            </FilterChip>
          ))}
          <FilterChip
            aria-expanded={showMore}
            aria-controls="rules-more-games"
            onClick={() => setShowMore((v) => !v)}
          >
            More games
            <ChevronDown
              aria-hidden="true"
              className={`h-3 w-3 transition-transform ${showMore ? 'rotate-180' : ''}`}
            />
          </FilterChip>
          <FilterChip
            active={tab === ALL_GAMES_VALUE}
            onClick={() => setTab(ALL_GAMES_VALUE)}
          >
            All games
          </FilterChip>
        </div>

        {/* Secondary row for less-common games. */}
        {showMore && (
          <div
            id="rules-more-games"
            className="mt-2 flex flex-wrap gap-2 border-l-2 border-muted pl-2"
          >
            {otherGames.map((game) => (
              <FilterChip
                key={game.slug}
                active={tab === game.slug}
                onClick={() => setTab(game.slug)}
              >
                {game.name}
              </FilterChip>
            ))}
          </div>
        )}

        <SearchInput onDebouncedChange={setQuery} />

        {/* Content area. */}
        {tab === ALL_GAMES_VALUE ? (
          <AllGamesAccordion />
        ) : (
          <>
            <h2 className="sr-only">{activeGame?.name ?? 'Rules'}</h2>
            <GameTOC rules={activeRules} />
          </>
        )}

        <Attribution />
      </div>
    </div>
  );
}
