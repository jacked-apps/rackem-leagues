/**
 * @fileoverview What's New — one release in full, earlier ones listed beneath.
 *
 * Serves both `/whats-new` (newest) and `/whats-new/:version` (a specific one).
 * Public: readable logged-out, so someone deciding whether to sign up can see a
 * record of steady work.
 *
 * Shape: the current release gets the screen; earlier ones are one line each.
 * A year of full release notes on one page is a wall nobody reads, but a year
 * of one-liners is a useful index — and keeping them here means "when did that
 * change?" is answered by scanning rather than by another navigation.
 *
 * @see docs/plans/2026-09-05-002-feat-whats-new-plan.md
 */

import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { RELEASES, UNRELEASED, type Release } from './releases';
import { earlierReleases, resolveRelease } from './releaseSelectors';
import { useMarkWhatsNewSeen } from './useWhatsNewSeen';

/** "March 4, 2026" — or "Coming soon" for the block still being written. */
function formatReleaseDate(date: string | null): string {
  if (!date) return 'Coming soon';
  // Split rather than `new Date(iso)`, which parses as UTC and can render the
  // previous day for anyone west of Greenwich.
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/** Heading for one release: version + date, or "In progress" while unreleased. */
function releaseTitle(release: Release): string {
  return release.version === UNRELEASED
    ? 'In progress'
    : `Version ${release.version}`;
}

export default function WhatsNewPage() {
  const { version } = useParams<{ version?: string }>();
  const release = resolveRelease(version, RELEASES);
  const earlier = earlierReleases(release?.version, RELEASES);
  const markSeen = useMarkWhatsNewSeen();

  // Opening the page is what clears the "New" marker. Runs on any release view:
  // someone who lands on an older release has still seen the notes.
  useEffect(() => {
    markSeen();
  }, [markSeen]);

  return (
    <div>
      <PageHeader
        backTo="/"
        backLabel="Home"
        title="What's New"
        subtitle="What we've changed, and when"
      />

      <div className="mx-auto max-w-2xl space-y-6 p-6">
        {!release ? (
          <p className="text-muted-foreground">
            Nothing to report yet — check back after the next update.
          </p>
        ) : (
          <section>
            <h2 className="text-2xl font-semibold">{releaseTitle(release)}</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              {formatReleaseDate(release.date)}
            </p>

            {release.noUserFacingChanges ? (
              <p className="text-foreground">{release.noUserFacingChanges}</p>
            ) : (
              <ul className="space-y-3 text-foreground">
                {release.entries.map((entry, i) => (
                  <li key={i} className="flex items-start">
                    <span className="mr-2" aria-hidden="true">•</span>
                    <span>
                      {entry.text}
                      {entry.forOperators && (
                        <span className="ml-2 whitespace-nowrap rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                          For league operators
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {earlier.length > 0 && (
          <section className="border-t pt-4">
            <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
              Earlier releases
            </h3>
            <ul className="space-y-2">
              {earlier.map((r) => (
                <li key={r.version}>
                  <Link
                    to={`/whats-new/${r.version}`}
                    className="text-primary hover:underline"
                  >
                    {r.version}
                  </Link>
                  <span className="text-muted-foreground">
                    {' · '}
                    {formatReleaseDate(r.date)}
                    {' · '}
                    {r.summary}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* The running build. Not decoration: "am I on the new version?" was
            unanswerable without DevTools, and a bug report that names a version
            is one we can act on. */}
        <p className="border-t pt-4 text-xs text-muted-foreground">
          You&apos;re running version {__APP_VERSION__}
        </p>
      </div>
    </div>
  );
}
