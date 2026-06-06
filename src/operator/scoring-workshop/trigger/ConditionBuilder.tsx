/**
 * @fileoverview Editor for the trigger's CONDITION half.
 *
 * Mirrors the allocator's `FormulaBuilder` feel: a visible "strip" up
 * top showing what the condition reads as in plain English, with the
 * editing controls below. No coder jargon — comparators read as "is
 * equal to" / "is more than" rather than `==` / `>`, and operands are
 * plain-language data names from the same registry the ACTION uses.
 *
 * Two modes:
 *
 *   - **Always** — `{ kind: 'always' }`. The trigger fires whenever its
 *     phase runs and re-arm permits.
 *   - **Compare** — `{ kind: 'compare', left, op, right }`. Each operand
 *     is either a state-bag var (picked from `TRIGGER_AVAILABLE_DATA`)
 *     or a literal number.
 *
 * Conditions never compute (locked in
 * `docs/league-system/modules/points-system/trigger.md`); just a single
 * flat comparison.
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
import {
  TRIGGER_AVAILABLE_DATA,
  triggerLabelForVar,
} from './availableData';
import type {
  Condition,
  ConditionOperand,
} from '@/systems/points-system/types';

type Comparator = '==' | '>' | '<' | '>=' | '<=';

const COMPARATORS: readonly { value: Comparator; phrase: string }[] = [
  { value: '==', phrase: 'is equal to' },
  { value: '>', phrase: 'is more than' },
  { value: '<', phrase: 'is less than' },
  { value: '>=', phrase: 'is at least' },
  { value: '<=', phrase: 'is no more than' },
];

function comparatorPhrase(op: Comparator): string {
  return COMPARATORS.find((c) => c.value === op)?.phrase ?? op;
}

export interface ConditionBuilderProps {
  readonly value: Condition;
  readonly onChange: (next: Condition) => void;
}

export function ConditionBuilder({ value, onChange }: ConditionBuilderProps) {
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
      <Label className="text-xs uppercase text-muted-foreground">When (condition)</Label>

      <ConditionStrip condition={value} />

      <div className="space-y-2">
        <Label className="text-sm">Mode</Label>
        <Select value={value.kind} onValueChange={(v) => switchKind(v as 'always' | 'compare')}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="always">
              <div className="flex flex-col">
                <span>Always</span>
                <span className="text-xs text-muted-foreground">
                  Fires every time its phase runs (subject to re-arm).
                </span>
              </div>
            </SelectItem>
            <SelectItem value="compare">
              <div className="flex flex-col">
                <span>When something happens</span>
                <span className="text-xs text-muted-foreground">
                  Fires when one match value compares a certain way to another.
                </span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {value.kind === 'compare' && (
        <CompareEditor value={value} onChange={onChange} />
      )}
    </div>
  );
}

/** The plain-English read of the current condition, shown as colored pills. */
function ConditionStrip({ condition }: { condition: Condition }) {
  return (
    <div className="flex min-h-[3rem] flex-wrap items-center gap-2 rounded-md border bg-muted/40 p-2">
      <span className="text-sm text-muted-foreground">When</span>
      {condition.kind === 'always' ? (
        <span className="rounded bg-primary/25 px-2 py-1 text-sm">always</span>
      ) : (
        <>
          <OperandPill operand={condition.left} />
          <span className="text-sm">{comparatorPhrase(condition.op)}</span>
          <OperandPill operand={condition.right} />
        </>
      )}
    </div>
  );
}

function OperandPill({ operand }: { operand: ConditionOperand }) {
  if (operand.kind === 'var') {
    return (
      <span className="rounded bg-primary/25 px-2 py-1 text-sm">
        {triggerLabelForVar(operand.name)}
      </span>
    );
  }
  return (
    <span className="rounded bg-success/25 px-2 py-1 font-mono text-sm">
      {operand.value}
    </span>
  );
}

function CompareEditor({
  value,
  onChange,
}: {
  value: Extract<Condition, { kind: 'compare' }>;
  onChange: (next: Condition) => void;
}) {
  return (
    <div className="space-y-3">
      <OperandEditor
        label="The first value"
        value={value.left}
        onChange={(next) => onChange({ ...value, left: next })}
      />
      <div className="space-y-1">
        <Label className="text-sm">…compared this way…</Label>
        <Select
          value={value.op}
          onValueChange={(v) => onChange({ ...value, op: v as Comparator })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {COMPARATORS.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.phrase}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <OperandEditor
        label="…to the second value"
        value={value.right}
        onChange={(next) => onChange({ ...value, right: next })}
      />
    </div>
  );
}

/**
 * Two ways to set an operand: pick from the data registry, or type a
 * specific number. Whichever the LO last touches becomes the operand.
 * Mirrors the allocator's "Add available data" + "Add a number" split.
 */
function OperandEditor({
  label,
  value,
  onChange,
}: {
  label: string;
  value: ConditionOperand;
  onChange: (next: ConditionOperand) => void;
}) {
  return (
    <div className="space-y-2 rounded-md bg-muted/30 p-2">
      <Label className="text-sm">{label}</Label>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">
            Pick a match value
          </Label>
          <Select
            value={value.kind === 'var' ? value.name : ''}
            onValueChange={(name) => onChange({ kind: 'var', name })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Pick a value…" />
            </SelectTrigger>
            <SelectContent>
              {TRIGGER_AVAILABLE_DATA.map((d) => (
                <SelectItem key={d.name} value={d.name}>
                  <div className="flex flex-col">
                    <span>{d.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {d.description}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">
            …or use a specific number
          </Label>
          <Input
            type="number"
            step="any"
            value={value.kind === 'const' ? value.value : ''}
            placeholder="e.g. 13"
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n)) onChange({ kind: 'const', value: n });
            }}
          />
        </div>
      </div>
    </div>
  );
}
