/**
 * @fileoverview `isEmojiOnly` — detects messages whose content is just
 * emoji, used by the Unit 13 "giant emoji message" render branch in
 * `MessageBubble`.
 *
 * iMessage's convention: a message with up to 3 emoji (and nothing else)
 * renders larger, unbubbled, for emphasis. Anything mixed or longer
 * renders as a normal text bubble. This helper encodes that rule.
 *
 * Implementation notes:
 *   - Uses `Intl.Segmenter` when available to count graphemes correctly
 *     (so ZWJ sequences like 👨‍👩‍👧 count as one). Falls back to
 *     `[...str]` codepoint iteration on engines without Segmenter — the
 *     fallback is slightly conservative (treats a multi-codepoint emoji
 *     as multiple graphemes), which means borderline cases bias toward
 *     "render as normal bubble" instead of "giant," which is the safer
 *     side to err on.
 *   - The detection regex matches Unicode `Extended_Pictographic` (covers
 *     almost all emoji) plus `Emoji_Component` (skin tones, ZWJ, VS16)
 *     plus regional-indicator pairs (flags). It does NOT match plain
 *     digits, ASCII letters, punctuation, or whitespace.
 *   - Trim whitespace before deciding — a message of "👍 " should count
 *     as emoji-only.
 */

// Match: Extended_Pictographic (covers nearly all emoji glyphs) +
// ZWJ (U+200D, for family / profession ZWJ sequences) +
// VS16 (U+FE0F, the emoji-presentation variation selector) +
// regional-indicator pairs (flags) +
// whitespace.
//
// Deliberately does NOT include `\p{Emoji_Component}` — that property
// matches digits 0-9 (because they're parts of keycap emojis like
// 1️⃣), which would make plain numeric strings register as emoji-only.
const EMOJI_RE = /^[\p{Extended_Pictographic}‍️\u{1F1E6}-\u{1F1FF}\s]+$/u;

const MAX_GIANT_GRAPHEMES = 3;

/**
 * Count graphemes (user-perceived characters). One ZWJ family emoji =
 * 1 grapheme even though it's 5+ codepoints.
 */
function graphemeCount(s: string): number {
  // Intl.Segmenter is supported in all modern evergreen browsers we
  // target, but guard for older engines just in case.
  const SegmenterCtor: typeof Intl.Segmenter | undefined = (Intl as { Segmenter?: typeof Intl.Segmenter })
    .Segmenter;
  if (SegmenterCtor) {
    const seg = new SegmenterCtor(undefined, { granularity: 'grapheme' });
    let n = 0;
    for (const _ of seg.segment(s)) n += 1;
    return n;
  }
  // Fallback: codepoint count. Multi-codepoint emoji will over-count, but
  // erring toward "treat as long → render as normal bubble" is safer than
  // accidentally enlarging text the user typed.
  return [...s].length;
}

/**
 * Returns `true` when the trimmed string is composed entirely of emoji
 * (plus emoji-related joiners / variation selectors / whitespace) AND
 * is ≤3 graphemes long. Returns `false` for empty strings, mixed
 * text+emoji, or strings of 4+ emojis.
 *
 * @example
 * isEmojiOnly('👍')           // true
 * isEmojiOnly('🎉🎉🎉')        // true
 * isEmojiOnly('🎉🎉🎉🎉')      // false (>3)
 * isEmojiOnly('hi 👍')         // false (mixed)
 * isEmojiOnly('')              // false
 */
export function isEmojiOnly(content: string): boolean {
  if (!content) return false;
  const trimmed = content.trim();
  if (!trimmed) return false;
  if (!EMOJI_RE.test(trimmed)) return false;
  // Count graphemes on the non-whitespace portion so spaces between
  // emojis don't inflate the count (e.g., "👍 👎" should be 2 graphemes,
  // not 3).
  const noSpaces = trimmed.replace(/\s+/g, '');
  return graphemeCount(noSpaces) > 0 && graphemeCount(noSpaces) <= MAX_GIANT_GRAPHEMES;
}
