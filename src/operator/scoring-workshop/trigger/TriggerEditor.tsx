/**
 * @fileoverview Editor for a single trigger variation.
 *
 * Composes name + description + TYPE + ConditionBuilder + ActionBuilder
 * + RE-ARM picker + the save-time guard. Save is disabled when the
 * name is empty; the guard runs on click and renders any rejection
 * inline.
 *
 * Order is intentionally absent here — per the locked spec, fire order
 * is a scoring-system-room concern, not a trigger-room concern. The
 * trigger row stores everything except order; the future scoring system
 * room assigns order when assembling the composition.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConditionBuilder } from './ConditionBuilder';
import { ActionBuilder } from './ActionBuilder';
import { runSaveTimeGuard } from './saveTimeGuard';
import { toTrigger, type TriggerRow } from './useTriggerRoom';
import type { ReArm, TriggerType } from '@/systems/points-system/types';

const TRIGGER_TYPES: readonly { value: TriggerType; label: string; hint: string }[] = [
  {
    value: 'match_start',
    label: 'At match start',
    hint: 'Fires once when the match begins, after thresholds resolve.',
  },
  {
    value: 'anytime',
    label: 'During the match',
    hint: 'Fires during the per-game phase, subject to re-arm.',
  },
  {
    value: 'match_end',
    label: 'At match end',
    hint: 'Fires once after all games are played.',
  },
];

// `manual` is a valid ReArm in the locked spec
// (`docs/league-system/modules/points-system/trigger.md`) but the reset
// mechanism that makes it different from `single_shot` doesn't exist
// yet — re-add to the dropdown when that surface ships.
const REARMS: readonly { value: ReArm; label: string; hint: string }[] = [
  { value: 'single_shot', label: 'Once per match', hint: 'Fires at most once.' },
  { value: 'periodic', label: 'Every time it holds', hint: 'May fire repeatedly while the condition holds.' },
];

export interface TriggerEditorProps {
  readonly initial: TriggerRow;
  readonly onSave: (row: TriggerRow) => Promise<boolean>;
  readonly onCancel: () => void;
}

export function TriggerEditor({ initial, onSave, onCancel }: TriggerEditorProps) {
  const [row, setRow] = useState<TriggerRow>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const canSave = row.name.trim().length > 0 && !saving;

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    const guard = runSaveTimeGuard(toTrigger(row));
    if (!guard.ok) {
      setError(guard.reason);
      setSaving(false);
      return;
    }
    const ok = await onSave(row);
    setSaving(false);
    if (!ok) setError('Save failed. Check console for details.');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit trigger</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="trigger-name">Name</Label>
          <Input
            id="trigger-name"
            value={row.name}
            onChange={(e) => setRow({ ...row, name: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="trigger-desc">Description</Label>
          <Textarea
            id="trigger-desc"
            value={row.description ?? ''}
            onChange={(e) => setRow({ ...row, description: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs uppercase text-muted-foreground">Fires</Label>
          <Select
            value={row.trigger_type}
            onValueChange={(v) => setRow({ ...row, trigger_type: v as TriggerType })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TRIGGER_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  <div className="flex flex-col">
                    <span>{t.label}</span>
                    <span className="text-xs text-muted-foreground">{t.hint}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <ConditionBuilder
          value={row.condition}
          onChange={(next) => setRow({ ...row, condition: next })}
        />
        <ActionBuilder
          value={row.action}
          onChange={(next) => setRow({ ...row, action: next })}
        />
        <div className="space-y-1">
          <Label className="text-xs uppercase text-muted-foreground">Re-arm</Label>
          <Select
            value={row.rearm}
            onValueChange={(v) => setRow({ ...row, rearm: v as ReArm })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REARMS.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  <div className="flex flex-col">
                    <span>{r.label}</span>
                    <span className="text-xs text-muted-foreground">{r.hint}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {error && (
          <div className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={!canSave} isLoading={saving} loadingText="Saving…">
            Save
          </Button>
          <Button variant="outline" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
