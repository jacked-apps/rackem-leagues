/**
 * @fileoverview useTeamLifecycle hook
 *
 * Encapsulates the "what action does the operator have available on this
 * team?" branching logic for `TeamCard` / `TeamManagement.tsx`.
 *
 * Action determination follows a strict priority order (first match wins):
 *   1. Any match with status='in_progress' → 'restricted'
 *      (live scoring is active; refuse drop until match completes)
 *   2. 0 matches in any state → 'delete'
 *      (typo / pre-schedule cleanup; hard delete is fine)
 *   3. All matches are scheduled or postponed (no results-bearing) → 'drop'
 *      (placeholder slots only; drop reassigns them to a bye)
 *   4. At least one results-bearing match (completed / awaiting_verification
 *      / forfeited) and no in_progress → 'drop'
 *      (drop preserves history; hard delete not offered to protect stats)
 *
 * The priority ordering resolves the ambiguity flagged in document review:
 * a team with `1 in_progress + 5 scheduled + 3 completed` is 'restricted'
 * because the in_progress rule (priority 1) overrides everything else.
 *
 * @see docs/plans/2026-04-29-001-fix-team-cascade-deletion-plan.md (Unit 2.5)
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/supabaseClient';
import { queryKeys } from '../queryKeys';

export type TeamLifecycleAction = 'delete' | 'drop' | 'restricted';

export interface MatchStatusCounts {
  scheduled: number;
  postponed: number;
  in_progress: number;
  completed: number;
  awaiting_verification: number;
  forfeited: number;
  total: number;
}

export interface TeamLifecycleState {
  /** Which action the operator can take. */
  action: TeamLifecycleAction;
  /** Loading flag for the underlying match-count query. */
  isLoading: boolean;
  /** Match-count breakdown driving the action decision. */
  counts: MatchStatusCounts;
  /** Plain-language reason — used in tooltips and confirmation dialogs. */
  reason: string;
}

const ZERO_COUNTS: MatchStatusCounts = {
  scheduled: 0,
  postponed: 0,
  in_progress: 0,
  completed: 0,
  awaiting_verification: 0,
  forfeited: 0,
  total: 0,
};

/**
 * Fetch all match statuses for a team in a single query, then count by
 * status client-side. Cheaper than 6 separate count queries.
 */
async function fetchMatchStatusCounts(teamId: string): Promise<MatchStatusCounts> {
  const { data, error } = await supabase
    .from('matches')
    .select('status')
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`);

  if (error) {
    throw new Error(`Failed to fetch match statuses: ${error.message}`);
  }

  const counts = { ...ZERO_COUNTS };

  (data ?? []).forEach(row => {
    const status = row.status as keyof MatchStatusCounts;
    if (status in counts) {
      counts[status] += 1;
    }
    counts.total += 1;
  });

  return counts;
}

function deriveAction(counts: MatchStatusCounts): { action: TeamLifecycleAction; reason: string } {
  // Priority 1: any in_progress match locks the team.
  if (counts.in_progress > 0) {
    return {
      action: 'restricted',
      reason: `This team has ${counts.in_progress} in-progress match${
        counts.in_progress === 1 ? '' : 'es'
      }. Wait for live scoring to finish before dropping.`,
    };
  }

  // Priority 2: zero matches → safe hard delete.
  if (counts.total === 0) {
    return {
      action: 'delete',
      reason: 'This team has no matches yet. Deleting it removes the team and roster.',
    };
  }

  const placeholderCount = counts.scheduled + counts.postponed;
  const resultsBearing = counts.completed + counts.awaiting_verification + counts.forfeited;

  // Priority 3: only placeholders → drop (reassigns them to a bye).
  if (placeholderCount === counts.total) {
    return {
      action: 'drop',
      reason: `This team has ${placeholderCount} unplayed match${
        placeholderCount === 1 ? '' : 'es'
      }. Dropping reassigns them to a bye slot; no scores are lost.`,
    };
  }

  // Priority 4: results-bearing exists → drop preserves history.
  return {
    action: 'drop',
    reason: `This team has ${resultsBearing} played match${
      resultsBearing === 1 ? '' : 'es'
    } and ${placeholderCount} unplayed. Dropping preserves history and reassigns unplayed matches to a bye.`,
  };
}

/**
 * Returns the operator action available on a team and the reason behind it.
 *
 * @param teamId - Team UUID. Pass null/undefined to skip the query.
 */
export function useTeamLifecycle(teamId: string | null | undefined): TeamLifecycleState {
  const enabled = !!teamId;
  const { data: counts, isLoading } = useQuery({
    queryKey: enabled
      ? [...queryKeys.teams.detail(teamId), 'matchStatusCounts']
      : ['teams', 'matchStatusCounts', 'disabled'],
    queryFn: () => fetchMatchStatusCounts(teamId!),
    enabled,
  });

  const resolvedCounts = counts ?? ZERO_COUNTS;
  const { action, reason } = deriveAction(resolvedCounts);

  return {
    action,
    isLoading,
    counts: resolvedCounts,
    reason,
  };
}
