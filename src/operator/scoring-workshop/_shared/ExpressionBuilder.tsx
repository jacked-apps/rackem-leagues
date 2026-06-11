/**
 * @fileoverview Perspective-free expression builder widget.
 *
 * Shared between the per-game allocator room (wraps it with side
 * perspective — winner vs. loser) and the trigger room (uses it
 * directly, no perspective). The widget owns the cursor model, the
 * token strip, the build panel, and the keyboard handler. The caller
 * supplies a flat list of available state-bag data and a function that
 * resolves a var name to a display label.
 *
 * Cursor model (text-editor style):
 *   - A cursor sits BETWEEN tokens (positions 0..N) and indicates where
 *     the next inserted token will go.
 *   - Click any gap between pills to move the cursor there. Click before
 *     the first pill or after the last pill to land at those ends.
 *   - "Add data", "Add number", "+ − × ÷ ( )" insert AT the cursor
 *     position and advance the cursor by one.
 *   - Clicking a pill removes that token. If the removal is to the LEFT
 *     of the cursor, the cursor shifts left so the surrounding tokens
 *     stay where they look.
 *   - "Backspace" removes the token immediately to the LEFT of the
 *     cursor (text-editor style).
 *   - "Clear" empties and resets cursor to the start.
 */

import { useEffect, useState } from 'react';
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
import type { FormulaToken, TokenOp } from '../per-game-allocator/formulaTokens';

/** Concrete picker entry — perspective already resolved by the caller. */
export interface ExpressionAvailableDatum {
  readonly name: string;
  readonly label: string;
  readonly description: string;
}

export interface ExpressionBuilderProps {
  readonly tokens: readonly FormulaToken[];
  readonly onChange: (next: FormulaToken[]) => void;
  readonly availableData: readonly ExpressionAvailableDatum[];
  readonly labelForVar: (name: string) => string;
}

