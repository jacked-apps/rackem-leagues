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
 *   - collapse runs of whitespace into a single space
 *   - trim
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

/** Strip running headers and collapse whitespace in one page's text. */
export function scrubPage(raw: string): string {
  return raw.replace(HEADER_PATTERN, ' ').replace(/\s+/g, ' ').trim();
}

/** Scrub every page and concatenate into a single body of text. */
export function scrubAndJoin(pages: { page: number; text: string }[]): string {
  return pages.map((p) => scrubPage(p.text)).join(' ');
}
