/**
 * @fileoverview Data hook for the threshold room — list, clone, upsert,
 * delete. Mirrors `useTriggerRoom` 1:1 in shape.
 *
 * Keeps UI components free of supabase imports. A threshold row stores its
 * authored definition (`{ operationKind, operationArgs }`) as JSONB plus the
 * display `label`, the generic resolvable `name` (assigned by us, never edited),
 * and the `expansion_mode`. RLS is deferred per [[project_rls_disabled_in_dev]];
 * the "see your variations + read-only officials" contract is app-side.
 */

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/supabaseClient';
import type { ThresholdExpansionMode } from '@/systems/points-system/types';

/** The authored operation reference stored in the `definition` JSONB column. */
export interface ThresholdDefinition {
  readonly operationKind: string;
  readonly operationArgs: Record<string, unknown>;
}

export interface ThresholdRoomRow {
  readonly id: string;
  /** Generic resolvable key (state-bag name). Stable; never edited by the LO. */
  readonly name: string;
  /** Display name the LO sees and edits. */
  readonly label: string;
  readonly description: string | null;
  readonly scope: 'official' | 'user';
  readonly author_id: string | null;
  readonly definition: ThresholdDefinition;
  readonly expansion_mode: ThresholdExpansionMode;
}

export interface UseThresholdRoom {
  readonly officials: ThresholdRoomRow[];
  readonly mine: ThresholdRoomRow[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly refresh: () => Promise<void>;
  readonly cloneOfficial: (id: string, newLabel: string) => Promise<string | null>;
  readonly upsert: (row: ThresholdRoomRow) => Promise<boolean>;
  readonly remove: (id: string) => Promise<boolean>;
}

const COLUMNS = 'id, name, label, description, scope, author_id, definition, expansion_mode';

/** Mint a fresh generic resolvable key. The LO's label is separate decoration. */
export function generateThresholdKey(): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.floor(Math.random() * 1e8).toString(16);
  return `threshold_${rand}`;
}

export function useThresholdRoom(currentMemberId: string | null): UseThresholdRoom {
  const [officials, setOfficials] = useState<ThresholdRoomRow[]>([]);
  const [mine, setMine] = useState<ThresholdRoomRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [offRes, mineRes] = await Promise.all([
      supabase.from('thresholds').select(COLUMNS).eq('scope', 'official').order('label'),
      currentMemberId
        ? supabase
            .from('thresholds')
            .select(COLUMNS)
            .eq('scope', 'user')
            .eq('author_id', currentMemberId)
            .order('label')
        : Promise.resolve({ data: [], error: null } as const),
    ]);
    if (offRes.error || mineRes.error) {
      setError(offRes.error?.message ?? mineRes.error?.message ?? 'load failed');
      setLoading(false);
      return;
    }
    setOfficials((offRes.data ?? []) as unknown as ThresholdRoomRow[]);
    setMine((mineRes.data ?? []) as unknown as ThresholdRoomRow[]);
    setLoading(false);
  }, [currentMemberId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const cloneOfficial = useCallback(
    async (sourceId: string, newLabel: string): Promise<string | null> => {
      if (!currentMemberId) return null;
      const source = officials.find((r) => r.id === sourceId);
      if (!source) return null;
      const { data, error: insertErr } = await supabase
        .from('thresholds')
        .insert({
          name: generateThresholdKey(),
          label: newLabel,
          description: source.description,
          scope: 'user',
          author_id: currentMemberId,
          definition: source.definition as unknown,
          expansion_mode: source.expansion_mode,
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
    async (row: ThresholdRoomRow): Promise<boolean> => {
      if (!currentMemberId) return false;
      const { error: upsertErr } = await supabase.from('thresholds').upsert({
        id: row.id,
        name: row.name,
        label: row.label,
        description: row.description,
        scope: 'user',
        author_id: currentMemberId,
        definition: row.definition as unknown,
        expansion_mode: row.expansion_mode,
      });
      if (upsertErr) return false;
      await refresh();
      return true;
    },
    [currentMemberId, refresh],
  );

  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      const { error: delErr } = await supabase.from('thresholds').delete().eq('id', id);
      if (delErr) return false;
      await refresh();
      return true;
    },
    [refresh],
  );

  return { officials, mine, loading, error, refresh, cloneOfficial, upsert, remove };
}
