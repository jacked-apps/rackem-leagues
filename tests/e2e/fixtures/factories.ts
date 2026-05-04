/**
 * @fileoverview Test data factories for E2E specs.
 *
 * Reusable helpers that build test data inside the E2E foundation
 * (Org / venue / users seeded by database/e2e_seed.sql). Each factory
 * returns the row it created (or composite return for createMatchReady-
 * ForLineup). Specs compose them to reach the state they want to test.
 *
 * Usage in a spec:
 *
 *   import { createMatchReadyForLineup } from './fixtures/factories';
 *
 *   const { match, homeTeam, awayTeam } = await createMatchReadyForLineup({
 *     homeCaptain: 'captain-1',
 *     awayCaptain: 'captain-2',
 *   });
 *   await page.goto(`/match/${match.id}/lineup`);
 *
 * RLS: factories use a service-role client (bypass). They are setup-
 * primitives, not behavior-under-test. Tests that exercise user-as-
 * actor permissions drive the UI as the authenticated user.
 *
 * Cleanup: factories do NOT clean up. Throwaway leagues accumulate under
 * the foundation org until `pnpm e2e:setup` runs, which deletes every
 * league owned by the foundation org (see database/e2e_seed.sql).
 */

import { getServiceClient } from './serviceClient';
import { E2E_ORG_ID, E2E_VENUE_ID, E2E_USERS, type UserKey } from './users';

