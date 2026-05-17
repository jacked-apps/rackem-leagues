/**
 * @fileoverview Curated emoji set for the messaging composer picker.
 *
 * 12 pool-league-flavoured emojis, hand-picked with Ed on 2026-05-15
 * during the Phase 1 polish triage. Order matters — appears left-to-right,
 * top-to-bottom in a 4×3 grid.
 *
 * This file is **config-driven**: edit the array to change the set
 * without touching the picker component. Keep it at 12 (4×3) until we
 * have a UX reason to grow — the grid stays one-screen on mobile, no
 * scrolling, no categories.
 *
 * Why this exact set (paraphrased from the triage):
 *   - 🎉 celebrate / win
 *   - 👍 agree / yes / "I'll be there"
 *   - 👎 disagree / no / "I'm not coming"
 *   - ❤️ love / appreciation
 *   - 🍻 cheers (pool-league specific — beer mugs, not champagne flutes)
 *   - 🎱 8-ball / pool brand
 *   - 😂 laugh
 *   - 🏆 match win / trophy
 *   - 💪 well played
 *   - 🔥 clutch shot / blowout win
 *   - 🤞 good luck (fingers crossed)
 *   - 💔 tough loss / sympathy
 *
 * Custom 9-ball / 10-ball emojis are NOT in standard Unicode — they're
 * tracked in `MVP_FEATURE_LIST.md` FUTURE FEATURES as a separate (medium-
 * large) project. 🎱 stands in for "pool" generally.
 */

export const EMOJI_SET: readonly string[] = [
  '🎉',
  '👍',
  '👎',
  '❤️',
  '🍻',
  '🎱',
  '😂',
  '🏆',
  '💪',
  '🔥',
  '🤞',
  '💔',
] as const;
