/**
 * @fileoverview Fire-and-forget usage instrumentation for the /rules feature.
 *
 * Writes one row into the `rules_page_events` Supabase table per significant
 * interaction:
 *   - page_open      — the /rules landing mounted.
 *   - search_query   — the user settled on a debounced search query.
 *   - deep_link_open — a /rules/:game/:ruleId resolved successfully.
 *
 * The inserts are silent: errors are swallowed. Telemetry must never surface
 * a toast, block rendering, or interfere with the dispute-sharing flow the
 * feature exists for. The owner reads the table directly via the Supabase
 * dashboard (RLS restricts non-service-role SELECT to developer members).
 *
 * No raw query text is ever stored — the helpers accept a `resultCount`
 * metric for search events instead.
 */

import { supabase } from '@/supabaseClient';

const TABLE = 'rules_page_events';

type EventType = 'page_open' | 'search_query' | 'deep_link_open';

type EventRow = {
  event_type: EventType;
  game?: string | null;
  rule_id?: string | null;
  result_count?: number | null;
};

function log(row: EventRow): void {
  // Fire-and-forget. Wrapped in an async IIFE so the try/catch swallows any
  // network or RLS error without surfacing a warning. Callers (useEffects)
  // never await this, so UI rendering is not blocked on the insert.
  void (async () => {
    try {
      await supabase.from(TABLE).insert(row);
    } catch {
      /* swallow — telemetry must never disrupt the user's flow */
    }
  })();
}

export const rulesEvents = {
  logPageOpen() {
    log({ event_type: 'page_open' });
  },

  logSearch(gameFilter: string, resultCount: number) {
    log({
      event_type: 'search_query',
      game: gameFilter || null,
      result_count: resultCount,
    });
  },

  logDeepLink(game: string, ruleId: string) {
    log({ event_type: 'deep_link_open', game, rule_id: ruleId });
  },
};
