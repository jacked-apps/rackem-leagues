/**
 * @fileoverview Editor shell for a Threshold module.
 *
 * A threshold is ONE resolver: `home + away → one number`. The LO sets a
 * display label + description (the generic resolvable key stays fixed
 * underneath), an expansion mode (how the value fans out), and the lookup —
 * a **formula** or a **chart** (the two interchangeable authoring views). On
 * save the active view's definition is dry-run through the real resolver
 * (`saveTimeGuard`) before it persists.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { FormulaView } from './FormulaView';
import { ChartView } from './ChartView';
import { thresholdSaveGuard } from './saveTimeGuard';
import type { ThresholdExpansionMode, Expression } from '@/systems/points-system/types';
import type { ResolvedChart } from '@/systems/threshold-charts/lookupChartRows';
import type { ThresholdDefinition, ThresholdRoomRow } from './useThresholdRoom';

type LookupView = 'formula' | 'chart';
type OutputField = 'result_1' | 'result_2' | 'result_3';

const EXPANSION_LABELS: Record<ThresholdExpansionMode, string> = {
  single: 'One value (side-less)',
  home_away: 'Home & away (mirrored)',
  per_pairing: 'Per pairing (race charts)',
};

function initialFormula(row: ThresholdRoomRow): Expression {
  const def = row.definition;
  if (def.operationKind === 'evaluate_expression') {
    const expr = def.operationArgs.expression;
    if (expr && typeof expr === 'object' && 'kind' in (expr as object)) return expr as Expression;
  }
  return { kind: 'const', value: 0 };
}

function initialChart(row: ThresholdRoomRow): {
  chart: ResolvedChart | null;
  outputField: OutputField;
} {
  const def = row.definition;
  if (def.operationKind === 'chart_lookup') {
    const embedded = def.operationArgs.chart;
    const field = def.operationArgs.output_field;
    const chart =
      embedded && typeof embedded === 'object' && Array.isArray((embedded as { rows?: unknown }).rows)
        ? (embedded as ResolvedChart)
        : null;
    return {
      chart,
      outputField:
        field === 'result_1' || field === 'result_2' || field === 'result_3' ? field : 'result_1',
    };
  }
  return { chart: null, outputField: 'result_1' };
}

export interface ThresholdEditorProps {
  readonly initial: ThresholdRoomRow;
  readonly onSave: (row: ThresholdRoomRow) => Promise<boolean>;
  readonly onCancel: () => void;
}

export function ThresholdEditor({ initial, onSave, onCancel }: ThresholdEditorProps) {
  const [label, setLabel] = useState(initial.label);
  const [description, setDescription] = useState(initial.description ?? '');
  const [view, setView] = useState<LookupView>(
    initial.definition.operationKind === 'chart_lookup' ? 'chart' : 'formula',
  );
  const [expansionMode, setExpansionMode] = useState<ThresholdExpansionMode>(initial.expansion_mode);
  const [activeDef, setActiveDef] = useState<ThresholdDefinition | null>(initial.definition);
  const [chartIsRace, setChartIsRace] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const expansionOptions = useMemo<ThresholdExpansionMode[]>(
    () => (view === 'chart' && chartIsRace ? ['single', 'home_away', 'per_pairing'] : ['single', 'home_away']),
    [view, chartIsRace],
  );

  // Keep the expansion mode valid for the current options.
  useEffect(() => {
    if (!expansionOptions.includes(expansionMode)) setExpansionMode('home_away');
  }, [expansionOptions, expansionMode]);

  const handleFormulaChange = useCallback((def: ThresholdDefinition | null) => {
    setActiveDef(def);
  }, []);
  const handleChartChange = useCallback((def: ThresholdDefinition | null, isRace: boolean) => {
    setActiveDef(def);
    setChartIsRace(isRace);
  }, []);

  const switchView = (next: LookupView) => {
    setView(next);
    setActiveDef(null); // the newly-mounted view re-emits its own definition
    setError(null);
  };

  const handleSave = async () => {
    if (label.trim().length === 0) {
      setError('Give your threshold a name.');
      return;
    }
    if (!activeDef) {
      setError(view === 'formula' ? 'Finish building the formula.' : 'Pick a chart.');
      return;
    }
    setSaving(true);
    const guard = await thresholdSaveGuard(activeDef, expansionMode);
    if (!guard.ok) {
      setSaving(false);
      setError(guard.reason);
      return;
    }
    const ok = await onSave({
      ...initial,
      label: label.trim(),
      description: description.trim() === '' ? null : description.trim(),
      expansion_mode: expansionMode,
      definition: activeDef,
    });
    setSaving(false);
    if (!ok) setError('Save failed — check the values and try again.');
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
        <Select value={expansionMode} onValueChange={(v) => setExpansionMode(v as ThresholdExpansionMode)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {expansionOptions.map((m) => (
              <SelectItem key={m} value={m}>
                {EXPANSION_LABELS[m]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-sm">How is the number figured out?</Label>
        <Select value={view} onValueChange={(v) => switchView(v as LookupView)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="formula">A formula</SelectItem>
            <SelectItem value="chart">A chart (lookup table)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {view === 'formula' ? (
        <FormulaView initial={initialFormula(initial)} onChange={handleFormulaChange} />
      ) : (
        <ChartView initial={initialChart(initial)} onChange={handleChartChange} />
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

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
