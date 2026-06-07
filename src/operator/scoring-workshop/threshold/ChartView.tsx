/**
 * @fileoverview Chart sub-view of the threshold editor — an inline editable
 * lookup table.
 *
 * The chart's rows live EMBEDDED in the threshold's own definition (clone-to-
 * own, exactly like the allocator embeds winner_side/loser_side), so editing a
 * cloned official means tweaking its real numbers right here. When there's no
 * chart yet (e.g. switching a formula threshold to the chart view), the LO
 * starts from one of the global charts, which copies its rows in to edit.
 *
 * Emits a `chart_lookup` definition with the embedded chart + the chosen output
 * column. Team charts (1D) edit comp_1 + win/tie/lose; race charts (2D) also
 * edit comp_2 (their runtime resolution is the deferred per-pairing work).
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
  fetchResolvedChart,
  listSelectableCharts,
  type SelectableChart,
} from '@/api/queries/thresholdCharts';
import type {
  ChartRow,
  ChartType,
  ResolvedChart,
} from '@/systems/threshold-charts/lookupChartRows';
import type { ThresholdDefinition } from './useThresholdRoom';

type OutputField = 'result_1' | 'result_2' | 'result_3';

function isRaceType(t: ChartType): boolean {
  return t === 'race_points' || t === 'race_percentage';
}

function outputOptions(t: ChartType): ReadonlyArray<{ value: OutputField; label: string }> {
  if (isRaceType(t)) {
    return [
      { value: 'result_1', label: 'Player 1 games to win' },
      { value: 'result_3', label: 'Player 2 games to win' },
    ];
  }
  return [
    { value: 'result_1', label: 'Games to win' },
    { value: 'result_2', label: 'Games to tie' },
    { value: 'result_3', label: 'Games to lose' },
  ];
}

const BLANK_ROW: ChartRow = { comp_1: 0, comp_2: null, result_1: 0, result_2: null, result_3: 0 };

export interface ChartViewProps {
  readonly initial: { readonly chart: ResolvedChart | null; readonly outputField: OutputField };
  readonly onChange: (def: ThresholdDefinition | null, isRace: boolean) => void;
}

export function ChartView({ initial, onChange }: ChartViewProps) {
  const [chart, setChart] = useState<ResolvedChart | null>(initial.chart);
  const [outputField, setOutputField] = useState<OutputField>(initial.outputField);
  const [pickable, setPickable] = useState<SelectableChart[]>([]);

  useEffect(() => {
    if (!chart) void listSelectableCharts().then(setPickable);
  }, [chart]);

  // Emit the definition whenever the chart or output column changes.
  useEffect(() => {
    if (chart) {
      onChange(
        {
          operationKind: 'chart_lookup',
          operationArgs: { output_field: outputField, chart },
        },
        isRaceType(chart.chartType),
      );
    } else {
      onChange(null, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chart, outputField]);

  const startFrom = async (chartId: string) => {
    const loaded = await fetchResolvedChart(chartId);
    if (loaded) setChart(loaded);
  };

  const setRows = (rows: ChartRow[]) =>
    setChart((c) => (c ? { ...c, rows } : c));

  const updateCell = (idx: number, field: keyof ChartRow, raw: string) => {
    if (!chart) return;
    const next = chart.rows.map((r, i) => {
      if (i !== idx) return r;
      const value = raw.trim() === '' ? null : Number(raw);
      return { ...r, [field]: value };
    });
    setRows(next);
  };

  if (!chart) {
    return (
      <div className="space-y-2 rounded-md border p-3">
        <Label className="text-xs uppercase text-muted-foreground">Chart</Label>
        <Label className="text-sm">Start from a chart</Label>
        <Select value="" onValueChange={startFrom}>
          <SelectTrigger>
            <SelectValue placeholder="Pick a chart to copy and edit…" />
          </SelectTrigger>
          <SelectContent>
            {pickable.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Its numbers copy in so you can tweak your own version.
        </p>
      </div>
    );
  }

  const isRace = isRaceType(chart.chartType);

  return (
    <div className="space-y-3 rounded-md border p-3">
      <Label className="text-xs uppercase text-muted-foreground">Chart</Label>

      <div className="space-y-1">
        <Label className="text-sm">Read which number</Label>
        <Select value={outputField} onValueChange={(v) => setOutputField(v as OutputField)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {outputOptions(chart.chartType).map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="p-1">{isRace ? 'P1 handicap' : 'Handicap gap'}</th>
              {isRace && <th className="p-1">P2 handicap</th>}
              <th className="p-1">{isRace ? 'P1 wins' : 'Win'}</th>
              {!isRace && <th className="p-1">Tie</th>}
              <th className="p-1">{isRace ? 'P2 wins' : 'Lose'}</th>
              <th className="p-1"></th>
            </tr>
          </thead>
          <tbody>
            {chart.rows.map((row, idx) => (
              <tr key={idx}>
                <td className="p-1"><CellInput value={row.comp_1} onChange={(v) => updateCell(idx, 'comp_1', v)} /></td>
                {isRace && <td className="p-1"><CellInput value={row.comp_2} onChange={(v) => updateCell(idx, 'comp_2', v)} /></td>}
                <td className="p-1"><CellInput value={row.result_1} onChange={(v) => updateCell(idx, 'result_1', v)} /></td>
                {!isRace && <td className="p-1"><CellInput value={row.result_2} onChange={(v) => updateCell(idx, 'result_2', v)} /></td>}
                <td className="p-1"><CellInput value={row.result_3} onChange={(v) => updateCell(idx, 'result_3', v)} /></td>
                <td className="p-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    loadingText="none"
                    onClick={() => setRows(chart.rows.filter((_, i) => i !== idx))}
                  >
                    ✕
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Button
        size="sm"
        variant="outline"
        loadingText="none"
        onClick={() => setRows([...chart.rows, { ...BLANK_ROW }])}
      >
        Add row
      </Button>
      <p className="text-xs text-muted-foreground">
        These are your copy's numbers — tweak them freely. Leave a cell blank for "no value".
      </p>
    </div>
  );
}

function CellInput({
  value,
  onChange,
}: {
  readonly value: number | null;
  readonly onChange: (raw: string) => void;
}) {
  return (
    <Input
      className="h-8 w-20"
      type="number"
      step="any"
      value={value === null ? '' : value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
