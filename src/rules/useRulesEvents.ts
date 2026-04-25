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

type EventType =
  | 'page_open'
  | 'search_query'
  | 'deep_link_open'
  | 'house_filter_activated'
  | 'differences_only_activated'
  | 'house_rule_opened'
  | 'scope_changed';

type EventRow = {
  event_type: EventType;
  game?: string | null;
  rule_id?: string | null;
  result_count?: number | null;
  scope_type?: 'organization' | 'league' | null;
  scope_id?: string | null;
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

  // ----- Branch 2 (house rules) -----

  logHouseFilterActivated(scope: { type: 'organization' | 'league'; id: string } | null) {
    log({
      event_type: 'house_filter_activated',
      scope_type: scope?.type ?? null,
      scope_id: scope?.id ?? null,
    });
  },

  logDifferencesOnlyActivated(scope: { type: 'organization' | 'league'; id: string } | null) {
    log({
      event_type: 'differences_only_activated',
      scope_type: scope?.type ?? null,
      scope_id: scope?.id ?? null,
    });
  },

  logHouseRuleOpened(scope: { type: 'organization' | 'league'; id: string }, ruleId: string) {
    log({
      event_type: 'house_rule_opened',
      scope_type: scope.type,
      scope_id: scope.id,
      rule_id: ruleId,
    });
  },

  logScopeChanged(scope: { type: 'organization' | 'league'; id: string } | null) {
    log({
      event_type: 'scope_changed',
      scope_type: scope?.type ?? null,
      scope_id: scope?.id ?? null,
    });
  },
};
