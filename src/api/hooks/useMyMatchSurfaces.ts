/**
 * @fileoverview Aggregate hook + pure resolvers for the "My Match" nav shortcut
 * (Unit 2 of docs/plans/2026-05-29-002-feat-my-match-jump-in-plan.md).
 *
 * One hook, `useMyMatchSurfaces`, is the single contract every "My Match"
 * surface consumes — the mobile bottom-nav tab, the nav-drawer section, and the
 * desktop sidebar entry. It owns three things:
 *   1. the team-scoped detection query (`getMyMatchMatches`, Unit 1),
 *   2. a lightweight realtime subscription that re-checks the surfaces when a
 *      match changes *status* (not on every per-game score write), and
 *   3. resolution of the raw match set into both shapes the surfaces need:
 *      - a four-tier "ladder" the bottom-nav/sidebar collapse to ONE auto-routed
 *        destination (live → today → past-due makeup → nothing), and
 *      - an unsorted-to-the-caller drawer list of every relevant match.
 *
 * The tier/tiebreak/label logic is factored into PURE exported functions so the
 * heart of the feature is testable without mounting React or a query client.
 * Consumers never re-run tier-to-destination logic — they read the resolved
 * fields off this hook.
 */

import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { REALTIME_SUBSCRIBE_STATES } from '@supabase/supabase-js';
import { supabase } from '@/supabaseClient';
import { getMemberTeamIds, getMyMatchMatches } from '@/api/queries/matches';
import { formatLocalDate, parseLocalDate } from '@/utils/formatters';
import type { MatchWithDetails } from '@/types';

/**
 * A detection-query row. `getMyMatchMatches` selects `*`, so `started_at` (a
 * real `matches` column the multi-live tiebreak needs) is present at runtime
 * even though the shared `Match` type doesn't declare it — we widen locally
 * rather than ripple a change through the shared schema type.
 */
export type MyMatchRow = MatchWithDetails & { started_at: string | null };

/** Tiers 1–3 are actionable (route somewhere); Tier 4 is "nothing of yours". */
export type MyMatchTier = 1 | 2 | 3 | 4;

/** The single-destination view the bottom-nav tab and sidebar entry consume. */
export interface MyMatchNavState {
  tier: MyMatchTier;
  /** The match a tap routes to (its lineup page). Null at Tier 4. */
  destinationMatchId: string | null;
  /** Live-indicator dot — Tier 1 (an actual in-progress match) only. */
  showLiveDot: boolean;
}

/** One row in the drawer's "My Match" section. */
export interface MyMatchDrawerItem {
  matchId: string;
  /** The member's own team in this match. */
  teamName: string;
  /** The other team — disambiguates when two of the member's teams play tonight. */
  opponentName: string;
  /** `'Live'` | `'Today'` | `'Makeup (Apr 7)'`. */
  label: string;
  /** Drawer chip grouping: in_progress/today → `'live'`, past-due → `'makeup'`. */
  group: 'live' | 'makeup';
  destinationPath: string;
}

/** The full contract returned to every consumer. */
export interface MyMatchSurfaces extends MyMatchNavState {
  drawerItems: MyMatchDrawerItem[];
  /** First load with a member set: surfaces render neutral, taps are no-ops. */
  isHydrating: boolean;
  /** Query failed: consumers fall back to the Tier-4 posture. */
  isError: boolean;
}

/** Posture when there's nothing to show (logged out, hydrating, error, Tier 4). */
const EMPTY_NAV: MyMatchNavState = {
  tier: 4,
  destinationMatchId: null,
  showLiveDot: false,
};

/**
 * Which tier a single match belongs to, or `null` if it doesn't qualify.
 * Mirrors the detection query's intent so a stray row can't be miscounted:
 *   1 = live (`in_progress`), 2 = today's `scheduled`, 3 = past-due `scheduled`.
 */
export function classifyTier(match: MyMatchRow, today: string): 1 | 2 | 3 | null {
  if (match.status === 'in_progress') return 1;
  if (match.status === 'scheduled') {
    const date = match.scheduled_date ?? null;
    if (date === today) return 2;
    if (date !== null && date < today) return 3;
  }
  return null;
}

