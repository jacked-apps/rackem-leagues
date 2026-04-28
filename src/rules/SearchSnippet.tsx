/**
 * @fileoverview Snippet extraction + highlight for one search result.
 *
 * Rules from `searchRulebook` come with a `matchType` ("heading" | "body")
 * and a `matchIndex` (char offset into the matched string). This component
 * turns that into a readable ~120–160 char excerpt:
 *   - For a body match: centered on the first occurrence with the matched
 *     substring wrapped in <mark>, additional occurrences visible inside
 *     the window are also highlighted, truncated on word boundaries with
 *     ellipsis.
 *   - For a heading match: we show the first ~150 chars of the body as
 *     supporting context (no <mark>) — the highlight for the heading lives
 *     in the surrounding row.
 *
 * Security: body paragraphs are emitted by the cleanup script with a
 * verification check that strips out `<` and `>`. We still render the text
 * through React children (escaped by default); <mark> wraps only plain
 * substrings we slice out of the original text.
 */

import type { Rule } from './rulebook.types';

const TARGET_LENGTH = 140;
const HALF_WINDOW = Math.floor(TARGET_LENGTH / 2);
const MAX_LENGTH = 160;

type SearchSnippetProps = {
  rule: Rule;
  query: string;
  matchType: 'heading' | 'body';
  bodyParagraphIndex?: number;
};

export function SearchSnippet({ rule, query, matchType, bodyParagraphIndex }: SearchSnippetProps) {
  const trimmed = query.trim();
  if (trimmed.length === 0) return null;

  // Heading match: show the first ~150 body chars as context, no highlight.
  if (matchType === 'heading' || bodyParagraphIndex === undefined) {
    const text = rule.body[0] ?? '';
    const snippet = truncateOnWordBoundary(text, MAX_LENGTH);
    return <p className="text-sm text-muted-foreground">{snippet}</p>;
  }

  const paragraph = rule.body[bodyParagraphIndex] ?? '';
  return (
    <p className="text-sm text-muted-foreground">
      {renderHighlightedSnippet(paragraph, trimmed)}
    </p>
  );
}

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
