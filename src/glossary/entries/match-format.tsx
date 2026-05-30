/**
 * @fileoverview Match-format glossary entries — how games inside a match
 * are generated (round-robin variants, individual races) and how each
 * pairing is decided (single rack vs race to N).
 *
 * NO DRIFT: no preset names embedded in definitions.
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
          It only decides the matchups and the game count. What each of those
          games looks like — a single rack or a race — is the{' '}
          <a href="#pairing-format" className="text-info hover:underline">pairing format</a>,
          a separate setting.
        </p>
      </div>
    ),
    l1_anchor: { path: 'docs/league-system/modules/pairings-generator.md' },
    related: ['lineup-size', 'match-format', 'pairing', 'pairing-format'],
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
      </div>
    ),
    l1_anchor: { path: 'docs/league-system/modules/team-geometry.md' },
    related: ['pairing-calculator', 'lineup-size', 'round-robin', 'individual-races'],
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
    related: [],
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
          Instead of running through round-robin pairings as single racks,
          each pair sits down and plays a race (race to 5, race to 7, etc.).
          First to the target wins that pairing. The match still has multiple
          pairings — they just play race-to-N each.
        </p>
        <p className="text-sm text-muted-foreground">
          This format is currently disabled in the wizard — coming soon.
        </p>
      </div>
    ),
    l1_anchor: { path: 'docs/league-system/modules/match-format.md' },
    related: ['match-format', 'race-to-n', 'pairing'],
  },

  'pairing-format': {
    slug: 'pairing-format',
    canonicalName: 'Pairing Format',
    aliases: [],
    shortDef:
      'Whether each pairing is decided by a single rack or by a race to N.',
    longDef: (
      <p>
        Pairing format is the per-pairing decision rule. Single Rack means
        one rack settles it. Race to N means the two players play until one
        reaches a target rack count. The choice changes how long each
        pairing takes and how much skill variance gets averaged out.
      </p>
    ),
    l1_anchor: { path: 'docs/league-system/modules/match-format.md' },
    related: ['single-rack', 'race-to-n'],
  },

  'single-rack': {
    slug: 'single-rack',
    canonicalName: 'Single Rack',
    aliases: ['one rack'],
    shortDef:
      'One rack per pairing — whoever wins that rack takes the pairing.',
    longDef: (
      <p>
        The most common pairing shape. Each home player meets each away
        player and they play exactly one rack against each other. The
        rack's winner is the pairing's winner. Fast, decisive, and easy to
        track on a scoreboard.
      </p>
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
          Each pairing is a race instead of a single rack. The two players
          play until one reaches the target — race to 7 means first to win 7
          racks. The race length can be the same for everyone, or can be
          adjusted per pairing based on skill gap (race length adjustment).
        </p>
      </div>
    ),
    l1_anchor: { path: 'docs/league-system/modules/match-format.md' },
    related: ['pairing-format', 'single-rack', 'race', 'race-length-adjustment'],
  },

  race: {
    slug: 'race',
    canonicalName: 'Race',
    aliases: ['first to', 'first-to-n'],
    shortDef:
      'A first-to-N format — whoever wins N racks first wins the race.',
    longDef: (
      <p>
        "Race" is the generic word for any first-to-target format. It can
        describe a single pairing (race to 7 between two players) or a
        whole match in formats that use individual races. The "N" is set by
        the league or by the handicap chart per pair.
      </p>
    ),
    l1_anchor: { path: 'docs/league-system/modules/match-format.md' },
    related: ['race-to-n', 'race-length-adjustment'],
  },
} as const satisfies Record<string, GlossaryEntry>;
