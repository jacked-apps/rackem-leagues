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
import { MAX_LENGTH, renderHighlightedSnippet, truncateOnWordBoundary } from './searchSnippetHelpers';

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
