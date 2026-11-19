-- ============================================================================
-- apply_odd_league_drop: drop a team mid-season from a league that ALREADY has
-- a BYE (odd team count), applying a re-pairing plan atomically.
-- ============================================================================
--
-- drop_team_mid_season (20260611000001) handles the EVEN league: it creates a
-- BYE and moves the dropped team's future matches onto it. It refuses a season
-- that already has a BYE ("separate case"). This is that case.
--
-- With a BYE already in the season, the dropped team's opponent (X) and the
-- bye-week team (Y) each need a new opponent every remaining week. WHO plays
-- WHOM and who is home is decided in the app (planOddLeagueDrop.ts: Ed's
-- "hybrid" re-pairing + home/away rule, which reads the real standings order),
-- then handed here as a plan. This function only checks the plan is still
-- valid and applies it in ONE transaction:
--   1. rewrite each planned match with its new home/away pair (venue follows
--      the new home team; a team that stays in its match keeps its lineup, a
--      team new to a match gets a fresh empty lineup)
--   2. move any planned match onto the BYE (a past week whose bye was already
--      settled: the opponent takes the forfeit win from the sweep)
--   3. delete the dropped team's other unplayed matches (never played, so no
--      history is lost; its lineups cascade away)
--   4. withdraw the dropped team (row + past results stay; hidden from standings)
--   5. re-deal tables for every week touched
--
-- Guards (the plan is rejected, nothing changes): team active; the season has
-- exactly one BYE; every planned match is in this season and still unplayed
-- with no locked lineup; afterwards the dropped team has no unplayed match left.
--
-- No "dropped team vs BYE" match is ever kept: the daily sweep_auto_forfeits()
-- would award it to the dropped (still-captained) team.
-- ============================================================================

