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
      'An ongoing team competition for one game on one recurring day each week — run by an operator, with its own rules, scoring, and handicap setup.',
    longDef: (
      <div className="space-y-3">
        <p>
          A league operator starts an ongoing team competition for a specific
          game on a specific day, with its own rules, scoring, and{' '}
          <a href="#handicap-system" className="text-info hover:underline">handicap</a>{' '}
          setup. The competition is divided up into{' '}
          <a href="#season" className="text-info hover:underline">seasons</a> —
          each can vary in length and may or may not end with playoffs.
        </p>
        <p>
          <strong>What makes one league distinct from another:</strong>
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Same game on a different day → <strong>different league</strong>.</li>
          <li>Different game on the same day → <strong>still a different league</strong>.</li>
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
            of every match.
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
          matches the{' '}
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
          more matches and crowns the season's champion.
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
      'The list of matches and which teams play whom — auto-generated from the season\'s teams, length, and match format.',
    longDef: (
      <div className="space-y-3">
        <p>
          Once a{' '}
          <a href="#season" className="text-info hover:underline">season</a>{' '}
          begins, the app generates a schedule: every match, the
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
      'A group of players competing together against other teams in a season.',
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
            of registered players or{' '}
            <a href="#placeholder-player" className="text-info hover:underline">placeholder players</a>.
          </li>
        </ul>
        <p>
          Placeholder players are roster slots a captain can add by name
          for players who haven't registered an app account yet. This lets
          the team be roster-complete from day one — so lineups, match
          math, and handicaps all work right away, without waiting on
          everyone to register.
        </p>
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
          <a href="#placeholder-player" className="text-info hover:underline">placeholder player</a>,{' '}
          <a href="#match" className="text-info hover:underline">match</a>,{' '}
          <a href="#schedule" className="text-info hover:underline">schedule</a>,{' '}
          <a href="#standings" className="text-info hover:underline">standings</a>.
        </p>
      </div>
    ),
    l1_anchor: { path: 'docs/league-system/README.md' },
    related: ['lineup'],
    reviewedByEd: '2026-05-30',
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
      'One team vs one team played in a single session — holds the scores, lineups, and games played.',
    longDef: (
      <div className="space-y-3">
        <p>
          A match is one team vs one team played in a single session.
          It's the played event — where the actual{' '}
          <a href="#game" className="text-info hover:underline">games</a>{' '}
          happen — and the record of what occurred.
        </p>
        <p>What a match record holds:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            The two{' '}
            <a href="#team" className="text-info hover:underline">teams</a>{' '}
            that played (home and away), and the date.
          </li>
          <li>
            Each team's{' '}
            <a href="#lineup" className="text-info hover:underline">lineup</a>{' '}
            — which players from the{' '}
            <a href="#roster" className="text-info hover:underline">roster</a>{' '}
            (drawn within the{' '}
            <a href="#roster-size" className="text-info hover:underline">roster size</a>{' '}
            cap) filled the{' '}
            <a href="#lineup-size" className="text-info hover:underline">lineup size</a>{' '}
            slots.
          </li>
          <li>The result of every individual game played (winner + score).</li>
          <li>Total games won by each team.</li>
          <li>Total points earned by each team (when the league tracks points).</li>
          <li>The match winner.</li>
          <li>Status — scheduled, in progress, completed, forfeit, makeup, preplayed.</li>
          <li>Any operator or captain notes attached to the match.</li>
        </ul>
        <p>The hierarchy:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            A{' '}
            <a href="#matchup" className="text-info hover:underline">matchup</a>{' '}
            (one week) is a group of matches.
          </li>
          <li>
            A match (one team vs one team) is a group of{' '}
            <a href="#game" className="text-info hover:underline">games</a>.
          </li>
          <li>
            A{' '}
            <a href="#game" className="text-info hover:underline">game</a>{' '}
            is a single rack between two players.
          </li>
        </ul>
        <p>
          Matches are booked weekly in this app — each team plays one
          match per week of the{' '}
          <a href="#season-length" className="text-info hover:underline">season length</a>.
          The number of games inside a match depends on the{' '}
          <a href="#lineup-size" className="text-info hover:underline">lineup size</a>{' '}
          and the{' '}
          <a href="#match-format" className="text-info hover:underline">match format</a>:
          a 3v3 double round robin produces 18 games per match; a 5v5
          single round robin produces 25.
        </p>
        <p>
          <strong>Scheduling exceptions.</strong> Matches can be played
          early (<a href="#preplayed-match" className="text-info hover:underline">preplayed match</a>){' '}
          or late (<a href="#makeup-match" className="text-info hover:underline">makeup match</a>){' '}
          when scheduling issues come up.
        </p>
        <p className="text-sm text-muted-foreground">
          <strong>A note on the word.</strong> &ldquo;Match&rdquo;
          sometimes gets used informally to mean a single game or round.
          In this app, match always means the team-vs-team event.
        </p>
        <p className="text-sm text-muted-foreground">
          Relevant topics:{' '}
          <a href="#matchup" className="text-info hover:underline">matchup</a>,{' '}
          <a href="#game" className="text-info hover:underline">game</a>,{' '}
          <a href="#team" className="text-info hover:underline">team</a>,{' '}
          <a href="#lineup" className="text-info hover:underline">lineup</a>,{' '}
          <a href="#lineup-size" className="text-info hover:underline">lineup size</a>,{' '}
          <a href="#roster" className="text-info hover:underline">roster</a>,{' '}
          <a href="#roster-size" className="text-info hover:underline">roster size</a>,{' '}
          <a href="#match-format" className="text-info hover:underline">match format</a>,{' '}
          <a href="#season-length" className="text-info hover:underline">season length</a>,{' '}
          <a href="#standings" className="text-info hover:underline">standings</a>,{' '}
          <a href="#makeup-match" className="text-info hover:underline">makeup match</a>,{' '}
          <a href="#preplayed-match" className="text-info hover:underline">preplayed match</a>.
        </p>
      </div>
    ),
    l1_anchor: { path: 'docs/league-system/README.md' },
    related: ['pairing', 'scorekeeper', 'captain'],
    reviewedByEd: '2026-05-30',
  },

  'makeup-match': {
    slug: 'makeup-match',
    canonicalName: 'Makeup Match',
    aliases: ['makeup matches'],
    shortDef:
      'A match played AFTER its scheduled week — usually because a team couldn\'t make the original date.',
    longDef: (
      <div className="space-y-3">
        <p>
          A makeup match is a{' '}
          <a href="#match" className="text-info hover:underline">match</a>{' '}
          played later than its originally scheduled week. Common reasons:
          a team couldn't field a{' '}
          <a href="#lineup" className="text-info hover:underline">lineup</a>{' '}
          on the scheduled date (illness, work conflict, venue
          unavailable), or the league granted a postponement.
        </p>
        <p>
          The match record is marked as a makeup so it's traceable, but
          it still counts toward the{' '}
          <a href="#season" className="text-info hover:underline">season</a>{' '}
          <a href="#standings" className="text-info hover:underline">standings</a>{' '}
          exactly like a normal-week match.
        </p>
        <p>
          Opposite of a{' '}
          <a href="#preplayed-match" className="text-info hover:underline">preplayed match</a>,
          which is played BEFORE its scheduled week.
        </p>
        <p className="text-sm text-muted-foreground">
          Relevant topics:{' '}
          <a href="#match" className="text-info hover:underline">match</a>,{' '}
          <a href="#preplayed-match" className="text-info hover:underline">preplayed match</a>,{' '}
          <a href="#lineup" className="text-info hover:underline">lineup</a>,{' '}
          <a href="#season" className="text-info hover:underline">season</a>,{' '}
          <a href="#standings" className="text-info hover:underline">standings</a>.
        </p>
      </div>
    ),
    l1_anchor: { path: 'docs/league-system/README.md' },
    related: ['schedule'],
  },

  'preplayed-match': {
    slug: 'preplayed-match',
    canonicalName: 'Preplayed Match',
    aliases: ['preplayed matches', 'pre-played match'],
    shortDef:
      'A match played BEFORE its scheduled week — usually because a team knows in advance they can\'t make the original date.',
    longDef: (
      <div className="space-y-3">
        <p>
          A preplayed match is a{' '}
          <a href="#match" className="text-info hover:underline">match</a>{' '}
          played earlier than its originally scheduled week. Common reasons:
          a team knows in advance they can't field a{' '}
          <a href="#lineup" className="text-info hover:underline">lineup</a>{' '}
          on the scheduled date (travel, planned absence) and chooses to
          play early instead.
        </p>
        <p>
          The match record is marked as preplayed so it's traceable, but
          it still counts toward the{' '}
          <a href="#season" className="text-info hover:underline">season</a>{' '}
          <a href="#standings" className="text-info hover:underline">standings</a>{' '}
          exactly like a normal-week match.
        </p>
        <p>
          Opposite of a{' '}
          <a href="#makeup-match" className="text-info hover:underline">makeup match</a>,
          which is played AFTER its scheduled week.
        </p>
        <p className="text-sm text-muted-foreground">
          Relevant topics:{' '}
          <a href="#match" className="text-info hover:underline">match</a>,{' '}
          <a href="#makeup-match" className="text-info hover:underline">makeup match</a>,{' '}
          <a href="#lineup" className="text-info hover:underline">lineup</a>,{' '}
          <a href="#season" className="text-info hover:underline">season</a>,{' '}
          <a href="#standings" className="text-info hover:underline">standings</a>.
        </p>
      </div>
    ),
    l1_anchor: { path: 'docs/league-system/README.md' },
    related: ['schedule'],
  },

  game: {
    slug: 'game',
    canonicalName: 'Game',
    aliases: [],
    shortDef:
      'A single rack between two players — the smallest unit of play. Also used as shorthand for the game-type a league plays (8-Ball, 9-Ball, 10-Ball).',
    longDef: (
      <div className="space-y-3">
        <p>
          A game is the smallest unit of play. One rack: balls racked,
          the{' '}
          <a href="#breaker" className="text-info hover:underline">breaker</a>{' '}
          breaks, players exchange shots until the rack is won. A{' '}
          <a href="#match" className="text-info hover:underline">match</a>{' '}
          contains many games — how many depends on the league's format.
        </p>
        <p>Game results feed several places:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <a href="#win-condition" className="text-info hover:underline">Win condition</a>{' '}
            — games are one of the metrics that can decide a match's
            outcome (points are the other).
          </li>
          <li>
            <a href="#points-calculator" className="text-info hover:underline">Points calculator</a>{' '}
            — games can drive how points accumulate.
          </li>
          <li>
            <a href="#achievements" className="text-info hover:underline">Achievements</a>{' '}
            — per-game feats the app keeps track of.
          </li>
        </ul>
        <p className="text-sm text-muted-foreground">
          <strong>A note on the word.</strong> "Game" is also used as
          shorthand for the{' '}
          <a href="#game-type" className="text-info hover:underline">game-type</a>{' '}
          the league plays (8-Ball, 9-Ball, 10-Ball). Context tells you
          which sense.
        </p>
        <p className="text-sm text-muted-foreground">
          Relevant topics:{' '}
          <a href="#match" className="text-info hover:underline">match</a>,{' '}
          <a href="#breaker" className="text-info hover:underline">breaker</a>,{' '}
          <a href="#game-type" className="text-info hover:underline">game type</a>,{' '}
          <a href="#win-condition" className="text-info hover:underline">win condition</a>,{' '}
          <a href="#points-calculator" className="text-info hover:underline">points calculator</a>,{' '}
          <a href="#achievements" className="text-info hover:underline">achievements</a>.
        </p>
      </div>
    ),
    l1_anchor: { path: 'docs/league-system/README.md' },
    related: ['racker'],
  },

  pairing: {
    slug: 'pairing',
    canonicalName: 'Pairing',
    aliases: [],
    shortDef:
      'A single player against a single opponent — the player-level unit in individual-race formats. Different from matchup, which is team-level.',
    longDef: (
      <div className="space-y-3">
        <p>
          Pairing is the player-level unit: a single player against a
          single opposing player. It applies specifically to
          individual-race formats — each player gets paired against one
          opponent and they play a race together (race to 7, race to 5,
          etc.). Whichever player gets there first wins the pairing.
        </p>
        <p>
          <strong>Don't confuse pairing with matchup.</strong> A{' '}
          <a href="#matchup" className="text-info hover:underline">matchup</a>{' '}
          is team-level — which teams play whom in a given week. A
          pairing is player-level — which player plays which other player,
          inside a{' '}
          <a href="#match" className="text-info hover:underline">match</a>.
          In round-robin formats, players don't have "pairings" in this
          sense — every player faces every opponent in a sequence of
          single racks.
        </p>
        <p className="text-sm text-muted-foreground">
          Relevant topics:{' '}
          <a href="#matchup" className="text-info hover:underline">matchup</a>,{' '}
          <a href="#match" className="text-info hover:underline">match</a>.
        </p>
      </div>
    ),
    l1_anchor: { path: 'docs/league-system/modules/match-format.md' },
    related: ['race-length-adjustment'],
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
      'The set of players from a team who actually play in a given match — chosen from the larger roster.',
    longDef: (
      <div className="space-y-3">
        <p>
          Before a{' '}
          <a href="#match" className="text-info hover:underline">match</a>{' '}
          begins, a{' '}
          <a href="#team" className="text-info hover:underline">team</a>{' '}
          picks which of their{' '}
          <a href="#roster" className="text-info hover:underline">roster</a>{' '}
          players will play. That's the lineup. The{' '}
          <a href="#lineup-size" className="text-info hover:underline">lineup size</a>{' '}
          is set at the league level. Anyone on the roster not in the
          lineup sits the match out.
        </p>
        <p className="text-sm text-muted-foreground">
          Relevant topics:{' '}
          <a href="#match" className="text-info hover:underline">match</a>,{' '}
          <a href="#team" className="text-info hover:underline">team</a>,{' '}
          <a href="#roster" className="text-info hover:underline">roster</a>,{' '}
          <a href="#lineup-size" className="text-info hover:underline">lineup size</a>.
        </p>
      </div>
    ),
    l1_anchor: { path: 'docs/league-system/modules/team-geometry.md' },
    related: ['captain', 'lineup-lock', 'substitute'],
  },

  'lineup-size': {
    slug: 'lineup-size',
    canonicalName: 'Lineup Size',
    aliases: [],
    shortDef:
      'Solely how many players from a team actually play in any given match.',
    longDef: (
      <div className="space-y-3">
        <p>
          How many players from a{' '}
          <a href="#team" className="text-info hover:underline">team</a>{' '}
          actually play in any given{' '}
          <a href="#match" className="text-info hover:underline">match</a>.
        </p>
        <p>
          The app uses lineup size as one of the inputs to figure out how
          many{' '}
          <a href="#game" className="text-info hover:underline">games</a>{' '}
          each match contains, and it's one of the values that defines
          the league's{' '}
          <a href="#match-format" className="text-info hover:underline">match format</a>.
        </p>
        <p className="text-sm text-muted-foreground">
          Relevant topics:{' '}
          <a href="#team" className="text-info hover:underline">team</a>,{' '}
          <a href="#match" className="text-info hover:underline">match</a>,{' '}
          <a href="#game" className="text-info hover:underline">game</a>,{' '}
          <a href="#match-format" className="text-info hover:underline">match format</a>.
        </p>
      </div>
    ),
    l1_anchor: { path: 'docs/league-system/modules/team-geometry.md' },
    related: ['lineup', 'roster-size'],
    reviewedByEd: '2026-05-30',
  },

  roster: {
    slug: 'roster',
    canonicalName: 'Roster',
    aliases: [],
    shortDef:
      "The full set of players signed up to a team. Must hold at least the lineup size and not exceed the roster size.",
    longDef: (
      <div className="space-y-3">
        <p>
          The roster is every player signed up to a{' '}
          <a href="#team" className="text-info hover:underline">team</a>.
          The{' '}
          <a href="#lineup" className="text-info hover:underline">lineup</a>{' '}
          for each{' '}
          <a href="#match" className="text-info hover:underline">match</a>{' '}
          is drawn from the roster.
        </p>
        <p>
          The{' '}
          <a href="#lineup-size" className="text-info hover:underline">lineup size</a>{' '}
          sets the floor (a roster has to hold at least that many) and the{' '}
          <a href="#roster-size" className="text-info hover:underline">roster size</a>{' '}
          sets the cap.
        </p>
        <p className="text-sm text-muted-foreground">
          Relevant topics:{' '}
          <a href="#team" className="text-info hover:underline">team</a>,{' '}
          <a href="#lineup" className="text-info hover:underline">lineup</a>,{' '}
          <a href="#match" className="text-info hover:underline">match</a>,{' '}
          <a href="#lineup-size" className="text-info hover:underline">lineup size</a>,{' '}
          <a href="#roster-size" className="text-info hover:underline">roster size</a>.
        </p>
      </div>
    ),
    l1_anchor: { path: 'docs/league-system/modules/team-geometry.md' },
    related: ['captain', 'placeholder-player', 'substitute'],
  },

  'roster-size': {
    slug: 'roster-size',
    canonicalName: 'Roster Size',
    aliases: [],
    shortDef:
      'Solely the maximum number of players a team is allowed to have on its roster.',
    longDef: (
      <div className="space-y-3">
        <p>
          Roster size is the maximum number of players that can join a single{' '}
          <a href="#team" className="text-info hover:underline">team</a>.
          Think of it as how deep the bench is — the list of players a{' '}
          <a href="#captain" className="text-info hover:underline">captain</a>{' '}
          can choose from when setting the{' '}
          <a href="#lineup" className="text-info hover:underline">lineup</a>{' '}
          for each{' '}
          <a href="#match" className="text-info hover:underline">match</a>.
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>Larger roster:</strong> a bigger pool to draw from. Someone
            missing a match becomes much less of a problem — somebody else on
            the{' '}
            <a href="#roster" className="text-info hover:underline">roster</a>{' '}
            steps in.
          </li>
          <li>
            <strong>Smaller roster:</strong> each player gets more playing
            time, but everyone has to show up more reliably.
          </li>
        </ul>
        <p className="text-sm text-muted-foreground">
          Relevant topics:{' '}
          <a href="#team" className="text-info hover:underline">team</a>,{' '}
          <a href="#roster" className="text-info hover:underline">roster</a>,{' '}
          <a href="#captain" className="text-info hover:underline">captain</a>,{' '}
          <a href="#lineup" className="text-info hover:underline">lineup</a>,{' '}
          <a href="#match" className="text-info hover:underline">match</a>.
        </p>
      </div>
    ),
    l1_anchor: { path: 'docs/league-system/modules/team-geometry.md' },
    related: ['lineup-size'],
    reviewedByEd: '2026-05-30',
    loSetting: 'live',
  },

  substitute: {
    slug: 'substitute',
    canonicalName: 'Substitute',
    aliases: ['sub'],
    shortDef:
      'A player who fills in for a missing team member. The app supports two patterns: anonymous subs and double duty.',
    longDef: (
      <div className="space-y-3">
        <p>
          A substitute is a player who fills in for a missing team
          member. The app supports two patterns:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <a href="#anonymous-sub" className="text-info hover:underline">Anonymous Sub</a>
          </li>
          <li>
            <a href="#double-duty" className="text-info hover:underline">Double Duty</a>
          </li>
        </ul>
        <p className="text-sm text-muted-foreground">
          Relevant topics:{' '}
          <a href="#anonymous-sub" className="text-info hover:underline">anonymous sub</a>,{' '}
          <a href="#double-duty" className="text-info hover:underline">double duty</a>.
        </p>
      </div>
    ),
    l1_anchor: { path: 'docs/league-system/modules/team-geometry.md' },
    related: ['roster', 'lineup'],
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
      "The team's representative to the league operator — handles team basics and speaks for the team on league matters.",
    longDef: (
      <div className="space-y-3">
        <p>
          A captain is the representative for a{' '}
          <a href="#team" className="text-info hover:underline">team</a>{' '}
          to the{' '}
          <a href="#league-operator" className="text-info hover:underline">league operator</a>.
          The app gives captains real control so they can run their team
          independently — and a couple of communication channels to make
          their league-side responsibilities easier.
        </p>
        <p><strong>What a captain can do:</strong></p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            Change the team's name (the{' '}
            <a href="#league-operator" className="text-info hover:underline">LO</a>{' '}
            can restrict this if needed).
          </li>
          <li>
            Add and remove{' '}
            <a href="#roster" className="text-info hover:underline">roster</a>{' '}
            players (the{' '}
            <a href="#league-operator" className="text-info hover:underline">LO</a>{' '}
            can restrict this too).
          </li>
        </ul>
        <p className="text-sm">
          Note: setting the{' '}
          <a href="#lineup" className="text-info hover:underline">lineup</a>{' '}
          for a{' '}
          <a href="#match" className="text-info hover:underline">match</a>{' '}
          isn't captain-only — anyone on the team can do it.
        </p>
        <p><strong>App-provided support for the role:</strong></p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>Team chat</strong> — every current member of the team,
            in one place for general communication. Day-to-day team issues
            are handled by the captain.
          </li>
          <li>
            <strong>Captains chat</strong> — every current captain in the
            league plus the{' '}
            <a href="#league-operator" className="text-info hover:underline">league operator</a>.
            A space for captains to coordinate scheduling and settle issues
            across teams without regular players piping in. The{' '}
            <a href="#league-operator" className="text-info hover:underline">LO</a>{' '}
            is in the room because most issues that surface here are ones
            they may need to weigh in on.
          </li>
        </ul>
        <p className="text-sm text-muted-foreground">
          Relevant topics:{' '}
          <a href="#team" className="text-info hover:underline">team</a>,{' '}
          <a href="#league-operator" className="text-info hover:underline">league operator</a>,{' '}
          <a href="#roster" className="text-info hover:underline">roster</a>,{' '}
          <a href="#lineup" className="text-info hover:underline">lineup</a>,{' '}
          <a href="#match" className="text-info hover:underline">match</a>.
        </p>
      </div>
    ),
    l1_anchor: { path: 'docs/league-system/README.md' },
    related: ['scorekeeper'],
    reviewedByEd: '2026-05-30',
  },

  'league-operator': {
    slug: 'league-operator',
    canonicalName: 'League Operator',
    aliases: ['LO', 'league op', 'operator'],
    shortDef:
      'Basically the CEO of an organization — runs the leagues, sets the format and house rules, collects the money, hands out prizes, settles disputes, everything.',
    longDef: (
      <div className="space-y-3">
        <p>
          The LO sets up an{' '}
          <a href="#organization" className="text-info hover:underline">organization</a>{' '}
          in this app that can hold as many{' '}
          <a href="#league" className="text-info hover:underline">leagues</a>{' '}
          as they want. They can appoint{' '}
          <a href="#staff" className="text-info hover:underline">staff</a>{' '}
          to help with the organization.
        </p>
        <p>
          Inside their organization the LO controls all of it: the{' '}
          <a href="#match-format" className="text-info hover:underline">format</a>{' '}
          each league uses, the team format, how much freedom{' '}
          <a href="#captain" className="text-info hover:underline">captains</a>{' '}
          get, the house rules, and the money coming in and going out.
          Complete control.
        </p>
        <p>
          The LO is also the final say on every dispute that escalates
          to their level — between captains, between players who get
          reported, between teams. The app gives them tools to make
          this easier, but the decisions are theirs.
        </p>
        <p><strong>Tools the app provides:</strong></p>
        <ul className="list-disc pl-5 space-y-1">
          <li><a href="#captains-chat" className="text-info hover:underline">Captains chat</a></li>
          <li><a href="#player-reports" className="text-info hover:underline">Player reports</a></li>
          <li><a href="#prize-calculator" className="text-info hover:underline">Prize calculator</a></li>
        </ul>
        <p className="text-sm">
          The LO's role as operator is separate from their participation.
          They might be a <a href="#captain" className="text-info hover:underline">captain</a>{' '}
          of one of their teams, a regular player on one, or not playing
          at all — the operator authority is the same either way.
        </p>
        <p className="text-sm text-muted-foreground">
          Relevant topics:{' '}
          <a href="#organization" className="text-info hover:underline">organization</a>,{' '}
          <a href="#league" className="text-info hover:underline">league</a>,{' '}
          <a href="#staff" className="text-info hover:underline">staff</a>,{' '}
          <a href="#match-format" className="text-info hover:underline">match format</a>,{' '}
          <a href="#captain" className="text-info hover:underline">captain</a>.
        </p>
      </div>
    ),
    l1_anchor: { path: 'docs/league-system/README.md' },
    related: ['scorekeeper'],
    reviewedByEd: '2026-05-30',
  },

  organization: {
    slug: 'organization',
    canonicalName: 'Organization',
    aliases: ['org'],
    shortDef:
      'The top-level container an LO operates under — the business, club, or group that holds the leagues together. One organization can run any number of leagues.',
    longDef: (
      <div className="space-y-3">
        <p>
          An organization is the umbrella the{' '}
          <a href="#league-operator" className="text-info hover:underline">league operator</a>{' '}
          runs leagues under — the business, club, or group that holds
          everything together. One organization can run any number of{' '}
          <a href="#league" className="text-info hover:underline">leagues</a>,
          each with its own seasons, teams, and rules.
        </p>
        <p>
          The organization is also the scope for{' '}
          <a href="#staff" className="text-info hover:underline">staff</a>{' '}
          — anyone appointed by the LO works at the org level and has
          visibility across the org's leagues.
        </p>
        <p>
          Think of the{' '}
          <a href="#league-operator" className="text-info hover:underline">LO</a>'s
          section of the app as the organization's office — its command
          center.
        </p>
        <p className="text-sm text-muted-foreground">
          Relevant topics:{' '}
          <a href="#league-operator" className="text-info hover:underline">league operator</a>,{' '}
          <a href="#league" className="text-info hover:underline">league</a>,{' '}
          <a href="#staff" className="text-info hover:underline">staff</a>.
        </p>
      </div>
    ),
    l1_anchor: { path: 'docs/league-system/README.md' },
    related: [],
    reviewedByEd: '2026-05-30',
  },

  staff: {
    slug: 'staff',
    canonicalName: 'Staff',
    aliases: ['org staff', 'league staff'],
    shortDef:
      "People the LO appoints to help run the organization. A staff member currently has almost LO-level authority, with a few specific limitations.",
    longDef: (
      <div className="space-y-3">
        <p>
          Staff are the{' '}
          <a href="#league-operator" className="text-info hover:underline">league operator's</a>{' '}
          appointed helpers — anyone given access to the{' '}
          <a href="#organization" className="text-info hover:underline">organization</a>{' '}
          beyond a regular player. Right now a staff member has almost
          the same authority as the LO, with a few specific exceptions.
        </p>
        <p><strong>Staff can be temporary.</strong></p>
        <p>
          Common use case: an LO needs help figuring out a setup or a
          setting. They appoint a temporary helper — either the
          rackem-leagues team or an experienced LO friend — who steps
          in to make the adjustments and then "leaves the organization"
          when done. No long-term commitment.
        </p>
        <p className="text-sm text-muted-foreground">
          Relevant topics:{' '}
          <a href="#league-operator" className="text-info hover:underline">league operator</a>,{' '}
          <a href="#organization" className="text-info hover:underline">organization</a>.
        </p>
      </div>
    ),
    l1_anchor: { path: 'docs/league-system/README.md' },
    related: [],
    reviewedByEd: '2026-05-30',
  },

  'captains-chat': {
    slug: 'captains-chat',
    canonicalName: 'Captains Chat',
    aliases: ['captain chat'],
    shortDef:
      "An in-app group chat created each season for every team's captain in the league plus the league staff.",
    longDef: (
      <div className="space-y-3">
        <p>
          The captains chat is an in-app group chat where every team's{' '}
          <a href="#captain" className="text-info hover:underline">captain</a>{' '}
          in a{' '}
          <a href="#league" className="text-info hover:underline">league</a>{' '}
          can coordinate scheduling, resolve disputes, and communicate
          with each other and with the league{' '}
          <a href="#staff" className="text-info hover:underline">staff</a>{' '}
          (including the{' '}
          <a href="#league-operator" className="text-info hover:underline">league operator</a>)
          — without player interference.
        </p>
        <p>
          It's created automatically when the LO activates a new{' '}
          <a href="#season" className="text-info hover:underline">season</a>,
          and the membership keeps itself up to date — if the LO changes
          who a team's captain is during the season, the chat updates
          automatically too.
        </p>
        <p className="text-sm text-muted-foreground">
          Relevant topics:{' '}
          <a href="#captain" className="text-info hover:underline">captain</a>,{' '}
          <a href="#league" className="text-info hover:underline">league</a>,{' '}
          <a href="#staff" className="text-info hover:underline">staff</a>,{' '}
          <a href="#league-operator" className="text-info hover:underline">league operator</a>,{' '}
          <a href="#season" className="text-info hover:underline">season</a>.
        </p>
      </div>
    ),
    l1_anchor: { path: 'docs/league-system/README.md' },
    related: ['team-chat'],
    reviewedByEd: '2026-05-30',
  },

  achievements: {
    slug: 'achievements',
    canonicalName: 'Achievements',
    aliases: ['feats', 'feats of excellence'],
    shortDef:
      'Per-game feats the app tracks over time — break-and-runs, golden breaks, and other notable events.',
    longDef: (
      <div className="space-y-3">
        <p>
          Achievements are noteworthy events the app records as they
          happen during{' '}
          <a href="#game" className="text-info hover:underline">games</a>.
          They show up on player profiles and team stats over time.
        </p>
        <p>
          Each achievement gets its own entry because pool has many
          different names for the same feat. Centralizing the def keeps
          everyone on the same page no matter which term they came in
          with.
        </p>
        <p><strong>Tracked achievements:</strong></p>
        <ul className="list-disc pl-5 space-y-1">
          <li><a href="#break-and-run" className="text-info hover:underline">Break and run</a></li>
          <li><a href="#golden-break" className="text-info hover:underline">Golden break</a></li>
        </ul>
        <p className="text-sm text-muted-foreground">
          Relevant topics:{' '}
          <a href="#game" className="text-info hover:underline">game</a>,{' '}
          <a href="#break-and-run" className="text-info hover:underline">break and run</a>,{' '}
          <a href="#golden-break" className="text-info hover:underline">golden break</a>.
        </p>
      </div>
    ),
    l1_anchor: { path: 'docs/league-system/README.md' },
    related: ['game-type'],
  },

  'break-and-run': {
    slug: 'break-and-run',
    canonicalName: 'Break and Run',
    aliases: ['table run', 'runout', 'run-out', 'run the table'],
    shortDef:
      'Running the table from the break — sinking every ball without missing or losing your turn.',
    longDef: (
      <p>
        A break and run is when a player breaks, sinks at least one ball,
        and proceeds to clear the rest of their balls and the winning ball
        without ever losing their turn. The same feat goes by several
        names: table run, runout, run-out, or just "running the table."
      </p>
    ),
    l1_anchor: { path: 'docs/league-system/README.md' },
    related: ['game', 'achievements'],
  },

  'golden-break': {
    slug: 'golden-break',
    canonicalName: 'Golden Break',
    aliases: ['9 on the break', '9 on the snap', 'snap-9', '8 on the break', '8 on the snap', '8-ball break', 'snap-8'],
    shortDef:
      'Sinking the winning ball on the break. Officially recognized only for the 9 in 9-Ball.',
    longDef: (
      <div className="space-y-3">
        <p>
          A golden break is when the winning ball drops on the break shot
          itself. By the official rules of the sport, that's the 9 in{' '}
          <a href="#nine-ball" className="text-info hover:underline">9-Ball</a>{' '}
          only — a legal break that sinks the 9 ends the rack as a win.
        </p>
        <p>
          <strong>About "8 on the break."</strong> In{' '}
          <a href="#eight-ball" className="text-info hover:underline">8-Ball</a>,
          sinking the 8 on the break isn't a uniform win — most official
          rule sets treat it as a re-rack, the opponent's choice, or even
          a loss. People call it a golden break colloquially ("8 on the
          break," "snap-8"), but the sport doesn't officially count it
          as one. Those terms still land here so searches resolve.
        </p>
        <p className="text-sm text-muted-foreground">
          Relevant topics:{' '}
          <a href="#nine-ball" className="text-info hover:underline">9-Ball</a>,{' '}
          <a href="#eight-ball" className="text-info hover:underline">8-Ball</a>,{' '}
          <a href="#game" className="text-info hover:underline">game</a>,{' '}
          <a href="#achievements" className="text-info hover:underline">achievements</a>.
        </p>
      </div>
    ),
    l1_anchor: { path: 'docs/league-system/README.md' },
    related: [],
  },

  'placeholder-player': {
    slug: 'placeholder-player',
    canonicalName: 'Placeholder Player',
    aliases: ['placeholder', 'placeholder players'],
    shortDef:
      "A stand-in for a real player who hasn't registered for the app yet. Plays and accumulates stats normally, then hands them off when the real person registers.",
    longDef: (
      <div className="space-y-3">
        <p>
          A placeholder player is a representation of an actual person
          who's on the{' '}
          <a href="#team" className="text-info hover:underline">team</a>{' '}
          but hasn't registered an account on the app yet. The{' '}
          <a href="#captain" className="text-info hover:underline">captain</a>{' '}
          creates the placeholder by name, and from there it behaves
          like any other{' '}
          <a href="#roster" className="text-info hover:underline">roster</a>{' '}
          player.
        </p>
        <p>
          The placeholder can be played in{' '}
          <a href="#match" className="text-info hover:underline">matches</a>,
          gets their full play history recorded, and their results count
          exactly like a registered player's would — handicap, standings,
          stats, everything.
        </p>
        <p>
          When the real person finally registers on the app, the
          placeholder's accumulated history can (and should) be transferred
          onto their new registered account. Basically: the app creates a
          fake "Bob" until the real Bob shows up and takes over.
        </p>
        <p className="text-sm text-muted-foreground">
          Relevant topics:{' '}
          <a href="#captain" className="text-info hover:underline">captain</a>,{' '}
          <a href="#team" className="text-info hover:underline">team</a>,{' '}
          <a href="#roster" className="text-info hover:underline">roster</a>,{' '}
          <a href="#match" className="text-info hover:underline">match</a>.
        </p>
      </div>
    ),
    l1_anchor: { path: 'docs/league-system/README.md' },
    related: [],
    reviewedByEd: '2026-05-30',
  },

  'team-chat': {
    slug: 'team-chat',
    canonicalName: 'Team Chat',
    aliases: [],
    shortDef:
      'An in-app group chat for every current member of a single team — created when their season activates.',
    longDef: (
      <div className="space-y-3">
        <p>
          The team chat is an in-app group chat that includes every current
          member of one{' '}
          <a href="#team" className="text-info hover:underline">team</a>.
          It's where the team coordinates: scheduling,{' '}
          <a href="#lineup" className="text-info hover:underline">lineup</a>{' '}
          talk, strategy, updates for players not in attendance, and
          anything else that comes up.
        </p>
        <p>
          It's created automatically when the LO activates a{' '}
          <a href="#season" className="text-info hover:underline">season</a>,
          and the membership auto-updates as the team's{' '}
          <a href="#roster" className="text-info hover:underline">roster</a>{' '}
          changes or the{' '}
          <a href="#captain" className="text-info hover:underline">captain</a>{' '}
          changes.
        </p>
        <p className="text-sm text-muted-foreground">
          Relevant topics:{' '}
          <a href="#team" className="text-info hover:underline">team</a>,{' '}
          <a href="#lineup" className="text-info hover:underline">lineup</a>,{' '}
          <a href="#season" className="text-info hover:underline">season</a>,{' '}
          <a href="#roster" className="text-info hover:underline">roster</a>,{' '}
          <a href="#captain" className="text-info hover:underline">captain</a>.
        </p>
      </div>
    ),
    l1_anchor: { path: 'docs/league-system/README.md' },
    related: ['captains-chat'],
    reviewedByEd: '2026-05-30',
  },

  'player-reports': {
    slug: 'player-reports',
    canonicalName: 'Player Reports',
    aliases: ['report', 'reports', 'reporting'],
    shortDef:
      'A way for any player to flag a problem to the league operator for review.',
    longDef: (
      <p>
        Any player can submit a report about another player, an incident,
        or anything else the{' '}
        <a href="#league-operator" className="text-info hover:underline">league operator</a>{' '}
        should know about. The LO is the one who decides what to do with
        each report.
      </p>
    ),
    l1_anchor: { path: 'docs/league-system/README.md' },
    related: [],
  },

  'prize-calculator': {
    slug: 'prize-calculator',
    canonicalName: 'Prize Calculator',
    aliases: ['prize calc'],
    shortDef:
      'A tool that helps the league operator work out money in (from teams) and prize splits at season end. Currently in progress.',
    longDef: (
      <p>
        The prize calculator helps the{' '}
        <a href="#league-operator" className="text-info hover:underline">league operator</a>{' '}
        handle the money side of running a league — total fees collected,
        prize pool breakdown, payout splits. The calculator is partially
        built; basics are in place.
      </p>
    ),
    l1_anchor: { path: 'docs/league-system/README.md' },
    related: [],
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
      'The moment a team finalizes their lineup before a match — after which players can no longer be swapped.',
    longDef: (
      <p>
        Lineup lock is the point of no return for the{' '}
        <a href="#lineup" className="text-info hover:underline">lineup</a>.
        Before lock, players can be swapped in and out. After lock, the
        lineup is committed and the match can begin. It's also typically
        when any manual handicap thresholds get entered, for leagues
        that don't use a calibrated chart.
      </p>
    ),
    l1_anchor: { path: 'docs/league-system/modules/team-geometry.md' },
    related: ['lineup', 'manual-entry'],
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
          falls on a Tuesday. If you want a different day, you create a
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
