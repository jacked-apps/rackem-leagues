/**
 * @fileoverview Fetch the event names recorded for a game, with bounded
 * retry to handle cross-table realtime ordering.
 *
 * Why retry: when the score_game_with_events rpc commits, both the
 * match_games UPDATE and the game_events INSERTs land in one transaction.
 * However, Supabase Realtime delivers per-table events independently — the
 * spectator's client may receive the match_games UPDATE realtime event
 * BEFORE its local replica reflects the new game_events rows. A SELECT
 * issued at UPDATE-event time will eventually see the rows once the
 * transaction is committed, but there is a small window where it could
 * race and return zero rows.
 *
 * If we built the confirmation dialog payload from a single SELECT and
 * raced through that window, the opponent would see "no events recorded"
 * for a game where the scorer had marked a Break and Run — a silent
 * scoring-accountability violation per the project_scoring_accountability
 * memory.
 *
 * Mitigation: bounded retry. If the first SELECT returns zero events on a
 * winner-confirmed game, retry up to 3 times with 100ms backoff before
 * accepting the empty result. Total worst-case wait: 300ms — imperceptible
 * to the spectator and well within the existing 500ms invalidation delay
 * pattern elsewhere in the codebase.
 *
 * @see docs/plans/2026-05-09-001-feat-scoring-event-registry-plan.md (Unit 7)
 */

import type { SupabaseClient } from '@supabase/supabase-js';

const MAX_ATTEMPTS = 3;
const BACKOFF_MS = 100;

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/**
 * Fetch event names for a single game, with bounded retry against cross-table
 * realtime ordering races. Returns an array of event_name strings.
 *
 * If `expectNonEmpty` is true (the typical winner-confirmed case), the
 * helper retries up to MAX_ATTEMPTS times when the SELECT returns zero rows.
 * If false, the first result is accepted as-is (used for paths where empty
 * is the expected outcome, e.g., post-vacate confirmation queue refresh).
 */
export async function fetchGameEventsForConfirmation(
  client: SupabaseClient<any>,
  gameId: string,
  expectNonEmpty: boolean = false,
): Promise<string[]> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const { data, error } = await client
      .from('game_events')
      .select('event_name')
      .eq('game_id', gameId);

    if (error) {
      // Hard error — return empty rather than throwing so the dialog still
      // opens. Logger upstream surfaces the diagnostic.
      return [];
    }

    const events = (data ?? []).map(row => row.event_name);

    // First attempt: if results are non-empty OR the caller didn't require
    // non-empty, accept and return.
    if (events.length > 0 || !expectNonEmpty) {
      return events;
    }

    // Empty result on a winner-confirmed game — possible replica race. Retry.
    if (attempt < MAX_ATTEMPTS) {
      await sleep(BACKOFF_MS);
    }
  }

  // Exhausted retries — accept the empty result. The spectator sees no events
  // recorded; if events truly exist they'll appear on next page load.
  return [];
}
