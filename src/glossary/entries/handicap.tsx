/**
 * @fileoverview Handicap-related glossary entries.
 *
 * Definitions follow the NO DRIFT principle: describe what each thing IS,
 * not which preset uses it. Preset names can change; the underlying concept
 * shouldn't be tied to a specific package.
 */

import type { GlossaryEntry } from '../types';

export const entries = {
  fargorate: {
    slug: 'fargorate',
    canonicalName: 'FargoRate',
    aliases: ['fargo', 'fargo rating', 'fargo rate'],
    shortDef:
      'The most comprehensive handicap system in pool — an international skill rating maintained by FargoRate. Higher is stronger; ratings typically run 100–850 but have no hard cap by design.',
    longDef: (
      <div className="space-y-3">
        <p>
          FargoRate is to pool what an ELO rating is to chess — a single
          international number that says how strong a player is.
        </p>
        <ul className="list-disc pl-5">
          <li><strong>300</strong> — beginner</li>
          <li><strong>500</strong> — solid league player</li>
          <li><strong>700</strong> — tournament shark</li>
        </ul>
        <p>
          The rating lives at{' '}
          <a
            href="https://www.fargorate.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-info hover:underline"
          >
            fargorate.com
          </a>{' '}
          and updates automatically as a player plays rated events. This app reads the number; it does not
          compute it. Ratings can in principle go over 1000 — there's no hard
          cap by design.
        </p>
        <p>
          <strong>How the gap works:</strong> every 100-point gap roughly
          doubles the stronger player's odds. A 500-vs-400 matchup &mdash; the
          500 wins about 2 out of 3 games. A 700-vs-400 &mdash; the 700 wins
          about 8 out of 9.
        </p>
      </div>
    ),
    l1_anchor: {
      path: 'docs/league-system/modules/handicap-systems/fargorate.md',
    },
    related: ['handicap', 'handicap-system', 'rating'],
    reviewedByEd: '2026-05-31',
  },

  handicap: {
    slug: 'handicap',
    canonicalName: 'Handicap',
    aliases: [],
    shortDef:
      'A way to make a contest between unevenly-matched competitors more fair — a bonus for the weaker side, a penalty for the stronger, or both.',
    longDef: (
      <div className="space-y-2">
        <p>
          One competitor is usually more skilled than another. A handicap evens
          that out: a bonus or benefit for the weaker side, a penalty or
          obstacle for the stronger, or both.
        </p>
        <p>
          There are many ways to do it, and none is perfect — but each is an
          attempt to level the playing field.
        </p>
      </div>
    ),
    l1_anchor: {
      path: 'docs/league-system/modules/handicap-systems/README.md',
    },
    related: ['handicap-system', 'handicap-mechanism', 'threshold', 'rating'],
    reviewedByEd: '2026-05-31',
  },

  'handicap-system': {
    slug: 'handicap-system',
    canonicalName: 'Handicap System',
    aliases: [],
    shortDef:
      'The method a league uses to calculate each player’s skill and assign them a rank.',
    longDef: (
      <div className="space-y-2">
        <p>
          A handicap system is how a league measures each player’s skill and
          gives them a rank. It can use:
        </p>
        <ul className="list-disc pl-5">
          <li>
            <a href="#points-handicap" className="text-info hover:underline">Points</a>
          </li>
          <li>
            <a href="#percentage-handicap" className="text-info hover:underline">Percentage</a>
          </li>
          <li>
            <a href="#fargorate" className="text-info hover:underline">FargoRate</a>
          </li>
        </ul>
        <p className="text-sm text-muted-foreground">
          Relevant topics:{' '}
          <a href="#points-handicap" className="text-info hover:underline">points handicap</a>,{' '}
          <a href="#percentage-handicap" className="text-info hover:underline">percentage handicap</a>,{' '}
          <a href="#fargorate" className="text-info hover:underline">FargoRate</a>.
        </p>
      </div>
    ),
    l1_anchor: {
      path: 'docs/league-system/modules/handicap-systems/README.md',
    },
    related: ['handicap', 'handicap-mechanism'],
    reviewedByEd: '2026-05-31',
  },

  'sample-size': {
    slug: 'sample-size',
    canonicalName: 'Sample Size',
    aliases: ['rating window', 'history window', 'handicap window', 'game history'],
    shortDef:
      'How much recent game history a handicap calculation uses — adjustable for Points and Percentage (FargoRate is external, so it doesn’t apply).',
    longDef: (
      <div className="space-y-2">
        <p>
          For the league-computed systems —{' '}
          <a href="#points-handicap" className="text-info hover:underline">Points</a>{' '}
          and{' '}
          <a href="#percentage-handicap" className="text-info hover:underline">Percentage</a>{' '}
          — you can set how many recent games feed a player’s rank. (
          <a href="#fargorate" className="text-info hover:underline">FargoRate</a>{' '}
          is maintained externally, so this doesn’t apply to it.)
        </p>
        <p>
          A small sample makes ranks volatile — a couple of strong or weak
          matches swing them. A large sample makes ranks sticky — slow to move,
          and they may not show a player’s skill progression. Balancing the two
          matters: you want an accurate rank that doesn’t swing so fast it can
          be gamed (sandbagging).
        </p>
        <p className="text-sm text-muted-foreground">
          Relevant topics:{' '}
          <a href="#points-handicap" className="text-info hover:underline">points handicap</a>,{' '}
          <a href="#percentage-handicap" className="text-info hover:underline">percentage handicap</a>,{' '}
          <a href="#fargorate" className="text-info hover:underline">FargoRate</a>.
        </p>
      </div>
    ),
    l1_anchor: {
      path: 'docs/league-system/modules/handicap-systems/README.md',
    },
    related: ['handicap-system'],
    reviewedByEd: '2026-05-31',
  },

  'starting-handicap': {
    slug: 'starting-handicap',
    canonicalName: 'Starting Handicap',
    aliases: ['provisional rank', 'starting rank', 'provisional handicap'],
    shortDef:
      'The rank a brand-new player (no game history) starts at — a default the operator can adjust — used for their first few matches before the normal calculation takes over.',
    longDef: (
      <div className="space-y-2">
        <p>
          A player with no history starts at a default — 40% for{' '}
          <a href="#percentage-handicap" className="text-info hover:underline">Percentage</a>,
          0 for{' '}
          <a href="#points-handicap" className="text-info hover:underline">Points</a>{' '}
          — and is locked there for their first three matches. After that, the
          normal calculation takes over.
        </p>
        <p>
          If the operator knows a newcomer plays well above or below that
          default, they can set a fairer starting rank for those first three
          matches — which also gives way to the normal calculation afterward.
        </p>
        <p className="text-sm text-muted-foreground">
          Relevant topics:{' '}
          <a href="#points-handicap" className="text-info hover:underline">points handicap</a>,{' '}
          <a href="#percentage-handicap" className="text-info hover:underline">percentage handicap</a>.
        </p>
      </div>
    ),
    l1_anchor: {
      path: 'docs/league-system/modules/handicap-systems/README.md',
    },
    related: ['handicap-system', 'sample-size'],
    reviewedByEd: '2026-05-31',
  },

  'handicap-mechanism': {
    slug: 'handicap-mechanism',
    canonicalName: 'Handicap Mechanism',
    aliases: ['head start', 'weight', 'on the wire'],
    shortDef:
      'How a handicap rank is applied to a match — a head start for the weaker side, added weight on the stronger, or both.',
    longDef: (
      <div className="space-y-2">
        <p>
          The{' '}
          <a href="#handicap-system" className="text-info hover:underline">handicap system</a>{' '}
          says who’s stronger; the mechanism is what the match does about it.
        </p>
        <p>
          <strong>Three ways to even a competition.</strong> Picture a 100-yard
          dash between the tortoise and the hare — the hare is faster, so:
        </p>
        <ul className="list-disc pl-5">
          <li>
            <strong>Head start</strong> — start the tortoise at the 20-yard
            line; now it only runs 80 yards. (Pool’s term for a head start is{' '}
            <em>on the wire</em>.)
          </li>
          <li>
            <strong>Weight</strong> — make the hare run 120 yards.
          </li>
          <li>
            <strong>Combination</strong> — if the total distance has to stay
            200 yards, adjust both: the hare runs 110, the tortoise 90.
          </li>
        </ul>
        <p className="text-sm text-muted-foreground">
          Relevant topics:{' '}
          <a href="#handicap-system" className="text-info hover:underline">handicap system</a>.
        </p>
      </div>
    ),
    l1_anchor: {
      path: 'docs/league-system/modules/handicap-mechanisms/README.md',
    },
    related: ['handicap', 'start-points', 'extra-games', 'race-length-adjustment'],
    reviewedByEd: '2026-05-31',
  },

  'points-handicap': {
    slug: 'points-handicap',
    canonicalName: 'Points Handicap',
    aliases: ['points handicap system', 'plus-minus handicap'],
    shortDef:
      '(wins − losses) divided by weeks played, producing a rank from −2 to +2.',
    longDef: (
      <div className="space-y-2">
        <p>
          With only five ranks, Points is the coarsest of the systems — it
          levels the field the least and favors stronger players.
        </p>
        <p>
          That’s intentional — it rewards skill progression, and it suits
          players training toward competitions that use{' '}
          <a href="#no-handicap" className="text-info hover:underline">no handicap</a>{' '}
          at all.
        </p>
        <p>
          The{' '}
          <a href="#sample-size" className="text-info hover:underline">sample size</a>{' '}
          you set matters here — it strongly affects how quickly a rank moves. A
          new player begins at a{' '}
          <a href="#starting-handicap" className="text-info hover:underline">starting handicap</a>{' '}
          until they’ve played enough to rank.
        </p>
        <p className="text-sm text-muted-foreground">
          Relevant topics:{' '}
          <a href="#no-handicap" className="text-info hover:underline">no handicap</a>,{' '}
          <a href="#sample-size" className="text-info hover:underline">sample size</a>,{' '}
          <a href="#starting-handicap" className="text-info hover:underline">starting handicap</a>.
        </p>
      </div>
    ),
    l1_anchor: {
      path: 'docs/league-system/modules/handicap-systems/points.md',
    },
    related: ['handicap-system', 'percentage-handicap', 'fargorate'],
    reviewedByEd: '2026-05-31',
  },

  'percentage-handicap': {
    slug: 'percentage-handicap',
    canonicalName: 'Percentage Handicap',
    aliases: ['percentage handicap system', 'win percentage'],
    shortDef:
      'Wins divided by total games played — a straight win percentage.',
    longDef: (
      <div className="space-y-2">
        <p>
          The most basic handicap system — just a player’s win percentage,
          simple to calculate.
        </p>
        <p>
          The{' '}
          <a href="#sample-size" className="text-info hover:underline">sample size</a>{' '}
          you set matters here — it strongly affects how quickly a rank moves. A
          new player begins at a{' '}
          <a href="#starting-handicap" className="text-info hover:underline">starting handicap</a>{' '}
          until they’ve played enough to rank.
        </p>
        <p className="text-sm text-muted-foreground">
          Relevant topics:{' '}
          <a href="#sample-size" className="text-info hover:underline">sample size</a>,{' '}
          <a href="#starting-handicap" className="text-info hover:underline">starting handicap</a>.
        </p>
      </div>
    ),
    l1_anchor: {
      path: 'docs/league-system/modules/handicap-systems/percentage.md',
    },
    related: ['handicap-system', 'points-handicap', 'fargorate'],
    reviewedByEd: '2026-05-31',
  },

  'no-handicap': {
    slug: 'no-handicap',
    canonicalName: 'No Handicap',
    aliases: ['unhandicapped', 'no handicap system', 'flat'],
    shortDef:
      'All players compete on equal terms; no skill compensation applied.',
    longDef: (
      <p>
        The league plays without any handicap. Every team needs the same number
        of wins regardless of skill. Suitable for tournaments, leagues where
        ratings aren't tracked, or leagues whose members are roughly evenly
        matched.
      </p>
    ),
    l1_anchor: {
      path: 'docs/league-system/modules/handicap-systems/README.md',
    },
    related: ['handicap', 'handicap-system'],
    reviewedByEd: '2026-05-31',
  },

  'extra-games': {
    slug: 'extra-games',
    canonicalName: 'Extra Games',
    aliases: ['games handicap', 'extra-game handicap'],
    shortDef:
      'A handicap mechanism where the stronger side has to win more games than the weaker to take the match.',
    longDef: (
      <div className="space-y-2">
        <p>
          Extra games is the{' '}
          <a href="#handicap-mechanism" className="text-info hover:underline">weight</a>{' '}
          approach, in games: the stronger side’s target is raised, so it has to
          win more games than the weaker side to take the match.
        </p>
        <p className="text-sm text-muted-foreground">
          Relevant topics:{' '}
          <a href="#handicap-mechanism" className="text-info hover:underline">handicap mechanism</a>.
        </p>
      </div>
    ),
    l1_anchor: {
      path: 'docs/league-system/modules/handicap-mechanisms/extra-games.md',
    },
    related: ['race-length-adjustment', 'threshold'],
    reviewedByEd: '2026-05-31',
  },

  'start-points': {
    slug: 'start-points',
    canonicalName: 'Start Points',
    aliases: [
      'start-points handicap',
      'points credit',
      'spot points',
      'starting bonus',
      'starting bonuses',
    ],
    shortDef:
      'An amount of points given to a team at the beginning of a match.',
    longDef: (
      <div className="space-y-2">
        <p>
          At the beginning of a match, the weaker team gets a{' '}
          <a href="#handicap-mechanism" className="text-info hover:underline">head start</a>{' '}
          of points, which the stronger team has to overcome by the end of the
          match. The number of points is calculated from the players’{' '}
          <a href="#rating" className="text-info hover:underline">ratings</a>.
        </p>
        <p className="text-sm text-muted-foreground">
          Relevant topics:{' '}
          <a href="#handicap-mechanism" className="text-info hover:underline">handicap mechanism</a>,{' '}
          <a href="#rating" className="text-info hover:underline">rating</a>.
        </p>
      </div>
    ),
    l1_anchor: {
      path: 'docs/league-system/modules/handicap-mechanisms/start-points.md',
    },
    related: ['extra-games', 'race-length-adjustment'],
    reviewedByEd: '2026-05-31',
  },

  'race-length-adjustment': {
    slug: 'race-length-adjustment',
    canonicalName: 'Race Length Adjustment',
    aliases: ['race adjustment', 'asymmetric race'],
    shortDef:
      'A handicap mechanism that adjusts the amount of points or games each opponent needs.',
    longDef: (
      <div className="space-y-2">
        <p>
          Race length adjustment is a combination of{' '}
          <a href="#handicap-mechanism" className="text-info hover:underline">head start</a>{' '}
          and{' '}
          <a href="#handicap-mechanism" className="text-info hover:underline">weight</a>:
          it extends the stronger opponent’s target and shortens the weaker
          opponent’s by the same amount, to allow handicapping of a set number
          of games.
        </p>
        <p className="text-sm text-muted-foreground">
          Relevant topics:{' '}
          <a href="#handicap-mechanism" className="text-info hover:underline">handicap mechanism</a>.
        </p>
      </div>
    ),
    l1_anchor: {
      path: 'docs/league-system/modules/handicap-mechanisms/race-length-adjustment.md',
    },
    related: ['extra-games', 'start-points'],
    reviewedByEd: '2026-05-31',
  },

  threshold: {
    slug: 'threshold',
    canonicalName: 'Threshold',
    aliases: ['benchmark', 'milestone', 'target', 'target games', 'target points'],
    shortDef:
      'A target set for a team or player to hit — a set number of games or points (aka milestone, benchmark).',
    longDef: (
      <div className="space-y-2">
        <p>
          What a threshold does depends on how the league is set up. Two popular
          uses: a finish line that wins the match — a{' '}
          <a href="#win-threshold" className="text-info hover:underline">win threshold</a>{' '}
          — or a milestone that awards a set number of points when reached.
          They’re not the only options, though; a league can put thresholds to
          other uses.
        </p>
        <p className="text-sm text-muted-foreground">
          Relevant topics:{' '}
          <a href="#win-threshold" className="text-info hover:underline">win threshold</a>.
        </p>
      </div>
    ),
    l1_anchor: {
      path: 'docs/league-system/modules/threshold-charts/README.md',
    },
    related: ['threshold-chart', 'scoring-system'],
    reviewedByEd: '2026-05-31',
  },

  'threshold-chart': {
    slug: 'threshold-chart',
    canonicalName: 'Threshold Chart',
    aliases: ['handicap chart', 'handicap table'],
    shortDef:
      'A lookup table — or a formula that produces one — that maps team ratings to the thresholds for a match.',
    longDef: (
      <div className="space-y-2">
        <p>
          The chart is how the abstract "skill compensation" idea becomes
          concrete numbers. The system takes each team's combined rating, runs
          it through the chart (or the formula behind it), and gets back the
          target number of games (or points) each side needs.
        </p>
        <p>
          Some charts are static lookups (fixed values for every rating
          combination). Some are formulas that compute targets on the fly.
        </p>
      </div>
    ),
    l1_anchor: {
      path: 'docs/league-system/modules/threshold-charts/README.md',
    },
    related: ['threshold', 'calibrated', 'manual-entry'],
  },

  calibrated: {
    slug: 'calibrated',
    canonicalName: 'Calibrated',
    aliases: ['tested', 'tested preset'],
    shortDef:
      'A threshold chart that\'s been tested against real-world play and ships with the app as a known-good package.',
    longDef: (
      <p>
        A calibrated chart isn't theoretical — it's been run against actual
        league seasons and the numbers produce balanced matches. Operators
        picking a calibrated package get a turnkey config; they don't have to
        invent or hand-tune any numbers.
      </p>
    ),
    l1_anchor: {
      path: 'docs/league-system/modules/threshold-charts/README.md',
    },
    related: ['threshold-chart', 'manual-entry'],
  },

  'manual-entry': {
    slug: 'manual-entry',
    canonicalName: 'Manual Entry',
    aliases: ['manual handicap', 'hand-entered handicap'],
    shortDef:
      'Any time a team, captain, scorekeeper, or operator hand-enters a handicap value — a threshold, a start-points credit, or a target — instead of using a calculated chart.',
    longDef: (
      <p>
        Some combinations of choices don't have a calibrated chart in the app.
        For those, the league agrees on the numbers themselves and someone
        enters them by hand at lineup lock (or at scoring time). Manual entry
        is the fallback that keeps the league running even when no built-in
        formula fits.
      </p>
    ),
    l1_anchor: {
      path: 'docs/league-system/modules/threshold-charts/README.md',
    },
    related: ['threshold-chart', 'calibrated'],
  },

  rating: {
    slug: 'rating',
    canonicalName: 'Rating',
    aliases: ['skill rating', 'skill number'],
    shortDef:
      'A player\'s skill number, calculated by whichever handicap system the league uses.',
    longDef: (
      <div className="space-y-2">
        <p>
          A rating is the output of a handicap system. Different systems
          produce different scales:
        </p>
        <ul className="list-disc pl-5">
          <li>A FargoRate rating might be 491.</li>
          <li>A points rating might be +1 or −2.</li>
          <li>A percentage rating might be 60%.</li>
        </ul>
        <p>
          The system the league uses decides what shape the rating takes.
          Higher is always stronger.
        </p>
      </div>
    ),
    l1_anchor: {
      path: 'docs/league-system/modules/handicap-systems/README.md',
    },
    related: ['handicap-system', 'fargorate'],
  },
} as const satisfies Record<string, GlossaryEntry>;
