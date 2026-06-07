/**
 * @fileoverview Chart sub-view of the threshold editor. Points the threshold at
 * an existing chart + an output column, reporting a `chart_lookup` definition
 * up to the editor shell.
 *
 * v1 lets the LO select a chart (the global templates) and which result column
 * to read. Editing a chart's numbers (the lookup-table editor) is coupled to
 * chart ownership/league-binding and lands with that work — see the plan.
 */

import { useEffect, useState } from 'react';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  listSelectableCharts,
  type SelectableChart,
} from '@/api/queries/thresholdCharts';
import type { ChartType } from '@/systems/threshold-charts/lookupChartRows';
import type { ThresholdDefinition } from './useThresholdRoom';

type OutputField = 'result_1' | 'result_2' | 'result_3';

function isRaceType(t: ChartType | undefined): boolean {
  return t === 'race_points' || t === 'race_percentage';
}

/** Output-column choices, labeled for the chart's format. */
function outputOptions(t: ChartType | undefined): ReadonlyArray<{ value: OutputField; label: string }> {
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

export interface ChartViewProps {
  readonly initial: { readonly chartId: string | null; readonly outputField: OutputField };
  readonly onChange: (def: ThresholdDefinition | null, isRace: boolean) => void;
}

export function ChartView({ initial, onChange }: ChartViewProps) {
  const [charts, setCharts] = useState<SelectableChart[]>([]);
  const [chartId, setChartId] = useState<string | null>(initial.chartId);
  const [outputField, setOutputField] = useState<OutputField>(initial.outputField);

  useEffect(() => {
    void listSelectableCharts().then(setCharts);
  }, []);

  const selected = charts.find((c) => c.id === chartId);
  const isRace = isRaceType(selected?.chartType);

  // Emit whenever the selection resolves to a complete definition.
  useEffect(() => {
    if (chartId) {
      onChange(
        {
          operationKind: 'chart_lookup',
          operationArgs: { chart_id: chartId, output_field: outputField },
        },
        isRace,
      );
    } else {
      onChange(null, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartId, outputField, isRace]);

  return (
    <div className="space-y-3 rounded-md border p-3">
      <Label className="text-xs uppercase text-muted-foreground">Chart</Label>
      <div className="space-y-1">
        <Label className="text-sm">Use this chart</Label>
        <Select value={chartId ?? ''} onValueChange={(v) => setChartId(v)}>
          <SelectTrigger>
            <SelectValue placeholder="Pick a chart…" />
          </SelectTrigger>
          <SelectContent>
            {charts.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-sm">Read which number</Label>
        <Select value={outputField} onValueChange={(v) => setOutputField(v as OutputField)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {outputOptions(selected?.chartType).map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <p className="text-xs text-muted-foreground">
        Editing a chart's numbers is coming with league setup. For now, point at a chart and pick
        the column to read.
      </p>
    </div>
  );
}
