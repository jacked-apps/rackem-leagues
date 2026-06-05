/**
 * @fileoverview Click-to-build formula UI.
 *
 * Replaces the previous free-text formula input + the separate "state
 * variable" side-kind. An LO builds an expression by clicking tokens —
 * never typing a state-bag variable name — which closes the most likely
 * misspelling and broken-formula failure modes the room is meant to
 * guardrail against.
 *
 * Tokens supported:
 *   - "Add Data"     → opens a list of curated `AVAILABLE_DATA` entries.
 *                       Clicking one appends a `var` token with the
 *                       canonical name.
 *   - "Add Number"   → a quick-input that appends a `const` token.
 *   - "+ − × ÷"      → operator buttons append `op` tokens.
 *   - "( )"          → paren buttons append grouping tokens.
 *   - "Undo last"    → pops the last token.
 *
 * The current token sequence renders as a horizontal row of pills above
 * the controls so the LO sees what they've built.
 */

import { useState } from 'react';
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
import { AVAILABLE_DATA, labelForVar } from './availableData';
import type { FormulaToken, TokenOp } from './formulaTokens';

export interface FormulaBuilderProps {
  readonly tokens: readonly FormulaToken[];
  readonly onChange: (next: FormulaToken[]) => void;
}

export function FormulaBuilder({ tokens, onChange }: FormulaBuilderProps) {
  const [numberInput, setNumberInput] = useState('');

  const append = (token: FormulaToken) => onChange([...tokens, token]);
  const undo = () => onChange(tokens.slice(0, -1));
  const clear = () => onChange([]);

  const addData = (name: string) => append({ kind: 'var', name });
  const addOp = (op: TokenOp) => append({ kind: 'op', op });
  const addLparen = () => append({ kind: 'lparen' });
  const addRparen = () => append({ kind: 'rparen' });

  const addNumber = () => {
    const n = Number(numberInput);
    if (!Number.isFinite(n)) return;
    append({ kind: 'const', value: n });
    setNumberInput('');
  };

  return (
    <div className="space-y-3">
      <TokenStrip tokens={tokens} />

      <div className="space-y-2 rounded-md border p-3">
        <Label className="text-xs uppercase text-muted-foreground">
          Build the formula
        </Label>

        <div className="space-y-1">
          <Label className="text-sm">Add available data</Label>
          <Select value="" onValueChange={addData}>
            <SelectTrigger>
              <SelectValue placeholder="Pick a value to add…" />
            </SelectTrigger>
            <SelectContent>
              {AVAILABLE_DATA.map((d) => (
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

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-sm">Add a number</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                step="any"
                value={numberInput}
                placeholder="e.g. 2"
                onChange={(e) => setNumberInput(e.target.value)}
              />
              <Button
                size="sm"
                loadingText="none"
                onClick={addNumber}
                disabled={numberInput.trim().length === 0}
              >
                Add
              </Button>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-sm">Operators</Label>
            <div className="flex flex-wrap gap-1">
              {(['+', '-', '*', '/'] as const).map((op) => (
                <Button
                  key={op}
                  size="sm"
                  variant="outline"
                  loadingText="none"
                  onClick={() => addOp(op)}
                >
                  {opSymbol(op)}
                </Button>
              ))}
              <Button size="sm" variant="outline" loadingText="none" onClick={addLparen}>
                (
              </Button>
              <Button size="sm" variant="outline" loadingText="none" onClick={addRparen}>
                )
              </Button>
            </div>
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            variant="outline"
            loadingText="none"
            onClick={undo}
            disabled={tokens.length === 0}
          >
            Undo last
          </Button>
          <Button
            size="sm"
            variant="outline"
            loadingText="none"
            onClick={clear}
            disabled={tokens.length === 0}
          >
            Clear
          </Button>
        </div>
      </div>
    </div>
  );
}

function TokenStrip({ tokens }: { tokens: readonly FormulaToken[] }) {
  return (
    <div className="flex min-h-[3rem] flex-wrap items-center gap-1 rounded-md border bg-muted/40 p-2">
      {tokens.length === 0 ? (
        <span className="text-sm text-muted-foreground">
          (empty — add some data, a number, or an operator)
        </span>
      ) : (
        tokens.map((tok, i) => <TokenPill key={i} token={tok} />)
      )}
    </div>
  );
}

function TokenPill({ token }: { token: FormulaToken }) {
  if (token.kind === 'var') {
    return (
      <span className="rounded bg-primary/10 px-2 py-1 text-sm">
        {labelForVar(token.name)}
      </span>
    );
  }
  if (token.kind === 'const') {
    return (
      <span className="rounded bg-success/10 px-2 py-1 text-sm font-mono">
        {token.value}
      </span>
    );
  }
  if (token.kind === 'op') {
    return (
      <span className="px-1 text-sm font-mono">{opSymbol(token.op)}</span>
    );
  }
  if (token.kind === 'lparen') return <span className="px-1 text-sm font-mono">(</span>;
  return <span className="px-1 text-sm font-mono">)</span>;
}

function opSymbol(op: TokenOp): string {
  if (op === '*') return '×';
  if (op === '/') return '÷';
  return op;
}
