/**
 * @fileoverview The organizer's Info tab — edit the tournament (Unit C3).
 *
 * These were set once on the create page and then unreachable, which is wrong
 * for a tournament that deliberately sits in setup for an evening: a name gets
 * typed in a hurry, and the game or format often isn't decided until people
 * turn up.
 *
 * Everything here is locked once the tournament starts — the match tree is
 * generated FROM the format, so changing it afterwards would leave the bracket
 * describing rules it wasn't built to. The mutation enforces that too; this
 * just doesn't offer what would be refused.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { GAME_TYPES } from '../gameTypes';
import type { BracketFormat } from '@/types/bracket';
import type { BracketSettings } from '@/api/mutations/brackets';

interface BracketInfoTabProps {
  settings: BracketSettings;
  /** Save; rejects with a user-facing message. */
  onSave: (settings: BracketSettings) => Promise<unknown>;
  saving?: boolean;
}

export function BracketInfoTab({ settings, onSave, saving = false }: BracketInfoTabProps) {
  const [draft, setDraft] = useState<BracketSettings>(settings);

  const set = <K extends keyof BracketSettings>(key: K, value: BracketSettings[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  // Nothing to save until something actually differs — a live Save button on an
  // untouched form invites a pointless write.
  const changed =
    draft.name.trim() !== settings.name.trim() ||
    draft.format !== settings.format ||
    draft.grandFinalReset !== settings.grandFinalReset ||
    draft.gameType !== settings.gameType;

  const isDouble = draft.format === 'double_elimination';

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (changed && draft.name.trim()) void onSave(draft);
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="tournament-name">Tournament name</Label>
        <Input
          id="tournament-name"
          value={draft.name}
          onChange={(e) => set('name', e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="tournament-game">Game</Label>
        <Select
          value={draft.gameType ?? undefined}
          onValueChange={(v) => set('gameType', v)}
        >
          <SelectTrigger id="tournament-game">
            <SelectValue placeholder="Pick a game" />
          </SelectTrigger>
          <SelectContent>
            {GAME_TYPES.map((g) => (
              <SelectItem key={g.value} value={g.value}>
                {g.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="tournament-format">Format</Label>
        <Select
          value={draft.format}
          onValueChange={(v) => set('format', v as BracketFormat)}
        >
          <SelectTrigger id="tournament-format">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="single_elimination">
              Single elimination — one loss and you're out
            </SelectItem>
            <SelectItem value="double_elimination">
              Double elimination — out on the second loss
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Meaningless in a single-elimination bracket, so it isn't offered. */}
      {isDouble && (
        <div className="flex items-start justify-between gap-4">
          <Label htmlFor="grand-final-reset" className="font-normal">
            Winners-side player must be beaten twice
            <span className="mt-0.5 block text-xs text-muted-foreground">
              The true double-elimination final — an unbeaten finalist can't go
              out on a single loss.
            </span>
          </Label>
          <Switch
            id="grand-final-reset"
            checked={draft.grandFinalReset}
            onCheckedChange={(v) => set('grandFinalReset', v)}
          />
        </div>
      )}

      <Button
        type="submit"
        className="w-full"
        loadingText="Saving…"
        isLoading={saving}
        disabled={!changed || !draft.name.trim()}
      >
        Save changes
      </Button>
    </form>
  );
}
