/**
 * @fileoverview R11 attribution block shown on the rulebook landing and each
 * rule detail page. Tells the reader which organization published these rules,
 * which edition they are reading, and links to CSI's own hosted PDF so a
 * player can verify authority in a dispute. The linked PDF lives on CSI's
 * site, not ours — we do not redistribute the source document.
 */

import { rulebook } from './useRulebook';

export function Attribution() {
  const { publisher, edition, sourcePdfUrl } = rulebook.index;
  return (
    <footer className="mt-8 border-t pt-4 text-center text-sm text-muted-foreground">
      <p>
        Official Rules — {publisher} / BCA — {formatEdition(edition)} edition
        {' · '}
        <a
          href={sourcePdfUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-foreground"
        >
          View source PDF
        </a>
      </p>
    </footer>
  );
}

/** Render an ISO edition date ("2023-06-01") as "June 1, 2023". */
function formatEdition(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}