export function ExpressionBuilder({
  tokens,
  onChange,
  availableData,
  labelForVar,
}: ExpressionBuilderProps) {
  const [numberInput, setNumberInput] = useState('');
  // Cursor position: 0..tokens.length. Defaults to the end (append-style)
  // when the formula first loads.
  const [cursorPos, setCursorPos] = useState<number>(tokens.length);

  // Clamp cursor if the parent ever shortens `tokens` from underneath us
  // (e.g., remote replace, or undo/clear via a different code path).
  useEffect(() => {
    if (cursorPos > tokens.length) setCursorPos(tokens.length);
  }, [tokens.length, cursorPos]);

  // Keyboard navigation: arrows move the cursor; Home/End jump to ends;
  // Backspace removes to the left. Ignored when the focus is inside a
  // text input (so typing in the "Add a number" field still works).
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement
    ) {
      return;
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setCursorPos((p) => Math.max(0, p - 1));
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setCursorPos((p) => Math.min(tokens.length, p + 1));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setCursorPos(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setCursorPos(tokens.length);
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      if (cursorPos > 0) {
        removeAt(cursorPos - 1);
      }
    }
  };

  const insertAt = (idx: number, token: FormulaToken) => {
    const next = [...tokens.slice(0, idx), token, ...tokens.slice(idx)];
    onChange(next);
    setCursorPos(idx + 1);
  };

  const removeAt = (idx: number) => {
    const next = [...tokens.slice(0, idx), ...tokens.slice(idx + 1)];
    onChange(next);
    if (idx < cursorPos) setCursorPos(Math.max(0, cursorPos - 1));
    else if (idx === cursorPos && cursorPos > next.length) setCursorPos(next.length);
  };

  const backspace = () => {
    if (cursorPos === 0) return;
    removeAt(cursorPos - 1);
  };

  const clear = () => {
    onChange([]);
    setCursorPos(0);
  };

  const addData = (name: string) => insertAt(cursorPos, { kind: 'var', name });
  const addOp = (op: TokenOp) => insertAt(cursorPos, { kind: 'op', op });
  const addLparen = () => insertAt(cursorPos, { kind: 'lparen' });
  const addRparen = () => insertAt(cursorPos, { kind: 'rparen' });

  const addNumber = () => {
    const n = Number(numberInput);
    if (!Number.isFinite(n)) return;
    insertAt(cursorPos, { kind: 'const', value: n });
    setNumberInput('');
  };

  return (
    <div className="space-y-3" onKeyDown={handleKeyDown}>
      <TokenStrip
        tokens={tokens}
        onRemove={removeAt}
        labelForVar={labelForVar}
        cursorPos={cursorPos}
        onMoveCursor={setCursorPos}
      />

      <div className="space-y-2 rounded-md border p-3">
        <Label className="text-xs uppercase text-muted-foreground">
          Build the expression
        </Label>

        <div className="space-y-1">
          <Label className="text-sm">Add available data</Label>
          <Select value="" onValueChange={addData}>
            <SelectTrigger>
              <SelectValue placeholder="Pick a value to add…" />
            </SelectTrigger>
            <SelectContent>
              {availableData.map((d) => (
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
            onClick={backspace}
            disabled={cursorPos === 0}
            title="Remove the token to the left of the cursor"
          >
            Backspace
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

function TokenStrip({
  tokens,
  onRemove,
  labelForVar,
  cursorPos,
  onMoveCursor,
}: {
  tokens: readonly FormulaToken[];
  onRemove: (idx: number) => void;
  labelForVar: (name: string) => string;
  cursorPos: number;
  onMoveCursor: (idx: number) => void;
}) {
  const gapCount = tokens.length + 1;
  return (
    <div
      tabIndex={0}
      className="flex min-h-[3rem] flex-wrap items-center gap-1 rounded-md border bg-muted/40 p-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
    >
      {Array.from({ length: gapCount }).map((_, gapIdx) => (
        <span key={`gap-${gapIdx}`} className="inline-flex items-center">
          <CursorGap
            active={cursorPos === gapIdx}
            onClick={() => onMoveCursor(gapIdx)}
          />
          {gapIdx < tokens.length && (
            <TokenPill
              token={tokens[gapIdx]!}
              onRemove={() => onRemove(gapIdx)}
              labelForVar={labelForVar}
            />
          )}
        </span>
      ))}
      {tokens.length === 0 && (
        <span className="ml-2 text-sm text-muted-foreground">
          (empty — pick some data, type a number, or add an operator)
        </span>
      )}
    </div>
  );
}

/**
 * The thin "gap" between (or before/after) tokens. Renders the blinking
 * cursor when this position is active; renders a thin clickable
 * separator otherwise so the LO can click into the gap to move the
 * cursor there.
 */
function CursorGap({ active, onClick }: { active: boolean; onClick: () => void }) {
  if (active) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label="Cursor position"
        title="Cursor — the next token will be inserted here"
        className="mx-1 inline-block h-7 w-2 animate-pulse rounded-sm bg-primary"
      />
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Move cursor here"
      title="Click to move the cursor here"
      className="mx-1 inline-block h-7 w-2 rounded-sm bg-transparent transition-colors hover:bg-primary/15"
    />
  );
}

function TokenPill({
  token,
  onRemove,
  labelForVar,
}: {
  token: FormulaToken;
  onRemove: () => void;
  labelForVar: (name: string) => string;
}) {
  const baseClass =
    'inline-flex cursor-pointer items-center rounded px-1.5 py-1 text-sm transition-colors hover:bg-destructive hover:text-destructive-foreground hover:line-through';
  const title = 'Click to remove this from the expression';
  if (token.kind === 'var') {
    return (
      <button
        type="button"
        onClick={onRemove}
        title={title}
        className={`${baseClass} bg-primary/25`}
      >
        {labelForVar(token.name)}
      </button>
    );
  }
  if (token.kind === 'const') {
    return (
      <button
        type="button"
        onClick={onRemove}
        title={title}
        className={`${baseClass} bg-success/25 font-mono`}
      >
        {token.value}
      </button>
    );
  }
  if (token.kind === 'op') {
    return (
      <button
        type="button"
        onClick={onRemove}
        title={title}
        className={`${baseClass} bg-secondary font-mono`}
      >
        {opSymbol(token.op)}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onRemove}
      title={title}
      className={`${baseClass} bg-muted-foreground/20 font-mono`}
    >
      {token.kind === 'lparen' ? '(' : ')'}
    </button>
  );
}

function opSymbol(op: TokenOp): string {
  if (op === '*') return '×';
  if (op === '/') return '÷';
  return op;
}
