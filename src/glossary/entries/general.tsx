/**
 * @fileoverview Cross-cutting glossary entries — the keystone container
 * concepts (league, season, match, matchup, game), team/player/roster terms,
 * tiebreakers, game types, and the qualifier descriptor.
 *
 * Definitions follow the NO DRIFT principle: describe what each thing IS,
 * not which preset uses it. Preset names can change; underlying concepts
 * shouldn't be tied to a specific package.
 *
 * "Night" is not used. Match is canonical.
 */

import type { GlossaryEntry } from '../types';

export const entries = {
  // ---- Container concepts (keystones) ----------------------------------

  league: {
    slug: 'league',
    canonicalName: 'League',
    aliases: [],
    shortDef:
      'A specific game + weekly time slot that runs over time (e.g., "8-Ball on Mondays") — set up once, then hosts recurring seasons.',
    longDef: (
      <div className="space-y-2">
        <p>
          A league is the long-running container. It picks the game (8-Ball,
          9-Ball, etc.), the night of the week matches play, the format
          (lineup size, handicap, scoring), and the rules. You set this up
          once.
        </p>
        <p>
          Under the league, seasons run one after another. The league
          provides the consistent shape; each season is one chapter of play
          within that shape.
        </p>
      </div>
    ),
    l1_anchor: { path: 'docs/league-system/README.md' },
    related: ['season', 'matchup', 'match'],
  },

  season: {
    slug: 'season',
    canonicalName: 'Season',
    aliases: [],
    shortDef:
      'One run of league play under a league — has a start date, weekly matches, and ends with playoffs (if configured).',
    longDef: (
      <p>
        Seasons run one after another under the same league to form
        consistent ongoing play. Each season has its own schedule, teams,
        rosters, and standings. When a season ends, the next one starts
        under the same league shape.
      </p>
    ),
    l1_anchor: { path: 'docs/league-system/README.md' },
    related: ['league', 'matchup', 'match'],
  },

  matchup: {
    slug: 'matchup',
    canonicalName: 'Matchup',
    aliases: ['matchups'],
    shortDef:
      'The schedule of who plays who in a given setting — at the team level (Kings vs Knights) or the player level (Joe vs John).',
    longDef: (
      <div className="space-y-2">
        <p>
          A matchup is the pairing. It says who's playing who. At the team
          level, a night's matchups are the slate of teams paired up. At the
          player level, a matchup is one player against one other.
        </p>
        <p>
          The relationship is layered: <strong>matchups are a group of
          matches</strong>, the same way a match is a group of games. 12
          teams scheduled for a night gives you 6 matchups (= 6 matches).
        </p>
      </div>
    ),
    l1_anchor: { path: 'docs/league-system/README.md' },
    related: ['match', 'pairing', 'season'],
  },

  match: {
    slug: 'match',
    canonicalName: 'Match',
    aliases: [],
    shortDef:
      'One team-vs-team event played on a specific date; contains multiple games.',
    longDef: (
      <div className="space-y-2">
        <p>
          A match is the singular event a matchup provides. Two teams meet,
          play through their lineups, and one wins. A match is made up of
          games — the number of games depends on the lineup size and the
          match format (single or double round robin etc.).
        </p>
        <p className="text-sm text-muted-foreground">
          A note on the word: "match" is also sometimes used in the wild to
          describe a single game or round. In this app, match always means
          the team-vs-team event.
        </p>
      </div>
    ),
    l1_anchor: { path: 'docs/league-system/README.md' },
    related: ['matchup', 'game'],
  },

  game: {
    slug: 'game',
    canonicalName: 'Game',
    aliases: [],
    shortDef:
      'A single rack between two players; you win a game by winning the rack.',
    longDef: (
      <p>
        A game is the smallest unit of play. One rack: balls racked, one
        player breaks, players exchange shots until the rack is won. A match
        contains many games (e.g., 18 in a 3v3 double round robin, 25 in a
        5v5 single round robin).
      </p>
    ),
    l1_anchor: { path: 'docs/league-system/README.md' },
    related: ['match', 'racker', 'breaker'],
  },

  pairing: {
    slug: 'pairing',
    canonicalName: 'Pairing',
    aliases: [],
    shortDef:
      'An individual player-vs-player race — used when teams play individual races instead of round-robin.',
    longDef: (
      <div className="space-y-2">
        <p>
          Pairing is reserved for the individual-race style of match. In
          that format, each player gets paired against one opponent and
          they play a race together (race to 7, race to 5, etc.). Whoever
          gets there first wins the pairing.
        </p>
        <p className="text-sm text-muted-foreground">
          In round-robin formats, players don't have "pairings" in this
          sense — every player faces every opponent in a sequence of single
          racks. Matchup is the broader scheduling word; pairing is the
          specific race-format unit.
        </p>
      </div>
    ),
    l1_anchor: { path: 'docs/league-system/modules/match-format.md' },
    related: ['matchup', 'race-length-adjustment'],
  },

  // ---- Game types ------------------------------------------------------

  'eight-ball': {
    slug: 'eight-ball',
    canonicalName: '8-Ball',
    aliases: ['8 ball', '8ball'],
    shortDef:
      'Classic stripes and solids — one player takes stripes, the other takes solids; sink your group, then sink the 8 to win.',
    longDef: (
      <p>
        The most common league game in the US. After the break, the table
        is "open" until one player legally sinks a stripe or solid — that
        decides which group each player owns. Players sink only their own
        group, then call a pocket for the 8-ball to win the rack.
      </p>
    ),
    l1_anchor: { path: 'docs/league-system/README.md' },
    related: ['game'],
  },

  'nine-ball': {
    slug: 'nine-ball',
    canonicalName: '9-Ball',
    aliases: ['9 ball', '9ball'],
    shortDef:
      'Rotation using balls 1–9 — hit the lowest-numbered ball first on every shot; sink the 9 to win the rack.',
    longDef: (
      <p>
        Players must contact the lowest-numbered ball on the table first,
        but any ball that goes in on a legal shot stays sunk. You can win
        the rack at any point by legally pocketing the 9 — including off a
        combo, carom, or a break that sinks the 9 outright.
      </p>
    ),
    l1_anchor: { path: 'docs/league-system/README.md' },
    related: ['game'],
  },

  'ten-ball': {
    slug: 'ten-ball',
    canonicalName: '10-Ball',
    aliases: ['10 ball', '10ball'],
    shortDef:
      'Call-pocket rotation using balls 1–10 — you must call a ball AND a pocket for every shot to count.',
    longDef: (
      <p>
        Like 9-ball with a strictness upgrade: every shot is call-pocket the
        entire game. You name the ball and the pocket; a ball going in any
        other pocket doesn't count and your turn ends. Considered the most
        skill-rewarding rotation game because lucky pockets don't help you.
      </p>
    ),
    l1_anchor: { path: 'docs/league-system/README.md' },
    related: ['game'],
  },

  // ---- Teams / players / roster ----------------------------------------

  lineup: {
    slug: 'lineup',
    canonicalName: 'Lineup',
    aliases: [],
    shortDef:
      'The set of players from a team who actually play in a given match (chosen from the larger roster).',
    longDef: (
      <p>
        Before a match begins, each captain picks which of their roster
        players will play that match. That's the lineup. Lineup size is set
        at the league level (e.g., 3 for 3v3, 5 for 5v5). Anyone on the
        roster not in the lineup is available as a substitute.
      </p>
    ),
    l1_anchor: { path: 'docs/league-system/modules/team-geometry.md' },
    related: ['lineup-size', 'roster', 'captain', 'substitute', 'lineup-lock'],
  },

  'lineup-size': {
    slug: 'lineup-size',
    canonicalName: 'Lineup Size',
    aliases: [],
    shortDef:
      'How many players per team actually play in each match — set at the league level.',
    longDef: (
      <p>
        Lineup size determines the shape of every match in the league. A
        3-person lineup pairs each of the 3 players against each opponent,
        which produces 9 games per single round robin or 18 per double. A
        5-person lineup produces 25 or 50.
      </p>
    ),
    l1_anchor: { path: 'docs/league-system/modules/team-geometry.md' },
    related: ['lineup', 'roster-size'],
  },

  roster: {
    slug: 'roster',
    canonicalName: 'Roster',
    aliases: [],
    shortDef:
      'The full set of players signed up to a team — must be at least the lineup size; extras serve as substitutes.',
    longDef: (
      <p>
        The roster is everyone on the team. The captain picks a lineup from
        the roster each match. Roster size is capped at the league level
        (e.g., 5 for a 3v3 team, 8 for a 5v5 team). Players beyond the
        lineup serve as substitutes when starters can't play.
      </p>
    ),
    l1_anchor: { path: 'docs/league-system/modules/team-geometry.md' },
    related: ['roster-size', 'lineup', 'substitute', 'captain'],
  },

  'roster-size': {
    slug: 'roster-size',
    canonicalName: 'Roster Size',
    aliases: [],
    shortDef:
      'The maximum number of players a team can carry on its roster — must be at least the lineup size.',
    longDef: (
      <p>
        The cap on how many players a team can register. A higher roster
        size means more substitute coverage when starters can't play. A
        lower size keeps the team tighter and gives everyone more weekly
        playing time.
      </p>
    ),
    l1_anchor: { path: 'docs/league-system/modules/team-geometry.md' },
    related: ['roster', 'lineup-size'],
  },

  substitute: {
    slug: 'substitute',
    canonicalName: 'Substitute',
    aliases: ['sub'],
    shortDef:
      'A roster player who isn\'t in the lineup for a given match — or fills in for a missing player.',
    longDef: (
      <div className="space-y-2">
        <p>The app supports two specific sub patterns:</p>
        <ul className="list-disc pl-5">
          <li>
            <strong>Anonymous Sub</strong> — a player whose handicap the
            league already knows plays in place of a missing player, but
            their results don't affect their own rating.
          </li>
          <li>
            <strong>Double Duty</strong> — a player in the lineup plays in
            two positions in the same match; the opposing team picks which
            roster player takes the doubled role.
          </li>
        </ul>
      </div>
    ),
    l1_anchor: { path: 'docs/league-system/modules/team-geometry.md' },
    related: ['anonymous-sub', 'double-duty', 'roster', 'lineup'],
  },

  'anonymous-sub': {
    slug: 'anonymous-sub',
    canonicalName: 'Anonymous Sub',
    aliases: ['anon sub', 'anonymous substitute'],
    shortDef:
      'A substitute whose handicap the league knows, but who plays anonymously so the games don\'t affect their own rating.',
    longDef: (
      <div className="space-y-2">
        <p>
          Anonymous subs solve a real problem. If a regular player fills in
          on another team and his games count toward his own rating, he has
          an incentive to lose on purpose (tank) to keep his handicap lower
          for when he plays for his own team.
        </p>
        <p>
          Going anonymous removes that incentive. The team gets a known-skill
          fill-in. The sub gets to play their best without it counting against
          (or for) their rating. Everyone wins.
        </p>
      </div>
    ),
    l1_anchor: { path: 'docs/league-system/modules/team-geometry.md' },
    related: ['substitute', 'double-duty'],
  },

  'double-duty': {
    slug: 'double-duty',
    canonicalName: 'Double Duty',
    aliases: ['double-duty player'],
    shortDef:
      'One player in the lineup plays in two positions in the same match — the opposing team picks which roster player does it.',
    longDef: (
      <p>
        Double duty is a sub workaround when the lineup is short but the
        team doesn't want to use a regular sub. A player in the lineup plays
        in two roster positions during the match. The opposing team gets to
        choose which available player takes the doubled role, which prevents
        the captain from stacking their strongest player into two slots.
      </p>
    ),
    l1_anchor: { path: 'docs/league-system/modules/team-geometry.md' },
    related: ['substitute', 'anonymous-sub'],
  },

  captain: {
    slug: 'captain',
    canonicalName: 'Captain',
    aliases: ['team captain'],
    shortDef:
      'The team leader. Manages the team in almost every way — name, players, lineups, handicap adjustments at lock.',
    longDef: (
      <div className="space-y-2">
        <p>
          The captain runs the team within this app. Specifically they can:
        </p>
        <ul className="list-disc pl-5">
          <li>Change the team's name.</li>
          <li>Add and remove roster players.</li>
          <li>Set the lineup for each match.</li>
          <li>Adjust handicap thresholds at lineup lock (for combos that need manual entry).</li>
        </ul>
        <p className="text-sm text-muted-foreground">
          Other team management actions live with the captain too — they're
          the operator's primary point of contact for anything team-level.
        </p>
      </div>
    ),
    l1_anchor: { path: 'docs/league-system/README.md' },
    related: ['lineup', 'lineup-lock', 'manual-entry'],
  },

  scorekeeper: {
    slug: 'scorekeeper',
    canonicalName: 'Scorekeeper',
    aliases: ['score keeper'],
    shortDef:
      'The person entering scores into the app during or after a match.',
    longDef: (
      <p>
        The scorekeeper is whoever is logging games as they happen — usually
        a captain, a designated team member, or the operator on site. They
        also handle manual entries (e.g., the result of a tiebreaker that
        the league handles outside the app).
      </p>
    ),
    l1_anchor: { path: 'docs/league-system/README.md' },
    related: ['captain', 'manual-entry', 'manual-tiebreaker'],
  },

  'lineup-lock': {
    slug: 'lineup-lock',
    canonicalName: 'Lineup Lock',
    aliases: [],
    shortDef:
      'The moment a captain finalizes their lineup before a match — also when manual handicap thresholds get entered for off-preset combos.',
    longDef: (
      <p>
        Lineup lock is the point of no return. Before lock, the captain can
        swap players in and out. After lock, the lineup is committed and the
        match's handicap thresholds (when not from a calibrated chart) are
        whatever the captain entered.
      </p>
    ),
    l1_anchor: { path: 'docs/league-system/modules/team-geometry.md' },
    related: ['captain', 'lineup', 'manual-entry'],
  },

  racker: {
    slug: 'racker',
    canonicalName: 'Racker',
    aliases: [],
    shortDef:
      'In a given game, the player who racks the balls — i.e., the player who is NOT breaking.',
    longDef: (
      <p>
        Pool has two roles each rack: the player who breaks (the breaker)
        and the player who racks (the racker). They alternate game to game
        in most formats. The role matters because in some scoring systems
        the breaker has an advantage, so balancing who breaks is part of
        the format design.
      </p>
    ),
    l1_anchor: { path: 'docs/league-system/README.md' },
    related: ['breaker', 'game'],
  },

  breaker: {
    slug: 'breaker',
    canonicalName: 'Breaker',
    aliases: [],
    shortDef:
      'In a given game, the player who breaks — i.e., takes the opening shot that scatters the rack.',
    longDef: (
      <p>
        The breaker hits the cue ball into the racked balls to start the
        game. In most leagues the break alternates from game to game so
        each player gets the same number of breaks. The opposite role is
        the racker, who sets up the rack the breaker is about to hit.
      </p>
    ),
    l1_anchor: { path: 'docs/league-system/README.md' },
    related: ['racker', 'game'],
  },

  // ---- Tiebreaker concepts (features partly speculative) ---------------

  tiebreaker: {
    slug: 'tiebreaker',
    canonicalName: 'Tiebreaker',
    aliases: ['tie breaker'],
    shortDef:
      'The method used to decide who wins when regular play ends in a tie.',
    longDef: (
      <div className="space-y-2">
        <p>
          Some leagues let ties stand. Others play an extra round, a single
          short race, or fall back to a hand entry. The tiebreaker setting
          tells the app which behavior the league agreed on.
        </p>
        <p className="text-sm text-muted-foreground">
          Note: most of the specific tiebreaker modules aren't fully coded
          in the app yet. Manual entry is the safe fallback that always
          works while the codified options are being built out.
        </p>
      </div>
    ),
    l1_anchor: { path: 'docs/league-system/modules/tiebreak-system/README.md' },
    related: ['extra-round', 'single-short-race', 'accept-tie', 'manual-tiebreaker'],
  },

  'extra-round': {
    slug: 'extra-round',
    canonicalName: 'Extra Round',
    aliases: ['best of 3', 'best of 5'],
    shortDef:
      'When a match ends tied, the teams play one more round of games — typically best of 3 or best of 5 — to decide the winner.',
    longDef: (
      <p>
        An extra round runs a short additional bracket between the tied
        teams. First to a target (2 wins out of 3, 3 out of 5, etc.) takes
        the match. This module hasn't been fully coded yet; manual entry is
        the working fallback in the meantime.
      </p>
    ),
    l1_anchor: { path: 'docs/league-system/modules/tiebreak-system/README.md' },
    related: ['tiebreaker', 'manual-tiebreaker'],
  },

  'single-short-race': {
    slug: 'single-short-race',
    canonicalName: 'Single Short Race',
    aliases: [],
    shortDef:
      'When a match ends tied, the teams play one short race to decide the winner.',
    longDef: (
      <p>
        A short race plays a single extra rack (or a short race-to-N) and
        whoever wins takes the match. Faster than an extra round but the
        module isn't fully coded yet; manual entry covers it for now.
      </p>
    ),
    l1_anchor: { path: 'docs/league-system/modules/tiebreak-system/README.md' },
    related: ['tiebreaker', 'manual-tiebreaker'],
  },

  'accept-tie': {
    slug: 'accept-tie',
    canonicalName: 'Accept Tie',
    aliases: [],
    shortDef:
      'The operator\'s choice to allow tied matches to stand as ties; no tiebreaker is played.',
    longDef: (
      <p>
        Some leagues are fine with ties. The match record shows a tie and
        the standings reflect it. This avoids extra time and the complexity
        of running additional games, and works well for casual league play.
      </p>
    ),
    l1_anchor: { path: 'docs/league-system/modules/tiebreak-system/README.md' },
    related: ['tiebreaker'],
  },

  'manual-tiebreaker': {
    slug: 'manual-tiebreaker',
    canonicalName: 'Manual Tiebreaker',
    aliases: [],
    shortDef:
      'A catch-all way for a league to decide a tied match — scorekeepers enter the agreed result manually.',
    longDef: (
      <p>
        When a league has its own tiebreaker rule that this app doesn't
        codify yet, manual tiebreaker is the safe path. The league plays
        whatever they normally play to break the tie, and the scorekeeper
        enters the winner into the app. The original game scores stay on
        the scoreboard; the manual entry decides who took the match.
      </p>
    ),
    l1_anchor: { path: 'docs/league-system/modules/tiebreak-system/README.md' },
    related: ['tiebreaker', 'scorekeeper', 'manual-entry'],
  },

  // ---- Schedule / setup ------------------------------------------------

  'start-date': {
    slug: 'start-date',
    canonicalName: 'Start Date',
    aliases: [],
    shortDef:
      'The date of the first match — sets the season\'s day-of-week, season name (Spring/Summer/Fall/Winter), and year.',
    longDef: (
      <p>
        Picking a start date does more than schedule the first match. It
        anchors the whole season: matches repeat weekly on the same day,
        the season name (Spring/Summer/Fall/Winter) is derived from the
        date, and the year shows up in the league name.
      </p>
    ),
    l1_anchor: { path: 'docs/league-system/README.md' },
    related: ['season', 'match'],
  },

  // ---- Qualifier / descriptor ------------------------------------------

  qualifier: {
    slug: 'qualifier',
    canonicalName: 'Qualifier',
    aliases: ['descriptor', 'division descriptor', 'league qualifier'],
    shortDef:
      'An optional name tag added to the league name for when you run multiple leagues of the same game on the same day (e.g., "East Side", "Beginner").',
    longDef: (
      <p>
        Two 8-Ball Monday leagues at the same venue need names that tell
        them apart. The qualifier is that distinguishing label. Some other
        league systems call this a "division descriptor" — same concept,
        different word. Leave it blank if you only run one league of the
        game/day combination.
      </p>
    ),
    l1_anchor: { path: 'docs/league-system/README.md' },
    related: ['league'],
  },
} as const satisfies Record<string, GlossaryEntry>;
