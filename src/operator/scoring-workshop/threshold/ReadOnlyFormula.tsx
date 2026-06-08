/**
 * @fileoverview Read-only formula display — renders a formula as the same
 * token pills the editable builder uses, but non-interactive.
 *
 * Lets an LO SEE the calculation behind a built-in threshold (Fargo, the
 * games-needed formulas, the milestone product) without it being editable yet.
 * Symbols we haven't opened up for editing (`^`, `floor`, `ceil`, `|…|`, …)
 * render as STAGNANT (greyed, locked) pills — visible so you know what you're
 * looking at, but you can't add or change them.
 */

import type { FormulaToken } from '../per-game-allocator/formulaTokens';

/** A non-editable symbol we display but haven't exposed in the builder yet. */
export interface LockedToken {
  readonly kind: 'locked';
  readonly text: string;
}

/** What ReadOnlyFormula can render: the editable token kinds plus locked ones. */
export type DisplayToken = FormulaToken | LockedToken;

/** A labeled line of a multi-part formula. */
export interface FormulaLine {
  readonly label?: string;
  readonly tokens: readonly DisplayToken[];
}

function opSymbol(op: string): string {
  if (op === '*') return '×';
  if (op === '/') return '÷';
  return op;
}

function Pill({ token }: { token: DisplayToken }) {
  const base = 'inline-flex items-center rounded px-1.5 py-1 text-sm';
  switch (token.kind) {
    case 'var':
      return <span className={`${base} bg-primary/25`}>{token.name}</span>;
    case 'const':
      return <span className={`${base} bg-success/25 font-mono`}>{token.value}</span>;
    case 'op':
      return <span className={`${base} bg-secondary font-mono`}>{opSymbol(token.op)}</span>;
    case 'lparen':
      return <span className={`${base} bg-muted-foreground/20 font-mono`}>(</span>;
    case 'rparen':
      return <span className={`${base} bg-muted-foreground/20 font-mono`}>)</span>;
    case 'locked':
      return (
        <span
          className={`${base} border border-dashed border-muted-foreground/40 bg-muted font-mono text-muted-foreground`}
          title="Not editable yet — shown so you can see the calculation"
        >
          {token.text}
        </span>
      );
  }
}

export function ReadOnlyFormula({ lines }: { lines: readonly FormulaLine[] }) {
  return (
    <div className="space-y-2">
      {lines.map((line, i) => (
        <div key={i} className="space-y-1">
          {line.label && (
            <div className="text-xs text-muted-foreground">{line.label}</div>
          )}
          <div className="flex min-h-[2.5rem] flex-wrap items-center gap-1 rounded-md border bg-muted/40 p-2">
            {line.tokens.map((t, j) => (
              <Pill key={j} token={t} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
