/**
 * @fileoverview Pure lookups over the release list.
 *
 * Separated from the page so the rules — which release is "current", what
 * counts as released, what the marker compares against — can be asserted
 * without rendering anything.
 */

import {
  RELEASES,
  UNRELEASED,
  type EntryKind,
  type Release,
  type ReleaseEntry,
} from './releases';

/**
 * The order groups appear, and what each is called on the page.
 *
 * New things first: a big feature buried between two small fixes gets missed,
 * and someone skimming wants what's new before what's mended. Fixes last —
 * worth publishing, not worth leading with.
 */
export const KIND_GROUPS: { kind: EntryKind; heading: string }[] = [
  { kind: 'feature', heading: 'New' },
  { kind: 'improvement', heading: 'Improved' },
  { kind: 'fix', heading: 'Fixed' },
];

/** A heading plus the entries under it. Empty groups are dropped. */
export interface EntryGroup {
  kind: EntryKind;
  heading: string;
  entries: ReleaseEntry[];
}

/**
 * Split a release's entries into display groups.
 *
 * Within a group, authored order is preserved — that's the writer's judgement
 * about what matters most, and no automatic rule beats it.
 *
 * @param entries - The release's entries
 * @returns Non-empty groups, in display order
 */
export function groupEntries(entries: ReleaseEntry[]): EntryGroup[] {
  return KIND_GROUPS.map(({ kind, heading }) => ({
    kind,
    heading,
    // Untagged defaults to `improvement`, so an entry can never vanish from the
    // page by omitting a field.
    entries: entries.filter((e) => (e.kind ?? 'improvement') === kind),
  })).filter((group) => group.entries.length > 0);
}

/** True for a real shipped release (excludes the accumulating block). */
export function isReleased(release: Release): boolean {
  return release.version !== UNRELEASED;
}

/**
 * Releases that have actually shipped, newest first.
 *
 * The list is authored newest-first, so this preserves order rather than
 * sorting: semver string comparison would put 1.10.0 before 1.9.0.
 */
export function releasedVersions(releases: Release[] = RELEASES): Release[] {
  return releases.filter(isReleased);
}

/**
 * The newest SHIPPED version, or null before the first release.
 *
 * This is what the "New" marker compares against — deliberately not the
 * unreleased block, since users shouldn't be told about something that hasn't
 * shipped.
 */
export function latestReleasedVersion(releases: Release[] = RELEASES): string | null {
  return releasedVersions(releases)[0]?.version ?? null;
}

/** A release worth showing: it says something. */
function hasContent(release: Release): boolean {
  return release.entries.length > 0 || !!release.noUserFacingChanges;
}

/**
 * The release to show for a route.
 *
 * @param version - From the URL, or undefined for `/whats-new`
 * @returns The named release; otherwise the newest one that actually says
 *          something.
 *
 * Skipping empty blocks matters immediately after a release: stamping opens a
 * fresh empty `unreleased` at the top of the list, so defaulting to "the first
 * entry" would greet everyone with a blank "In progress" page on exactly the
 * day they were told to come and look. The unreleased block IS shown once it
 * has entries, which is the normal state on dev and staging.
 *
 * An unknown version falls back rather than 404s: a stale link from a support
 * conversation should still land somewhere useful.
 */
export function resolveRelease(
  version?: string,
  releases: Release[] = RELEASES
): Release | null {
  if (version) {
    const match = releases.find((r) => r.version === version);
    if (match) return match;
  }
  return releases.find(hasContent) ?? releases[0] ?? null;
}

/**
 * The other releases, for the "Earlier releases" list.
 *
 * Excludes whichever release is currently displayed — listing it under
 * "Earlier" while it's open above reads as a duplicate — and excludes the
 * unreleased block, which has no version or date to show.
 */
export function earlierReleases(
  currentVersion: string | undefined,
  releases: Release[] = RELEASES
): Release[] {
  return releasedVersions(releases).filter((r) => r.version !== currentVersion);
}
