/**
 * @fileoverview Formula sub-view of the threshold editor. Builds the number
 * with the shared `ExpressionBuilder` over the threshold virtuals and reports
 * an `evaluate_expression` definition (or `null` while invalid) up to the
 * editor shell.
 */

import { useEffect, useState } from 'react';
import { Label } from '@/components/ui/label';
import { ExpressionBuilder } from '../_shared/ExpressionBuilder';
import {
  expressionToTokens,
  tokensToExpression,
  type FormulaToken,
} from '../per-game-allocator/formulaTokens';
import { THRESHOLD_AVAILABLE_DATA, thresholdLabelForVar } from './availableData';
import type { Expression } from '@/systems/points-system/types';
import type { ThresholdDefinition } from './useThresholdRoom';

export interface FormulaViewProps {
  readonly initial: Expression;
  readonly onChange: (def: ThresholdDefinition | null) => void;
}

export function FormulaView({ initial, onChange }: FormulaViewProps) {
  const [tokens, setTokens] = useState<FormulaToken[]>(() => expressionToTokens(initial));
  const [parseError, setParseError] = useState<string | null>(null);

  const emit = (next: FormulaToken[]) => {
    if (next.length === 0) {
      setParseError('The formula is empty.');
      onChange(null);
      return;
    }
    const parsed = tokensToExpression(next);
    if (parsed.ok) {
      setParseError(null);
      onChange({
        operationKind: 'evaluate_expression',
        operationArgs: { expression: parsed.expression },
      });
    } else {
      setParseError(parsed.reason);
      onChange(null);
    }
  };

  // Emit the initial definition on mount (and whenever the parent swaps it in).
  useEffect(() => {
    const init = expressionToTokens(initial);
    setTokens(init);
    emit(init);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  const handleTokensChange = (next: FormulaToken[]) => {
    setTokens(next);
    emit(next);
  };

  return (
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
      {parseError && <p className="text-xs text-destructive">{parseError}</p>}
    </div>
  );
}
