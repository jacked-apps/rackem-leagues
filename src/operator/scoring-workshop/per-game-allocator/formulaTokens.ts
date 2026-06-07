/**
 * @fileoverview Token model for the click-to-build formula UI.
 *
 * The workshop stores a flat array of build tokens. At save time the
 * tokens get parsed into the engine's `Expression` tree shape (the same
 * tree triggers use). On load the tree gets serialized back to tokens so
 * the editor can re-render the formula the user built.
 *
 * Tokens are intentionally limited: an LO can pick a state-bag var,
 * type a number, choose an arithmetic operator, or group with parens.
 * No precedence handling — operations parse left-associatively unless
 * the LO grouped them with parens. That's the "broken-formula
 * guardrail" tradeoff: clarity over math-textbook conventions.
 */

import type { Expression } from '@/systems/points-system/types';

export type TokenOp = '+' | '-' | '*' | '/';

export type FormulaToken =
  | { readonly kind: 'var'; readonly name: string }
  | { readonly kind: 'const'; readonly value: number }
  | { readonly kind: 'op'; readonly op: TokenOp }
  | { readonly kind: 'lparen' }
  | { readonly kind: 'rparen' };

/**
 * Convert an Expression tree back to a flat token sequence so the editor
 * can render it. Always wraps binary operations in explicit parens so
 * a round-trip is faithful (the parser accepts both wrapped and unwrapped
 * binaries; the serializer is conservative).
 */
export function expressionToTokens(expr: Expression): FormulaToken[] {
  if (expr.kind === 'const') return [{ kind: 'const', value: expr.value }];
  if (expr.kind === 'var') return [{ kind: 'var', name: expr.name }];
  // op
  return [
    { kind: 'lparen' },
    ...expressionToTokens(expr.left),
    { kind: 'op', op: expr.op },
    ...expressionToTokens(expr.right),
    { kind: 'rparen' },
  ];
}

export type ParseResult =
  | { readonly ok: true; readonly expression: Expression }
  | { readonly ok: false; readonly reason: string };

/**
 * Parse a token sequence into an Expression tree.
 *
 * Grammar (informal):
 *   expr   := term ( op term )*           // left-associative chain
 *   term   := var | const | '(' expr ')'
 *
 * No operator precedence — `a + b * c` parses as `((a + b) * c)`. LOs
 * can force grouping with parens.
 */
export function tokensToExpression(tokens: readonly FormulaToken[]): ParseResult {
  if (tokens.length === 0) {
    return { ok: false, reason: 'The formula is empty. Add some data or a number to start.' };
  }
  const ctx: ParseCtx = { tokens, pos: 0 };
  const exprResult = parseExpr(ctx);
  if (!exprResult.ok) return exprResult;
  if (ctx.pos !== tokens.length) {
    return {
      ok: false,
      reason: `Unexpected token near position ${ctx.pos + 1}. Check for missing operators or unmatched parens.`,
    };
  }
  return { ok: true, expression: exprResult.expression };
}

interface ParseCtx {
  readonly tokens: readonly FormulaToken[];
  pos: number;
}

function parseExpr(ctx: ParseCtx): ParseResult {
  let left = parseTerm(ctx);
  if (!left.ok) return left;
  while (ctx.pos < ctx.tokens.length && ctx.tokens[ctx.pos]?.kind === 'op') {
    const opToken = ctx.tokens[ctx.pos] as { kind: 'op'; op: TokenOp };
    ctx.pos += 1;
    const right = parseTerm(ctx);
    if (!right.ok) return right;
    left = {
      ok: true,
      expression: {
        kind: 'op',
        op: opToken.op,
        left: left.expression,
        right: right.expression,
      },
    };
  }
  return left;
}

function parseTerm(ctx: ParseCtx): ParseResult {
  const tok = ctx.tokens[ctx.pos];
  if (!tok) return { ok: false, reason: 'Expected a value but the formula ended.' };
  if (tok.kind === 'var') {
    ctx.pos += 1;
    return { ok: true, expression: { kind: 'var', name: tok.name } };
  }
  if (tok.kind === 'const') {
    ctx.pos += 1;
    return { ok: true, expression: { kind: 'const', value: tok.value } };
  }
  if (tok.kind === 'lparen') {
    ctx.pos += 1;
    const inner = parseExpr(ctx);
    if (!inner.ok) return inner;
    if (ctx.tokens[ctx.pos]?.kind !== 'rparen') {
      return { ok: false, reason: 'Missing a closing paren.' };
    }
    ctx.pos += 1;
    return inner;
  }
  if (tok.kind === 'rparen') {
    return { ok: false, reason: 'Unexpected closing paren — nothing for it to close.' };
  }
  return { ok: false, reason: 'Expected a value but found an operator.' };
}
