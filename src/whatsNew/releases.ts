/**
 * @fileoverview What's New — the release notes users read.
 *
 * ── HOW TO ADD AN ENTRY ──────────────────────────────────────────────────────
 *
 * In the PR that makes the change, add a line to the `unreleased` block below.
 * Write it while the effect is fresh; reconstructing a fortnight of work from
 * commit subjects at release time is how notes end up unreadable.
 *
 * If your PR has no user-facing effect — a refactor, a test fix, a dependency
 * bump — add nothing, and put `[no-changelog]` in the PR description. That's a
 * normal, expected answer; the CI check just insists you give one.
 *
 * ── HOW TO WRITE IT ──────────────────────────────────────────────────────────
 *
 * The reader is a pool player, not an engineer.
 *
 *   - Say what changed FOR THEM, not what we did.
 *   - No jargon. None. Not "service worker", "migration", "race condition",
 *     "cache", "dispatcher". If a word only makes sense to us, it doesn't go
 *     on the page.
 *   - Name the thing they can see — the button, the screen, the chat.
 *   - One or two sentences. If it needs a paragraph, it's two entries, or it
 *     doesn't belong.
 *
 * Be candid, including about our own mistakes. The point of this page isn't a
 * polished image, it's evidence that somebody is paying attention:
 *
 *   ✅ "For about a week the app couldn't install its own updates. That's
 *       fixed — tapping Update now actually updates it."
 *   ❌ "Fixed an issue where the app could fail to update."
 *
 * Two limits, both about accuracy rather than image: don't overstate the damage
 * either, and never blame a user or their device for something that was ours.
 *
 * ── AT RELEASE ───────────────────────────────────────────────────────────────
 *
 * `node scripts/stamp-whats-new.mjs 1.9.0` renames the `unreleased` block to
 * that version, dates it, and opens a fresh empty one.
 *
 * @see docs/plans/2026-09-05-002-feat-whats-new-plan.md
 */

/** One line on the page. */
export interface ReleaseEntry {
  /** Plain language, present tense, no jargon. See the writing rules above. */
  text: string;
  /**
   * Marks something only a league operator would care about, so a player can
   * skip it. A tag, not a separate view — one list is one thing to maintain.
   */
  forOperators?: boolean;
}

/** One release. */
export interface Release {
  /** Semver, or `unreleased` for the block currently being accumulated. */
  version: string;
  /** ISO date; null while unreleased. */
  date: string | null;
  /**
   * The one-liner shown in the "Earlier releases" list.
   *
   * Written by hand alongside the entries. Generating it would give either the
   * first entry — often the least important thing in the release — or a count,
   * which tells nobody anything.
   */
  summary: string;
  entries: ReleaseEntry[];
  /**
   * Set ONLY when a release genuinely changed nothing a user would notice, with
   * the reason. Satisfies the release gate deliberately rather than bypassing
   * it, and leaves a record of why the release was quiet.
   */
  noUserFacingChanges?: string;
}

/** The block the sentinel `version` uses while entries accumulate. */
export const UNRELEASED = 'unreleased';

/**
 * Releases, newest first.
 *
 * The `unreleased` block is always index 0 (add it back after stamping). It is
 * shown on the page but never triggers the "New" marker — users shouldn't be
 * told about something that hasn't shipped.
 */
export const RELEASES: Release[] = [
  {
    version: UNRELEASED,
    date: null,
    summary: '',
    entries: [],
  },
  {
    version: '1.0.0',
    date: '2026-09-05',
    summary:
      'Message notifications on your phone, tournament brackets, and an update button that works',
    entries: [
      {
        text: 'Messages can now reach your phone even when the app is closed. Tap the notification and it opens straight to that conversation.',
      },
      {
        text: 'You decide what comes through. Set quiet hours so nothing arrives overnight, pick a default for each kind of chat, and mute any single conversation on its own.',
      },
      {
        text: 'A busy group chat notifies you once and then stays quiet for a few minutes, instead of buzzing for every message. Direct messages always come through.',
      },
      {
        text: 'Your phone was buzzing for the chat you were already reading. It does not any more.',
      },
      {
        text: 'Only the first message in a conversation was making a sound and the rest arrived silently. Every message announces itself properly now.',
      },
      {
        text: 'Tournaments: run a single or double elimination bracket for a bar night or a side event. Add names, tap the winners, and share a link so anyone can follow along live. It is free and it does not need a league.',
      },
      {
        text: 'For about a week the app could not install its own updates, and tapping Update looked like it did nothing at all. That is fixed. It now shows you it is working and reloads on its own when it is done.',
      },
      {
        text: 'In a direct message the other person\u2019s name stays at the top instead of scrolling away, and it is no longer repeated above every single message.',
      },
      {
        text: 'You can see which version of the app you are running at the bottom of this page. Worth knowing if something looks wrong and you want to tell us about it.',
      },
      {
        text: 'This page. From now on you can see what we have changed and when, and look back through earlier releases.',
      },
    ],
  },
];
