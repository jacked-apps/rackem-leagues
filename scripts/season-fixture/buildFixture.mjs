/**
 * @fileoverview Turn raw production rows for one completed season into the
 * season-replay fixture — keeping ONLY what scoring needs, with no names,
 * real ids or dates. Pure: no I/O (the fetch lives in
 * scripts/fetch-season-fixture.mjs).
 *
 * The repo is PUBLIC, so this is an allow-list, never a block-list: a field
 * is copied only if it's named here, so a column added to production later
 * can't leak in by default.
 *
 * What's kept, and why:
 *   - teams → "Team A", "Team B"… (stable by first appearance)
 *   - weeks → a number (1 = first week), never a date
 *   - lineups → per-slot handicaps + the frozen team modifier (no player ids:
 *     scoring never reads them)
 *   - games → which SIDE won, positions, tiebreaker flag, values, and whether
 *     each side confirmed (true/false, never who)
 *   - the scoring settings from system_snapshot (no ids, no timestamp)
 *   - the stored targets, games won, points and result — the answer key
 *
 * @see docs/plans/2026-11-17-001-feat-trustworthy-tests-plan.md (U3)
 */

/** Snapshot keys that carry scoring settings and no identifying data. */
export const SNAPSHOT_KEYS = [
  'mechanism', 'handicap_type', 'lineup_size', 'win_condition', 'points_calculator',
  'points_calculator_params', 'per_game_allocator', 'tiebreaker_trigger',
  'tiebreaker_format', 'game_generation', 'pairing_format', 'race_length', 'overrides',
];

const pick = (row, keys) => Object.fromEntries(keys.filter((k) => k in row).map((k) => [k, row[k]]));
const letter = (i) => `Team ${String.fromCharCode(65 + i)}`;

/**
 * @param {object} raw
 * @param {object[]} raw.matches - completed `matches` rows of the season
 * @param {object[]} raw.weeks - the season's `season_weeks` rows
 * @param {object[]} raw.teams - `teams` rows with `id` + `status`
 * @param {object[]} raw.lineups - `match_lineups` rows for those matches
 * @param {object[]} raw.games - `match_games` rows for those matches
 * @returns {{ matches: object[], skipped: { byes: number } }}
 */
export function buildFixture({ matches, weeks, teams, lineups, games }) {
  const weekNumber = new Map(
    [...weeks].sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date)).map((w, i) => [w.id, { n: i + 1, type: w.week_type }]),
  );
  const byeTeams = new Set(teams.filter((t) => t.status === 'bye').map((t) => t.id));
  const played = matches
    .filter((m) => !byeTeams.has(m.home_team_id) && !byeTeams.has(m.away_team_id))
    .sort((a, b) => weekNumber.get(a.season_week_id).n - weekNumber.get(b.season_week_id).n || a.match_number - b.match_number);

  const teamName = new Map();
  const nameOf = (id) => {
    if (!teamName.has(id)) teamName.set(id, letter(teamName.size));
    return teamName.get(id);
  };
  // Mirrors computeEngineRunningTotals: the LOCKED lineup row for each team.
  const lockedLineup = (matchId, teamId) =>
    lineups.filter((l) => l.match_id === matchId && l.team_id === teamId && l.locked);
  const sideOf = (m, teamId) => (teamId === m.home_team_id ? 'home' : teamId === m.away_team_id ? 'away' : null);

  const out = played.map((m) => {
    const week = weekNumber.get(m.season_week_id);
    const side = (teamId) => {
      const rows = lockedLineup(m.id, teamId);
      return {
        lockedRows: rows.length,
        handicaps: rows[0] ? [1, 2, 3, 4, 5].map((n) => rows[0][`player${n}_handicap`]) : null,
        home_team_modifier: rows[0]?.home_team_modifier ?? null,
      };
    };
    return {
      key: `W${String(week.n).padStart(2, '0')}-M${m.match_number}`,
      week: week.n,
      weekType: week.type,
      home: nameOf(m.home_team_id),
      away: nameOf(m.away_team_id),
      snapshot: m.system_snapshot ? pick(m.system_snapshot, SNAPSHOT_KEYS) : null,
      usesThresholdChart: Boolean(m.system_snapshot?.threshold_chart_id),
      stored: {
        ...pick(m, ['home_to_win', 'home_to_tie', 'home_to_lose', 'away_to_win', 'away_to_tie', 'away_to_lose',
          'home_games_won', 'away_games_won', 'home_points_earned', 'away_points_earned', 'match_result']),
        winner: m.winner_team_id ? sideOf(m, m.winner_team_id) : null,
      },
      lineups: { home: side(m.home_team_id), away: side(m.away_team_id) },
      games: games
        .filter((g) => g.match_id === m.id)
        .sort((a, b) => a.game_number - b.game_number)
        .map((g) => ({
          n: g.game_number,
          winner: g.winner_team_id ? sideOf(m, g.winner_team_id) : null,
          ...pick(g, ['home_position', 'away_position', 'is_tiebreaker', 'winner_value', 'loser_value', 'win_by_forfeit']),
          confirmed_home: Boolean(g.confirmed_by_home),
          confirmed_away: Boolean(g.confirmed_by_away),
        })),
    };
  });
  return { matches: out, skipped: { byes: matches.length - played.length } };
}
