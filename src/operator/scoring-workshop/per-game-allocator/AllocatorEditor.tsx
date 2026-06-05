/**
 * @fileoverview Editor for a single per-game allocator variation.
 *
 * Composes name + description + winner SideEditor + loser SideEditor +
 * the save-time guard. Save is disabled when the name is empty; the guard
 * runs on click and renders any rejection inline. Officials are not
 * editable here (the parent list never opens them for edit — only "Make a
 * copy I can edit"), so this component assumes a user-scope row.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SideEditor } from './SideEditor';
import { runSaveTimeGuard } from './saveTimeGuard';
import { toPerGameAllocator, type AllocatorRow } from './useAllocatorRoom';

export interface AllocatorEditorProps {
  readonly initial: AllocatorRow;
  readonly onSave: (row: AllocatorRow) => Promise<boolean>;
  readonly onCancel: () => void;
}

export function AllocatorEditor({ initial, onSave, onCancel }: AllocatorEditorProps) {
  const [row, setRow] = useState<AllocatorRow>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const canSave = row.name.trim().length > 0 && !saving;

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    const guard = runSaveTimeGuard(toPerGameAllocator(row));
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
        <CardTitle>Edit per-game allocator</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="alloc-name">Name</Label>
          <Input
            id="alloc-name"
            value={row.name}
            onChange={(e) => setRow({ ...row, name: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="alloc-desc">Description</Label>
          <Textarea
            id="alloc-desc"
            value={row.description ?? ''}
            onChange={(e) => setRow({ ...row, description: e.target.value })}
          />
        </div>
        <SideEditor
          heading="Winner side"
          value={row.winner_side}
          onChange={(next) => setRow({ ...row, winner_side: next })}
          perspective="winner"
        />
        <SideEditor
          heading="Loser side"
          value={row.loser_side}
          onChange={(next) => setRow({ ...row, loser_side: next })}
          perspective="loser"
        />
        {error && (
          <div className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
        <div className="flex gap-2">
          <Button
            onClick={handleSave}
            disabled={!canSave}
            isLoading={saving}
            loadingText="Saving…"
          >
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
