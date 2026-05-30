/**
 * @fileoverview Match-format glossary entries — how games inside a match
 * are generated (round-robin variants, individual races) and how each
 * pairing is decided (single rack vs race to N).
 *
 * NO DRIFT: no preset names embedded in definitions.
 */

import type { GlossaryEntry } from '../types';

export const entries = {
  'match-format': {
    slug: 'match-format',
    canonicalName: 'Match Format',
    aliases: [],
    shortDef:
      'How the individual games inside a match are generated — round robin variants, individual races, and so on.',
    longDef: (
      <div className="space-y-2">
        <p>
          Match format is the answer to "how many games does this match
          contain, and who plays whom?" Common shapes:
        </p>
        <ul className="list-disc pl-5">
          <li>
            <strong>Single Round Robin</strong> — every player on one team
            plays every player on the other team once.
          </li>
          <li>
            <strong>Double Round Robin</strong> — same pairings twice; once
            breaking, once racking.
          </li>
          <li>
            <strong>Individual Races</strong> — each opposing-player pair
            plays a race together rather than single racks.
          </li>
        </ul>
      </div>
    ),
    l1_anchor: { path: 'docs/league-system/modules/match-format.md' },
    related: [
      'round-robin',
      'single-round-robin',
      'double-round-robin',
      'individual-races',
    ],
  },

  'round-robin': {
    slug: 'round-robin',
    canonicalName: 'Round Robin',
    aliases: ['rr'],
    shortDef:
      'A format where every player on one team faces every player on the other team.',
    longDef: (
      <p>
        Round robin is a fairness pattern: nobody gets to avoid anyone. Each
        player on the home team takes a turn against each player on the away
        team. The variants are about repetition — single round robin runs
        each opposing pair once; double runs each pair twice, flipping who
        breaks.
      </p>
    ),
    l1_anchor: { path: 'docs/league-system/modules/match-format.md' },
    related: ['single-round-robin', 'double-round-robin', 'match-format'],
  },

  'single-round-robin': {
    slug: 'single-round-robin',
    canonicalName: 'Single Round Robin',
    aliases: ['single rr', 'srr'],
    shortDef:
      'Each player faces each opposing player exactly once.',
    longDef: (
      <p>
        In a 5v5 single round robin, each home player meets each away
        player one time — 25 games total. Faster than a double round robin,
        but only one of the two players in any pairing gets to break.
      </p>
    ),
    l1_anchor: { path: 'docs/league-system/modules/match-format.md' },
    related: ['round-robin', 'double-round-robin'],
  },

  'double-round-robin': {
    slug: 'double-round-robin',
    canonicalName: 'Double Round Robin',
    aliases: ['double rr', 'drr'],
    shortDef:
      'Each player faces each opposing player twice — once breaking, once racking.',
    longDef: (
      <p>
        In a 3v3 double round robin, each home player meets each away player
        twice — 18 games total. The two meetings split the break: each
        player gets to break against the same opponent once and rack once.
        Eliminates any "luck of the break" advantage at the pairing level.
      </p>
    ),
    l1_anchor: { path: 'docs/league-system/modules/match-format.md' },
    related: ['round-robin', 'single-round-robin', 'racker', 'breaker'],
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
