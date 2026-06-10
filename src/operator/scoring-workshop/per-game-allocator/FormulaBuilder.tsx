/**
 * @fileoverview Per-game allocator's formula builder.
 *
 * Thin perspective-aware wrapper around the shared
 * `ExpressionBuilder` widget. The allocator edits one SIDE at a time
 * (winner or loser), so virtual names like `this_side_value` render as
 * "Winner base" on the winner side and "Loser base" on the loser side.
 * The shared widget knows nothing about sides; this wrapper resolves
 * the perspective into concrete strings before handing them off.
 *
 * The trigger room imports `ExpressionBuilder` directly — triggers have
 * no per-side perspective.
 */

import { useMemo } from 'react';
import { ExpressionBuilder, type ExpressionAvailableDatum } from '../_shared/ExpressionBuilder';
import {
  AVAILABLE_DATA,
  labelForVar,
  type SidePerspective,
} from './availableData';
import type { FormulaToken } from './formulaTokens';

export interface FormulaBuilderProps {
  readonly tokens: readonly FormulaToken[];
  readonly onChange: (next: FormulaToken[]) => void;
  /**
   * Which side is being edited. Drives the role-based labels in the
   * data picker + token pills ("Winner base" vs "Loser base") without
   * changing the underlying variable names the runtime reads.
   */
  readonly perspective: SidePerspective;
}

export function FormulaBuilder({ tokens, onChange, perspective }: FormulaBuilderProps) {
  const resolvedData: readonly ExpressionAvailableDatum[] = useMemo(
    () =>
      AVAILABLE_DATA.map((d) => ({
        name: d.name,
        label: d.label(perspective),
        description: d.description(perspective),
      })),
    [perspective],
  );

  const resolvedLabelForVar = useMemo(
    () => (name: string) => labelForVar(name, perspective),
    [perspective],
  );

  return (
    <ExpressionBuilder
      tokens={tokens}
      onChange={onChange}
      availableData={resolvedData}
      labelForVar={resolvedLabelForVar}
    />
  );
}
