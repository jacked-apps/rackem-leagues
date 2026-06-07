/**
 * @fileoverview Data hook for the per-game allocator room — list, clone,
 * upsert, delete.
 *
 * Keeps the UI components free of supabase imports. Returns:
 *   - `officials`: read-only seeded templates (scope='official')
 *   - `mine`: rows owned by the current member
 *   - `refresh`: re-fetch both lists
 *   - `cloneOfficial(id, newName)`: insert a user-scope copy of an official
 *   - `upsert(row)`: insert or update a user-scope row
 *   - `remove(id)`: delete a user-scope row (the DB trigger blocks officials)
 *
 * The room's contract: users see their own variations + read-only globals.
 * The list query enforces this app-side; RLS is the eventual real
 * protection (deferred per [[project_rls_disabled_in_dev]]).
 */

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/supabaseClient';
import type {
  PerGameAllocator,
  SideConfig,
} from '@/systems/points-system/types';

export interface AllocatorRow {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly scope: 'official' | 'user';
  readonly author_id: string | null;
  readonly winner_side: SideConfig;
  readonly loser_side: SideConfig;
}

export interface UseAllocatorRoom {
  readonly officials: AllocatorRow[];
  readonly mine: AllocatorRow[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly refresh: () => Promise<void>;
  readonly cloneOfficial: (id: string, newName: string) => Promise<string | null>;
  readonly upsert: (row: AllocatorRow) => Promise<boolean>;
  readonly remove: (id: string) => Promise<boolean>;
}

export function useAllocatorRoom(currentMemberId: string | null): UseAllocatorRoom {
  const [officials, setOfficials] = useState<AllocatorRow[]>([]);
  const [mine, setMine] = useState<AllocatorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [offRes, mineRes] = await Promise.all([
      supabase
        .from('per_game_allocators')
        .select('id, name, description, scope, author_id, winner_side, loser_side')
        .eq('scope', 'official')
        .order('name'),
      currentMemberId
        ? supabase
            .from('per_game_allocators')
            .select('id, name, description, scope, author_id, winner_side, loser_side')
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
    setOfficials((offRes.data ?? []) as unknown as AllocatorRow[]);
    setMine((mineRes.data ?? []) as unknown as AllocatorRow[]);
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
        .from('per_game_allocators')
        .insert({
          name: newName,
          description: source.description,
          scope: 'user',
          author_id: currentMemberId,
          winner_side: source.winner_side as unknown,
          loser_side: source.loser_side as unknown,
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
    async (row: AllocatorRow): Promise<boolean> => {
      if (!currentMemberId) return false;
      const { error: upsertErr } = await supabase
        .from('per_game_allocators')
        .upsert({
          id: row.id,
          name: row.name,
          description: row.description,
          scope: 'user',
          author_id: currentMemberId,
          winner_side: row.winner_side as unknown,
          loser_side: row.loser_side as unknown,
        });
      if (upsertErr) return false;
      await refresh();
      return true;
    },
    [currentMemberId, refresh],
  );

  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      const { error: delErr } = await supabase
        .from('per_game_allocators')
        .delete()
        .eq('id', id);
      if (delErr) return false;
      await refresh();
      return true;
    },
    [refresh],
  );

  return { officials, mine, loading, error, refresh, cloneOfficial, upsert, remove };
}

/**
 * Build a `PerGameAllocator` (the in-memory shape the runtime + guard
 * consume) from an `AllocatorRow` (the DB shape this hook returns).
 */
export function toPerGameAllocator(row: AllocatorRow): PerGameAllocator {
  return {
    name: row.name,
    winner: row.winner_side,
    loser: row.loser_side,
  };
}
