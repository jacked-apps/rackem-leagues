/**
 * @fileoverview Data hook for the trigger room — list, clone, upsert,
 * delete. Mirrors `useAllocatorRoom` 1:1 in shape.
 *
 * Keeps UI components free of supabase imports. Returns:
 *   - `officials`: read-only seeded templates (scope='official')
 *   - `mine`: rows owned by the current member
 *   - `refresh`: re-fetch both lists
 *   - `cloneOfficial(id, newName)`: insert a user-scope copy of an official
 *   - `upsert(row)`: insert or update a user-scope row
 *   - `remove(id)`: delete a user-scope row (the DB trigger blocks officials)
 *
 * RLS is deferred per [[project_rls_disabled_in_dev]]; the room's
 * contract — "see your variations + read-only globals" — is enforced
 * app-side until then.
 */

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/supabaseClient';
import type {
  Condition,
  ReArm,
  Trigger,
  TriggerAction,
  TriggerType,
} from '@/systems/points-system/types';

export interface TriggerRow {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly scope: 'official' | 'user';
  readonly author_id: string | null;
  readonly trigger_type: TriggerType;
  readonly condition: Condition;
  readonly action: TriggerAction;
  readonly rearm: ReArm;
}

export interface UseTriggerRoom {
  readonly officials: TriggerRow[];
  readonly mine: TriggerRow[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly refresh: () => Promise<void>;
  readonly cloneOfficial: (id: string, newName: string) => Promise<string | null>;
  readonly upsert: (row: TriggerRow) => Promise<boolean>;
  readonly remove: (id: string) => Promise<boolean>;
}

const COLUMNS =
  'id, name, description, scope, author_id, trigger_type, condition, action, rearm';

export function useTriggerRoom(currentMemberId: string | null): UseTriggerRoom {
  const [officials, setOfficials] = useState<TriggerRow[]>([]);
  const [mine, setMine] = useState<TriggerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [offRes, mineRes] = await Promise.all([
      supabase
        .from('triggers')
        .select(COLUMNS)
        .eq('scope', 'official')
        .order('name'),
      currentMemberId
        ? supabase
            .from('triggers')
            .select(COLUMNS)
            .eq('scope', 'user')
            .eq('author_id', currentMemberId)
            .order('name')
        : Promise.resolve({ data: [], error: null } as const),
    ]);
    if (offRes.error || mineRes.error) {
      setError(offRes.error?.message ?? mineRes.error?.message ?? 'load failed');
      setLoading(false);
      return;
    }
    setOfficials((offRes.data ?? []) as unknown as TriggerRow[]);
    setMine((mineRes.data ?? []) as unknown as TriggerRow[]);
    setLoading(false);
  }, [currentMemberId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const cloneOfficial = useCallback(
    async (sourceId: string, newName: string): Promise<string | null> => {
      if (!currentMemberId) return null;
      const source = officials.find((r) => r.id === sourceId);
      if (!source) return null;
      const { data, error: insertErr } = await supabase
        .from('triggers')
        .insert({
          name: newName,
          description: source.description,
          scope: 'user',
          author_id: currentMemberId,
          trigger_type: source.trigger_type,
          condition: source.condition as unknown,
          action: source.action as unknown,
          rearm: source.rearm,
        })
        .select('id')
        .single();
      if (insertErr || !data) return null;
      await refresh();
      return (data as { id: string }).id;
    },
    [currentMemberId, officials, refresh],
  );

  const upsert = useCallback(
    async (row: TriggerRow): Promise<boolean> => {
      if (!currentMemberId) return false;
      const { error: upsertErr } = await supabase.from('triggers').upsert({
        id: row.id,
        name: row.name,
        description: row.description,
        scope: 'user',
        author_id: currentMemberId,
        trigger_type: row.trigger_type,
        condition: row.condition as unknown,
        action: row.action as unknown,
        rearm: row.rearm,
      });
      if (upsertErr) return false;
      await refresh();
      return true;
    },
    [currentMemberId, refresh],
  );

  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      const { error: delErr } = await supabase.from('triggers').delete().eq('id', id);
      if (delErr) return false;
      await refresh();
      return true;
    },
    [refresh],
  );

  return { officials, mine, loading, error, refresh, cloneOfficial, upsert, remove };
}

/**
 * Build an in-memory `Trigger` (the runtime + guard shape) from a row.
 * Order is synthesized to the default — the trigger room never
 * controls fire order; that's the future scoring system room's job.
 */
export function toTrigger(row: TriggerRow): Trigger {
  return {
    name: row.name,
    type: row.trigger_type,
    condition: row.condition,
    action: row.action,
    rearm: row.rearm,
    order: { number: 0, beforeAllocator: false },
  };
}
