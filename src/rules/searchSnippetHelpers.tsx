/**
 * @fileoverview Pure snippet helpers behind `SearchSnippet`: carve a ~140
 * char window around the first match, snap it to word boundaries, and wrap
 * every visible occurrence in <mark>.
 *
 * Kept out of `SearchSnippet.tsx` so that file exports only its component
 * (keeps React fast-refresh working). Unit-tested directly.
 */

const TARGET_LENGTH = 140;
const HALF_WINDOW = Math.floor(TARGET_LENGTH / 2);
export const MAX_LENGTH = 160;

/** Produce a snippet centered on the first match and highlight every match in view. */
export function renderHighlightedSnippet(paragraph: string, query: string): React.ReactNode[] {
  const lowerQuery = query.toLowerCase();
  const lowerParagraph = paragraph.toLowerCase();
  const firstMatch = lowerParagraph.indexOf(lowerQuery);
  if (firstMatch < 0) return [truncateOnWordBoundary(paragraph, MAX_LENGTH)];

  const slice = extractWindow(paragraph, firstMatch, query.length);
  return highlightAllOccurrences(slice, query);
}

/** Carve a ~140 char window centered on the match, snapped to word boundaries. */
function extractWindow(paragraph: string, matchStart: number, matchLen: number): string {
  const rawStart = Math.max(0, matchStart - HALF_WINDOW);
  const rawEnd = Math.min(paragraph.length, matchStart + matchLen + HALF_WINDOW);
  const start = rawStart === 0 ? 0 : advanceToWord(paragraph, rawStart);
  const end = rawEnd === paragraph.length ? paragraph.length : retreatToWord(paragraph, rawEnd);
  let slice = paragraph.slice(start, end).trim();
  if (start > 0) slice = `…${slice}`;
  if (end < paragraph.length) slice = `${slice}…`;
  return slice;
}

/** Wrap every case-insensitive occurrence of `query` inside `slice` with <mark>. */
function highlightAllOccurrences(slice: string, query: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const lowerSlice = slice.toLowerCase();
  const lowerQuery = query.toLowerCase();
  let cursor = 0;
  let key = 0;
  while (cursor < slice.length) {
    const hit = lowerSlice.indexOf(lowerQuery, cursor);
    if (hit < 0) {
      nodes.push(slice.slice(cursor));
      break;
    }
    if (hit > cursor) nodes.push(slice.slice(cursor, hit));
    nodes.push(
      <mark key={key++} className="rounded bg-yellow-200 text-foreground px-0.5">
        {slice.slice(hit, hit + query.length)}
      </mark>,
    );
    cursor = hit + query.length;
  }
  return nodes;
}

/** Step forward to the first space so the slice starts on a word boundary. */
function advanceToWord(text: string, from: number): number {
  const nextSpace = text.indexOf(' ', from);
  return nextSpace === -1 ? from : nextSpace + 1;
}

/** Step backward to the previous space so the slice ends on a word boundary. */
function retreatToWord(text: string, to: number): number {
  const prevSpace = text.lastIndexOf(' ', to);
  return prevSpace === -1 ? to : prevSpace;
}

/** Truncate on a trailing word boundary with an ellipsis if shortened. */
export function truncateOnWordBoundary(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const cut = retreatToWord(text, maxLength);
  return `${text.slice(0, cut).trimEnd()}…`;
}
