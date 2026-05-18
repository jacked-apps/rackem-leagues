/**
 * @fileoverview Editor for individual awards (Top Shooter,
 * Outstanding Achievement, etc.). Awards default to two presets the
 * brainstorm settled on:
 *   - 🏆 Top Shooter — comes out of the prize pool
 *   - 🎁 Outstanding Achievement — LO-funded by default (Ed's pattern)
 *
 * LO can add custom awards too. `loFunded=true` means "out of LO's
 * pocket, doesn't reduce the team pool."
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, Award } from 'lucide-react';
import type { IndividualAward } from '@/utils/finances';

interface IndividualAwardsEditorProps {
  awards: IndividualAward[];
  onChange: (awards: IndividualAward[]) => void;
}

const newAwardId = () => `award-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export function IndividualAwardsEditor({ awards, onChange }: IndividualAwardsEditorProps) {
  const [adding, setAdding] = useState(false);
  const [draftLabel, setDraftLabel] = useState('');
  const [draftAmount, setDraftAmount] = useState('');
  const [draftLoFunded, setDraftLoFunded] = useState(false);

  const totalFromPool = awards.filter((a) => !a.loFunded).reduce((acc, a) => acc + a.amount, 0);
  const totalLoFunded = awards.filter((a) => a.loFunded).reduce((acc, a) => acc + a.amount, 0);

  const updateAward = (id: string, patch: Partial<IndividualAward>) => {
    onChange(awards.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  };

  const removeAward = (id: string) => {
    onChange(awards.filter((a) => a.id !== id));
  };

  const addAward = () => {
    const amt = parseFloat(draftAmount);
    if (!draftLabel.trim() || !isFinite(amt) || amt <= 0) return;
    onChange([
      ...awards,
      { id: newAwardId(), label: draftLabel.trim(), amount: amt, loFunded: draftLoFunded },
    ]);
    setDraftLabel('');
    setDraftAmount('');
    setDraftLoFunded(false);
    setAdding(false);
  };

  return (
    <div className="space-y-2">
      {awards.map((a) => (
        <div key={a.id} className="grid grid-cols-[1fr_120px_auto_auto] gap-2 items-center">
          <Input
            value={a.label}
            onChange={(e) => updateAward(a.id, { label: e.target.value })}
            placeholder="Award name"
          />
          <Input
            type="number"
            step="0.01"
            min="0"
            value={a.amount}
            onChange={(e) => updateAward(a.id, { amount: parseFloat(e.target.value) || 0 })}
          />
          <label className="flex items-center gap-1 text-xs cursor-pointer whitespace-nowrap">
            <Checkbox
              checked={a.loFunded}
              onCheckedChange={(c) => updateAward(a.id, { loFunded: !!c })}
            />
            🎁 LO-funded
          </label>
          <Button
            variant="ghost"
            size="sm"
            loadingText="none"
            onClick={() => removeAward(a.id)}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}

      {adding && (
        <div className="border rounded-lg p-2 space-y-2 bg-muted/30">
          <div className="grid grid-cols-[1fr_120px] gap-2">
            <Input
              value={draftLabel}
              onChange={(e) => setDraftLabel(e.target.value)}
              placeholder="Award name"
              autoFocus
            />
            <Input
              type="number"
              step="0.01"
              min="0"
              value={draftAmount}
              onChange={(e) => setDraftAmount(e.target.value)}
              placeholder="$0.00"
            />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={draftLoFunded} onCheckedChange={(c) => setDraftLoFunded(!!c)} />
            🎁 LO-funded (doesn't reduce prize pool)
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" loadingText="none" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button loadingText="none" onClick={addAward}>
              Add
            </Button>
          </div>
        </div>
      )}

      {!adding && (
        <Button
          variant="outline"
          size="sm"
          loadingText="none"
          onClick={() => setAdding(true)}
          className="gap-1"
        >
          <Plus className="h-3.5 w-3.5" />
          Add award
        </Button>
      )}

      {awards.length > 0 && (
        <div className="flex justify-between text-xs text-muted-foreground pt-2 border-t">
          <span className="flex items-center gap-1">
            <Award className="h-3 w-3" />
            From pool: ${totalFromPool.toFixed(2)}
          </span>
          <span>🎁 LO-funded: ${totalLoFunded.toFixed(2)}</span>
        </div>
      )}
    </div>
  );
}

/** Default starter awards seeded into a new calculator session. */
export function defaultIndividualAwards(): IndividualAward[] {
  return [
    { id: newAwardId(), label: '🏆 Top Shooter', amount: 100, loFunded: false },
    { id: newAwardId(), label: '🎁 Outstanding Achievement', amount: 50, loFunded: true },
  ];
}
