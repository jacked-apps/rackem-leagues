/**
 * @fileoverview Unit tests for the pure helpers in `SearchSnippet.tsx`
 * (`renderHighlightedSnippet` and `truncateOnWordBoundary`). The full
 * React component is exercised indirectly by the RulesPage integration
 * test; here we pin down the core slicing/highlighting behavior.
 */

import { describe, it, expect } from 'vitest';

import {
  renderHighlightedSnippet,
  truncateOnWordBoundary,
} from '@/rules/SearchSnippet';

// Helper: flatten the returned React nodes into a single plain-text string
// and the set of substrings that were wrapped in <mark> elements.
function summarize(nodes: React.ReactNode[]) {
  let text = '';
  const marks: string[] = [];
  for (const node of nodes) {
    if (typeof node === 'string') {
      text += node;
    } else if (node && typeof node === 'object' && 'props' in node) {
      const el = node as { props: { children?: React.ReactNode } };
      const inner = typeof el.props.children === 'string' ? el.props.children : '';
      marks.push(inner);
      text += inner;
    }
  }
  return { text, marks };
}

describe('truncateOnWordBoundary', () => {
  it('returns text unchanged when under the limit', () => {
    expect(truncateOnWordBoundary('short string', 50)).toBe('short string');
  });

  it('truncates on a word boundary and appends an ellipsis', () => {
    const text = 'The cue ball must contact the lowest numbered ball or it is a foul.';
    const out = truncateOnWordBoundary(text, 30);
    expect(out.length).toBeLessThanOrEqual(30 + 1); // +1 for the ellipsis char
    expect(out).toMatch(/\S…$/); // ends with non-space + ellipsis
    expect(out.endsWith(' …')).toBe(false);
  });
});

describe('renderHighlightedSnippet', () => {
  it('wraps the first occurrence of the query in <mark>', () => {
    const nodes = renderHighlightedSnippet(
      'The cue ball must contact the lowest numbered ball first.',
      'cue ball',
    );
    const { text, marks } = summarize(nodes);
    expect(text.toLowerCase()).toContain('cue ball');
    expect(marks).toContain('cue ball');
  });

  it('is case-insensitive (matches "The" with query "the")', () => {
    const nodes = renderHighlightedSnippet('The quick brown fox', 'the');
    const { marks } = summarize(nodes);
    expect(marks.length).toBeGreaterThan(0);
    expect(marks[0].toLowerCase()).toBe('the');
  });

  it('highlights every occurrence that sits inside the extracted window', () => {
    const paragraph =
      'A foul on a foul is still a foul when a foul occurs after a foul.';
    const nodes = renderHighlightedSnippet(paragraph, 'foul');
    const { marks } = summarize(nodes);
    expect(marks.length).toBeGreaterThanOrEqual(3);
    for (const m of marks) expect(m.toLowerCase()).toBe('foul');
  });

  it('emits no <mark> when the query is not present', () => {
    const nodes = renderHighlightedSnippet('nothing interesting here', 'zyzzyva');
    const { marks } = summarize(nodes);
    expect(marks.length).toBe(0);
  });

  it('produces a snippet whose length is bounded roughly around the target', () => {
    const long =
      'lorem ipsum '.repeat(200) + 'stalemate' + ' dolor sit'.repeat(50);
    const nodes = renderHighlightedSnippet(long, 'stalemate');
    const { text } = summarize(nodes);
    // Target is ~140, max 160 plus ellipses. Be generous.
    expect(text.length).toBeLessThan(200);
    expect(text.length).toBeGreaterThan(50);
  });

  it('treats regex-special characters as literal substrings (no throw)', () => {
    expect(() =>
      renderHighlightedSnippet('see section 3-1 (rule 1)', '(rule'),
    ).not.toThrow();
  });
});
