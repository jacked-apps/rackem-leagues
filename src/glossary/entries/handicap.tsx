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
      'A national pool skill rating maintained by FargoRate. Higher is stronger; ratings typically run 100–850 but have no hard cap by design.',
    longDef: (
      <div className="space-y-3">
        <p>
          FargoRate is to pool what an ELO rating is to chess — a single
          national number that says how strong a player is.
        </p>
        <ul className="list-disc pl-5">
          <li><strong>350</strong> — beginner</li>
          <li><strong>500</strong> — solid league player</li>
          <li><strong>700</strong> — tournament shark</li>
        </ul>
        <p>
          The rating lives at fargorate.com and updates automatically as a
          player plays rated events. This app reads the number; it does not
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
  },

  handicap: {
    slug: 'handicap',
    canonicalName: 'Handicap',
    aliases: [],
    shortDef:
      'A skill-compensation mechanism that lets uneven players compete more fairly.',
    longDef: (
      <div className="space-y-2">
        <p>
          Pool isn't fully fair just because both players follow the same
          rules — a stronger player still wins most of the time. A handicap is
          the system's way of making the matchup <em>more</em> fair: it shifts
          targets, points, or race lengths so the weaker side has a real shot.
        </p>
        <p>
          The HOW varies. Some leagues require the stronger team to win more
          games (extra games). Some give the weaker team a points head start
          (start points). Some shorten races for the weaker player (race
          length adjustment). The right choice depends on which formula the
          league has agreed on.
        </p>
      </div>
    ),
    l1_anchor: {
      path: 'docs/league-system/modules/handicap-systems/README.md',
    },
    related: ['handicap-system', 'handicap-mechanism', 'threshold', 'rating'],
  },

  'handicap-system': {
    slug: 'handicap-system',
    canonicalName: 'Handicap System',
    aliases: [],
    shortDef:
      'The method used to calculate each player\'s skill number — e.g., Points, Percentage, FargoRate.',
    longDef: (
      <div className="space-y-2">
        <p>
          A handicap system is the <em>formula</em> that produces a player's
          skill number. Different systems take different inputs and produce
          different scales:
        </p>
        <ul className="list-disc pl-5">
          <li><strong>Points</strong> — straight (wins − losses) over weeks played.</li>
          <li><strong>Percentage</strong> — wins divided by total games played.</li>
          <li><strong>FargoRate</strong> — an externally-maintained national rating.</li>
        </ul>
        <p>
          The system decides the number. The <em>mechanism</em> (separate
          choice) decides how that number gets applied to a match.
        </p>
      </div>
    ),
    l1_anchor: {
      path: 'docs/league-system/modules/handicap-systems/README.md',
    },
    related: ['handicap', 'handicap-mechanism', 'rating'],
  },

  'handicap-mechanism': {
    slug: 'handicap-mechanism',
    canonicalName: 'Handicap Mechanism',
    aliases: [],
    shortDef:
      'How the handicap result is applied to a match — extra games to win, bonus start points, race-length adjustment, or none.',
    longDef: (
      <div className="space-y-2">
        <p>
          The handicap system tells you who's stronger. The mechanism tells you
          what to <em>do</em> about it in a match. The same skill gap can be
          compensated three different ways:
        </p>
        <ul className="list-disc pl-5">
          <li>
            <strong>Extra Games</strong> — the stronger team needs more
            game wins to take the match.
          </li>
          <li>
            <strong>Start Points</strong> — the weaker team begins the match
            with a points credit.
          </li>
          <li>
            <strong>Race Length Adjustment</strong> — each individual matchup
            races to a different number based on the rating gap.
          </li>
        </ul>
      </div>
    ),
    l1_anchor: {
      path: 'docs/league-system/modules/handicap-mechanisms/README.md',
    },
    related: [
      'handicap',
      'handicap-system',
      'extra-games',
      'start-points',
      'race-length-adjustment',
    ],
  },

  'points-handicap': {
    slug: 'points-handicap',
    canonicalName: 'Points Handicap',
    aliases: ['points handicap system', 'plus-minus handicap'],
    shortDef:
      'A handicap formula based on (wins − losses) divided by weeks played; produces a value from −2 to +2.',
    longDef: (
      <div className="space-y-2">
        <p>
          A simple integer-style handicap. Each player carries a running
          (wins − losses)/(weeks played) value, clamped to the range −2 to +2.
          Positive numbers mean the player is winning more than they're
          losing; negative means the reverse.
        </p>
        <p className="text-sm text-muted-foreground">
          Note: a "points handicap" is not the same as "points scoring." Points
          handicap is about a player's <em>rating</em>. Points scoring is
          about how the <em>match</em> is decided.
        </p>
      </div>
    ),
    l1_anchor: {
      path: 'docs/league-system/modules/handicap-systems/points.md',
    },
    related: ['handicap-system', 'rating'],
  },

  'percentage-handicap': {
    slug: 'percentage-handicap',
    canonicalName: 'Percentage Handicap',
    aliases: ['percentage handicap system', 'win percentage'],
    shortDef:
      'A handicap formula that\'s a straight win/loss percentage — wins divided by total games played.',
    longDef: (
      <p>
        A player's percentage handicap is their straight win rate: total games
        won divided by total games played, expressed as a percent. A player at
        60% has won 60 of their last 100 games. The number lives between 0%
        and 100% and updates as more games are played.
      </p>
    ),
    l1_anchor: {
      path: 'docs/league-system/modules/handicap-systems/percentage.md',
    },
    related: ['handicap-system', 'rating'],
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
  },

  'extra-games': {
    slug: 'extra-games',
    canonicalName: 'Extra Games',
    aliases: ['games handicap', 'extra-game handicap'],
    shortDef:
      'A handicap mechanism where the stronger team has to win more games than the weaker team to take the match.',
    longDef: (
      <div className="space-y-2">
        <p>
          The handicap chart maps each team's rating sum to a target number of
          game wins. Stronger teams need a higher target; weaker teams need a
          lower one. Both teams play the same total games, but the bar to
          "win" is set asymmetrically.
        </p>
        <p className="text-sm text-muted-foreground">
          Race Length Adjustment is functionally similar — both shift the
          finish line based on rating gap. Extra Games shifts the team-level
          target; Race Length Adjustment shifts per-pairing race lengths.
        </p>
      </div>
    ),
    l1_anchor: {
      path: 'docs/league-system/modules/handicap-mechanisms/extra-games.md',
    },
    related: ['handicap-mechanism', 'threshold', 'race-length-adjustment'],
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
      'games on the wire',
    ],
    shortDef:
      'A handicap mechanism where both teams share the same finish line, but the weaker team starts with a head start set by the rating gap.',
    longDef: (
      <div className="space-y-2">
        <p>
          Before any game is played, the weaker team gets a head start — a
          number of games or points based on the{' '}
          <a href="#rating" className="text-info hover:underline">rating</a>{' '}
          gap. Both teams then race to the same finish line, so the stronger
          team has to make up that gap to win.
        </p>
        <p>
          It’s the opposite approach to a{' '}
          <a href="#threshold" className="text-info hover:underline">threshold</a>{' '}
          handicap: instead of moving where each team’s finish line sits, it
          moves where the weaker team starts.
        </p>
        <p className="text-sm text-muted-foreground">
          Relevant topics:{' '}
          <a href="#rating" className="text-info hover:underline">rating</a>,{' '}
          <a href="#threshold" className="text-info hover:underline">threshold</a>.
        </p>
      </div>
    ),
    l1_anchor: {
      path: 'docs/league-system/modules/handicap-mechanisms/start-points.md',
    },
    related: ['handicap-mechanism', 'extra-games'],
  },

  'race-length-adjustment': {
    slug: 'race-length-adjustment',
    canonicalName: 'Race Length Adjustment',
    aliases: ['race adjustment', 'asymmetric race'],
    shortDef:
      'A handicap mechanism where each opponent races to a different target, set by the rating gap — the weaker side needs fewer to win.',
    longDef: (
      <div className="space-y-2">
        <p>
          When a contest is settled by a{' '}
          <a href="#race" className="text-info hover:underline">race</a>, this
          sets each side’s{' '}
          <a href="#threshold" className="text-info hover:underline">target</a>{' '}
          from the rating gap: the weaker side races to a lower number, the
          stronger side to a higher one — games or points, whichever the race
          counts. It works the same whether the opponents are two players or two
          teams.
        </p>
        <p>
          Like{' '}
          <a href="#extra-games" className="text-info hover:underline">extra games</a>,
          it shifts the finish line by the rating gap — here by changing the
          race target.
        </p>
        <p className="text-sm text-muted-foreground">
          Relevant topics:{' '}
          <a href="#race" className="text-info hover:underline">race</a>,{' '}
          <a href="#threshold" className="text-info hover:underline">threshold</a>,{' '}
          <a href="#extra-games" className="text-info hover:underline">extra games</a>.
        </p>
      </div>
    ),
    l1_anchor: {
      path: 'docs/league-system/modules/handicap-mechanisms/race-length-adjustment.md',
    },
    related: ['handicap-mechanism'],
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
