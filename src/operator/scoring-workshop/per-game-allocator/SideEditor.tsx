/**
 * @fileoverview Reusable side editor — used for both winner and loser sides.
 *
 * Three peer side-kinds (state-bag read folded into Formula per Ed's
 * feedback after first browser test):
 *   - Fixed number       — `{ base: <number>, formula: null }`
 *   - Scorer-input range — `{ base: { min, max, label }, formula: null }`
 *   - Formula            — `{ base: 0, formula: { operationKind: 'evaluate_expression',
 *                            operationArgs: { expression: <tree> } } }`
 *
 * The Formula kind now powers BOTH "this side equals one piece of
 * available data" (single-var expression) AND multi-token expressions
 * like `(home_wins + 2)`. Click-to-build inside `FormulaBuilder`
 * eliminates the free-text-var-name footgun.
 */

import type { ChangeEvent } from 'react';
import { useEffect, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { FormulaBuilder } from './FormulaBuilder';
import {
  expressionToTokens,
  tokensToExpression,
  type FormulaToken,
} from './formulaTokens';
// Side-effect import: register the evaluate_expression recipe the
// click-to-build formula path writes into.
import '@/systems/points-system/allocator-formula-operations/evaluate-expression';
import type { Expression, SideConfig } from '@/systems/points-system/types';

export type SideKind = 'fixed' | 'range' | 'formula';

export interface SideEditorProps {
  readonly heading: string;
  readonly value: SideConfig;
  readonly onChange: (next: SideConfig) => void;
}

export function SideEditor({ heading, value, onChange }: SideEditorProps) {
  const kind = detectKind(value);
  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="font-medium">{heading}</div>
      <div className="space-y-1">
        <Label>How does this side get its number?</Label>
        <Select value={kind} onValueChange={(k) => onChange(forKind(k as SideKind))}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="fixed">Fixed number</SelectItem>
            <SelectItem value="range">Scorer types a number (range)</SelectItem>
            <SelectItem value="formula">Formula (build from available data)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <KindFields kind={kind} value={value} onChange={onChange} />
    </div>
  );
}

function detectKind(side: SideConfig): SideKind {
  if (side.formula) return 'formula';
  if (typeof side.base === 'object') return 'range';
  return 'fixed';
}

function forKind(kind: SideKind): SideConfig {
  if (kind === 'fixed') return { base: 0, formula: null };
  if (kind === 'range') {
    return {
      base: { min: 0, max: 7, label: 'Balls pocketed by loser' },
      formula: null,
    };
  }
  // formula — start empty; user clicks tokens to build it.
  return {
    base: 0,
    formula: {
      operationKind: 'evaluate_expression',
      operationArgs: { expression: { kind: 'const', value: 0 } satisfies Expression },
    },
  };
}

function KindFields({
  kind,
  value,
  onChange,
}: {
  kind: SideKind;
  value: SideConfig;
  onChange: (next: SideConfig) => void;
}) {
  if (kind === 'fixed') {
    const n = typeof value.base === 'number' ? value.base : 0;
    return (
      <div className="space-y-1">
        <Label>Value</Label>
        <Input
          type="number"
          step="any"
          value={n}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            onChange({ base: Number(e.target.value), formula: null })
          }
        />
      </div>
    );
  }
  if (kind === 'range') {
    const r = typeof value.base === 'object' ? value.base : { min: 0, max: 7, label: '' };
    return (
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1">
          <Label>Min</Label>
          <Input
            type="number"
            value={r.min}
            onChange={(e) =>
              onChange({ base: { ...r, min: Number(e.target.value) }, formula: null })
            }
          />
        </div>
        <div className="space-y-1">
          <Label>Max</Label>
          <Input
            type="number"
            value={r.max}
            onChange={(e) =>
              onChange({ base: { ...r, max: Number(e.target.value) }, formula: null })
            }
          />
        </div>
        <div className="space-y-1">
          <Label>Scorer prompt</Label>
          <Input
            value={r.label}
            onChange={(e) =>
              onChange({ base: { ...r, label: e.target.value }, formula: null })
            }
          />
        </div>
      </div>
    );
  }
  // Formula — click-to-build.
  return <FormulaKindFields value={value} onChange={onChange} />;
}

function FormulaKindFields({
  value,
  onChange,
}: {
  value: SideConfig;
  onChange: (next: SideConfig) => void;
}) {
  // Draft tokens are local UI state — they may be a partially-built,
  // not-yet-parseable sequence. On every change we try to parse: if it
  // succeeds, the parsed expression is pushed to SideConfig (which the
  // save-time guard + runtime ultimately consume). If parsing fails the
  // tokens are kept on screen and the error is shown inline; SideConfig
  // keeps its last-good expression.
  //
  // Back-compat: variations saved before the formula-folding refactor
  // may reference `read_state_var` (single-state-bag read). Translate
  // to the equivalent single-var Expression so the editor shows it
  // unchanged.
  const initialExpr = extractExpression(value.formula);
  const [tokens, setTokens] = useState<FormulaToken[]>(() =>
    expressionToTokens(initialExpr),
  );
  const [parseError, setParseError] = useState<string | null>(null);

  // Re-seed local tokens when the parent swaps the whole SideConfig
  // (e.g., kind change) — recognize that by a formula-ref identity flip.
  useEffect(() => {
    if (!value.formula) return;
    const expr = extractExpression(value.formula);
    setTokens(expressionToTokens(expr));
    setParseError(null);
    // Intentionally key only on operationKind so token edits don't loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.formula?.operationKind]);

  const handleTokensChange = (next: FormulaToken[]) => {
    setTokens(next);
    if (next.length === 0) {
      setParseError(null);
      return;
    }
    const parsed = tokensToExpression(next);
    if (parsed.ok) {
      setParseError(null);
      onChange({
        base: 0,
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
      <FormulaBuilder tokens={tokens} onChange={handleTokensChange} />
      {parseError && (
        <p className="text-xs text-destructive">Formula isn't valid yet: {parseError}</p>
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
