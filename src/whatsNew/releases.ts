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

/**
 * What kind of change this is, which decides where it sits on the page.
 *
 * Grouped rather than chronological: a big new feature buried between two small
 * fixes gets missed, and someone skimming wants the new things first. Fixes go
 * last — worth publishing, not worth leading with.
 */
export type EntryKind = 'feature' | 'improvement' | 'fix';

/** One line on the page. */
export interface ReleaseEntry {
  /** Plain language, present tense, no jargon. See the writing rules above. */
  text: string;
  /**
   * Defaults to `improvement` — the middle ground, and the safest thing for an
   * untagged entry to be. Reserve `feature` for something genuinely new that a
   * user could not do before.
   */
  kind?: EntryKind;
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
    summary:
      'Message notifications on your phone, tournament brackets, and an update button that works',
    entries: [
      {
        text: 'Tournaments: run a single or double elimination bracket for a week off or a special event. Add names, tap the winners, and share a link so anyone can follow along live. It’s free and it doesn’t need a league.',
        kind: 'feature',
      },
      {
        text: 'Players can put themselves in your tournament. Print the QR code, stick it on the wall, and anyone who scans it is added to a waiting list you approve from. No account needed \u2014 they can just type a name.',
        kind: 'feature',
      },
      {
        text: 'Scan the code and you get the tournament\u2019s own page: who\u2019s in, who\u2019s still waiting, and what you\u2019re playing. It updates itself while you stand there, and the bracket appears on it once the organiser starts.',
        kind: 'feature',
      },
      {
        text: 'Everyone you\u2019ve run a tournament with is remembered, so next time they\u2019re one tap away instead of retyped \u2014 including the regulars who don\u2019t use the app. You can drop anyone from that list whenever you like.',
        kind: 'feature',
        forOperators: true,
      },
      {
        text: 'The paid tournament extras are switched on but nobody is being charged for them yet. Cards aren\u2019t checked and no money is taken \u2014 the price you see is a placeholder while we finish the payment side. Use them free in the meantime.',
        kind: 'improvement',
      },
      {
        text: 'Messages can now reach your phone even when the app is closed. Tap the notification and it opens straight to that conversation.',
        kind: 'feature',
      },
      {
        text: 'You decide what comes through. Set quiet hours so nothing arrives overnight, pick a default for each kind of chat, and mute any single conversation on its own.',
        kind: 'feature',
      },
      {
        text: 'A busy group chat notifies you once and then stays quiet for a few minutes, instead of buzzing for every message. Direct messages always come through.',
        kind: 'feature',
      },
      {
        text: 'It won’t buzz for a conversation you’re already reading, and it won’t go off repeatedly for a chat you’ve just checked.',
        kind: 'improvement',
      },
      {
        text: 'The Update button works properly now, and shows you it’s working.',
        kind: 'fix',
      },
      {
        text: 'In a direct message the other person\u2019s name stays at the top instead of scrolling away, and it\u2019s no longer repeated above every single message.',
        kind: 'improvement',
      },
      {
        text: 'You can see which version of the app you’re running at the bottom of this page. Worth knowing if something looks wrong and you want to tell us about it.',
        kind: 'improvement',
      },
      {
        text: 'This "What’s New" page. From now on you can see what we’ve changed and when, and look back through earlier releases.',
        kind: 'feature',
      },
    ],
  },
];
