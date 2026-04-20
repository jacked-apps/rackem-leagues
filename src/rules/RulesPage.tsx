/**
 * @fileoverview The `/rules` landing page.
 *
 * Branch 1 shipped: CSI rulebook reader with game filter chips + search.
 *
 * Branch 2 additions (Unit 3A):
 *   - New "House rules" filter chip with chevron disclosure.
 *   - Scope picker (shadcn Sheet) for choosing which league/org's rules
 *     to overlay. Defaults to the user's active league; falls back to the
 *     picker when there are 0 or 2+ memberships.
 *   - Search results merge CSI matches + house-rule matches, each origin-
 *     labeled, CSI-first-then-house per R16.
 *
 * Unit 3B (next) will wire the TOC/Accordion interleave + differences-
 * only toggle. Unit 4 adds the house-rule detail route.
 */

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';

import { PageHeader } from '@/components/PageHeader';
import { FilterChip } from '@/components/ui/filter-chip';

import { AllGamesAccordion } from './AllGamesAccordion';
import { Attribution } from './Attribution';
import { GameTOC } from './GameTOC';
import { SearchInput } from './SearchInput';
import { SearchResults } from './SearchResults';
import { HouseRulesScopePicker, type ScopeSelection } from './HouseRulesScopePicker';
import { rulebook } from './useRulebook';
import { useRulebookSearch } from './useRulebookSearch';
import { rulesEvents } from './useRulesEvents';
import { useActiveLeague } from './useActiveLeague';
import {
  useHouseRulesForMemberships,
  useHouseRulesForScope,
} from './useHouseRules';
import { searchHouseRules, type HouseRuleSearchResult } from './searchHouseRules';
import type { HouseRule, HouseRuleScope } from './house-rules.types';

const LAST_GAME_KEY = 'rackem:rules:lastGame';
const ALL_GAMES_VALUE = 'all';
const MAIN_GAME_SLUGS = ['general', '8-ball', '9-ball', '10-ball'] as const;

function isMainGame(slug: string): boolean {
  return (MAIN_GAME_SLUGS as readonly string[]).includes(slug);
}

function readInitialTab(): string {
  const known = new Set(rulebook.index.games.map((g) => g.slug));
  known.add(ALL_GAMES_VALUE);
  try {
    const stored = window.localStorage.getItem(LAST_GAME_KEY);
    if (stored && known.has(stored)) return stored;
  } catch {
    // ignore
  }
  return rulebook.index.defaultGame;
}

/** Convert a ScopeSelection to a short label for the chip. */
function labelFor(selection: ScopeSelection): string {
  if (selection.kind === 'my-memberships') return 'My memberships';
  const name = selection.displayName;
  return name.length > 20 ? `${name.slice(0, 18)}…` : name;
}

