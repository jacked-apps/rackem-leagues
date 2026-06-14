-- ============================================================================
-- drop_team_mid_season: remove a team that has already played, replacing its
-- FUTURE slot with a fresh BYE — atomically.
-- ============================================================================
--
-- Pre-season, a dropping team can be repurposed in place as the BYE
-- (convertTeamToBye) because it has no history. Mid-season it does: its past
-- played matches have real results and must stay. So instead:
--   1. WITHDRAW the dropping team (status='withdrawn') — its row + past results
--      stay intact for history; it's just out of active standings going forward.
--   2. Create a fresh BYE team for the season.
--   3. Rewire every UNPLAYED match the dropped team had (status='scheduled', no
--      winner) onto the new BYE — its future opponents now play the BYE, and the
--      auto-forfeit sweep settles those as forfeits.
--
-- This is several cross-table writes (create bye, rewire home + away + lineups,
-- withdraw), so it runs as ONE transaction — a partial drop (bye created but
-- matches not rewired, etc.) is impossible.
--
-- Guarded: the team must be active, and the season must not already hold a BYE
-- (the even-count case; an odd league that already has a BYE is a separate edge).
-- Forfeit SCORING of the resulting BYE matches is handled by sweep_auto_forfeits.
-- ============================================================================

create or replace function drop_team_mid_season(
  p_team_id   uuid,
  p_season_id uuid
)
returns uuid -- the new BYE team's id
language plpgsql
security definer
as $$
declare
  v_league_id   uuid;
  v_roster_size integer;
  v_status      text;
  v_bye_id      uuid;
begin
  -- Guard 1: the team exists and is active.
  select league_id, roster_size, status
    into v_league_id, v_roster_size, v_status
  from teams
  where id = p_team_id;

  if v_status is null then
    raise exception 'Team not found';
  end if;
  if v_status <> 'active' then
    raise exception 'Only an active team can be dropped (status: %)', v_status;
  end if;

  -- Guard 2: at most one BYE per season.
  if exists (select 1 from teams where season_id = p_season_id and status = 'bye') then
    raise exception 'This season already has a BYE — odd-league mid-season drop is a separate case';
  end if;

  -- Create the replacement BYE (mirrors createByeTeam's shape).
  insert into teams (season_id, league_id, captain_id, team_name, roster_size, status, home_venue_id)
  values (p_season_id, v_league_id, null, 'BYE', v_roster_size, 'bye', null)
  returning id into v_bye_id;

  -- Rewire the dropped team's UNPLAYED-match lineup rows onto the BYE FIRST,
  -- while the matches still reference the dropped team.
  update match_lineups ml
    set team_id = v_bye_id
  where ml.team_id = p_team_id
    and ml.match_id in (
      select m.id from matches m
      where m.status = 'scheduled'
        and m.winner_team_id is null
        and (m.home_team_id = p_team_id or m.away_team_id = p_team_id)
    );

  -- Rewire the unplayed matches themselves (home + away) onto the BYE. Played
  -- matches (a winner, or any non-scheduled status) are left untouched — the
  -- dropped team keeps its history there.
  update matches
    set home_team_id = v_bye_id
  where home_team_id = p_team_id
    and status = 'scheduled'
    and winner_team_id is null;

  update matches
    set away_team_id = v_bye_id
  where away_team_id = p_team_id
    and status = 'scheduled'
    and winner_team_id is null;

  -- Withdraw the dropped team — keeps its row + past results for the record.
  update teams set status = 'withdrawn' where id = p_team_id;

  return v_bye_id;
end;
$$;

grant execute on function drop_team_mid_season(uuid, uuid) to authenticated;

comment on function drop_team_mid_season(uuid, uuid) is
'Atomically drop a team that has already played: withdraw it (keeping its past
results), create a fresh BYE, and rewire all its UNPLAYED matches (+ their
lineups) onto the BYE so future opponents get bye weeks. Guards: team active,
one BYE per season. Returns the new BYE team id. The resulting BYE matches are
forfeited by sweep_auto_forfeits().';
