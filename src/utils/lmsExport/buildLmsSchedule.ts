/**
 * @fileoverview Build an LMS-shaped schedule export from our season schedule.
 *
 * CSI/FargoRate LMS imports a schedule as a week-by-week grid of matchups
 * written `AWAY @ HOME` using TEAM NUMBERS, and it numbers teams ALPHABETICALLY
 * (confirmed from LMS's "View Statistics" screen, which lists teams A→Z and
 * models the bye as a real "Bye Team"). This module turns our `WeekSchedule[]`
 * into that shape:
 *   - teams numbered 1..N by case-insensitive alphabetical name (bye included,
 *     normalized to "Bye Team" so it sorts/labels exactly like LMS),
 *   - one row per PLAY week (regular weeks with real matchups; blackout / break /
 *     playoff-TBD weeks are skipped), each cell `awayNumber @ homeNumber`,
 *   - a per-team stats block (home/away counts + opponent frequency) that mirrors
 *     LMS's "View Statistics" so the operator can verify the import landed.
 *
 * Pure + DOM-free so it's unit-testable; the CSV/serialization + download live
 * separately (`lmsScheduleToCsv.ts`, `src/utils/download.ts`).
 */

/**
 * Minimal structural input — just the fields the export reads. Deliberately NOT
 * tied to a specific `WeekSchedule` type (the codebase has two slightly
 * different ones); any schedule shape with these fields works.
 */
export interface LmsSourceTeam {
  id: string;
  team_name: string;
  status: string;
}
export interface LmsSourceMatch {
  match_number: number;
  home_team?: LmsSourceTeam | null;
  away_team?: LmsSourceTeam | null;
}
export interface LmsSourceWeek {
  week: { week_type: string; week_name: string; scheduled_date: string };
  matches: LmsSourceMatch[];
}

/** A team as LMS sees it: an alphabetical number + display name. */
export interface LmsNumberedTeam {
  number: number;
  teamId: string;
  name: string;
  isBye: boolean;
}

/** One play week: `cells` are `away @ home` by number, in match order. */
export interface LmsWeekRow {
  weekNumber: number;
  weekName: string;
  date: string;
  cells: string[];
}

/** Per-team verification stats, mirroring LMS's "View Statistics". */
export interface LmsTeamStat {
  number: number;
  name: string;
  home: number;
  away: number;
  opponents: { name: string; count: number }[];
}

export interface LmsScheduleExport {
  teams: LmsNumberedTeam[];
  weeks: LmsWeekRow[];
  stats: LmsTeamStat[];
}

/** LMS labels the bye "Bye Team"; match that so numbering + display align. */
function displayName(team: LmsSourceTeam): string {
  return team.status === 'bye' ? 'Bye Team' : team.team_name;
}

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.toLowerCase().localeCompare(b.name.toLowerCase());

/**
 * Convert a season's schedule into the LMS export shape.
 *
 * @param schedule - Weeks with their matches (from `getSeasonSchedule`).
 * @returns Numbered teams, the play-week grid, and verification stats.
 */
export function buildLmsSchedule(schedule: LmsSourceWeek[]): LmsScheduleExport {
  // Only regular weeks carry round-robin matchups; within them, only matches
  // with BOTH teams present (a NULL side is a legacy bye or playoff TBD — not a
  // real matchup to import).
  const regularWeeks = schedule.filter((w) => w.week.week_type === 'regular');
  const realMatches = (matches: LmsSourceMatch[]) =>
    matches
      .filter((m) => m.home_team && m.away_team)
      .sort((a, b) => a.match_number - b.match_number);

  // 1. Collect distinct teams, number them alphabetically (bye included).
  const teamNames = new Map<string, { name: string; isBye: boolean }>();
  for (const { matches } of regularWeeks) {
    for (const m of realMatches(matches)) {
      for (const t of [m.home_team!, m.away_team!]) {
        teamNames.set(t.id, { name: displayName(t), isBye: t.status === 'bye' });
      }
    }
  }
  const teams: LmsNumberedTeam[] = [...teamNames.entries()]
    .map(([teamId, v]) => ({ teamId, ...v }))
    .sort(byName)
    .map((t, i) => ({ number: i + 1, ...t }));
  const numberOf = new Map(teams.map((t) => [t.teamId, t.number]));

  // 2. Build the play-week grid (`away @ home`), numbering only weeks that have
  //    real matchups so the week numbers run 1..N like LMS's.
  const weeks: LmsWeekRow[] = [];
  for (const { week, matches } of regularWeeks) {
    const real = realMatches(matches);
    if (real.length === 0) continue;
    weeks.push({
      weekNumber: weeks.length + 1,
      weekName: week.week_name,
      date: week.scheduled_date,
      cells: real.map((m) => `${numberOf.get(m.away_team!.id)} @ ${numberOf.get(m.home_team!.id)}`),
    });
  }

  // 3. Per-team stats: home/away counts + how often each pair meets.
  const acc = new Map(teams.map((t) => [t.teamId, { home: 0, away: 0, opp: new Map<string, number>() }]));
  for (const { matches } of regularWeeks) {
    for (const m of realMatches(matches)) {
      const home = acc.get(m.home_team!.id)!;
      const away = acc.get(m.away_team!.id)!;
      home.home += 1;
      away.away += 1;
      const homeName = displayName(m.home_team!);
      const awayName = displayName(m.away_team!);
      home.opp.set(awayName, (home.opp.get(awayName) ?? 0) + 1);
      away.opp.set(homeName, (away.opp.get(homeName) ?? 0) + 1);
    }
  }
  const stats: LmsTeamStat[] = teams.map((t) => {
    const a = acc.get(t.teamId)!;
    return {
      number: t.number,
      name: t.name,
      home: a.home,
      away: a.away,
      opponents: [...a.opp.entries()].map(([name, count]) => ({ name, count })).sort(byName),
    };
  });

  return { teams, weeks, stats };
}
