/**
 * @fileoverview League-settings picker card for the per-game allocator.
 *
 * Hosts the choice of which variation a league uses (or NULL → use the
 * prepackaged composition unchanged). The pick runs through
 * `runApplyTimePreview` against the league's prepackaged composition —
 * warnings surface inline and the LO can Apply Anyway or cancel.
 *
 * Reads/writes `preferences.per_game_allocator_id` for the league. Uses
 * the existing modular-field write pattern (insert league-level prefs
 * row if none exists).
 */

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/supabaseClient';
import { useUserProfile } from '@/api/hooks';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  useAllocatorRoom,
  toPerGameAllocator,
  type AllocatorRow,
} from './useAllocatorRoom';
import { runApplyTimePreview, type ApplyTimePreview } from './applyTimePreview';

const NONE_VALUE = '__none__';

export interface AllocatorPickerProps {
  readonly leagueId: string;
}

export function AllocatorPicker({ leagueId }: AllocatorPickerProps) {
  const { member } = useUserProfile();
  const room = useAllocatorRoom(member?.id ?? null);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string>(NONE_VALUE);
  const [pointsCalculator, setPointsCalculator] = useState<string | null>(null);
  const [preview, setPreview] = useState<ApplyTimePreview | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const all: AllocatorRow[] = [...room.officials, ...room.mine];

  useEffect(() => {
    void (async () => {
      const [prefRes, viewRes] = await Promise.all([
        supabase
          .from('preferences')
          .select('per_game_allocator_id')
          .eq('entity_type', 'league')
          .eq('entity_id', leagueId)
          .maybeSingle(),
        supabase
          .from('resolved_league_preferences')
          .select('points_calculator')
          .eq('league_id', leagueId)
          .single(),
      ]);
      const id = (prefRes.data?.per_game_allocator_id as string | null) ?? null;
      setCurrentId(id);
      setSelectedId(id ?? NONE_VALUE);
      setPointsCalculator(viewRes.data?.points_calculator ?? null);
    })();
  }, [leagueId]);

  const handleSelect = useCallback(
    (value: string) => {
      setSelectedId(value);
      setStatus(null);
      if (value === NONE_VALUE) {
        setPreview(null);
        return;
      }
      const picked = all.find((r) => r.id === value);
      if (!picked) {
        setPreview(null);
        return;
      }
      setPreview(
        runApplyTimePreview(pointsCalculator, toPerGameAllocator(picked)),
      );
    },
    [all, pointsCalculator],
  );

  const handleApply = useCallback(async () => {
    setStatus(null);
    const newId = selectedId === NONE_VALUE ? null : selectedId;
    const { error } = await supabase
      .from('preferences')
      .upsert(
        {
          entity_type: 'league',
          entity_id: leagueId,
          per_game_allocator_id: newId,
        },
        { onConflict: 'entity_type,entity_id' },
      );
    if (error) {
      setStatus(`Save failed: ${error.message}`);
      return;
    }
    setCurrentId(newId);
    setStatus('Saved.');
  }, [leagueId, selectedId]);

  const changed = (selectedId === NONE_VALUE ? null : selectedId) !== currentId;
  const blockApply =
    !changed || (preview !== null && !preview.ok);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Per-Game Allocator</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Replace the prepackaged scoring system's per-game allocator with a
          variation you built in the workshop. NULL = use the prepackaged
          default.
        </p>
        <div className="space-y-1">
          <Label>Variation</Label>
          <Select value={selectedId} onValueChange={handleSelect}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE_VALUE}>
                Use prepackaged default
              </SelectItem>
              {room.officials.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name} (official)
                </SelectItem>
              ))}
              {room.mine.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {preview && !preview.ok && (
          <div className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
            Preview blocked: {preview.reason}
          </div>
        )}
        {preview && preview.ok && preview.warnings.length > 0 && (
          <div className="rounded-md border border-warning bg-warning/10 p-3 text-sm">
            <div className="mb-1 font-medium">
              Preview ran with warnings:
            </div>
            <ul className="list-inside list-disc">
              {preview.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">
              You can still apply this pick — the warnings are advisory.
            </p>
          </div>
        )}
        {preview && preview.ok && preview.warnings.length === 0 && (
          <div className="rounded-md border border-success bg-success/10 p-3 text-sm">
            Preview clean.
          </div>
        )}
        {status && <p className="text-sm text-muted-foreground">{status}</p>}
        <Button onClick={handleApply} disabled={blockApply} loadingText="none">
          Apply
        </Button>
      </CardContent>
    </Card>
  );
}
