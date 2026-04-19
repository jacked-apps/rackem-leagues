/**
 * @fileoverview The `/rules` landing page.
 *
 * Layout (mobile-first): a sticky search input on top, a row of game tabs
 * underneath, and either the selected game's TOC or the "All games"
 * accordion below. Attribution sits at the bottom.
 *
 * Selection is persisted to `localStorage` under `rackem:rules:lastGame` so
 * returning users land on the game they were reading last.
 *
 * The search input is rendered but typing does not swap to a results list
 * yet — `SearchResults` lands in Unit 4 and will replace the TOC/accordion
 * region when the debounced query is non-empty.
 */

import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { AllGamesAccordion } from './AllGamesAccordion';
import { Attribution } from './Attribution';
import { GameTOC } from './GameTOC';
import { SearchInput } from './SearchInput';
import { rulebook } from './useRulebook';

const LAST_GAME_KEY = 'rackem:rules:lastGame';
const ALL_GAMES_VALUE = 'all';

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

  return (
    <div className="mx-auto max-w-3xl p-4">
      <h1 className="sr-only">Official Rules</h1>
      <SearchInput onDebouncedChange={setQuery} />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-transparent p-0">
          {rulebook.index.games.map((game) => (
            <TabsTrigger key={game.slug} value={game.slug} className="flex-none">
              {game.name}
            </TabsTrigger>
          ))}
          <TabsTrigger value={ALL_GAMES_VALUE} className="flex-none">
            All games
          </TabsTrigger>
        </TabsList>

        {rulebook.index.games.map((game) => (
          <TabsContent key={game.slug} value={game.slug}>
            <h2 className="sr-only">{game.name}</h2>
            <GameTOC rules={rulebook.rulesByGame[game.slug] ?? []} />
          </TabsContent>
        ))}
        <TabsContent value={ALL_GAMES_VALUE}>
          <h2 className="sr-only">All games</h2>
          <AllGamesAccordion />
        </TabsContent>
      </Tabs>

      <Attribution />
    </div>
  );
}
