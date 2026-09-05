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
    version: '1.9.0',
    date: '2026-09-05',
    summary: 'Notifications you control, tournaments, and a pile of fixes',
    entries: [
      {
        text: 'Messages can now reach your phone when the app is closed. You choose what comes through: quiet hours so nothing arrives overnight, a default per kind of chat, and a setting on any single conversation.',
      },
      {
        text: 'A busy group chat notifies you once and then holds off for a few minutes, instead of buzzing for every message.',
      },
      {
        text: 'Your phone was buzzing for the chat you were already looking at. It does not any more.',
      },
      {
        text: 'For about a week the app could not install its own updates — tapping Update appeared to do nothing. That is fixed, and it now shows you it is working.',
      },
      {
        text: 'Tournaments: run a single or double elimination bracket for a bar night or side event. Add names, tap winners, and share a link so anyone can follow along. Free, and it does not need a league.',
      },
      {
        text: 'Tapping Create team chat twice made two identical chats. Now it makes one.',
      },
      {
        text: 'In a direct message the other person’s name stays at the top instead of scrolling away, and their name is no longer repeated above every message.',
      },
      {
        text: 'House rules: add your own rules on top of the official rulebook, so "scratch on the 8 is a loss" is written down instead of argued about.',
        forOperators: true,
      },
      {
        text: 'League dues at a glance, and a payout calculator for working out prize money.',
        forOperators: true,
      },
      {
        text: 'Enter a match that was played on paper, and reopen a finished match to correct it.',
        forOperators: true,
      },
      {
        text: 'Print a results sheet laid out the way CSI/FargoRate wants it, and tick off which matches you have already entered there.',
        forOperators: true,
      },
    ],
  },
];
