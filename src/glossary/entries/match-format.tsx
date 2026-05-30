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
            <strong>
              <a href="#round-robin" className="text-info hover:underline">
                Round Robin
              </a>
            </strong>{' '}
            — every player faces every opposing player, once (single) or twice
            (double).
          </li>
          <li>
            <strong>
              <a href="#individual-races" className="text-info hover:underline">
                Individual Races
              </a>
            </strong>{' '}
            — each pairing plays a race rather than single racks.
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
  },

  'individual-races': {
    slug: 'individual-races',
    canonicalName: 'Individual Races',
    aliases: ['races format'],
    shortDef:
      'Each opposing-player pair plays a race together instead of single racks.',
    longDef: (
      <div className="space-y-2">
        <p>
          Instead of running through{' '}
          <a href="#round-robin" className="text-info hover:underline">round-robin</a>{' '}
          <a href="#pairing" className="text-info hover:underline">pairings</a>{' '}
          as single racks, each pair sits down and plays a{' '}
          <a href="#race-to-n" className="text-info hover:underline">race</a>{' '}
          (race to 5, race to 7, etc.). First to the target wins that pairing.
          The match still has multiple pairings — they just play race-to-N each.
        </p>
        <p className="text-sm text-muted-foreground">
          Relevant topics:{' '}
          <a href="#round-robin" className="text-info hover:underline">round robin</a>,{' '}
          <a href="#pairing" className="text-info hover:underline">pairing</a>,{' '}
          <a href="#race-to-n" className="text-info hover:underline">race to N</a>.
        </p>
        <p className="text-sm text-muted-foreground">
          This format is currently disabled in the wizard — coming soon.
        </p>
      </div>
    ),
    l1_anchor: { path: 'docs/league-system/modules/match-format.md' },
    related: ['match-format'],
  },

  'pairing-format': {
    slug: 'pairing-format',
    canonicalName: 'Pairing Format',
    aliases: [],
    shortDef:
      'Whether each pairing is decided by a single rack or by a race to N.',
    longDef: (
      <div className="space-y-2">
        <p>
          Pairing format is the decision rule for each{' '}
          <a href="#pairing" className="text-info hover:underline">pairing</a>.{' '}
          <a href="#single-rack" className="text-info hover:underline">Single Rack</a>{' '}
          means one rack settles it.{' '}
          <a href="#race-to-n" className="text-info hover:underline">Race to N</a>{' '}
          means the two players play until one reaches a target rack count. The
          choice changes how long each pairing takes and how much skill variance
          gets averaged out.
        </p>
        <p className="text-sm text-muted-foreground">
          Relevant topics:{' '}
          <a href="#pairing" className="text-info hover:underline">pairing</a>,{' '}
          <a href="#single-rack" className="text-info hover:underline">single rack</a>,{' '}
          <a href="#race-to-n" className="text-info hover:underline">race to N</a>.
        </p>
      </div>
    ),
    l1_anchor: { path: 'docs/league-system/modules/match-format.md' },
    related: ['match-format'],
  },

  'single-rack': {
    slug: 'single-rack',
    canonicalName: 'Single Rack',
    aliases: ['one rack'],
    shortDef:
      'One rack per pairing — whoever wins that rack takes the pairing.',
    longDef: (
      <div className="space-y-2">
        <p>
          The most common{' '}
          <a href="#pairing" className="text-info hover:underline">pairing</a>{' '}
          shape. Each home player meets each away player and they play exactly
          one rack against each other. The rack’s winner is the pairing’s
          winner. Fast, decisive, and easy to track on a scoreboard.
        </p>
        <p className="text-sm text-muted-foreground">
          Relevant topics:{' '}
          <a href="#pairing" className="text-info hover:underline">pairing</a>.
        </p>
      </div>
    ),
    l1_anchor: { path: 'docs/league-system/modules/match-format.md' },
    related: ['pairing-format', 'race-to-n'],
  },

  'race-to-n': {
    slug: 'race-to-n',
    canonicalName: 'Race to N',
    aliases: ['race format', 'race to', 'first to n'],
    shortDef:
      'Each pairing plays a race to N racks — first player to N wins the pairing.',
    longDef: (
      <div className="space-y-2">
        <p>
          Each{' '}
          <a href="#pairing" className="text-info hover:underline">pairing</a> is
          a race instead of a{' '}
          <a href="#single-rack" className="text-info hover:underline">single rack</a>.
          The two players play until one reaches the target — race to 7 means
          first to win 7 racks. The race length can be the same for everyone, or
          adjusted per pairing based on skill gap (
          <a href="#race-length-adjustment" className="text-info hover:underline">
            race length adjustment
          </a>
          ).
        </p>
        <p className="text-sm text-muted-foreground">
          Relevant topics:{' '}
          <a href="#pairing" className="text-info hover:underline">pairing</a>,{' '}
          <a href="#single-rack" className="text-info hover:underline">single rack</a>,{' '}
          <a href="#race-length-adjustment" className="text-info hover:underline">
            race length adjustment
          </a>
          .
        </p>
      </div>
    ),
    l1_anchor: { path: 'docs/league-system/modules/match-format.md' },
    related: ['pairing-format', 'race'],
  },

  race: {
    slug: 'race',
    canonicalName: 'Race',
    aliases: ['first to', 'first-to-n'],
    shortDef:
      'A first-to-N format — whoever wins N racks first wins the race.',
    longDef: (
      <div className="space-y-2">
        <p>
          “Race” is the generic word for any first-to-target format. It can
          describe a single{' '}
          <a href="#pairing" className="text-info hover:underline">pairing</a>{' '}
          (race to 7 between two players) or a whole match in formats that use{' '}
          <a href="#individual-races" className="text-info hover:underline">
            individual races
          </a>
          . The “N” is set by the league or by the handicap chart per pair.
        </p>
        <p className="text-sm text-muted-foreground">
          Relevant topics:{' '}
          <a href="#pairing" className="text-info hover:underline">pairing</a>,{' '}
          <a href="#individual-races" className="text-info hover:underline">individual races</a>.
        </p>
      </div>
    ),
    l1_anchor: { path: 'docs/league-system/modules/match-format.md' },
    related: ['race-to-n', 'race-length-adjustment'],
  },
} as const satisfies Record<string, GlossaryEntry>;
