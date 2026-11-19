/**
 * @fileoverview Pure checks behind testHygiene.test.ts — the three ways a test
 * suite can look green while protecting nothing:
 *
 *   1. A skipped test (`it.skip`, `it.todo`, `skipIf`, `xit`, `ctx.skip()`,
 *      `(cond ? it : it.skip)`) — fine with a written reason, never silent.
 *      `.only` is never fine: it quietly skips everything else in the file.
 *   2. An orphan test file — one no vitest project runs, so it never runs.
 *   3. A test body that `return`s part-way through — on an empty database it
 *      passes having skipped its assertions ("silent skip").
 *
 * Source is parsed with the TypeScript compiler, so the word "skip" inside a
 * string or comment is never mistaken for a skip.
 *
 * @see docs/plans/2026-11-17-001-feat-trustworthy-tests-plan.md (U6)
 */

import ts from 'typescript';

const TEST_FNS = new Set(['it', 'test', 'describe', 'suite']);
const SKIP_PROPS = new Set(['skip', 'todo', 'skipIf', 'runIf']);
const X_FNS = new Set(['xit', 'xtest', 'xdescribe']);
const REASON = /skip-reason:\s*\S/;

/** One skip-like construct found in a test file. */
export interface SkipFinding {
  line: number;
  kind: string;
  reason: string | null;
}

function parse(source: string, fileName: string) {
  const kind = fileName.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  return ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, kind);
}

/**
 * The `// skip-reason: …` written on the same line, or in the comment block
 * directly above it. Returns the reason text, or null.
 */
function reasonFor(lines: string[], line: number): string | null {
  const own = lines[line - 1].match(/skip-reason:\s*(.+)$/);
  if (own) return own[1].trim();
  for (let i = line - 2; i >= 0; i--) {
    const text = lines[i].trim();
    if (!/^(\/\/|\/\*|\*)/.test(text)) break;
    if (REASON.test(text)) return text.replace(/^.*skip-reason:\s*/, '').replace(/\*\/$/, '').trim();
  }
  return null;
}

/** Every skip / todo / only in a test file, with its written reason if any. */
export function findSkips(source: string, fileName = 'x.test.ts'): SkipFinding[] {
  const sf = parse(source, fileName);
  const lines = source.split('\n');
  const found: SkipFinding[] = [];
  const add = (node: ts.Node, kind: string) => {
    const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
    found.push({ line, kind, reason: reasonFor(lines, line) });
  };
  const visit = (node: ts.Node) => {
    if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression)) {
      const obj = node.expression.text;
      const prop = node.name.text;
      if (TEST_FNS.has(obj) && (prop === 'only' || SKIP_PROPS.has(prop))) add(node, `${obj}.${prop}`);
      // ctx.skip() / context.skip() — a test skipping itself at run time.
      else if (!TEST_FNS.has(obj) && prop === 'skip' && ts.isCallExpression(node.parent) && node.parent.expression === node) add(node, `${obj}.skip()`);
    }
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && X_FNS.has(node.expression.text)) add(node, node.expression.text);
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

/** Problems a reviewer must act on: `.only` anywhere, or a skip with no reason. */
export function skipProblems(findings: SkipFinding[]): SkipFinding[] {
  return findings.filter((f) => f.kind.endsWith('.only') || !f.reason);
}

const isFunction = (n: ts.Node) => ts.isArrowFunction(n) || ts.isFunctionExpression(n) || ts.isFunctionDeclaration(n);
const isExpectCall = (n: ts.Node) =>
  ts.isCallExpression(n) && (
    (ts.isIdentifier(n.expression) && n.expression.text === 'expect') ||
    (ts.isPropertyAccessExpression(n.expression) && ts.isIdentifier(n.expression.expression) && n.expression.expression.text === 'expect')
  );

/**
 * Lines where a test body `return`s part-way through, skipping whatever
 * assertions come after — on missing data the test passes having checked
 * nothing (or only half). Allowed: the body's final statement, `return
 * expect(…)`, and returns inside nested callbacks (they leave the callback,
 * not the test).
 */
export function findEarlyReturns(source: string, fileName = 'x.test.ts'): number[] {
  const sf = parse(source, fileName);
  const lines: number[] = [];
  const checkBody = (body: ts.Node) => {
    const finalStatement = ts.isBlock(body) ? body.statements[body.statements.length - 1] : undefined;
    const returns = (n: ts.Node) => {
      if (n !== body && isFunction(n)) return;
      if (ts.isReturnStatement(n) && n !== finalStatement) {
        let hasExpect = false;
        const scan = (m: ts.Node) => { if (isExpectCall(m)) hasExpect = true; else ts.forEachChild(m, scan); };
        if (n.expression) scan(n.expression);
        if (!hasExpect) lines.push(sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1);
      }
      ts.forEachChild(n, returns);
    };
    returns(body);
  };
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const name = ts.isIdentifier(callee) ? callee.text
        : ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression) ? callee.expression.text : '';
      if (name === 'it' || name === 'test') {
        const fn = node.arguments.find(isFunction) as ts.ArrowFunction | ts.FunctionExpression | undefined;
        if (fn?.body) checkBody(fn.body);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return lines;
}

/**
 * A vitest include/exclude glob → RegExp. Supports what our config uses:
 * `**` (any depth), `*` (within one segment) and `{a,b}`.
 */
export function globToRegExp(glob: string): RegExp {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') {
      re += glob[i + 2] === '/' ? '(?:.*/)?' : '.*';
      i += glob[i + 2] === '/' ? 2 : 1;
    } else if (c === '*') re += '[^/]*';
    else if (c === '{') {
      const end = glob.indexOf('}', i);
      re += `(?:${glob.slice(i + 1, end).split(',').map((s) => s.replace(/[.+^$()|[\]\\]/g, '\\$&')).join('|')})`;
      i = end;
    } else re += c.replace(/[.+^$()|[\]\\?]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}

/** A vitest project as declared in vitest.config.ts. */
export interface ProjectGlobs {
  name: string;
  include: string[];
  exclude: string[];
}

/** The projects that would run `path` (repo-relative, forward slashes). */
export function projectsFor(path: string, projects: ProjectGlobs[]): string[] {
  // A bare exclude like 'node_modules' means that folder anywhere.
  const excluded = (g: string) => globToRegExp(g.includes('/') || g.includes('*') ? g : `**/${g}/**`).test(path);
  return projects
    .filter((p) => p.include.some((g) => globToRegExp(g).test(path)) && !p.exclude.some(excluded))
    .map((p) => p.name);
}
