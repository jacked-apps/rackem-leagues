/**
 * @fileoverview Tests for the release lookups.
 *
 * The rules worth pinning are the ones that are easy to get subtly wrong: the
 * "New" marker must never fire for something unreleased, the earlier-releases
 * list must not repeat the release already on screen, and ordering must come
 * from the authored order rather than from comparing version strings — "1.10.0"
 * sorts before "1.9.0" as text.
 */

import { describe, it, expect } from 'vitest';
import {
  earlierReleases,
  isReleased,
  latestReleasedVersion,
  releasedVersions,
  resolveRelease,
} from '../releaseSelectors';
import { UNRELEASED, type Release } from '../releases';

const make = (version: string, date: string | null): Release => ({
  version,
  date,
  summary: `summary for ${version}`,
  entries: [{ text: `something changed in ${version}` }],
});

const FIXTURE: Release[] = [
  { ...make(UNRELEASED, null), summary: 'in progress' },
  make('1.10.0', '2026-03-04'),
  make('1.9.0', '2026-02-20'),
  make('1.8.0', '2026-01-30'),
];

describe('isReleased', () => {
  it('excludes the unreleased block', () => {
    expect(isReleased(FIXTURE[0])).toBe(false);
    expect(isReleased(FIXTURE[1])).toBe(true);
  });
});

describe('latestReleasedVersion', () => {
  it('is the newest SHIPPED version, never the unreleased block', () => {
    // The whole point: a user shouldn't get a "New" marker for something that
    // hasn't gone out.
    expect(latestReleasedVersion(FIXTURE)).toBe('1.10.0');
  });

  it('takes authored order, not string comparison', () => {
    // "1.10.0" < "1.9.0" as text. If this ever sorts, it breaks here.
    expect(latestReleasedVersion(FIXTURE)).not.toBe('1.9.0');
  });

  it('is null before anything has shipped', () => {
    expect(latestReleasedVersion([FIXTURE[0]])).toBeNull();
  });
});

describe('resolveRelease', () => {
  it('defaults to the newest of anything, including unreleased', () => {
    // On dev and staging the unreleased block is the only content there is;
    // an empty page would be worse than showing it.
    expect(resolveRelease(undefined, FIXTURE)?.version).toBe(UNRELEASED);
  });

  it('finds a named version', () => {
    expect(resolveRelease('1.9.0', FIXTURE)?.version).toBe('1.9.0');
  });

  it('falls back rather than failing on an unknown version', () => {
    // A stale link from a support conversation should still land somewhere
    // useful instead of a dead end.
    expect(resolveRelease('9.9.9', FIXTURE)?.version).toBe(UNRELEASED);
  });

  it('returns null when there are no releases at all', () => {
    expect(resolveRelease(undefined, [])).toBeNull();
  });
});

describe('earlierReleases', () => {
  it('lists the other shipped releases, newest first', () => {
    expect(earlierReleases('1.10.0', FIXTURE).map((r) => r.version)).toEqual([
      '1.9.0',
      '1.8.0',
    ]);
  });

  it('excludes the release currently on screen', () => {
    // Listing it under "Earlier releases" while it's open above reads as a
    // duplicate.
    expect(earlierReleases('1.9.0', FIXTURE).map((r) => r.version)).toEqual([
      '1.10.0',
      '1.8.0',
    ]);
  });

  it('never lists the unreleased block — it has no version or date to show', () => {
    const versions = earlierReleases(UNRELEASED, FIXTURE).map((r) => r.version);
    expect(versions).not.toContain(UNRELEASED);
    expect(versions).toEqual(['1.10.0', '1.9.0', '1.8.0']);
  });

  it('is empty when nothing has shipped, so no empty heading renders', () => {
    expect(earlierReleases(UNRELEASED, [FIXTURE[0]])).toEqual([]);
  });
});

describe('releasedVersions', () => {
  it('drops the unreleased block and preserves order', () => {
    expect(releasedVersions(FIXTURE).map((r) => r.version)).toEqual([
      '1.10.0',
      '1.9.0',
      '1.8.0',
    ]);
  });
});
