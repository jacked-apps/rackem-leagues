/**
 * @fileoverview House-rules CRUD mutations.
 *
 * Plain async functions that talk to Supabase. Called by TanStack Query
 * mutation hooks (future `useHouseRuleMutationsHooks` in the reader/author
 * units) with optimistic updates. Sonner toasts are wired at call sites,
 * not here.
 *
 * Delete + Undo pattern: `deleteHouseRule(id)` issues a real DELETE. The
 * caller holds the deleted row in memory for ~10s; on Undo, call
 * `reinsertHouseRule(row)` which re-INSERTs preserving the original `id`
 * so any deep-links copied before the delete still resolve.
 */

import { supabase } from '@/supabaseClient';
import type {
  HouseRule,
  HouseRuleFormValues,
  HouseRuleScope,
} from '@/rules/house-rules.types';

const TABLE = 'house_rules' as const;
const VIEW = 'house_rules_with_scope_name' as const;

/** Map a scope descriptor to the column payload the DB expects. */
function scopeColumns(scope: HouseRuleScope) {
  if (scope.type === 'organization') {
    return { organization_id: scope.organizationId, league_id: null };
  }
  return { organization_id: null, league_id: scope.leagueId };
}

/** Insert a new rule at the given scope. Returns the row from the view. */
export async function createHouseRule(
  scope: HouseRuleScope,
  values: HouseRuleFormValues,
): Promise<HouseRule> {
  const payload = { ...scopeColumns(scope), ...values };
  const { data, error } = await supabase
    .from(TABLE)
    .insert(payload as never)
    .select('id')
    .single();
  if (error) throw error;
  return fetchHouseRuleById((data as { id: string }).id);
}

/** Update an existing rule. Returns the fresh row from the view. */
export async function updateHouseRule(
  id: string,
  values: HouseRuleFormValues,
): Promise<HouseRule> {
  const { error } = await supabase.from(TABLE).update(values as never).eq('id', id);
  if (error) throw error;
  return fetchHouseRuleById(id);
}

/** Hard DELETE. Caller is responsible for any Undo window. */
export async function deleteHouseRule(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw error;
}

/**
 * Re-insert a previously-deleted rule, **preserving the original `id`**.
 * Used by the Undo flow so deep-links copied before the delete still resolve.
 */
export async function reinsertHouseRule(row: HouseRule): Promise<HouseRule> {
  const payload = {
    id: row.id,
    organization_id: row.organization_id,
    league_id: row.league_id,
    game: row.game,
    effect_type: row.effect_type,
    related_rule_id: row.related_rule_id,
    title: row.title,
    body: row.body,
  };
  const { error } = await supabase.from(TABLE).insert(payload as never);
  if (error) throw error;
  return fetchHouseRuleById(row.id);
}

/** Small convenience: refresh a rule's full record from the view. */
async function fetchHouseRuleById(id: string): Promise<HouseRule> {
  const { data, error } = await supabase
    .from(VIEW as never)
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as HouseRule;
}
