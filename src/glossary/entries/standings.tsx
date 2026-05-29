/**
 * @fileoverview Standings glossary entries — the season-long ranking
 * table and the metrics that sort it.
 *
 * NO DRIFT: no preset names embedded in definitions.
 */

import type { GlossaryEntry } from '../types';

export const entries = {
  standings: {
    slug: 'standings',
    canonicalName: 'Standings',
    aliases: ['standings table', 'team standings', 'rankings'],
    shortDef:
      'The season-long ranking table that shows what place each team is in and their record.',
    longDef: (
      <p>
        Standings are the running scoreboard of the season. Each team has a
        row showing their place (1st, 2nd, etc.) and their record — match
        wins, total games won, points earned, and whatever other metrics
        the league tracks. The sort priority decides which metric carries
        the most weight in ranking.
      </p>
    ),
    l1_anchor: {
      path: 'docs/league-system/modules/tiebreak-system/README.md',
    },
    related: ['standings-sort', 'match-wins', 'total-points', 'total-games-won'],
  },

  'standings-sort': {
    slug: 'standings-sort',
    canonicalName: 'Standings Sort',
    aliases: ['sort priority', 'standings sort priority', 'ranking metric'],
    shortDef:
      'The metric used to rank teams in the standings — the primary sort column, with the others as tiebreakers.',
    longDef: (
      <div className="space-y-2">
        <p>
          Standings sort tells the app which stat matters most for ranking.
          Common choices:
        </p>
        <ul className="list-disc pl-5">
          <li>
            <strong>Match Wins First</strong> — match wins, then games won,
            then points.
          </li>
          <li>
            <strong>Total Points First</strong> — points, then match wins,
            then games won.
          </li>
          <li>
            <strong>Total Games Won First</strong> — games won, then match
            wins, then points.
          </li>
        </ul>
        <p>
          The other metrics still show in the table; they just break ties
          if the primary metric is equal.
        </p>
      </div>
    ),
    l1_anchor: {
      path: 'docs/league-system/modules/tiebreak-system/README.md',
    },
    related: ['standings', 'match-wins', 'total-points', 'total-games-won'],
  },

  'match-wins': {
    slug: 'match-wins',
    canonicalName: 'Match Wins',
    aliases: ['match-win count', 'wins'],
    shortDef:
      'How many matches a team has won across the season.',
    longDef: (
      <p>
        Match wins counts whole matches, not individual games. A team that
        won 6 matches has 6 match wins regardless of how many games they
        won inside those matches. This is the headline number for most BCAPL-
        style standings.
      </p>
    ),
    l1_anchor: {
      path: 'docs/league-system/modules/tiebreak-system/README.md',
    },
    related: ['standings', 'standings-sort', 'match'],
  },

  'total-points': {
    slug: 'total-points',
    canonicalName: 'Total Points',
    aliases: ['points earned', 'season points'],
    shortDef:
      'Total points accumulated across the season — by team or by player, depending on the table.',
    longDef: (
      <p>
        Total points is the sum of every points contribution the team (or
        player) earned across all matches in the season. The exact source
        depends on which points calculator the league uses, but the column
        is always "what's the season-long points number." For player-level
        standings, this is per player; for team standings, it's the team sum.
      </p>
    ),
    l1_anchor: {
      path: 'docs/league-system/modules/tiebreak-system/README.md',
    },
    related: ['standings', 'standings-sort', 'points-calculator'],
  },

  'total-games-won': {
    slug: 'total-games-won',
    canonicalName: 'Total Games Won',
    aliases: ['games won', 'season games'],
    shortDef:
      'Total individual games won by a team (or player) across the entire season.',
    longDef: (
      <p>
        Total games won counts every game won across all matches in the
        season. This is the lowest-level performance metric — a team that
        plays close-but-just-short matches week after week may have lots of
        games won without many match wins, which can matter when match wins
        are tied at the top of the standings.
      </p>
    ),
    l1_anchor: {
      path: 'docs/league-system/modules/tiebreak-system/README.md',
    },
    related: ['standings', 'standings-sort', 'game'],
  },
} as const satisfies Record<string, GlossaryEntry>;
