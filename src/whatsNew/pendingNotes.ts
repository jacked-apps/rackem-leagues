/**
 * @fileoverview What's New notes that haven't shipped yet.
 *
 * Each user-facing PR adds ONE file to `src/whatsNew/notes/` instead of editing
 * a shared list. Two open PRs therefore never touch the same file, so they can
 * never conflict with each other — the person merging them (Jack) never has to
 * untangle anything.
 *
 * At release, `scripts/stamp-whats-new.mjs` (run automatically by
 * `npm version`) folds these files into a versioned block in `releases.ts` and
 * deletes them. Until then they show on the page as "Latest changes".
 *
 * @see src/whatsNew/notes/README.md for the file format
 * @see docs/plans/2026-11-01-001-fix-whats-new-zero-step-release-plan.md
 */

import type { ReleaseEntry } from './releases';

/** One note file: a page entry, plus a few words for the release summary. */
export interface PendingNote extends ReleaseEntry {
  /**
   * A short phrase for the release's one-line summary ("My Stats", "fairer
   * tiebreakers"). The stamp joins every note's headline into that line, so
   * nobody has to write a summary at release time. Leave it off for small
   * fixes that don't belong in the headline.
   */
  headline?: string;
}

// A file holds one note, or an array when a PR has several.
const files = import.meta.glob<PendingNote | PendingNote[]>('./notes/*.json', {
  eager: true,
  import: 'default',
});

/**
 * Every waiting note, in file-name order — the same order the stamp uses, so
 * the page doesn't reshuffle on release day.
 */
export const PENDING_NOTES: PendingNote[] = Object.keys(files)
  .sort()
  .flatMap((path) => files[path]);

/** The waiting notes as page entries (the headline only feeds the summary). */
export const PENDING_ENTRIES: ReleaseEntry[] = PENDING_NOTES.map(
  ({ headline: _headline, ...entry }) => entry
);
