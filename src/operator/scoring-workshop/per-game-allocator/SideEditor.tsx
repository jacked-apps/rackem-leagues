/**
 * @fileoverview Reusable side editor — used for both winner and loser sides.
 *
 * Surfaces R11's communication contract as a first-class side-kind choice:
 *   - Fixed number      — `{ base: <number>, formula: null }`
 *   - State-bag value   — `{ base: 0, formula: read_state_var(var_name) }`
 *   - Scorer-input range — `{ base: { min, max, label }, formula: null }`
 *   - Formula recipe    — `{ base: <number>, formula: <picker> }`
 *
 * Each kind renders its own dial inputs. Switching kinds resets the
 * irrelevant fields so the saved JSONB always matches the chosen shape.
 */

import type { ChangeEvent } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { registeredAllocatorFormulaOperationNames } from '@/systems/points-system/allocator-formula-registry';
// Side-effect imports: ensure the formula recipes appear in the picker.
import '@/systems/points-system/allocator-formula-operations/add-complement-of-other-side';
import '@/systems/points-system/allocator-formula-operations/state-diff-times-constant';
import '@/systems/points-system/allocator-formula-operations/read-state-var';
import type { SideConfig } from '@/systems/points-system/types';

export type SideKind = 'fixed' | 'state' | 'range' | 'formula';

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
            <SelectItem value="state">Read from a state variable</SelectItem>
            <SelectItem value="range">Scorer types a number (range)</SelectItem>
            <SelectItem value="formula">Formula recipe</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <KindFields kind={kind} value={value} onChange={onChange} />
    </div>
  );
}

function detectKind(side: SideConfig): SideKind {
  if (side.formula?.operationKind === 'read_state_var') return 'state';
  if (side.formula) return 'formula';
  if (typeof side.base === 'object') return 'range';
  return 'fixed';
}

function forKind(kind: SideKind): SideConfig {
  if (kind === 'fixed') return { base: 0, formula: null };
  if (kind === 'state') {
    return {
      base: 0,
      formula: { operationKind: 'read_state_var', operationArgs: { var_name: '' } },
    };
  }
  if (kind === 'range') {
    return {
      base: { min: 0, max: 7, label: 'Balls pocketed by loser' },
      formula: null,
    };
  }
  // formula
  return {
    base: 0,
    formula: { operationKind: 'add_complement_of_other_side', operationArgs: {} },
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
  if (kind === 'state') {
    const varName = String(
      value.formula?.operationArgs?.var_name ?? '',
    );
    return (
      <div className="space-y-1">
        <Label>State variable name</Label>
        <Input
          value={varName}
          placeholder="e.g. pointsPerGame"
          onChange={(e) =>
            onChange({
              base: 0,
              formula: {
                operationKind: 'read_state_var',
                operationArgs: { var_name: e.target.value },
              },
            })
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
  // formula
  const ops = registeredAllocatorFormulaOperationNames().filter(
    (n) => n !== 'read_state_var',
  );
  const selected = value.formula?.operationKind ?? ops[0] ?? '';
  return (
    <div className="space-y-1">
      <Label>Formula recipe</Label>
      <Select
        value={selected}
        onValueChange={(op) =>
          onChange({
            base: typeof value.base === 'number' ? value.base : 0,
            formula: { operationKind: op, operationArgs: {} },
          })
        }
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ops.map((op) => (
            <SelectItem key={op} value={op}>
              {op}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        Formula args inputs land in a future polish pass — for now this
        picker writes the recipe name and the loader's args-shape check
        catches anything missing on save.
      </p>
    </div>
  );
}
