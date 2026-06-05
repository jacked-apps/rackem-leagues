/**
 * @fileoverview Match-format glossary entries — the pairing calculator and the
 * two settings it works with: match format (how pairings are arranged — round
 * robin / individual races) and pairing format (what each pairing is — single
 * rack / race-to-N).
 *
 * NO DRIFT: no preset names embedded in definitions; describe what each thing
 * is, not which packaged system happens to use it.
 *
 * Link convention (aligned with general.tsx): every glossary term in the prose
 * is an in-body link; a muted "Relevant topics:" line gathers those in-body
 * links; the `related` array holds adjacent concepts NOT in the body.
 */

import type { GlossaryEntry } from '../types';

export const entries = {
  'pairing-calculator': {
    slug: 'pairing-calculator',
    canonicalName: 'Pairing Calculator',
    aliases: ['pairings', 'pairing generator'],
    shortDef:
      'Works out the full set of pairings for a match — who plays whom, and how many games — from the lineup size and the match format.',
    longDef: (
      <div className="space-y-2">
        <p>
          The pairing calculator takes two settings — the{' '}
          <a href="#lineup-size" className="text-info hover:underline">lineup size</a>{' '}
          (how many players each team fields) and the{' '}
          <a href="#match-format" className="text-info hover:underline">match format</a>{' '}
          (single round robin, double round robin, or individual races) — and
          works out the full set of{' '}
          <a href="#pairing" className="text-info hover:underline">pairings</a>{' '}
          for a match: who plays whom, and how many games there are.
        </p>
        <p>
          It only decides the pairings and the game count. What each of those
          games looks like — a single rack or a race — is the{' '}
          <a href="#pairing-format" className="text-info hover:underline">pairing format</a>,
          a separate setting.
        </p>
        <p className="text-sm text-muted-foreground">
          Relevant topics:{' '}
          <a href="#lineup-size" className="text-info hover:underline">lineup size</a>,{' '}
          <a href="#match-format" className="text-info hover:underline">match format</a>,{' '}
          <a href="#pairing" className="text-info hover:underline">pairing</a>,{' '}
          <a href="#pairing-format" className="text-info hover:underline">pairing format</a>.
        </p>
      </div>
    ),
    l1_anchor: { path: 'docs/league-system/modules/pairings-generator.md' },
    related: ['matchup'],
    reviewedByEd: '2026-05-30',
  },

  'match-format': {
    slug: 'match-format',
    canonicalName: 'Match Format',
    aliases: [],
    shortDef:
      'Which way a match’s pairings are arranged — single round robin, double round robin, or individual races.',
    longDef: (
      <div className="space-y-2">
        <p>
          Match format is the arrangement pattern a league picks for its
          pairings. The{' '}
          <a href="#pairing-calculator" className="text-info hover:underline">
            pairing calculator
          </a>{' '}
          combines it with the{' '}
          <a href="#lineup-size" className="text-info hover:underline">lineup size</a>{' '}
          to work out the actual games. The choices:
        </p>
        <ul className="list-disc pl-5">
          <li>
            <a href="#round-robin" className="text-info hover:underline">Round Robin</a>
          </li>
          <li>
            <a href="#individual-races" className="text-info hover:underline">
              Individual Races
            </a>
          </li>
        </ul>
        <p className="text-sm text-muted-foreground">
          Relevant topics:{' '}
          <a href="#pairing-calculator" className="text-info hover:underline">pairing calculator</a>,{' '}
          <a href="#lineup-size" className="text-info hover:underline">lineup size</a>,{' '}
          <a href="#round-robin" className="text-info hover:underline">round robin</a>,{' '}
          <a href="#individual-races" className="text-info hover:underline">individual races</a>.
        </p>
      </div>
    ),
    l1_anchor: { path: 'docs/league-system/modules/team-geometry.md' },
    related: ['pairing-format'],
    reviewedByEd: '2026-05-30',
  },

  'round-robin': {
    slug: 'round-robin',
    canonicalName: 'Round Robin',
    aliases: ['rr', 'single round robin', 'double round robin'],
    shortDef:
      'An arrangement where every player faces every opposing player — once (single) or twice (double).',
    longDef: (
      <p>
        Round robin is a fairness pattern: nobody gets to avoid anyone. Every
        player takes a turn against every player on the other team. It comes in
        two depths — <strong>single</strong> runs each opposing pair once;{' '}
        <strong>double</strong> runs each pair twice, flipping who breaks.
      </p>
    ),
    l1_anchor: { path: 'docs/league-system/modules/team-geometry.md' },
    related: ['match-format', 'lineup-size', 'pairing-calculator'],
    reviewedByEd: '2026-05-30',
  },

  'individual-races': {
    slug: 'individual-races',
    canonicalName: 'Individual Races',
    aliases: ['races format'],
    shortDef: 'Player vs player, playing to a set number of wins.',
    longDef: (
      <div className="space-y-2">
        <p>
          In individual races, each player is matched with a single opponent
          from the other team and plays them just once — one{' '}
          <a href="#pairing" className="text-info hover:underline">pairing</a>,
          decided by a{' '}
          <a href="#race" className="text-info hover:underline">race to N</a>.
          The number of wins each player needs is set by their handicap, so
          stronger and weaker players can play to different targets (
          <a href="#race-length-adjustment" className="text-info hover:underline">
            race length adjustment
          </a>
          ).
        </p>
        <p className="text-sm text-muted-foreground">
          Relevant topics:{' '}
          <a href="#pairing" className="text-info hover:underline">pairing</a>,{' '}
          <a href="#race" className="text-info hover:underline">race to N</a>,{' '}
          <a href="#race-length-adjustment" className="text-info hover:underline">
            race length adjustment
          </a>
          .
        </p>
      </div>
    ),
    l1_anchor: { path: 'docs/league-system/modules/match-format.md' },
    related: ['match-format', 'round-robin'],
    reviewedByEd: '2026-05-30',
  },

  'pairing-format': {
    slug: 'pairing-format',
    canonicalName: 'Pairing Format',
    aliases: [],
    shortDef:
      'Whether each pairing is a single rack or a race to N.',
    longDef: (
      <div className="space-y-2">
        <p>
          Pairing format is the decision rule for each{' '}
          <a href="#pairing" className="text-info hover:underline">pairing</a> —
          a{' '}
          <a href="#single-rack" className="text-info hover:underline">single rack</a>{' '}
          or a{' '}
          <a href="#race" className="text-info hover:underline">race to N</a>.
          The choice mainly affects how long a pairing takes and how much one
          lucky rack can swing it.
        </p>
        <p className="text-sm text-muted-foreground">
          Relevant topics:{' '}
          <a href="#pairing" className="text-info hover:underline">pairing</a>,{' '}
          <a href="#single-rack" className="text-info hover:underline">single rack</a>,{' '}
          <a href="#race" className="text-info hover:underline">race to N</a>.
        </p>
      </div>
    ),
    l1_anchor: { path: 'docs/league-system/modules/match-format.md' },
    related: ['match-format'],
    reviewedByEd: '2026-05-30',
  },

  'single-rack': {
    slug: 'single-rack',
    canonicalName: 'Single Rack',
    aliases: ['one rack'],
    shortDef:
      'One rack per pairing — whoever wins the rack wins the pairing.',
    longDef: (
      <div className="space-y-2">
        <p>
          The simplest pairing format: the{' '}
          <a href="#pairing" className="text-info hover:underline">pairing</a> is
          settled by a single rack, and whoever wins that rack wins the pairing.
          Fast, decisive, and easy to track on a scoreboard.
        </p>
        <p className="text-sm text-muted-foreground">
          Relevant topics:{' '}
          <a href="#pairing" className="text-info hover:underline">pairing</a>.
        </p>
      </div>
    ),
    l1_anchor: { path: 'docs/league-system/modules/match-format.md' },
    related: ['pairing-format', 'race'],
    reviewedByEd: '2026-05-30',
  },

  race: {
    slug: 'race',
    canonicalName: 'Race',
    aliases: [
      'race to n',
      'race to',
      'race format',
      'best of',
      'best of n',
      'first to',
      'first to n',
      'first-to-n',
    ],
    shortDef:
      'A first-to-target format (also called “best of N”) — first to reach a set number of games or points wins.',
    longDef: (
      <div className="space-y-2">
        <p>
          A race is a first-to-target format: whoever first reaches a set
          number wins. That number can be games (“race to 7” — first to win 7)
          or points (straight pool is a race to 150).{' '}
          <strong>“Best of N”</strong> is the same idea framed differently — a
          race to win the majority (best of 7 is a race to 4).
        </p>
        <p>
          It can settle a contest between two players or between two teams, and
          the{' '}
          <a href="#threshold" className="text-info hover:underline">target</a>{' '}
          can be the same for both sides or set by handicap — one side might
          race to 150 while the other races to 125 (
          <a href="#race-length-adjustment" className="text-info hover:underline">
            race length adjustment
          </a>
          ). It’s also the shape of{' '}
          <a href="#individual-races" className="text-info hover:underline">
            individual races
          </a>
          .
        </p>
        <p className="text-sm text-muted-foreground">
          Relevant topics:{' '}
          <a href="#threshold" className="text-info hover:underline">threshold</a>,{' '}
          <a href="#race-length-adjustment" className="text-info hover:underline">
            race length adjustment
          </a>
          ,{' '}
          <a href="#individual-races" className="text-info hover:underline">individual races</a>.
        </p>
      </div>
    ),
    l1_anchor: { path: 'docs/league-system/modules/match-format.md' },
    related: ['pairing-format', 'single-rack'],
    reviewedByEd: '2026-05-31',
  },
} as const satisfies Record<string, GlossaryEntry>;
