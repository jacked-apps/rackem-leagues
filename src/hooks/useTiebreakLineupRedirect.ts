/**
 * @fileoverview Send a team still on the scoring page to the tiebreak lineup.
 *
 * When a match ends tied, both phones run MatchEndVerification's completion,
 * and whichever is quicker records the tie and creates the tiebreak games.
 * The OTHER phone receives those games almost at once: its count goes from
 * 18/18 to 18/21, `allGamesComplete` turns false, and MatchEndVerification
 * (the only thing that navigated to the tiebreak lineup) unmounts before it
 * ever runs. That phone was stranded on the scoring page, and a refresh did
 * not help, because the route guard allows /score for an in-progress match.
 * (Before the 2026-10 tiebreak rebuild, unlocking the match lineups bounced
 * the page; the rebuild keeps them locked, which removed that path.)
 *
 * This hook is the page-level backstop: while the match is tied, the tiebreak
 * games exist, and the two tiebreak lineups are not both locked, the team
 * belongs on the lineup page. It never navigates before the tiebreak record
 * has loaded (the lineup page needs it, and acting on a still-loading record
 * could bounce /score ↔ /lineup). The record is created just after the games,
 * after the last match-row realtime event, so nothing else would refetch it:
 * the hook re-fetches it every second until it appears.
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { MatchTiebreaker } from '@/api/queries/tiebreakers';

/** Re-check interval while waiting for the tiebreak record to exist. */
const RECORD_POLL_MS = 1000;

interface TiebreakLineupRedirectParams {
  matchId: string | undefined;
  /** matches.status — only an in-progress match can be mid-tiebreak. */
  status: string | null | undefined;
  /** matches.match_result — 'tie' once the regulation result is recorded. */
  matchResult: string | null | undefined;
  /** Whether any is_tiebreaker games exist for this match. */
  tiebreakerGamesExist: boolean;
  /** The tiebreak record: undefined while loading, null when none exists yet. */
  record: MatchTiebreaker | null | undefined;
  /** Re-fetch the tiebreak record. */
  refetchRecord: () => unknown;
}

/**
 * Navigates to `/match/:id/lineup` when this team still has a tiebreak lineup
 * to set (see file header). No-op in every other state.
 *
 * @example
 * useTiebreakLineupRedirect({
 *   matchId, status: match?.status, matchResult: match?.match_result,
 *   tiebreakerGamesExist, record: tiebreakQuery.data,
 *   refetchRecord: tiebreakQuery.refetch,
 * });
 */
export function useTiebreakLineupRedirect({
  matchId,
  status,
  matchResult,
  tiebreakerGamesExist,
  record,
  refetchRecord,
}: TiebreakLineupRedirectParams) {
  const navigate = useNavigate();
  const tiedWithGames =
    !!matchId && status === 'in_progress' && matchResult === 'tie' && tiebreakerGamesExist;
  const lineups = record?.match_tiebreaker_lineups ?? [];
  const bothLocked = lineups.length >= 2 && lineups.every((l) => l.locked);

  // Record not created / not loaded yet: keep asking until it is.
  const waitingForRecord = tiedWithGames && !record;
  useEffect(() => {
    if (!waitingForRecord) return;
    refetchRecord();
    const id = setInterval(() => refetchRecord(), RECORD_POLL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waitingForRecord]);

  // Record loaded and the tiebreak lineups still need setting: go set them.
  const shouldRedirect = tiedWithGames && !!record && !bothLocked;
  useEffect(() => {
    if (shouldRedirect && matchId) navigate(`/match/${matchId}/lineup`, { replace: true });
  }, [shouldRedirect, matchId, navigate]);
}
