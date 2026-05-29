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
    aliases: ['division'],
    shortDef:
      'An ongoing team competition for one game on one weekly night — run by an operator, with its own rules, scoring, and handicap setup.',
    longDef: (
      <div className="space-y-3">
        <p>
          A league operator starts an ongoing team competition for a specific
          game on a specific night, with its own rules, scoring, and{' '}
          <a href="#handicap-system" className="text-info hover:underline">handicap</a>{' '}
          setup. The competition is divided up into{' '}
          <a href="#season" className="text-info hover:underline">seasons</a> —
          each can vary in length and may or may not end with playoffs.
        </p>
        <p>
          <strong>What makes one league distinct from another:</strong>
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Same game on a different night → <strong>different league</strong>.</li>
          <li>Different game on the same night → <strong>still a different league</strong>.</li>
        </ul>
        <p>
          Each league runs mostly the same metrics across its seasons. Small
          changes can be made while a season is in progress; larger changes
          are best made between seasons. Some changes are big enough that
          creating a new league is cleaner than reconfiguring an existing one.
        </p>
        <p>
          <strong>The{' '}
          <a href="#league-name" className="text-info hover:underline">name</a>{' '}
          is composed automatically from the operator's setup.</strong>{' '}
          The shape is:{' '}
          <em>
            [<a href="#game-type" className="text-info hover:underline">Game</a>]{' '}
            [Day-of-Week]{' '}
            [<a href="#qualifier" className="text-info hover:underline">Qualifier</a>?]{' '}
            [<a href="#season" className="text-info hover:underline">Season</a>]{' '}
            [Year]
          </em>
          . Most of these come from the league's{' '}
          <a href="#start-date" className="text-info hover:underline">start-date</a>{' '}
          and{' '}
          <a href="#qualifier" className="text-info hover:underline">qualifier</a>.
        </p>
        <p>
          <strong>Examples.</strong> A 9-Ball league starting Tuesday March
          4, 2026, no qualifier → <strong>&ldquo;9 Ball Tuesday Spring
          2026&rdquo;</strong>. Add a qualifier like &ldquo;East Side&rdquo;
          and it becomes <strong>&ldquo;9 Ball Tuesday East Side Spring
          2026&rdquo;</strong>.
        </p>
        <p className="text-sm text-muted-foreground">
          <strong>A note on the word.</strong> Other pool league systems
          call this concept a <em>division</em>. We chose
          &ldquo;league&rdquo; because that's what people actually say in
          everyday speech (&ldquo;I play my 8-Ball Tuesday league,&rdquo;
          not &ldquo;I play my 8-Ball Tuesday division&rdquo;). Matching
          natural language reduces friction when operators talk about the
          app with players.
        </p>
        <p className="text-sm text-muted-foreground">
          Relevant topics:{' '}
          <a href="#handicap-system" className="text-info hover:underline">handicap system</a>,{' '}
          <a href="#season" className="text-info hover:underline">season</a>,{' '}
          <a href="#league-name" className="text-info hover:underline">league name</a>,{' '}
          <a href="#game-type" className="text-info hover:underline">game type</a>,{' '}
          <a href="#qualifier" className="text-info hover:underline">qualifier</a>,{' '}
          <a href="#start-date" className="text-info hover:underline">start-date</a>.
        </p>
      </div>
    ),
    l1_anchor: { path: 'docs/league-system/README.md' },
    related: ['matchup', 'match', 'team'],
    reviewedByEd: '2026-05-29',
  },

  season: {
    slug: 'season',
    canonicalName: 'Season',
    aliases: [],
    shortDef:
      'One run of league play inside a league — its own teams, schedule, length, standings, and (optionally) playoffs.',
    longDef: (
      <div className="space-y-3">
        <p>
          A season is the current chapter of league play. Each season is its
          own self-contained competitive period inside a longer-running{' '}
          <a href="#league" className="text-info hover:underline">league</a>{' '}
          — when one season ends, the next starts under the same league
          shape, one after another. Multiple seasons stack up over the life
          of a league.
        </p>
        <p>What a season holds:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            A{' '}
            <a href="#season-length" className="text-info hover:underline">length</a>{' '}
            (number of weeks).
          </li>
          <li>
            An optional{' '}
            <a href="#playoffs" className="text-info hover:underline">playoffs</a>{' '}
            at the end.
          </li>
          <li>
            A generated{' '}
            <a href="#schedule" className="text-info hover:underline">schedule</a>{' '}
            of every match night.
          </li>
          <li>
            The specific{' '}
            <a href="#team" className="text-info hover:underline">teams</a>{' '}
            registered for this season.
          </li>
          <li>
            The{' '}
            <a href="#match" className="text-info hover:underline">matches</a>{' '}
            and{' '}
            <a href="#matchup" className="text-info hover:underline">matchups</a>{' '}
            for every team across the schedule.
          </li>
          <li>
            Its own{' '}
            <a href="#standings" className="text-info hover:underline">standings</a>{' '}
            and stats — independent from past or future seasons.
          </li>
          <li>
            A name (so players can identify "this season" vs "last season"
            vs "next season").
          </li>
        </ul>
        <p>
          Practically: when someone in the app says "the standings" or "the{' '}
          <a href="#schedule" className="text-info hover:underline">schedule</a>,"
          they mean <em>this</em> season's. Past seasons stay archived under
          the same{' '}
          <a href="#league" className="text-info hover:underline">league</a>;
          future seasons are scheduled but not yet active.
        </p>
        <p>
          The season name is auto-generated, similar to the{' '}
          <a href="#league-name" className="text-info hover:underline">league name</a>{' '}
          but anchored to this season's{' '}
          <a href="#start-date" className="text-info hover:underline">start-date</a>{' '}
          — so a single league hosts a series of distinctly-named seasons
          over time.
        </p>
        <p className="text-sm text-muted-foreground">
          Relevant topics:{' '}
          <a href="#league" className="text-info hover:underline">league</a>,{' '}
          <a href="#league-name" className="text-info hover:underline">league name</a>,{' '}
          <a href="#season-length" className="text-info hover:underline">season length</a>,{' '}
          <a href="#playoffs" className="text-info hover:underline">playoffs</a>,{' '}
          <a href="#schedule" className="text-info hover:underline">schedule</a>,{' '}
          <a href="#team" className="text-info hover:underline">team</a>,{' '}
          <a href="#match" className="text-info hover:underline">match</a>,{' '}
          <a href="#matchup" className="text-info hover:underline">matchup</a>,{' '}
          <a href="#standings" className="text-info hover:underline">standings</a>,{' '}
          <a href="#start-date" className="text-info hover:underline">start-date</a>.
        </p>
      </div>
    ),
    l1_anchor: { path: 'docs/league-system/README.md' },
    related: ['roster', 'captain'],
    reviewedByEd: '2026-05-29',
  },

  'season-length': {
    slug: 'season-length',
    canonicalName: 'Season Length',
    aliases: [],
    shortDef:
      'How many weeks of regular play a season runs — set per-season, not at the league level.',
    longDef: (
      <div className="space-y-3">
        <p>
          Each{' '}
          <a href="#season" className="text-info hover:underline">season</a>{' '}
          has its own length, expressed in weeks. The length drives how many
          match nights the{' '}
          <a href="#schedule" className="text-info hover:underline">schedule</a>{' '}
          spans before regular play ends.
        </p>
        <p>
          Length is configured per-season, not at the{' '}
          <a href="#league" className="text-info hover:underline">league</a>{' '}
          level — so different seasons under the same league can run for
          different durations (e.g., a 10-week summer season and a 16-week
          fall season).
        </p>
        <p>
          Season length only counts regular play.{' '}
          <a href="#playoffs" className="text-info hover:underline">Playoffs</a>{' '}
          (when configured) run AFTER the season-length weeks complete and
          are counted separately.
        </p>
        <p className="text-sm text-muted-foreground">
          Relevant topics:{' '}
          <a href="#season" className="text-info hover:underline">season</a>,{' '}
          <a href="#schedule" className="text-info hover:underline">schedule</a>,{' '}
          <a href="#league" className="text-info hover:underline">league</a>,{' '}
          <a href="#playoffs" className="text-info hover:underline">playoffs</a>.
        </p>
      </div>
    ),
    l1_anchor: { path: 'docs/league-system/README.md' },
    related: [],
  },

  playoffs: {
    slug: 'playoffs',
    canonicalName: 'Playoffs',
    aliases: ['playoff', 'post-season', 'postseason'],
    shortDef:
      'An optional end-of-season elimination round that decides the season\'s champion.',
    longDef: (
      <div className="space-y-3">
        <p>
          Playoffs are an optional extension to a{' '}
          <a href="#season" className="text-info hover:underline">season</a>.
          After regular play (the{' '}
          <a href="#season-length" className="text-info hover:underline">season length</a>{' '}
          weeks) ends, the top teams from the regular-season{' '}
          <a href="#standings" className="text-info hover:underline">standings</a>{' '}
          qualify for a playoff bracket. The bracket plays out across one or
          more match nights and crowns the season's champion.
        </p>
        <p>What playoffs configuration covers:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            How many{' '}
            <a href="#team" className="text-info hover:underline">teams</a>{' '}
            qualify (e.g., top 4, top 8).
          </li>
          <li>
            The bracket format (single elimination, double, round robin, etc.).
          </li>
          <li>The number of playoff weeks.</li>
        </ul>
        <p>
          Playoffs are configured per-season, so a{' '}
          <a href="#league" className="text-info hover:underline">league</a>{' '}
          can choose to run them some seasons and skip others. Skipping
          playoffs is legitimate — many leagues prefer the regular-season{' '}
          <a href="#standings" className="text-info hover:underline">standings</a>{' '}
          to decide the champion.
        </p>
        <p className="text-sm text-muted-foreground">
          Relevant topics:{' '}
          <a href="#season" className="text-info hover:underline">season</a>,{' '}
          <a href="#season-length" className="text-info hover:underline">season length</a>,{' '}
          <a href="#standings" className="text-info hover:underline">standings</a>,{' '}
          <a href="#team" className="text-info hover:underline">team</a>,{' '}
          <a href="#league" className="text-info hover:underline">league</a>.
        </p>
      </div>
    ),
    l1_anchor: { path: 'docs/league-system/README.md' },
    related: ['tiebreaker'],
  },

  schedule: {
    slug: 'schedule',
    canonicalName: 'Schedule',
    aliases: ['season schedule'],
    shortDef:
      'The list of match nights and which teams play whom — auto-generated from the season\'s teams, length, and match format.',
    longDef: (
      <div className="space-y-3">
        <p>
          Once a{' '}
          <a href="#season" className="text-info hover:underline">season</a>{' '}
          begins, the app generates a schedule: every match night, the
          teams that meet, and the venue (when multiple venues are in play).
          The schedule is the master list of who plays whom and when.
        </p>
        <p>What drives the schedule:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            The number of{' '}
            <a href="#team" className="text-info hover:underline">teams</a>{' '}
            registered for the season.
          </li>
          <li>
            The{' '}
            <a href="#season-length" className="text-info hover:underline">season length</a>{' '}
            (how many weeks of regular play).
          </li>
          <li>
            The{' '}
            <a href="#match-format" className="text-info hover:underline">match format</a>{' '}
            (single or double round robin, or individual races).
          </li>
          <li>
            The day-of-week and{' '}
            <a href="#start-date" className="text-info hover:underline">start-date</a>{' '}
            inherited from the{' '}
            <a href="#league" className="text-info hover:underline">league</a>.
          </li>
        </ul>
        <p>
          Operators can adjust the schedule mid-season — cancel a{' '}
          <a href="#match" className="text-info hover:underline">match</a>,
          reschedule, swap venues — without affecting the overall structure.
        </p>
        <p className="text-sm text-muted-foreground">
          Relevant topics:{' '}
          <a href="#season" className="text-info hover:underline">season</a>,{' '}
          <a href="#team" className="text-info hover:underline">team</a>,{' '}
          <a href="#season-length" className="text-info hover:underline">season length</a>,{' '}
          <a href="#match-format" className="text-info hover:underline">match format</a>,{' '}
          <a href="#start-date" className="text-info hover:underline">start-date</a>,{' '}
          <a href="#league" className="text-info hover:underline">league</a>,{' '}
          <a href="#match" className="text-info hover:underline">match</a>.
        </p>
      </div>
    ),
    l1_anchor: { path: 'docs/league-system/README.md' },
    related: ['matchup'],
  },

  team: {
    slug: 'team',
    canonicalName: 'Team',
    aliases: ['teams'],
    shortDef:
      'A group of players competing together in a season — has a name, a captain, and a roster.',
    longDef: (
      <div className="space-y-3">
        <p>
          A team is the unit of competition in a{' '}
          <a href="#season" className="text-info hover:underline">season</a>.
          A team is made up of:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>A name (chosen by the captain or operator).</li>
          <li>
            A{' '}
            <a href="#captain" className="text-info hover:underline">captain</a>{' '}
            who manages the team day-to-day.
          </li>
          <li>
            A{' '}
            <a href="#roster" className="text-info hover:underline">roster</a>{' '}
            of registered players.
          </li>
        </ul>
        <p>
          Each season, teams play{' '}
          <a href="#match" className="text-info hover:underline">matches</a>{' '}
          against other teams across the season's{' '}
          <a href="#schedule" className="text-info hover:underline">schedule</a>.
          Match results accumulate into the team's record in the season{' '}
          <a href="#standings" className="text-info hover:underline">standings</a>.
        </p>
        <p>
          Teams are registered per-season. A team might exist across multiple
          seasons (same name, same captain, same core roster) — but each
          season the team is registered fresh: rosters can change, names
          can shift, and the team's record starts over.
        </p>
        <p className="text-sm text-muted-foreground">
          Relevant topics:{' '}
          <a href="#season" className="text-info hover:underline">season</a>,{' '}
          <a href="#captain" className="text-info hover:underline">captain</a>,{' '}
          <a href="#roster" className="text-info hover:underline">roster</a>,{' '}
          <a href="#match" className="text-info hover:underline">match</a>,{' '}
          <a href="#schedule" className="text-info hover:underline">schedule</a>,{' '}
          <a href="#standings" className="text-info hover:underline">standings</a>.
        </p>
      </div>
    ),
    l1_anchor: { path: 'docs/league-system/README.md' },
    related: ['lineup'],
  },

  matchup: {
    slug: 'matchup',
    canonicalName: 'Matchup',
    aliases: ['matchups'],
    shortDef:
      'The list of who plays whom in a given week — that week\'s slate of team-vs-team matches.',
    longDef: (
      <div className="space-y-3">
        <p>
          A matchup is the list of who plays whom in a given week. For a
          week where 12 teams are scheduled to play, the matchup is the
          full set of 6 team-vs-team meetings happening that week (e.g.,
          Kings vs Knights, Eagles vs Ravens, Wolves vs Bears, …). Each
          team-vs-team meeting inside the list is a{' '}
          <a href="#match" className="text-info hover:underline">match</a>.
        </p>
        <p>
          <strong>Matchups</strong> (plural) is the list of all the weekly
          matchups across a{' '}
          <a href="#season" className="text-info hover:underline">season</a>{' '}
          — i.e., the team-pairing part of the season's{' '}
          <a href="#schedule" className="text-info hover:underline">schedule</a>,
          week by week.
        </p>
        <p>The hierarchy:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            A matchup (one week) is a group of{' '}
            <a href="#match" className="text-info hover:underline">matches</a>.
          </li>
          <li>
            A{' '}
            <a href="#match" className="text-info hover:underline">match</a>{' '}
            (one team-vs-team event) is a group of{' '}
            <a href="#game" className="text-info hover:underline">games</a>.
          </li>
          <li>
            A{' '}
            <a href="#game" className="text-info hover:underline">game</a>{' '}
            is a single rack between two players.
          </li>
        </ul>
        <p>
          <strong>Don't confuse matchup with pairing.</strong> A matchup is
          team-level (which teams play whom this week). A{' '}
          <a href="#pairing" className="text-info hover:underline">pairing</a>{' '}
          is player-level — a single player vs a single player, inside a
          specific{' '}
          <a href="#match" className="text-info hover:underline">match</a>{' '}
          (race-to-N formats). Different layers of the hierarchy.
        </p>
        <p className="text-sm text-muted-foreground">
          Relevant topics:{' '}
          <a href="#match" className="text-info hover:underline">match</a>,{' '}
          <a href="#game" className="text-info hover:underline">game</a>,{' '}
          <a href="#pairing" className="text-info hover:underline">pairing</a>,{' '}
          <a href="#season" className="text-info hover:underline">season</a>,{' '}
          <a href="#schedule" className="text-info hover:underline">schedule</a>.
        </p>
      </div>
    ),
    l1_anchor: { path: 'docs/league-system/README.md' },
    related: ['team', 'match-format'],
    reviewedByEd: '2026-05-29',
  },

  match: {
    slug: 'match',
    canonicalName: 'Match',
    aliases: [],
    shortDef:
      'One team-vs-team event played on a specific date; contains multiple games.',
    longDef: (
      <div className="space-y-3">
        <p>
          A match is one team vs one team on a single night. It's the
          played event — where the actual{' '}
          <a href="#game" className="text-info hover:underline">games</a>{' '}
          happen — and the record of what occurred: the{' '}
          <a href="#lineup" className="text-info hover:underline">lineups</a>{' '}
          each team brought, the scores, who won, and any notes.
        </p>
        <p>The hierarchy:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            A{' '}
            <a href="#matchup" className="text-info hover:underline">matchup</a>{' '}
            (one week) is a group of matches.
          </li>
          <li>
            A match (one team vs one team, one night) is a group of{' '}
            <a href="#game" className="text-info hover:underline">games</a>.
          </li>
          <li>
            A{' '}
            <a href="#game" className="text-info hover:underline">game</a>{' '}
            is a single rack between two players.
          </li>
        </ul>
        <p>
          The number of games inside a match depends on the{' '}
          <a href="#lineup-size" className="text-info hover:underline">lineup size</a>{' '}
          and the{' '}
          <a href="#match-format" className="text-info hover:underline">match format</a>.
          For example, a 3v3 double round robin produces 18 games per
          match; a 5v5 single round robin produces 25.
        </p>
        <p className="text-sm text-muted-foreground">
          <strong>A note on the word.</strong> &ldquo;Match&rdquo; sometimes
          gets used informally to mean a single game or round. In this app,
          match always means the team-vs-team event on a single night.
        </p>
        <p className="text-sm text-muted-foreground">
          Relevant topics:{' '}
          <a href="#matchup" className="text-info hover:underline">matchup</a>,{' '}
          <a href="#game" className="text-info hover:underline">game</a>,{' '}
          <a href="#lineup" className="text-info hover:underline">lineup</a>,{' '}
          <a href="#lineup-size" className="text-info hover:underline">lineup size</a>,{' '}
          <a href="#match-format" className="text-info hover:underline">match format</a>.
        </p>
      </div>
    ),
    l1_anchor: { path: 'docs/league-system/README.md' },
    related: ['pairing', 'team', 'scorekeeper'],
    reviewedByEd: '2026-05-29',
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

  'game-type': {
    slug: 'game-type',
    canonicalName: 'Game Type',
    aliases: [],
    shortDef:
      'The specific pool game a league plays — 8-Ball, 9-Ball, or 10-Ball. Set once at league creation.',
    longDef: (
      <p>
        Each league plays one game type. The options are{' '}
        <a href="#eight-ball" className="text-info hover:underline">8-Ball</a>,{' '}
        <a href="#nine-ball" className="text-info hover:underline">9-Ball</a>,
        or{' '}
        <a href="#ten-ball" className="text-info hover:underline">10-Ball</a>.
        The choice also affects how the app tracks stats and achievements —
        8-Ball break-and-runs and 9-Ball break-and-runs are tracked
        separately, for example.
      </p>
    ),
    l1_anchor: { path: 'docs/league-system/README.md' },
    related: ['eight-ball', 'nine-ball', 'ten-ball', 'league'],
  },

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
      'The date your league starts. This choice locks in your league\'s day of the week (and more) — choose carefully.',
    longDef: (
      <div className="space-y-3">
        <p>
          Start date is more than just the first day of{' '}
          <a href="#league" className="text-info hover:underline">league</a>{' '}
          play. It helps us{' '}
          <a href="#league-name" className="text-info hover:underline">name</a>{' '}
          the{' '}
          <a href="#league" className="text-info hover:underline">league</a>{' '}
          and{' '}
          <a href="#season" className="text-info hover:underline">seasons</a>{' '}
          so players can tell which{' '}
          <a href="#league" className="text-info hover:underline">league</a>{' '}
          they're looking for.
        </p>
        <p>From the start date we get:</p>
        <div className="space-y-1 pl-4">
          <p>A. The day of the week</p>
          <p>B. The time of year (Spring, Summer, Fall, Winter)</p>
          <p>C. The year</p>
        </div>
        <p>
          The day of the week is especially important because it gets{' '}
          <strong>locked in</strong>. For example: this{' '}
          <a href="#league" className="text-info hover:underline">league</a>{' '}
          plays 8-Ball on Tuesdays — every{' '}
          <a href="#match" className="text-info hover:underline">match</a>{' '}
          falls on a Tuesday. If you want a different night, you create a
          new{' '}
          <a href="#league" className="text-info hover:underline">league</a>.
        </p>
        <p className="text-sm text-muted-foreground">
          Relevant topics:{' '}
          <a href="#league" className="text-info hover:underline">league</a>,{' '}
          <a href="#league-name" className="text-info hover:underline">league name</a>,{' '}
          <a href="#season" className="text-info hover:underline">season</a>,{' '}
          <a href="#match" className="text-info hover:underline">match</a>.
        </p>
      </div>
    ),
    l1_anchor: { path: 'docs/league-system/README.md' },
    related: ['qualifier'],
    reviewedByEd: '2026-05-29',
  },

  // ---- Qualifier / descriptor ------------------------------------------

  'league-name': {
    slug: 'league-name',
    canonicalName: 'League Name',
    aliases: ['league title'],
    shortDef:
      'The auto-generated name of a league — composed from the game, day-of-week, optional qualifier, season, and year.',
    longDef: (
      <div className="space-y-3">
        <p>
          Each{' '}
          <a href="#league" className="text-info hover:underline">league</a>{' '}
          gets a name automatically. The shape is:
        </p>
        <p className="pl-4">
          <em>
            [<a href="#game-type" className="text-info hover:underline">Game</a>]{' '}
            [Day-of-Week]{' '}
            [<a href="#qualifier" className="text-info hover:underline">Qualifier</a>?]{' '}
            [<a href="#season" className="text-info hover:underline">Season</a>]{' '}
            [Year]
          </em>
        </p>
        <p>
          Most of these come from the league's{' '}
          <a href="#start-date" className="text-info hover:underline">start-date</a>{' '}
          and{' '}
          <a href="#qualifier" className="text-info hover:underline">qualifier</a>.
          The day-of-week, season name (Spring/Summer/Fall/Winter), and year
          are all derived from the start-date the operator picked.
        </p>
        <p>
          <strong>Examples.</strong> A 9-Ball league starting Tuesday March
          4, 2026, no qualifier → <strong>&ldquo;9 Ball Tuesday Spring
          2026&rdquo;</strong>. With a qualifier &ldquo;East Side&rdquo; it
          becomes <strong>&ldquo;9 Ball Tuesday East Side Spring
          2026&rdquo;</strong>.
        </p>
      </div>
    ),
    l1_anchor: { path: 'docs/league-system/README.md' },
    related: ['league', 'start-date', 'qualifier', 'season', 'game-type'],
    reviewedByEd: '2026-05-29',
  },

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