/** Stable string compare helper (no locale surprises on IDs/ISO dates). */
function cmpStr(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Order two matches *within the same tier*. The "most important" match is the
 * one that sorts first.
 *   - Tier 1 (live): oldest-started first (`started_at` ASC, nulls last), then
 *     furthest-along (`home_games_won + away_games_won` DESC), then `id`.
 *   - Tier 2 (today): `COALESCE(started_at, scheduled_date)` ASC, then `id`.
 *   - Tier 3 (makeup): oldest past-due first (`scheduled_date` ASC), then `id`.
 */
export function compareWithinTier(tier: 1 | 2 | 3, a: MyMatchRow, b: MyMatchRow): number {
  if (tier === 1) {
    const sa = a.started_at;
    const sb = b.started_at;
    if (sa !== sb) {
      if (sa === null) return 1; // nulls last
      if (sb === null) return -1;
      return cmpStr(sa, sb);
    }
    const ga = (a.home_games_won ?? 0) + (a.away_games_won ?? 0);
    const gb = (b.home_games_won ?? 0) + (b.away_games_won ?? 0);
    if (ga !== gb) return gb - ga; // furthest-along first
    return cmpStr(a.id, b.id);
  }
  if (tier === 2) {
    const ka = a.started_at ?? a.scheduled_date ?? '';
    const kb = b.started_at ?? b.scheduled_date ?? '';
    if (ka !== kb) return cmpStr(ka, kb);
    return cmpStr(a.id, b.id);
  }
  // tier === 3
  const da = a.scheduled_date ?? '';
  const db = b.scheduled_date ?? '';
  if (da !== db) return cmpStr(da, db);
  return cmpStr(a.id, b.id);
}

/** Group the raw set into the three actionable tiers, each internally sorted. */
function groupByTier(matches: MyMatchRow[], today: string): Record<1 | 2 | 3, MyMatchRow[]> {
  const groups: Record<1 | 2 | 3, MyMatchRow[]> = { 1: [], 2: [], 3: [] };
  for (const match of matches) {
    const tier = classifyTier(match, today);
    if (tier) groups[tier].push(match);
  }
  ([1, 2, 3] as const).forEach((tier) => {
    groups[tier].sort((a, b) => compareWithinTier(tier, a, b));
  });
  return groups;
}

/**
 * Collapse the raw match set to the single auto-routed destination. Picks the
 * lowest tier that has any match, then that tier's "most important" one.
 */
export function resolveMyMatchNavState(matches: MyMatchRow[], today: string): MyMatchNavState {
  const groups = groupByTier(matches, today);
  for (const tier of [1, 2, 3] as const) {
    if (groups[tier].length > 0) {
      return {
        tier,
        destinationMatchId: groups[tier][0].id,
        showLiveDot: tier === 1,
      };
    }
  }
  return EMPTY_NAV;
}

/** Human label for the date a makeup was originally scheduled (e.g. "Apr 7"). */
function formatMakeupDate(isoDate: string | null | undefined): string {
  if (!isoDate) return '';
  return parseLocalDate(isoDate).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

/** Turn one classified match into a drawer row from the member's perspective. */
function toDrawerItem(
  match: MyMatchRow,
  tier: 1 | 2 | 3,
  teamIdSet: Set<string>,
): MyMatchDrawerItem {
  const homeIsMine = match.home_team_id != null && teamIdSet.has(match.home_team_id);
  const myTeam = homeIsMine ? match.home_team : match.away_team;
  const opponent = homeIsMine ? match.away_team : match.home_team;
  const label =
    tier === 1 ? 'Live' : tier === 2 ? 'Today' : `Makeup (${formatMakeupDate(match.scheduled_date)})`;
  return {
    matchId: match.id,
    teamName: myTeam?.team_name ?? 'My team',
    opponentName: opponent?.team_name ?? 'BYE',
    label,
    // Live + Today both live under the "Live" chip; past-due is "Makeup".
    group: tier === 3 ? 'makeup' : 'live',
    destinationPath: `/match/${match.id}/lineup`,
  };
}

/**
 * Build the drawer list: every relevant match, ordered live → today → makeup,
 * each labeled from the member's perspective ("my team vs opponent").
 */
export function buildMyMatchDrawerItems(
  matches: MyMatchRow[],
  teamIds: string[],
  today: string,
): MyMatchDrawerItem[] {
  const teamIdSet = new Set(teamIds);
  const groups = groupByTier(matches, today);
  const items: MyMatchDrawerItem[] = [];
  for (const tier of [1, 2, 3] as const) {
    for (const match of groups[tier]) {
      items.push(toDrawerItem(match, tier, teamIdSet));
    }
  }
  return items;
}

/** TanStack cache key for the resolved surfaces, scoped per member. */
export const myMatchSurfacesKey = (memberId: string | null | undefined) =>
  ['myMatchSurfaces', memberId ?? null] as const;

/**
 * Aggregate hook powering every "My Match" surface.
 *
 * @param memberId - The current user's `members.id` (`member?.id` at call
 *   sites). Null/undefined → the no-match posture with NO query and NO realtime
 *   channel (logged out / pre-profile-hydration).
 */
export function useMyMatchSurfaces(memberId: string | null | undefined): MyMatchSurfaces {
  const queryClient = useQueryClient();
  const enabled = !!memberId;

  const query = useQuery({
    queryKey: myMatchSurfacesKey(memberId),
    queryFn: async () => {
      // enabled:false guards this path; the guard keeps the contract explicit.
      if (!memberId) return { matches: [] as MyMatchRow[], teamIds: [] as string[] };
      const teamIds = await getMemberTeamIds(memberId);
      const matches = teamIds.length
        ? ((await getMyMatchMatches(memberId, teamIds)) as MyMatchRow[])
        : [];
      return { matches, teamIds };
    },
    enabled,
    // Mirror the spectator live-matches hook: a short staleness window plus
    // refetch-on-focus, with realtime closing the gap between focuses.
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  // Realtime: broad-subscribe to `matches` UPDATEs and re-check the surfaces
  // ONLY when a row's status actually changed. `matches` is REPLICA IDENTITY
  // FULL, so payload.old carries the prior status; the guard drops the heavy
  // churn from per-game home/away_games_won writes during live scoring.
  const droppedRef = useRef(false);
  useEffect(() => {
    if (!memberId) return;

    const channel = supabase
      .channel(`my_match_${memberId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'matches' },
        (payload) => {
          const oldStatus = (payload.old as { status?: string } | null)?.status;
          const newStatus = (payload.new as { status?: string } | null)?.status;
          // Invalidate on a real status change, or defensively if the old
          // status is somehow absent (so we never miss a transition).
          if (oldStatus === undefined || oldStatus !== newStatus) {
            queryClient.invalidateQueries({ queryKey: myMatchSurfacesKey(memberId) });
          }
        },
      )
      .subscribe((status) => {
        // Realtime doesn't replay rows missed while the socket was down, so on
        // a re-SUBSCRIBED after a drop we refetch to catch up. The first
        // SUBSCRIBED isn't a catch-up.
        if (status === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED) {
          if (droppedRef.current) {
            droppedRef.current = false;
            queryClient.invalidateQueries({ queryKey: myMatchSurfacesKey(memberId) });
          }
        } else if (
          status === REALTIME_SUBSCRIBE_STATES.CLOSED ||
          status === REALTIME_SUBSCRIBE_STATES.TIMED_OUT ||
          status === REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR
        ) {
          droppedRef.current = true;
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [memberId, queryClient]);

  // Logged out / no member: nothing to resolve, and (per the toast gating in
  // consumers) this is distinct from a hydrating state.
  if (!enabled) {
    return { ...EMPTY_NAV, drawerItems: [], isHydrating: false, isError: false };
  }

  // First load with a member set: render neutral, treat taps as silent no-ops.
  if (query.isLoading) {
    return { ...EMPTY_NAV, drawerItems: [], isHydrating: true, isError: false };
  }

  if (query.isError) {
    return { ...EMPTY_NAV, drawerItems: [], isHydrating: false, isError: true };
  }

  const today = formatLocalDate(new Date());
  const matches = query.data?.matches ?? [];
  const teamIds = query.data?.teamIds ?? [];

  return {
    ...resolveMyMatchNavState(matches, today),
    drawerItems: buildMyMatchDrawerItems(matches, teamIds, today),
    isHydrating: false,
    isError: false,
  };
}
