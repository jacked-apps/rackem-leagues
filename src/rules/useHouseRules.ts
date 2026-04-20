/**
 * @fileoverview Data loader hooks for house rules.
 *
 * Implements the "scoped lazy load" strategy from the plan:
 *   - On `/rules` mount: `useHouseRulesForMemberships` fetches ONLY the
 *     rules the user can see by default — every league they're a member of
 *     plus every organization they're staff of.
 *   - When the user narrows the filter to a scope they're NOT a member of,
 *     `useHouseRulesForScope(scope)` fetches just that scope's rules.
 *
 * Both read from the `house_rules_with_scope_name` view so `scope_name` is
 * populated in one round-trip. Cached per-scope via TanStack Query keys.
 */

import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/supabaseClient';
import { useMyMemberships } from './useMyMemberships';
import type { HouseRule, HouseRuleScope } from './house-rules.types';

const VIEW = 'house_rules_with_scope_name' as const;

async function fetchForOrgOrLeagueIds(args: {
  orgIds: string[];
  leagueIds: string[];
}): Promise<HouseRule[]> {
  if (args.orgIds.length === 0 && args.leagueIds.length === 0) return [];

  // Build a single query that ORs both filters. `or()` is the Supabase way.
  const clauses: string[] = [];
  if (args.orgIds.length > 0) clauses.push(`organization_id.in.(${args.orgIds.join(',')})`);
  if (args.leagueIds.length > 0) clauses.push(`league_id.in.(${args.leagueIds.join(',')})`);

  const { data, error } = await supabase
    .from(VIEW as never)
    .select('*')
    .or(clauses.join(','));
  if (error) throw error;
  return (data ?? []) as HouseRule[];
}

async function fetchForScope(scope: HouseRuleScope): Promise<HouseRule[]> {
  const column = scope.type === 'organization' ? 'organization_id' : 'league_id';
  const id = scope.type === 'organization' ? scope.organizationId : scope.leagueId;
  const { data, error } = await supabase
    .from(VIEW as never)
    .select('*')
    .eq(column, id);
  if (error) throw error;
  return (data ?? []) as HouseRule[];
}

/** Fetch every house rule visible to the current user by membership. */
export function useHouseRulesForMemberships() {
  const memberships = useMyMemberships();
  const orgIds = memberships.data?.organizations.map((o) => o.id) ?? [];
  const leagueIds = memberships.data?.leagues.map((l) => l.id) ?? [];

  return useQuery({
    // Scope the cache by the specific id lists so a membership change invalidates.
    queryKey: ['rules', 'house', 'memberships', orgIds.sort(), leagueIds.sort()],
    queryFn: () => fetchForOrgOrLeagueIds({ orgIds, leagueIds }),
    enabled: memberships.isSuccess,
    staleTime: 5 * 60 * 1000,
  });
}

/** Fetch a single house rule by id (detail-page deep-link flow). */
export function useHouseRule(ruleId: string | null | undefined) {
  return useQuery({
    queryKey: ['rules', 'house', 'one', ruleId ?? 'none'],
    queryFn: async (): Promise<HouseRule | null> => {
      if (!ruleId) return null;
      const { data, error } = await supabase
        .from(VIEW as never)
        .select('*')
        .eq('id', ruleId)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as HouseRule | null;
    },
    enabled: !!ruleId,
    staleTime: 5 * 60 * 1000,
  });
}

/** Fetch rules for a specific scope on demand (cheat-sheet flow). */
export function useHouseRulesForScope(scope: HouseRuleScope | null) {
  return useQuery({
    queryKey: scope
      ? ['rules', 'house', 'scope', scope.type, scope.type === 'organization' ? scope.organizationId : scope.leagueId]
      : ['rules', 'house', 'scope', 'none'],
    queryFn: () => (scope ? fetchForScope(scope) : Promise.resolve([])),
    enabled: scope !== null,
    staleTime: 5 * 60 * 1000,
  });
}
