/**
 * @fileoverview Turn Stryker's JSON mutation report into a summary Ed can read
 * without knowing Stryker. Pure — no I/O (the CLI is
 * scripts/mutation-summary.mjs).
 *
 * The report (mutation-testing-report-schema): `files[path].mutants[]`, each
 * with `status` (Killed / Survived / NoCoverage / Timeout / CompileError /
 * RuntimeError / Ignored / Pending), `mutatorName`, `replacement`,
 * `location` (1-based line/column), `coveredBy` / `killedBy` test ids, and
 * for Ignored a `statusReason`. `testFiles[path].tests[]` names the test ids.
 *
 * Counting: a Timeout counts as caught (the mistake made the tests hang —
 * they noticed). CompileError / RuntimeError mutants aren't real mistakes
 * (the code wouldn't even run) and are left out. Ignored = accepted on
 * purpose with a written reason; shown separately, never as caught.
 *
 * @see docs/plans/2026-11-17-001-feat-trustworthy-tests-plan.md (U8)
 */

/** Each Stryker mutator, as the mistake it makes. */
const IN_WORDS = {
  ArithmeticOperator: 'changed a math operator',
  ArrayDeclaration: 'emptied a list',
  ArrowFunction: 'made a function return nothing',
  AssignmentOperator: 'changed an assignment (e.g. += to -=)',
  BlockStatement: 'deleted a block of code',
  BooleanLiteral: 'flipped true/false',
  ConditionalExpression: 'forced a condition always true or always false',
  EqualityOperator: 'changed a comparison (e.g. >= to >)',
  LogicalOperator: 'swapped and/or (&& ||, ??)',
  MethodExpression: 'swapped a method (e.g. min for max)',
  ObjectLiteral: 'emptied an object',
  OptionalChaining: 'removed a ?. null-guard',
  Regex: 'changed a pattern',
  StringLiteral: 'changed a text value',
  UnaryOperator: 'flipped a sign or a !',
  UpdateOperator: 'swapped ++ and --',
};
export const inWords = (mutator) => IN_WORDS[mutator] ?? `"${mutator}" change`;

const CAUGHT = new Set(['Killed', 'Timeout']);
const MISSED = new Set(['Survived', 'NoCoverage']);

/** The original code a mutant replaced, on one line. */
function original(source, { start, end }) {
  const lines = source.split('\n');
  const text = start.line === end.line
    ? lines[start.line - 1].slice(start.column - 1, end.column - 1)
    : `${lines[start.line - 1].slice(start.column - 1)} …`;
  return text.replace(/\s+/g, ' ').trim().slice(0, 70);
}
const oneLine = (s) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, 70);

/**
 * @param {object} report - Stryker JSON report
 * @returns {string} markdown
 */
export function summarize(report) {
  const all = Object.entries(report?.files ?? {}).flatMap(([path, f]) =>
    (f.mutants ?? []).map((m) => ({ ...m, path, source: f.source ?? '' })));
  const caught = all.filter((m) => CAUGHT.has(m.status));
  const missed = all.filter((m) => MISSED.has(m.status));
  const accepted = all.filter((m) => m.status === 'Ignored');
  const total = caught.length + missed.length;

  const where = (m) => `${m.path}:${m.location.start.line}`;
  const change = (m) => `\`${original(m.source, m.location)}\` → \`${oneLine(m.replacement)}\` (${inWords(m.mutatorName)})`;

  const out = ['## Mutation testing', ''];
  out.push(missed.length === 0
    ? `**Of ${total} deliberate mistakes, the tests caught all ${total}.**`
    : `**Of ${total} deliberate mistakes, the tests caught ${caught.length} (${Math.floor((caught.length / total) * 100)}%). Missed ${missed.length}.**`);

  if (missed.length) {
    out.push('', '### Missed — the tests did not notice these', ...missed.map((m) =>
      `- ${where(m)} — ${change(m)}${m.status === 'NoCoverage' ? ' — **no test runs this line at all**' : ''}`));
  }
  if (accepted.length) {
    out.push('', `### Accepted on purpose (${accepted.length})`, ...accepted.map((m) =>
      `- ${where(m)} — ${change(m)} — reason: ${oneLine(m.statusReason) || '(none written)'}`));
  }

  // Tests that ran on a mistake's line but never caught a single one: they
  // execute the code without really checking it.
  const names = new Map(Object.values(report?.testFiles ?? {}).flatMap((f) => (f.tests ?? []).map((t) => [t.id, t.name])));
  const covering = new Set(all.flatMap((m) => m.coveredBy ?? []));
  const killing = new Set(all.flatMap((m) => m.killedBy ?? []));
  const idle = [...covering].filter((id) => !killing.has(id));
  if (idle.length) {
    out.push('', '### Tests that ran on mistakes but caught none', ...idle.map((id) => `- ${names.get(id) ?? id}`));
  }
  return `${out.join('\n')}\n`;
}
