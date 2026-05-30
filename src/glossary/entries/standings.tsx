/**
 * @fileoverview Standings glossary entries — the season-long ranking
 * table and the metrics that sort it.
 *
 * NO DRIFT: no preset names embedded in definitions.
 *
 * Link convention (aligned with general.tsx): every glossary term in the prose
 * is an in-body link; a muted "Relevant topics:" line gathers those in-body
 * links; the `related` array holds adjacent concepts NOT in the body.
 */

import type { GlossaryEntry } from '../types';

export const entries = {
  standings: {
    slug: 'standings',
    canonicalName: 'Standings',
    aliases: ['standings table', 'team standings', 'rankings'],
    shortDef:
      'Where players check their team’s rank in the league at any time, along with the record behind it.',
    longDef: (
      <div className="space-y-2">
        <p>
          Standings are the league’s running scoreboard — where players go to
          see where their team ranks at any given moment. Each team has a row
          showing its place (1st, 2nd, etc.) and its record.
        </p>
        <p>
          The league operator decides which metrics the standings use —{' '}
          <a href="#match-wins" className="text-info hover:underline">match wins</a>,{' '}
          <a href="#total-points" className="text-info hover:underline">points</a>,{' '}
          <a href="#total-games-won" className="text-info hover:underline">games won</a>,
          and so on — and the order of importance among them, the league’s{' '}
          <a href="#standings-sort" className="text-info hover:underline">
            standings sort
          </a>
          . That order is what sorts the teams, and it’s{' '}
          <strong>an operator setting that can be changed.</strong> So the
          ranking you see reflects that league’s choices, not a universal rule.
        </p>
        <p>
          The fuller win/loss records and other numbers behind the ranking live
          in{' '}
          <a href="#stats" className="text-info hover:underline">stats</a>.
        </p>
        <p className="text-sm text-muted-foreground">
          Relevant topics:{' '}
          <a href="#match-wins" className="text-info hover:underline">match wins</a>,{' '}
          <a href="#total-points" className="text-info hover:underline">total points</a>,{' '}
          <a href="#total-games-won" className="text-info hover:underline">total games won</a>,{' '}
          <a href="#standings-sort" className="text-info hover:underline">standings sort</a>,{' '}
          <a href="#stats" className="text-info hover:underline">stats</a>.
        </p>
      </div>
    ),
    l1_anchor: {
      path: 'docs/league-system/modules/tiebreak-system/README.md',
    },
    related: ['season', 'playoffs'],
    reviewedByEd: '2026-05-30',
  },

  'standings-sort': {
    slug: 'standings-sort',
    canonicalName: 'Standings Sort',
    aliases: ['sort priority', 'standings sort priority', 'ranking metric'],
    shortDef:
      'The order of importance a league operator gives the ranking metrics — the first metric ranks teams, and the next ones order any that come out even.',
    longDef: (
      <div className="space-y-2">
        <p>
          Standings sort is the order of importance the league operator gives
          the ranking metrics. The first metric ranks the teams; when teams
          come out even on it, the next metric in the order decides who places
          higher, and so on down the list.
        </p>
        <ul className="list-disc pl-5">
          <li>
            <strong>Match Wins First</strong> —{' '}
            <a href="#match-wins" className="text-info hover:underline">match wins</a>,
            then{' '}
            <a href="#total-games-won" className="text-info hover:underline">games won</a>,
            then{' '}
            <a href="#total-points" className="text-info hover:underline">points</a>.
          </li>
          <li>
            <strong>Total Points First</strong> — points, then match wins, then
            games won.
          </li>
          <li>
            <strong>Total Games Won First</strong> — games won, then match wins,
            then points.
          </li>
        </ul>
        <p>
          With several metrics in play, teams rarely stay even all the way
          down, so lasting ties are unusual. When teams do come out even, they
          share a rank for the moment — tied for 2nd, say — until later results
          separate them.
        </p>
        <p className="text-sm text-muted-foreground">
          Relevant topics:{' '}
          <a href="#match-wins" className="text-info hover:underline">match wins</a>,{' '}
          <a href="#total-games-won" className="text-info hover:underline">total games won</a>,{' '}
          <a href="#total-points" className="text-info hover:underline">total points</a>.
        </p>
      </div>
    ),
    l1_anchor: {
      path: 'docs/league-system/modules/tiebreak-system/README.md',
    },
    related: ['standings'],
    reviewedByEd: '2026-05-30',
  },

  'match-wins': {
    slug: 'match-wins',
    canonicalName: 'Match Wins',
    aliases: ['match-win count', 'wins'],
    shortDef:
      'How many matches a team has won across the season.',
    longDef: (
      <div className="space-y-2">
        <p>
          Match wins counts the accumulation of every{' '}
          <a href="#match" className="text-info hover:underline">match</a> in
          which a particular team is victorious. This is often the main metric
          for the{' '}
          <a href="#standings-sort" className="text-info hover:underline">
            standings sort
          </a>
          . This is not a count of{' '}
          <a href="#total-points" className="text-info hover:underline">points</a>{' '}
          or individual{' '}
          <a href="#total-games-won" className="text-info hover:underline">games</a>{' '}
          a team has accrued.
        </p>
        <p className="text-sm text-muted-foreground">
          Relevant topics:{' '}
          <a href="#match" className="text-info hover:underline">match</a>,{' '}
          <a href="#standings-sort" className="text-info hover:underline">standings sort</a>,{' '}
          <a href="#total-points" className="text-info hover:underline">total points</a>,{' '}
          <a href="#total-games-won" className="text-info hover:underline">total games won</a>.
        </p>
      </div>
    ),
    l1_anchor: {
      path: 'docs/league-system/modules/tiebreak-system/README.md',
    },
    related: ['standings'],
    reviewedByEd: '2026-05-30',
  },

  'total-points': {
    slug: 'total-points',
    canonicalName: 'Total Points',
    aliases: ['points earned', 'season points'],
    shortDef:
      'Total points accumulated across the season — by the team or its players, depending on the table.',
    longDef: (
      <div className="space-y-2">
        <p>
          Total points is the sum of every points contribution the team or its
          players earned across all{' '}
          <a href="#match" className="text-info hover:underline">matches</a> in
          the season. The exact source depends on the{' '}
          <a href="#scoring-system" className="text-info hover:underline">
            scoring system
          </a>{' '}
          the league operator has chosen, which can be customized. For
          player-level{' '}
          <a href="#standings" className="text-info hover:underline">standings</a>{' '}
          it’s tallied per player; for team standings it’s the team total.
        </p>
        <p className="text-sm text-muted-foreground">
          Relevant topics:{' '}
          <a href="#match" className="text-info hover:underline">match</a>,{' '}
          <a href="#scoring-system" className="text-info hover:underline">scoring system</a>,{' '}
          <a href="#standings" className="text-info hover:underline">standings</a>.
        </p>
      </div>
    ),
    l1_anchor: {
      path: 'docs/league-system/modules/tiebreak-system/README.md',
    },
    related: ['match-wins', 'total-games-won'],
    reviewedByEd: '2026-05-30',
  },

  'total-games-won': {
    slug: 'total-games-won',
    canonicalName: 'Total Games Won',
    aliases: ['games won', 'season games'],
    shortDef:
      'Total individual games won by the team or its players across the entire season.',
    longDef: (
      <div className="space-y-2">
        <p>
          Total games won counts every{' '}
          <a href="#game" className="text-info hover:underline">game</a> the team
          or its players won across all{' '}
          <a href="#match" className="text-info hover:underline">matches</a> in
          the season. It’s the most fundamental performance metric — a team that
          plays close-but-just-short matches week after week can pile up games
          won without many{' '}
          <a href="#match-wins" className="text-info hover:underline">match wins</a>,
          which can matter for the{' '}
          <a href="#standings-sort" className="text-info hover:underline">
            standings sort
          </a>{' '}
          when teams are even on match wins near the top of the{' '}
          <a href="#standings" className="text-info hover:underline">standings</a>.
        </p>
        <p className="text-sm text-muted-foreground">
          Relevant topics:{' '}
          <a href="#game" className="text-info hover:underline">game</a>,{' '}
          <a href="#match" className="text-info hover:underline">match</a>,{' '}
          <a href="#match-wins" className="text-info hover:underline">match wins</a>,{' '}
          <a href="#standings-sort" className="text-info hover:underline">standings sort</a>,{' '}
          <a href="#standings" className="text-info hover:underline">standings</a>.
        </p>
      </div>
    ),
    l1_anchor: {
      path: 'docs/league-system/modules/tiebreak-system/README.md',
    },
    related: ['total-points'],
    reviewedByEd: '2026-05-30',
  },

  // DRAFT STUB — created on the Mac branch so `standings` can link here.
  // Full content (deeper game metrics + achievements) is pending Ed's stats
  // work on the other machine. Do NOT create a second `stats` or
  // `achievements` entry on the PC branch — link to this one instead.
  // Intentionally left without `reviewedByEd` so it shows as unreviewed.
  stats: {
    slug: 'stats',
    canonicalName: 'Stats',
    aliases: ['statistics', 'team stats', 'player stats', 'stats page'],
    shortDef:
      'The accumulated team and player numbers across the league — win/loss records and other performance metrics.',
    longDef: (
      <div className="space-y-2">
        <p>
          Stats is the fuller picture behind the{' '}
          <a href="#standings" className="text-info hover:underline">standings</a>:
          accumulated team and player numbers — wins, losses, games — plus
          deeper game metrics the league tracks. Where standings rank teams,
          stats is where the records and metrics that feed those ranks live.
        </p>
        <p className="text-sm text-muted-foreground">
          Relevant topics:{' '}
          <a href="#standings" className="text-info hover:underline">standings</a>.
        </p>
      </div>
    ),
    l1_anchor: {
      path: 'docs/league-system/README.md',
    },
    related: [],
  },
} as const satisfies Record<string, GlossaryEntry>;