-- Rewrite one match to a new home/away pair. A team already in the match keeps
-- its lineup row; a team new to it gets a fresh one (the departing team's row,
-- which may hold early-entered players, is deleted). Venue = new home's venue.
create or replace function _odd_drop_rewrite_match(p_match_id uuid, p_home uuid, p_away uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  m          matches%rowtype;
  v_home_lu  uuid;
  v_away_lu  uuid;
begin
  select * into m from matches where id = p_match_id for update;

  v_home_lu := case p_home when m.home_team_id then m.home_lineup_id
                           when m.away_team_id then m.away_lineup_id end;
  v_away_lu := case p_away when m.home_team_id then m.home_lineup_id
                           when m.away_team_id then m.away_lineup_id end;

  if v_home_lu is null then
    insert into match_lineups (match_id, team_id, player1_handicap, player2_handicap,
      player3_handicap, player4_handicap, player5_handicap, home_team_modifier, locked)
    values (p_match_id, p_home, 0, 0, 0, 0, 0, 0, false)
    returning id into v_home_lu;
  end if;
  if v_away_lu is null then
    insert into match_lineups (match_id, team_id, player1_handicap, player2_handicap,
      player3_handicap, player4_handicap, player5_handicap, home_team_modifier, locked)
    values (p_match_id, p_away, 0, 0, 0, 0, 0, 0, false)
    returning id into v_away_lu;
  end if;

  update matches
     set home_team_id = p_home,
         away_team_id = p_away,
         home_lineup_id = v_home_lu,
         away_lineup_id = v_away_lu,
         scheduled_venue_id = (select home_venue_id from teams where id = p_home)
   where id = p_match_id;

  -- Lineup rows no longer used by this match belonged to departing teams.
  delete from match_lineups
   where match_id = p_match_id
     and id not in (v_home_lu, v_away_lu);
end;
$$;

create or replace function apply_odd_league_drop(
  p_team_id    uuid,
  p_season_id  uuid,
  p_updates    jsonb,   -- [{ "matchId": uuid, "homeTeamId": uuid, "awayTeamId": uuid }, ...]
  p_rewire_ids uuid[],  -- dropped-team matches to move onto the BYE
  p_delete_ids uuid[]   -- dropped-team matches to remove
)
returns integer -- number of weeks touched
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_status   text;
  v_bye_id   uuid;
  v_byes     integer;
  v_planned  uuid[];
  v_weeks    uuid[];
  u          jsonb;
  m          matches%rowtype;
begin
  -- Guard: the team is active and in this season.
  select status into v_status from teams where id = p_team_id and season_id = p_season_id;
  if v_status is null then raise exception 'Team not found in this season'; end if;
  if v_status <> 'active' then
    raise exception 'Only an active team can be dropped (status: %)', v_status;
  end if;

  -- Guard: exactly one BYE (this is the odd-league path).
  select count(*), min(id::text)::uuid into v_byes, v_bye_id
    from teams where season_id = p_season_id and status = 'bye';
  if v_byes <> 1 then
    raise exception 'Expected one BYE in this season, found % (use drop_team_mid_season for an even league)', v_byes;
  end if;

  -- Guard: every planned match is in this season, unplayed, with no locked lineup.
  v_planned := array(select (e->>'matchId')::uuid from jsonb_array_elements(coalesce(p_updates, '[]')) e)
               || coalesce(p_rewire_ids, '{}') || coalesce(p_delete_ids, '{}');
  if exists (
    select 1 from unnest(v_planned) as pid(id)
    left join matches mm on mm.id = pid.id
    where mm.id is null
       or mm.season_id <> p_season_id
       or mm.status <> 'scheduled'
       or mm.winner_team_id is not null
       or exists (select 1 from match_lineups ml where ml.match_id = mm.id and ml.locked)
  ) then
    raise exception 'The schedule changed since this drop was planned (a match started, was played or no longer exists). Please try again.';
  end if;

  -- Weeks touched, captured before any delete.
  v_weeks := array(select distinct season_week_id from matches where id = any(v_planned));

  -- 1. Rewrite planned matches with their new pairs.
  for u in select * from jsonb_array_elements(coalesce(p_updates, '[]')) loop
    perform _odd_drop_rewrite_match((u->>'matchId')::uuid, (u->>'homeTeamId')::uuid, (u->>'awayTeamId')::uuid);
  end loop;

  -- 2. Move planned matches onto the BYE (the dropped team's side becomes the BYE).
  for m in select * from matches where id = any(coalesce(p_rewire_ids, '{}')) loop
    perform _odd_drop_rewrite_match(
      m.id,
      case when m.home_team_id = p_team_id then v_bye_id else m.home_team_id end,
      case when m.away_team_id = p_team_id then v_bye_id else m.away_team_id end);
  end loop;

  -- 3. Remove the dropped team's other unplayed matches.
  delete from matches where id = any(coalesce(p_delete_ids, '{}'));

  -- Guard: nothing unplayed is left for the dropped team (the plan was complete).
  if exists (
    select 1 from matches
    where (home_team_id = p_team_id or away_team_id = p_team_id)
      and status = 'scheduled' and winner_team_id is null
  ) then
    raise exception 'The drop plan missed some of this team''s remaining matches. Please try again.';
  end if;

  -- 4. Withdraw the dropped team (keeps its row and past results).
  update teams set status = 'withdrawn' where id = p_team_id;

  -- 5. Re-deal tables for every week touched.
  perform assign_tables_for_week(w) from unnest(v_weeks) as w;

  return coalesce(array_length(v_weeks, 1), 0);
end;
$$;

grant execute on function apply_odd_league_drop(uuid, uuid, jsonb, uuid[], uuid[]) to authenticated;

comment on function apply_odd_league_drop(uuid, uuid, jsonb, uuid[], uuid[]) is
'Drop a team mid-season from a league that already has a BYE. Applies the app''s
re-pairing plan (planOddLeagueDrop.ts) atomically: rewrite planned matches with
new pairs (venue follows home; lineups follow their team), move planned matches
onto the BYE, delete the dropped team''s other unplayed matches, withdraw it,
re-deal tables. Rejects a stale or incomplete plan. Returns weeks touched.';
