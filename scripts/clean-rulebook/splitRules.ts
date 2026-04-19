/**
 * @fileoverview Slice a single section's scrubbed text into Rule records.
 *
 * Leans on the source PDF's typesetting convention: a **double space** is
 * used consistently as the major structural delimiter — between rule ID and
 * heading, between heading and body, between body items in a numbered list,
 * and between sentences that end with a period. `scrubText` preserves those
 * double-space runs (see that module's comments), so here we can use them
 * as the primary splitting signal.
 *
 * Per-rule layout we expect:
 *     "<id>  <heading>  <paragraph>  <paragraph>  ..."
 *
 * Rule IDs are recognized by the pattern `(\d+)[-.](\d+)` followed by a
 * double space. The `[-.]` tolerates the typo we observed where some rules
 * are typeset as `3.2` instead of `3-2`. The canonical ID stored in the
 * output is always hyphenated (`3-2`), independent of how the source wrote
 * it, so downstream code can index consistently.
 *
 * The double-space requirement in the lookahead is what prevents body-text
 * references like "see Figure 3-1)" or "Figure 6-2 specifies" from being
 * mistaken for rule-ID markers — those mentions are single-spaced.
 */

import type { Rule } from '../../src/rules/rulebook.types';

// Rule-ID: `N-N` or `N.N`, not preceded by the word "Figure " or by a digit,
// followed by 2+ spaces. The "Figure " lookbehind prevents figure captions
// like "Figure 3-1 Apex ball..." from being mistaken for rule markers.
const RULE_ID_PATTERN = /(?<!Figure )(?<!\d)(\d+)[-.](\d+)(?= {2,})/g;

/** Lone list markers ("1.", "a.", "iii.") that should merge into the next paragraph. */
const LONE_LIST_MARKER = /^(\d+|[A-Za-z])\.$/;

/** Start-of-paragraph list marker ("1. ", "a. ", etc.). */
const LIST_ITEM_START = /^(\d+|[A-Za-z])\.\s/;

/**
 * Heuristic: is this body paragraph figure-related noise the PDF emitted
 * between rules or at section boundaries? Figures come through as a mix of
 * bare words ("Figure"), short numeric stubs ("2", "10"), and diagram-label
 * fragments ("Apex 1", "Apex ball on foot spot"). Dropping them produces
 * cleaner rule bodies without touching real rule content.
 */
function looksLikeFigureNoise(p: string): boolean {
  if (p.length <= 3) return true; // "2", "10", "3"
  if (/^Figure\b/.test(p)) return true; // "Figure", "Figure 3-1 ..."
  if (/^Apex\b/.test(p)) return true; // "Apex ball on foot spot", "Apex 1"
  if (/^\d+-ball and \d+-ball/.test(p)) return true; // diagram caption fragments
  return false;
}

/**
 * Trim trailing figure fragments that slipped inside an otherwise-real body
 * paragraph. When the PDF emits figure text without a double-space separator
 * between it and the preceding sentence, the noise gets glued to the end of
 * the last real paragraph (commonly on the final rule of a section whose
 * next section opens with a figure). If a figure-ish marker ("Apex", "Figure
 * N-N") follows a sentence terminator (period, close-paren), truncate there.
 */
function stripTrailingFigureNoise(paragraph: string): string {
  return paragraph
    .replace(/([.!?)]\s)(Apex\b|Figure\s+\d+[-.]\d+).*$/, '$1')
    .trim();
}

/**
 * Re-attach a bare list marker to the paragraph that follows it. The source
 * typesetting emits "1." and its content as two double-space-separated parts;
 * we want one paragraph per list item for readable rendering.
 */
function mergeOrphanMarkers(parts: string[]): string[] {
  const merged: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (LONE_LIST_MARKER.test(part) && i + 1 < parts.length) {
      merged.push(`${part} ${parts[i + 1]}`);
      i++; // consumed the next part
    } else {
      merged.push(part);
    }
  }
  return merged;
}

/**
 * Merge continuation sentences into their preceding list item. The source
 * double-spaces sentences within a numbered body item, which would otherwise
 * produce one paragraph per sentence. For rendering we want one paragraph per
 * list item, so any paragraph that does NOT start with a list marker is
 * folded back into the previous list-item paragraph.
 */
function foldContinuationsIntoListItems(paragraphs: string[]): string[] {
  const out: string[] = [];
  for (const p of paragraphs) {
    const last = out[out.length - 1];
    if (last && LIST_ITEM_START.test(last) && !LIST_ITEM_START.test(p)) {
      out[out.length - 1] = `${last} ${p}`;
    } else {
      out.push(p);
    }
  }
  return out;
}

/**
 * Split one section's scrubbed text into `Rule[]` in source order.
 *
 * @param sectionText Text for a single `RULES SECTION N` body (already stripped
 *                    of its section header by `splitSections`).
 * @param gameSlug    Slug of the game these rules belong to (e.g., "9-ball").
 */
export function splitRulesInSection(sectionText: string, gameSlug: string): Rule[] {
  const matches = [...sectionText.matchAll(RULE_ID_PATTERN)];
  const rules: Rule[] = [];

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const next = matches[i + 1];
    const canonicalId = `${match[1]}-${match[2]}`; // normalize "3.2" → "3-2"
    const chunkStart = (match.index ?? 0) + match[0].length;
    const chunkEnd = next?.index ?? sectionText.length;
    const chunk = sectionText.slice(chunkStart, chunkEnd).trim();

    const parts = chunk
      .split(/ {2,}/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length === 0) continue;

    const heading = parts[0];
    const body = foldContinuationsIntoListItems(
      mergeOrphanMarkers(parts.slice(1))
        .map(stripTrailingFigureNoise)
        .filter((p) => !looksLikeFigureNoise(p)),
    );

    rules.push({
      id: canonicalId,
      game: gameSlug,
      heading,
      body,
      order: i,
    });
  }

  return rules;
}
