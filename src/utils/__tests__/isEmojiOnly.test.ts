/**
 * @fileoverview Tests for `isEmojiOnly` — the helper that drives the
 * Unit 13 "giant emoji" render branch in `MessageBubble`. Pins the
 * iMessage-style rule: 1–3 trimmed emoji → giant, anything else →
 * normal bubble.
 */

import { describe, it, expect } from 'vitest';
import { isEmojiOnly } from '../isEmojiOnly';

describe('isEmojiOnly — positives (should render as giant emoji)', () => {
  it.each([
    ['🎉'],
    ['👍'],
    ['❤️'], // ZWJ + variation selector — common gotcha
    ['🎱'],
    ['🍻'],
    ['👍👎'],
    ['🎉🎉🎉'],
    ['🤞 🤞'], // spaces between emojis still count as emoji-only
    [' 👍 '], // surrounding whitespace stripped
  ])('returns true for %s', (content) => {
    expect(isEmojiOnly(content)).toBe(true);
  });
});

describe('isEmojiOnly — negatives (should render as normal bubble)', () => {
  it.each([
    [''],
    ['   '],
    ['hello'],
    ['hi 👍'], // mixed text + emoji
    ['👍 cool'],
    ['🎉🎉🎉🎉'], // 4 emojis — over the cap
    ['🎉👍❤️🍻'], // 4 different emojis
    ['🎉🎉🎉🎉🎉🎉'], // many
    ['123'],
    ['!!!'],
  ])('returns false for %s', (content) => {
    expect(isEmojiOnly(content)).toBe(false);
  });
});
