/**
 * @fileoverview Editor for a Threshold module (formula view).
 *
 * A threshold is ONE resolver: `home + away → one number`, written to the
 * state bag. The LO sets:
 *   - a display **label** + description (the generic resolvable key stays
 *     fixed underneath — see `useThresholdRoom.generateThresholdKey`);
 *   - an **expansion mode** — how the value fans out (a single side-less
 *     value, or a home/away mirror authored once from the neutral
 *     `this_side`/`other_side` perspective);
 *   - the **formula** (this view) that computes the number, built with the
 *     shared `ExpressionBuilder` over the threshold virtuals.
 *
 * The chart view (a lookup table instead of a formula) is the other half of
 * the lookup-side fork and lands with the chart editor; this editor handles
 * formula-defined thresholds.
 */

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  ExpressionBuilder,
} from '../_shared/ExpressionBuilder';
import {
  expressionToTokens,
  tokensToExpression,
  type FormulaToken,
} from '../per-game-allocator/formulaTokens';
import { THRESHOLD_AVAILABLE_DATA, thresholdLabelForVar } from './availableData';
import type { ThresholdExpansionMode, Expression } from '@/systems/points-system/types';
import type { ThresholdRoomRow } from './useThresholdRoom';

/** Expansion modes the FORMULA view supports (per_pairing is chart-only). */
const FORMULA_EXPANSION_MODES: ReadonlyArray<{
  readonly value: ThresholdExpansionMode;
  readonly label: string;
}> = [
  { value: 'single', label: 'One value (side-less)' },
  { value: 'home_away', label: 'Home & away (mirrored)' },
];

/** Pull the editable formula expression out of a row's definition. */
function initialExpression(row: ThresholdRoomRow): Expression {
  const def = row.definition;
  if (def.operationKind === 'evaluate_expression') {
    const expr = def.operationArgs.expression;
    if (expr && typeof expr === 'object' && 'kind' in (expr as object)) {
      return expr as Expression;
    }
  }
  return { kind: 'const', value: 0 };
}

export interface ThresholdEditorProps {
  readonly initial: ThresholdRoomRow;
  readonly onSave: (row: ThresholdRoomRow) => Promise<boolean>;
  readonly onCancel: () => void;
}

export function ThresholdEditor({ initial, onSave, onCancel }: ThresholdEditorProps) {
  const [label, setLabel] = useState(initial.label);
  const [description, setDescription] = useState(initial.description ?? '');
  const [expansionMode, setExpansionMode] = useState<ThresholdExpansionMode>(
    initial.expansion_mode === 'per_pairing' ? 'home_away' : initial.expansion_mode,
  );
  const [tokens, setTokens] = useState<FormulaToken[]>(() =>
    expressionToTokens(initialExpression(initial)),
  );
  const [parseError, setParseError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Re-sync when the parent swaps the row wholesale.
  useEffect(() => {
    setLabel(initial.label);
    setDescription(initial.description ?? '');
    setExpansionMode(
      initial.expansion_mode === 'per_pairing' ? 'home_away' : initial.expansion_mode,
    );
    setTokens(expressionToTokens(initialExpression(initial)));
    setParseError(null);
  }, [initial]);

  const handleTokensChange = (next: FormulaToken[]) => {
    setTokens(next);
    if (next.length === 0) {
      setParseError('The formula is empty.');
      return;
    }
    const parsed = tokensToExpression(next);
    setParseError(parsed.ok ? null : parsed.reason);
  };

  const handleSave = async () => {
    const parsed = tokensToExpression(tokens);
    if (!parsed.ok) {
      setParseError(parsed.reason);
      return;
    }
    if (label.trim().length === 0) {
      setParseError('Give your threshold a name.');
      return;
    }
    setSaving(true);
    const ok = await onSave({
      ...initial,
      label: label.trim(),
      description: description.trim() === '' ? null : description.trim(),
      expansion_mode: expansionMode,
      definition: {
        operationKind: 'evaluate_expression',
        operationArgs: { expression: parsed.expression },
      },
    });
    setSaving(false);
    if (!ok) setParseError('Save failed — check the values and try again.');
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label className="text-sm">Name</Label>
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Finish line" />
      </div>
      <div className="space-y-1">
        <Label className="text-sm">Description</Label>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What this threshold figures out."
        />
      </div>

      <div className="space-y-1">
        <Label className="text-sm">Is this for home and away?</Label>
        <Select
          value={expansionMode}
          onValueChange={(v) => setExpansionMode(v as ThresholdExpansionMode)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FORMULA_EXPANSION_MODES.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {expansionMode === 'home_away'
            ? 'Build it once from "my side" — we make the away mirror for you.'
            : 'One value, the same for everybody.'}
        </p>
      </div>

      <div className="space-y-2 rounded-md border p-3">
        <Label className="text-xs uppercase text-muted-foreground">Formula</Label>
        <p className="text-xs text-muted-foreground">
          Build the number. Click a pill to remove it; click a gap to move the cursor.
        </p>
        <ExpressionBuilder
          tokens={tokens}
          onChange={handleTokensChange}
          availableData={THRESHOLD_AVAILABLE_DATA}
          labelForVar={thresholdLabelForVar}
        />
        {parseError && (
          <p className="text-xs text-destructive">{parseError}</p>
        )}
      </div>

      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={saving} loadingText="Saving…" isLoading={saving}>
          Save
        </Button>
        <Button variant="outline" loadingText="none" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