/** Unique-name suffix so concurrent test workers don't collide. */
function uniqueName(prefix: string): string {
  const ts = new Date().toISOString().replace(/[-T:.Z]/g, '').slice(0, 14);
  const suffix = Math.random().toString(36).slice(2, 7);
  return `${prefix}-${ts}-${suffix}`;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export interface CreateLeagueOpts {
  division?: string;
  teamFormat?: '5_man' | '8_man';
  lineupSize?: number;
  maxRosterSize?: number;
  gameGeneration?: string;
  handicapType?: string;
  gameType?: string;
  dayOfWeek?: string;
}

export async function createLeague(opts: CreateLeagueOpts = {}) {
  const supabase = getServiceClient();
  const division = opts.division ?? uniqueName('e2e');
  const teamFormat = opts.teamFormat ?? '8_man';
  const lineupSize = opts.lineupSize ?? 5;
  const maxRosterSize = opts.maxRosterSize ?? 8;
  const gameGeneration = opts.gameGeneration ?? 'single_round_robin';
  const handicapType = opts.handicapType ?? 'none';

  const { data: league, error } = await supabase
    .from('leagues')
    .insert({
      organization_id: E2E_ORG_ID,
      game_type: opts.gameType ?? 'eight_ball',
      day_of_week: opts.dayOfWeek ?? 'tuesday',
      division,
      team_format: teamFormat,
      league_start_date: today(),
      status: 'active',
    })
    .select()
    .single();
  if (error) throw new Error(`createLeague failed: ${error.message}`);

  // The trigger_create_league_preferences trigger created an empty
  // preferences row on insert. Upsert the modular fields onto it.
  const { error: prefsError } = await supabase.from('preferences').upsert(
    {
      entity_type: 'league',
      entity_id: league.id,
      lineup_size: lineupSize,
      max_roster_size: maxRosterSize,
      game_generation: gameGeneration,
      handicap_type: handicapType,
      team_format: teamFormat,
    },
    { onConflict: 'entity_type,entity_id' }
  );
  if (prefsError) throw new Error(`createLeague (preferences upsert) failed: ${prefsError.message}`);

  // Link the foundation venue to this league.
  await supabase.from('league_venues').insert({ league_id: league.id, venue_id: E2E_VENUE_ID });

  return league;
}

export interface CreateSeasonOpts {
  weeks?: number;
  startDate?: string;
  name?: string;
}

export async function createSeason(leagueId: string, opts: CreateSeasonOpts = {}) {
  const supabase = getServiceClient();
  const weeks = opts.weeks ?? 12;
  const startDate = opts.startDate ?? today();
  const endDate = addDays(startDate, weeks * 7);

  const { data: season, error } = await supabase
    .from('seasons')
    .insert({
      league_id: leagueId,
      season_name: opts.name ?? uniqueName('e2e-season'),
      start_date: startDate,
      end_date: endDate,
      season_length: weeks,
      status: 'active',
    })
    .select()
    .single();
  if (error) throw new Error(`createSeason failed: ${error.message}`);

  const weekRows = [];
  for (let i = 0; i < weeks; i += 1) {
    weekRows.push({
      season_id: season.id,
      scheduled_date: addDays(startDate, i * 7),
      week_name: `Week ${i + 1}`,
      week_type: 'regular',
    });
  }
  const { data: weekData, error: weeksError } = await supabase
    .from('season_weeks')
    .insert(weekRows)
    .select();
  if (weeksError) throw new Error(`createSeason (weeks) failed: ${weeksError.message}`);

  return { ...season, weeks: weekData };
}

export interface CreateTeamOpts {
  name?: string;
  rosterSize?: number;
}

export async function createTeam(
  leagueId: string,
  seasonId: string,
  captainKey: UserKey,
  opts: CreateTeamOpts = {}
) {
  const supabase = getServiceClient();
  const captainMemberId = E2E_USERS[captainKey].memberId;

  const { data: team, error } = await supabase
    .from('teams')
    .insert({
      season_id: seasonId,
      league_id: leagueId,
      captain_id: captainMemberId,
      home_venue_id: E2E_VENUE_ID,
      team_name: opts.name ?? uniqueName('e2e-team'),
      roster_size: opts.rosterSize ?? 5,
      status: 'active',
    })
    .select()
    .single();
  if (error) throw new Error(`createTeam failed: ${error.message}`);

  // Add captain to team_players. Tests that need more roster members
  // can insert additional team_players rows themselves.
  const { error: tpError } = await supabase.from('team_players').insert({
    team_id: team.id,
    season_id: seasonId,
    member_id: captainMemberId,
    is_captain: true,
    status: 'active',
  });
  if (tpError) throw new Error(`createTeam (team_players) failed: ${tpError.message}`);

  return team;
}

export async function createMatch(
  seasonId: string,
  seasonWeekId: string,
  homeTeamId: string,
  awayTeamId: string,
  opts: { matchNumber?: number } = {}
) {
  const supabase = getServiceClient();
  const { data: match, error } = await supabase
    .from('matches')
    .insert({
      season_id: seasonId,
      season_week_id: seasonWeekId,
      home_team_id: homeTeamId,
      away_team_id: awayTeamId,
      scheduled_venue_id: E2E_VENUE_ID,
      match_number: opts.matchNumber ?? 1,
      status: 'scheduled',
    })
    .select()
    .single();
  if (error) throw new Error(`createMatch failed: ${error.message}`);
  // The trigger_auto_create_match_lineups trigger has now created the
  // two match_lineups rows automatically. Don't insert them manually.
  return match;
}

/**
 * Mark a match as completed with a winner. Used by the team-drop tests
 * to set up "this team has played matches" state so the dialog flow
 * exercises the has-results branch.
 */
export async function markMatchCompleted(matchId: string, winnerTeamId: string) {
  const supabase = getServiceClient();
  const { error } = await supabase
    .from('matches')
    .update({
      status: 'completed',
      winner_team_id: winnerTeamId,
      home_points_earned: 2.0,
      away_points_earned: 0,
      completed_at: new Date().toISOString(),
    })
    .eq('id', matchId);
  if (error) throw new Error(`markMatchCompleted failed: ${error.message}`);
}

/**
 * Force a match's season_week to a past date so it counts as "past-due"
 * for the forfeit_past_bye_matches helper. The helper's predicate is
 * `season_weeks.scheduled_date < CURRENT_DATE`, so we set it to
 * yesterday.
 */
export async function backdateSeasonWeek(seasonWeekId: string, daysAgo = 1) {
  const supabase = getServiceClient();
  const past = new Date();
  past.setUTCDate(past.getUTCDate() - daysAgo);
  const { error } = await supabase
    .from('season_weeks')
    .update({ scheduled_date: past.toISOString().slice(0, 10) })
    .eq('id', seasonWeekId);
  if (error) throw new Error(`backdateSeasonWeek failed: ${error.message}`);
}

export interface CreateMatchReadyForLineupOpts {
  homeCaptain: UserKey;
  awayCaptain: UserKey;
  leagueOpts?: CreateLeagueOpts;
}

/**
 * Composite shortcut: builds a complete league + season + 2 teams + 1 match,
 * with both `match_lineups` rows auto-created (locked=false, no slots filled).
 * Returns the chain so specs can navigate to the match's lineup page and
 * drive the UI from there.
 */
export async function createMatchReadyForLineup(opts: CreateMatchReadyForLineupOpts) {
  const league = await createLeague(opts.leagueOpts);
  const season = await createSeason(league.id);
  const homeTeam = await createTeam(league.id, season.id, opts.homeCaptain);
  const awayTeam = await createTeam(league.id, season.id, opts.awayCaptain);
  const match = await createMatch(season.id, season.weeks[0].id, homeTeam.id, awayTeam.id);
  return { league, season, homeTeam, awayTeam, match };
}
