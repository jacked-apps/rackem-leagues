/**
 * @fileoverview Editor for the trigger's ACTION half.
 *
 * Action writes ONE named state-bag variable. The v1 trigger room
 * limits writes to the `TRIGGER_WRITE_TARGETS` set (`home_points`,
 * `away_points`) — that's the universal scoring outcome a trigger can
 * affect without depending on other modules being plugged in.
 *
 * Value modes:
 *
 *   - **Fixed value** — `{ kind: 'set', value: number }`. Writes a
 *     literal number to the target. The runtime can technically `set`
 *     non-numerics (`true`, `'home'`), but the v1 picker is numeric
 *     only since the allowed targets are points totals.
 *
 *   - **Computed from an expression** — `{ kind: 'expr', expr }`. Uses
 *     the bare `ExpressionBuilder` widget from Unit 4. The expression
 *     can reference any universal state-bag name.
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
import { useEffect, useState } from 'react';
import {
  ExpressionBuilder,
  type ExpressionAvailableDatum,
} from '../_shared/ExpressionBuilder';
import {
  TRIGGER_AVAILABLE_DATA,
  TRIGGER_WRITE_TARGETS,
  triggerLabelForVar,
} from './availableData';
import {
  expressionToTokens,
  tokensToExpression,
  type FormulaToken,
} from '../per-game-allocator/formulaTokens';
import type {
  Expression,
  TriggerAction,
} from '@/systems/points-system/types';

const RESOLVED_DATA: readonly ExpressionAvailableDatum[] = TRIGGER_AVAILABLE_DATA;

export interface ActionBuilderProps {
  readonly value: TriggerAction;
  readonly onChange: (next: TriggerAction) => void;
}

export function ActionBuilder({ value, onChange }: ActionBuilderProps) {
  const valueKind = value.value.kind;

  const setTarget = (target: string) => onChange({ ...value, target });

  const setKind = (next: 'set' | 'expr') => {
    if (next === 'set') {
      onChange({ ...value, value: { kind: 'set', value: 0 } });
    } else {
      onChange({
        ...value,
        value: {
          kind: 'expr',
          expr: { kind: 'const', value: 0 },
        },
      });
    }
  };

  return (
    <div className="space-y-3 rounded-md border p-3">
      <Label className="text-xs uppercase text-muted-foreground">
        Then (action)
      </Label>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-sm">Write to</Label>
          <Select value={value.target} onValueChange={setTarget}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TRIGGER_WRITE_TARGETS.map((t) => (
                <SelectItem key={t.name} value={t.name}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-sm">Value comes from</Label>
          <Select value={valueKind} onValueChange={(v) => setKind(v as 'set' | 'expr')}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="set">A fixed number</SelectItem>
              <SelectItem value="expr">An expression</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {value.value.kind === 'set' ? (
        <SetValueEditor value={value} onChange={onChange} />
      ) : (
        <ExprValueEditor value={value} onChange={onChange} />
      )}
    </div>
  );
}

function SetValueEditor({
  value,
  onChange,
}: {
  value: TriggerAction;
  onChange: (next: TriggerAction) => void;
}) {
  const v = value.value.kind === 'set' ? value.value.value : 0;
  const n = typeof v === 'number' ? v : 0;
  return (
    <div className="space-y-1">
      <Label className="text-sm">Number to write</Label>
      <Input
        type="number"
        step="any"
        value={n}
        onChange={(e) =>
          onChange({
            ...value,
            value: { kind: 'set', value: Number(e.target.value) },
          })
        }
      />
    </div>
  );
}

function ExprValueEditor({
  value,
  onChange,
}: {
  value: TriggerAction;
  onChange: (next: TriggerAction) => void;
}) {
  const initialExpr: Expression =
    value.value.kind === 'expr' ? value.value.expr : { kind: 'const', value: 0 };
  const [tokens, setTokens] = useState<FormulaToken[]>(() =>
    expressionToTokens(initialExpr),
  );
  const [parseError, setParseError] = useState<string | null>(null);

  // Re-sync when the parent swaps the trigger wholesale.
  useEffect(() => {
    if (value.value.kind === 'expr') {
      setTokens(expressionToTokens(value.value.expr));
      setParseError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.value.kind === 'expr' ? JSON.stringify(value.value.expr) : null]);

  const handleTokensChange = (next: FormulaToken[]) => {
    setTokens(next);
    if (next.length === 0) {
      setParseError('The expression is empty.');
      return;
    }
    const parsed = tokensToExpression(next);
    if (parsed.ok) {
      setParseError(null);
      onChange({ ...value, value: { kind: 'expr', expr: parsed.expression } });
    } else {
      setParseError(parsed.reason);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Build the expression. Click a pill to remove it. Click a gap to move
        the cursor. ← → arrows also move the cursor; Backspace removes to the
        left.
      </p>
      <ExpressionBuilder
        tokens={tokens}
        onChange={handleTokensChange}
        availableData={RESOLVED_DATA}
        labelForVar={triggerLabelForVar}
      />
      {parseError && (
        <p className="text-xs text-destructive">
          Expression isn't valid yet: {parseError}
        </p>
      )}
      <SampleHint action={value} />
    </div>
  );
}

function SampleHint({ action }: { action: TriggerAction }) {
  if (action.value.kind !== 'expr') return null;
  return (
    <p className="text-xs text-muted-foreground">
      Tip: to ADD to the target (most common), reference the target itself in
      the expression — e.g. "{triggerLabelForVar(action.target)} + 5".
    </p>
  );
}
