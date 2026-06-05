/**
 * @fileoverview Reusable side editor — used for both winner and loser sides.
 *
 * Mirrors the SideConfig architecture EXACTLY:
 *   - **Base** — either a fixed number OR a scorer-input range. Always
 *     present on a side.
 *   - **Formula** — optional. When ON, transforms the resolved base into
 *     the side's final value. When OFF, the final value IS the base.
 *
 * Renders both as independent sections (not one dropdown choosing one of
 * three kinds). The user picks base shape AND independently picks
 * whether to attach a formula. This is the room's true architectural
 * shape — exposing it in the UI prevents the LO from being surprised
 * by hidden state.
 */

import type { ChangeEvent } from 'react';
import { useEffect, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { FormulaBuilder } from './FormulaBuilder';
import type { SidePerspective } from './availableData';
import {
  expressionToTokens,
  tokensToExpression,
  type FormulaToken,
} from './formulaTokens';
// Side-effect import: register the evaluate_expression recipe the
// click-to-build formula path writes into.
import '@/systems/points-system/allocator-formula-operations/evaluate-expression';
import type { Expression, SideConfig } from '@/systems/points-system/types';

type BaseKind = 'fixed' | 'range';

export interface SideEditorProps {
  readonly heading: string;
  readonly value: SideConfig;
  readonly onChange: (next: SideConfig) => void;
  /**
   * Which side this editor represents. Drives the role-based labels
   * in the formula builder ("Winner base" vs "Loser base") without
   * changing the runtime contract.
   */
  readonly perspective: SidePerspective;
}

export function SideEditor({
  heading,
  value,
  onChange,
  perspective,
}: SideEditorProps) {
  return (
    <div className="space-y-4 rounded-md border p-3">
      <div className="font-medium">{heading}</div>
      <BaseSection value={value} onChange={onChange} />
      <FormulaSection value={value} onChange={onChange} perspective={perspective} />
    </div>
  );
}

// ============================================================================
// Base section — single number OR scorer-input range
// ============================================================================

function BaseSection({
  value,
  onChange,
}: {
  value: SideConfig;
  onChange: (next: SideConfig) => void;
}) {
  const baseKind: BaseKind = typeof value.base === 'object' ? 'range' : 'fixed';

  const setBaseKind = (next: BaseKind) => {
    if (next === 'fixed') {
      onChange({ ...value, base: typeof value.base === 'number' ? value.base : 0 });
    } else {
      onChange({
        ...value,
        base:
          typeof value.base === 'object'
            ? value.base
            : { min: 0, max: 7, label: 'Balls pocketed by loser' },
      });
    }
  };

  return (
    <div className="space-y-2 rounded-md border bg-muted/30 p-3">
      <Label className="text-xs uppercase text-muted-foreground">Base</Label>
      <div className="space-y-1">
        <Label className="text-sm">Shape</Label>
        <Select value={baseKind} onValueChange={(k) => setBaseKind(k as BaseKind)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="fixed">Fixed number</SelectItem>
            <SelectItem value="range">Scorer types a number (range)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {baseKind === 'fixed' ? (
        <FixedBaseInput value={value} onChange={onChange} />
      ) : (
        <RangeBaseInputs value={value} onChange={onChange} />
      )}
    </div>
  );
}

function FixedBaseInput({
  value,
  onChange,
}: {
  value: SideConfig;
  onChange: (next: SideConfig) => void;
}) {
  const n = typeof value.base === 'number' ? value.base : 0;
  return (
    <div className="space-y-1">
      <Label className="text-sm">Value</Label>
      <Input
        type="number"
        step="any"
        value={n}
        onChange={(e: ChangeEvent<HTMLInputElement>) =>
          onChange({ ...value, base: Number(e.target.value) })
        }
      />
    </div>
  );
}

function RangeBaseInputs({
  value,
  onChange,
}: {
  value: SideConfig;
  onChange: (next: SideConfig) => void;
}) {
  const r =
    typeof value.base === 'object' ? value.base : { min: 0, max: 7, label: '' };
  return (
    <div className="grid grid-cols-3 gap-2">
      <div className="space-y-1">
        <Label className="text-sm">Min</Label>
        <Input
          type="number"
          value={r.min}
          onChange={(e) =>
            onChange({ ...value, base: { ...r, min: Number(e.target.value) } })
          }
        />
      </div>
      <div className="space-y-1">
        <Label className="text-sm">Max</Label>
        <Input
          type="number"
          value={r.max}
          onChange={(e) =>
            onChange({ ...value, base: { ...r, max: Number(e.target.value) } })
          }
        />
      </div>
      <div className="space-y-1">
        <Label className="text-sm">Scorer prompt</Label>
        <Input
          value={r.label}
          onChange={(e) =>
            onChange({ ...value, base: { ...r, label: e.target.value } })
          }
        />
      </div>
    </div>
  );
}

// ============================================================================
// Formula section — optional transformation of the resolved base
// ============================================================================

function FormulaSection({
  value,
  onChange,
  perspective,
}: {
  value: SideConfig;
  onChange: (next: SideConfig) => void;
  perspective: SidePerspective;
}) {
  // `formulaOn` is local to the section so we can show the builder
  // BEFORE there's a parseable expression — without that, "Add a
  // formula" would have to seed SideConfig.formula with a placeholder
  // value (like 0) which then strands a `0` pill the LO can't fully
  // delete (additive build). With local state, the formula stays NULL
  // on SideConfig until the LO builds something parseable; the builder
  // is shown the whole time.
  const [formulaOn, setFormulaOn] = useState<boolean>(value.formula !== null);

  // Re-sync when the parent swaps the SideConfig wholesale (kind change
  // upstream, clone load, etc.).
  useEffect(() => {
    setFormulaOn(value.formula !== null);
  }, [value.formula?.operationKind]);

  const turnOn = () => setFormulaOn(true);
  const turnOff = () => {
    setFormulaOn(false);
    onChange({ ...value, formula: null });
  };

  return (
    <div className="space-y-2 rounded-md border bg-muted/30 p-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs uppercase text-muted-foreground">
          Formula (optional)
        </Label>
        {formulaOn ? (
          <Button size="sm" variant="outline" loadingText="none" onClick={turnOff}>
            Remove formula
          </Button>
        ) : (
          <Button size="sm" loadingText="none" onClick={turnOn}>
            Add a formula
          </Button>
        )}
      </div>
      {!formulaOn ? (
        <p className="text-xs text-muted-foreground">
          No formula. This side's final value is just the base above. Add a
          formula to transform the base — for example, "base + (7 − the other
          side's value this game)."
        </p>
      ) : (
        <FormulaBody value={value} onChange={onChange} perspective={perspective} />
      )}
    </div>
  );
}

function FormulaBody({
  value,
  onChange,
  perspective,
}: {
  value: SideConfig;
  onChange: (next: SideConfig) => void;
  perspective: SidePerspective;
}) {
  // Tokens are local draft state. When the user opens an existing
  // formula, tokens hydrate from it. When "Add a formula" was just
  // clicked (no formula on SideConfig yet), tokens start empty and the
  // strip shows the empty hint.
  //
  // On every change we try to parse: success → push the parsed
  // expression up to SideConfig (turning formula non-null for the first
  // time when the LO has built something valid). Failure → keep tokens
  // on screen, show the error inline; SideConfig.formula stays at its
  // last-good value (or null if there hasn't been one yet).
  //
  // Back-compat: old rows that referenced the now-folded read_state_var
  // recipe hydrate as a single-var Expression.
  const initialTokens = value.formula
    ? expressionToTokens(extractExpression(value.formula))
    : [];
  const [tokens, setTokens] = useState<FormulaToken[]>(() => initialTokens);
  const [parseError, setParseError] = useState<string | null>(null);

  useEffect(() => {
    if (!value.formula) {
      setTokens([]);
      setParseError(null);
      return;
    }
    const expr = extractExpression(value.formula);
    setTokens(expressionToTokens(expr));
    setParseError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.formula?.operationKind]);

  const handleTokensChange = (next: FormulaToken[]) => {
    setTokens(next);
    if (next.length === 0) {
      setParseError(null);
      // No tokens — leave formula off on SideConfig until the LO builds
      // something. (Or remove it if it had been set.)
      if (value.formula) onChange({ ...value, formula: null });
      return;
    }
    const parsed = tokensToExpression(next);
    if (parsed.ok) {
      setParseError(null);
      onChange({
        ...value,
        formula: {
          operationKind: 'evaluate_expression',
          operationArgs: { expression: parsed.expression },
        },
      });
    } else {
      setParseError(parsed.reason);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Transforms the base into this side's final value. The formula can
        reference the base via "{perspective === 'winner' ? 'Winner' : 'Loser'} base
        (this game)" — or stand alone if it doesn't need the base. Click any
        pill to remove it from the formula.
      </p>
      <FormulaBuilder
        tokens={tokens}
        onChange={handleTokensChange}
        perspective={perspective}
      />
      {parseError && (
        <p className="text-xs text-destructive">
          Formula isn't valid yet: {parseError}
        </p>
      )}
    </div>
  );
}

/**
 * Pull an Expression tree out of a SideConfig.formula reference,
 * handling the back-compat case where older variations used the
 * now-folded `read_state_var` recipe (a single state-bag read) by
 * promoting it to an equivalent single-var Expression.
 */
function extractExpression(formula: SideConfig['formula']): Expression {
  if (!formula) return { kind: 'const', value: 0 };
  if (formula.operationKind === 'evaluate_expression') {
    const expr = formula.operationArgs.expression;
    if (
      typeof expr === 'object' &&
      expr !== null &&
      'kind' in (expr as Record<string, unknown>)
    ) {
      return expr as Expression;
    }
    return { kind: 'const', value: 0 };
  }
  if (formula.operationKind === 'read_state_var') {
    const name = formula.operationArgs.var_name;
    if (typeof name === 'string' && name.length > 0) {
      return { kind: 'var', name };
    }
    return { kind: 'const', value: 0 };
  }
  return { kind: 'const', value: 0 };
}