export default function RulesPage() {
  const [tab, setTab] = useState<string>(() => readInitialTab());
  const [showMore, setShowMore] = useState<boolean>(
    () => !isMainGame(tab) && tab !== ALL_GAMES_VALUE,
  );
  const [query, setQuery] = useState('');
  const [resetCount, setResetCount] = useState(0);

  // House-rules filter state.
  const { activeLeague } = useActiveLeague();
  const [scopeSelection, setScopeSelection] = useState<ScopeSelection | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const handleClearSearch = () => {
    setQuery('');
    setResetCount((c) => c + 1);
  };
  const handleClearFilter = () => setTab(ALL_GAMES_VALUE);

  const searchResults = useRulebookSearch(query, tab);

  // ---- House-rule data: memberships (always fetched when a selection is
  // active) + optional on-demand scope for non-membership cheat-sheet flows.
  const memberships = useHouseRulesForMemberships();
  const nonMembershipScope: HouseRuleScope | null = useMemo(() => {
    if (!scopeSelection || scopeSelection.kind !== 'single') return null;
    return scopeSelection.scope;
  }, [scopeSelection]);
  const nonMembershipRules = useHouseRulesForScope(nonMembershipScope);

  // Resolve the visible house-rule corpus for the current selection.
  const visibleHouseRules: HouseRule[] = useMemo(() => {
    if (!scopeSelection) return [];
    if (scopeSelection.kind === 'my-memberships') return memberships.data ?? [];
    const scope = scopeSelection.scope;
    const membershipMatch = (memberships.data ?? []).filter((r) =>
      scope.type === 'organization'
        ? r.organization_id === scope.organizationId
        : r.league_id === scope.leagueId,
    );
    if (membershipMatch.length > 0) return membershipMatch;
    return nonMembershipRules.data ?? [];
  }, [scopeSelection, memberships.data, nonMembershipRules.data]);

  const houseSearchResults: HouseRuleSearchResult[] = useMemo(
    () => (query.trim().length === 0 ? [] : searchHouseRules(query, visibleHouseRules)),
    [query, visibleHouseRules],
  );

  // Events.
  useEffect(() => {
    rulesEvents.logPageOpen();
  }, []);

  useEffect(() => {
    if (query.trim().length === 0) return;
    rulesEvents.logSearch(tab, searchResults.length);
  }, [query, tab, searchResults.length]);

  useEffect(() => {
    try {
      window.localStorage.setItem(LAST_GAME_KEY, tab);
    } catch {
      // ignore
    }
  }, [tab]);

  // ---- House-rules chip interaction ---------------------------------------

  function houseChipClick() {
    // Already on → toggle off.
    if (scopeSelection) {
      setScopeSelection(null);
      rulesEvents.logHouseFilterActivated(null);
      return;
    }
    // Off → activate. Default to active league when present.
    if (activeLeague) {
      const selection: ScopeSelection = {
        kind: 'single',
        scope: { type: 'league', leagueId: activeLeague.id },
        displayName: activeLeague.displayName,
      };
      setScopeSelection(selection);
      rulesEvents.logHouseFilterActivated({ type: 'league', id: activeLeague.id });
      return;
    }
    // No active league → open picker.
    setPickerOpen(true);
    rulesEvents.logHouseFilterActivated(null);
  }

  function houseChipChevronClick() {
    setPickerOpen(true);
  }

  function handlePickerSelect(selection: ScopeSelection) {
    setScopeSelection(selection);
    if (selection.kind === 'single' && selection.scope.type === 'league') {
      rulesEvents.logScopeChanged({ type: 'league', id: selection.scope.leagueId });
    } else if (selection.kind === 'single' && selection.scope.type === 'organization') {
      rulesEvents.logScopeChanged({ type: 'organization', id: selection.scope.organizationId });
    } else {
      rulesEvents.logScopeChanged(null);
    }
  }

  const mainGames = rulebook.index.games.filter((g) => isMainGame(g.slug));
  const otherGames = rulebook.index.games.filter(
    (g) => !isMainGame(g.slug) && g.slug !== ALL_GAMES_VALUE,
  );
  const activeGame = rulebook.index.games.find((g) => g.slug === tab);
  const activeRules = activeGame ? rulebook.rulesByGame[activeGame.slug] ?? [] : [];

  const houseChipLabel = scopeSelection ? `House rules · ${labelFor(scopeSelection)}` : 'House rules';

  return (
    <div>
      <PageHeader backTo="/" backLabel="Home" title="Official Rules" />

      <div className="mx-auto max-w-3xl p-4">
        <div className="space-y-2" role="group" aria-label="Filter rules">
          <div className="flex flex-wrap items-center gap-2">
            {mainGames.map((game) => (
              <FilterChip
                key={game.slug}
                active={tab === game.slug}
                onClick={() => setTab(game.slug)}
              >
                {game.name}
              </FilterChip>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
            <FilterChip active={!!scopeSelection} onClick={houseChipClick}>
              {houseChipLabel}
              <ChevronDown
                aria-hidden="true"
                className="h-3 w-3"
                onClick={(e) => {
                  e.stopPropagation();
                  houseChipChevronClick();
                }}
              />
            </FilterChip>
          </div>
        </div>

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

        <SearchInput key={resetCount} onDebouncedChange={setQuery} />

        {query.trim().length > 0 ? (
          <SearchResults
            query={query}
            gameFilter={tab}
            results={searchResults}
            houseResults={houseSearchResults}
            onClearSearch={handleClearSearch}
            onClearFilter={handleClearFilter}
          />
        ) : tab === ALL_GAMES_VALUE ? (
          <AllGamesAccordion />
        ) : (
          <>
            <h2 className="sr-only">{activeGame?.name ?? 'Rules'}</h2>
            <GameTOC rules={activeRules} />
          </>
        )}

        <Attribution />
      </div>

      <HouseRulesScopePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={handlePickerSelect}
      />
    </div>
  );
}
