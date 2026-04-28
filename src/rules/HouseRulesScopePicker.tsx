/**
 * @fileoverview Scope picker for the House-rules filter.
 *
 * Renders as a shadcn Sheet. Lists the user's memberships (leagues grouped
 * under their organizations) plus a search input pinned at the top. Users
 * can pick "My memberships (all)" to fan out across everything they belong
 * to, or pick a single league (which narrows to that league only — the
 * cheat-sheet flow for joining a new league).
 *
 * Mobile posture: full-height bottom sheet with the search input sticky at
 * the top so the on-screen keyboard doesn't hide it.
 */

import { useMemo, useState } from 'react';

import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

import { useMyMemberships } from './useMyMemberships';
import type { HouseRuleScope } from './house-rules.types';

export type ScopeSelection =
  | { kind: 'my-memberships' }
  | { kind: 'single'; scope: HouseRuleScope; displayName: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (selection: ScopeSelection) => void;
};

export function HouseRulesScopePicker({ open, onOpenChange, onSelect }: Props) {
  const memberships = useMyMemberships();
  const [query, setQuery] = useState('');

  const filteredLeagues = useMemo(() => {
    const q = query.trim().toLowerCase();
    const leagues = memberships.data?.leagues ?? [];
    if (!q) return leagues;
    return leagues.filter(
      (l) =>
        l.displayName.toLowerCase().includes(q) ||
        l.organizationName.toLowerCase().includes(q),
    );
  }, [memberships.data, query]);

  const hasMemberships = (memberships.data?.leagues.length ?? 0) > 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader className="shrink-0 p-4 pr-10 border-b">
          <SheetTitle>Which league?</SheetTitle>
          <SheetDescription>
            Pick which league's house rules you want to see alongside the official rules.
          </SheetDescription>
        </SheetHeader>

        <div className="shrink-0 p-4 border-b">
          <Input
            type="search"
            placeholder="Find your league"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Find your league"
          />
        </div>

        <nav className="flex-1 overflow-y-auto p-2" aria-label="Available scopes">
          {hasMemberships ? (
            <SheetClose asChild>
              <button
                type="button"
                className="flex w-full min-h-11 items-center rounded-md px-3 py-2 text-left hover:bg-accent"
                onClick={() => onSelect({ kind: 'my-memberships' })}
              >
                <span className="font-medium">All my leagues</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {memberships.data?.leagues.length} league
                  {memberships.data?.leagues.length === 1 ? '' : 's'}
                </span>
              </button>
            </SheetClose>
          ) : null}

          {filteredLeagues.length === 0 && !memberships.isLoading ? (
            <p className="p-4 text-sm text-muted-foreground">
              {hasMemberships
                ? 'No leagues match that search.'
                : "You're not in a league yet. Once you join one, your league's rules will show up here."}
            </p>
          ) : null}

          {filteredLeagues.map((league) => (
            <SheetClose asChild key={league.id}>
              <button
                type="button"
                className="flex w-full min-h-11 flex-col items-start rounded-md px-3 py-2 text-left hover:bg-accent"
                onClick={() =>
                  onSelect({
                    kind: 'single',
                    scope: { type: 'league', leagueId: league.id },
                    displayName: league.displayName,
                  })
                }
              >
                <span className="font-medium">{league.displayName}</span>
                <span className="text-xs text-muted-foreground">{league.organizationName}</span>
              </button>
            </SheetClose>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
