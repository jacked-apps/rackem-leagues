/**
 * @fileoverview Handicap-related glossary entries.
 *
 * Seeded in Unit 1 with FargoRate. Units 4 and 5 extend this file with the
 * remaining handicap vocabulary surfaced during wizard / operator-area coverage.
 */

import type { GlossaryEntry } from '../types';

export const entries = {
  fargorate: {
    slug: 'fargorate',
    canonicalName: 'FargoRate',
    aliases: ['fargo', 'fargo rating', 'fargo rate'],
    shortDef:
      'A national pool skill rating from 100 to 850, maintained by FargoRate. Higher is stronger.',
    longDef: (
      <div className="space-y-3">
        <p>
          FargoRate is to pool what an ELO rating is to chess — a single national
          number that says how strong a player is.
        </p>
        <ul className="list-disc pl-5">
          <li>
            <strong>350</strong> — beginner
          </li>
          <li>
            <strong>500</strong> — solid league player
          </li>
          <li>
            <strong>700</strong> — tournament shark
          </li>
        </ul>
        <p>
          The rating lives at fargorate.com and updates automatically as a player
          plays rated events. This app reads the number; it does not compute it.
        </p>
        <p>
          <strong>How the gap works:</strong> every 100-point gap roughly doubles
          the stronger player's odds. A 500-vs-400 matchup &mdash; the 500 wins
          about 2 out of 3 head-to-head games. A 700-vs-400 &mdash; the 700 wins
          about 8 out of 9.
        </p>
      </div>
    ),
    l1_anchor: {
      path: 'docs/league-system/modules/handicap-systems/fargorate.md',
    },
    related: [],
  },
} as const satisfies Record<string, GlossaryEntry>;
