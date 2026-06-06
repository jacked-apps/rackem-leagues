/**
 * @fileoverview Editor for the trigger's CONDITION half.
 *
 * Two modes, picked via a dropdown:
 *
 *   - **Always** — `{ kind: 'always' }`. The trigger fires whenever its
 *     phase runs and re-arm permits.
 *   - **Compare** — `{ kind: 'compare', left, op, right }`. Each operand
 *     is either a state-bag var (picked from `TRIGGER_AVAILABLE_DATA`)
 *     or a literal number.
 *
 * Conditions never compute (that's the ACTION's job per
 * `docs/league-system/modules/points-system/trigger.md`), so there is
 * no arithmetic; just a single flat comparison.
 */

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { TRIGGER_AVAILABLE_DATA } from './availableData';
import type {
  Condition,
  ConditionOperand,
} from '@/systems/points-system/types';

type Comparator = '==' | '>' | '<' | '>=' | '<=';
const COMPARATORS: readonly Comparator[] = ['==', '>', '<', '>=', '<='];

export interface ConditionBuilderProps {
  readonly value: Condition;
  readonly onChange: (next: Condition) => void;
}

export function ConditionBuilder({ value, onChange }: ConditionBuilderProps) {
  const kind = value.kind;

  const switchKind = (next: 'always' | 'compare') => {
    if (next === 'always') {
      onChange({ kind: 'always' });
      return;
    }
    onChange({
      kind: 'compare',
      left: { kind: 'var', name: 'games_played' },
      op: '==',
      right: { kind: 'const', value: 0 },
    });
  };

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs uppercase text-muted-foreground">
          When (condition)
        </Label>
        <Select value={kind} onValueChange={(v) => switchKind(v as 'always' | 'compare')}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="always">Always</SelectItem>
            <SelectItem value="compare">When … {'{op}'} …</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {kind === 'always' ? (
        <p className="text-xs text-muted-foreground">
          Always true. The trigger fires whenever its phase runs and re-arm permits.
        </p>
      ) : (
        <CompareEditor value={value} onChange={onChange} />
      )}
    </div>
  );
}

function CompareEditor({
  value,
  onChange,
}: {
  value: Extract<Condition, { kind: 'compare' }>;
  onChange: (next: Condition) => void;
}) {
  const setLeft = (next: ConditionOperand) =>
    onChange({ ...value, left: next });
  const setRight = (next: ConditionOperand) =>
    onChange({ ...value, right: next });
  const setOp = (next: (typeof COMPARATORS)[number]) =>
    onChange({ ...value, op: next });

  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto_1fr]">
      <OperandEditor heading="Left" value={value.left} onChange={setLeft} />
      <div className="flex flex-col items-center justify-end">
        <Label className="text-sm">Compare</Label>
        <Select value={value.op} onValueChange={(v) => setOp(v as typeof value.op)}>
          <SelectTrigger className="w-20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {COMPARATORS.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <OperandEditor heading="Right" value={value.right} onChange={setRight} />
    </div>
  );
}

function OperandEditor({
  heading,
  value,
  onChange,
}: {
  heading: string;
  value: ConditionOperand;
  onChange: (next: ConditionOperand) => void;
}) {
  const opKind = value.kind;
  return (
    <div className="space-y-1">
      <Label className="text-sm">{heading}</Label>
      <Select
        value={opKind}
        onValueChange={(v) => {
          if (v === 'const') onChange({ kind: 'const', value: 0 });
          else
            onChange({
              kind: 'var',
              name: TRIGGER_AVAILABLE_DATA[0]!.name,
            });
        }}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="var">A state-bag value</SelectItem>
          <SelectItem value="const">A literal number</SelectItem>
        </SelectContent>
      </Select>
      {opKind === 'var' ? (
        <Select
          value={value.name}
          onValueChange={(v) => onChange({ kind: 'var', name: v })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TRIGGER_AVAILABLE_DATA.map((d) => (
              <SelectItem key={d.name} value={d.name}>
                {d.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input
          type="number"
          step="any"
          value={value.value}
          onChange={(e) =>
            onChange({ kind: 'const', value: Number(e.target.value) })
          }
        />
      )}
    </div>
  );
}
