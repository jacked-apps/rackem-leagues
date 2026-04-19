/**
 * @fileoverview Remove PDF-rendering artifacts from extracted page text.
 *
 * The source PDF prints a running header on every page: either
 * `OFFICIAL RULES OF CUESPORTS INTERNATIONAL  <page-number>` (header first)
 * or `<page-number>  OFFICIAL RULES OF CUESPORTS INTERNATIONAL` (page-number
 * first — seen on even pages). Both variants have to go before we concatenate
 * pages, otherwise the header text shows up mid-paragraph in the cleaned
 * output and breaks rule-ID regexes that assume digit-dash-digit patterns
 * occur only at rule boundaries.
 *
 * This module does only safe, local cleanup:
 *   - strip the running header + its adjacent page number
 *   - normalize line breaks and tabs to single spaces
 *   - collapse runs of 3+ spaces to exactly 2 (normalizes marker width)
 *   - trim leading/trailing whitespace
 *
 * Crucially, it **preserves runs of 2 consecutive spaces** because those are
 * meaningful structural markers in the source PDF: the typesetting puts two
 * or more spaces between a rule ID and its heading, and again between the
 * heading and the body. Collapsing them to single spaces (as an earlier
 * iteration did) destroys the signal the rule splitter relies on.
 *
 * It deliberately does not try to split rules or detect paragraphs — those
 * are later stages in the pipeline.
 */

const HEADER = 'OFFICIAL RULES OF CUESPORTS INTERNATIONAL';

// Matches the header with an optional adjacent page number on either side.
// Non-capturing; we substitute with a single space so words on either side
// don't collide.
const HEADER_PATTERN = new RegExp(
  `(?:\\d+\\s+)?${HEADER.replace(/ /g, '\\s+')}(?:\\s+\\d+)?`,
  'g',
);

/** Strip running headers and normalize whitespace in one page's text. */
export function scrubPage(raw: string): string {
  return raw
    .replace(HEADER_PATTERN, '  ') // remove header, leave a double space so multi-space markers survive at boundaries
    .replace(/[\r\n\t]+/g, ' ') // normalize line breaks / tabs to a single space
    .replace(/ {3,}/g, '  ') // normalize 3+ space runs to exactly 2 (keeps marker intact)
    .trim();
}

/** Scrub every page and concatenate into a single body of text. */
export function scrubAndJoin(pages: { page: number; text: string }[]): string {
  return pages.map((p) => scrubPage(p.text)).join(' ');
}
