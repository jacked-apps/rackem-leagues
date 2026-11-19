/**
 * @fileoverview Which LINES of a file belong to a database query — so the
 * query-test guard fires when a query changes, not when a lint fix or a
 * refactor merely touches a file that happens to contain one.
 *
 * A query region is:
 *   1. a Supabase call chain: from `.from('…')` / `.rpc('…')` /
 *      `.storage.from(` to the end of the statement (`.eq(…)`, `.order(…)`,
 *      multi-line select strings and all), and
 *   2. any constant a chain passes to `.select(NAME)` — e.g. `GAME_SELECT`,
 *      where the My Stats (#277) bug actually lived.
 *
 * Dry run before this existed (2026-11-17): judging whole files, the guard
 * would have failed 24 of the last 30 PRs — a check that cries wolf gets
 * switched off. A tokenizer-free scan is enough: strings and comments are
 * skipped so brackets inside them don't confuse the depth count.
 *
 * @see docs/plans/2026-11-17-001-feat-trustworthy-tests-plan.md (U1)
 */

const CHAIN_START = /\.(?:from|rpc)\(\s*['"`]|\.storage\s*\.\s*from\(/g;
const SELECT_CONST = /\.select\(\s*([A-Za-z_$][\w$]*)\s*[,)]/g;

/** Index just past the string/comment starting at `i`, or `i` if none. */
function skipOpaque(src, i) {
  const ch = src[i];
  if (ch === '/' && (src[i + 1] === '/' || src[i + 1] === '*')) {
    const close = src[i + 1] === '/' ? '\n' : '*/';
    const end = src.indexOf(close, i + 2);
    return end === -1 ? src.length : end + (close === '*/' ? 2 : 0);
  }
  if (ch !== "'" && ch !== '"' && ch !== '`') return i;
  for (let j = i + 1; j < src.length; j++) {
    if (src[j] === '\\') j++;
    else if (src[j] === ch) return j + 1;
  }
  return src.length;
}

/**
 * End index of the statement starting at `start`: a `;` or `,` at depth 0,
 * a closing bracket that drops below depth 0, or a newline at depth 0 whose
 * next line doesn't continue the chain with `.`.
 */
export function statementEnd(src, start) {
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    const skipped = skipOpaque(src, i);
    if (skipped !== i) { i = skipped - 1; continue; }
    const ch = src[i];
    if ('([{'.includes(ch)) depth++;
    else if (')]}'.includes(ch) && --depth < 0) return i;
    else if (depth === 0 && (ch === ';' || ch === ',')) return i;
    else if (depth === 0 && ch === '\n' && !/^\s*\./.test(src.slice(i + 1, i + 200))) return i;
  }
  return src.length;
}

/** 1-based line number of index `i`. */
const lineOf = (src, i) => src.slice(0, i).split('\n').length;

/**
 * Every 1-based line number that sits inside a query region.
 *
 * @param {string} src - full file text
 * @returns {Set<number>}
 */
export function queryLines(src) {
  const lines = new Set();
  const addSpan = (from, to) => {
    for (let n = lineOf(src, from); n <= lineOf(src, to); n++) lines.add(n);
  };
  for (const match of src.matchAll(CHAIN_START)) {
    addSpan(match.index, statementEnd(src, match.index + 1));
  }
  for (const match of src.matchAll(SELECT_CONST)) {
    const decl = new RegExp(`(?:const|let|var)\\s+${match[1].replace(/\$/g, '\\$')}\\s*=`).exec(src);
    if (decl) addSpan(decl.index, statementEnd(src, decl.index + decl[0].length));
  }
  return lines;
}
