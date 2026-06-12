-- ============================================================================
-- Auto-forfeit sweep — the league's first scheduled (pg_cron) job
-- ============================================================================
--
-- A BYE is a permanently captainless team that forfeits every match; a real
-- team that loses its captain forfeits the same way. This one set-based rule
-- unifies both: a captainless team can't field a lineup, so it forfeits.
--
-- Once daily, over ALL leagues at once, for every match that is `scheduled`,
-- unplayed, and PAST-DUE (its week's scheduled_date is before today):
--   - both teams have a captain   → ignore (a real game still to be played)
--   - exactly one team captainless → the captained team is the winner (forfeit)
--   - neither team captained       → skip (double-forfeit edge — deferred)
--
-- A forfeit here = DECLARING A WINNER: winner_team_id + status='completed',
-- which is exactly how standings / handicap queries already count a win
-- (they filter status='completed' and read winner_team_id). Points-for-the-win
-- (forfeit SCORING) is deliberately DEFERRED — this job only settles who won.
--
-- Keyed on "past-due + unplayed" (status/date), never a specific date, so it is
-- SELF-HEALING: a skipped run is swept up the next day; nothing falls through.
-- Cheap + flat at scale: the partial index idx_matches_status_season_week
-- (status IN ('scheduled','in_progress')) already covers the scan, the result
-- set is tiny (most matches are 'completed'), and it's ONE query for every
-- league — cost scales with missed matches, not league count.
--
-- The LOGIC lives in a function (testable directly); pg_cron only calls it.
-- ============================================================================

create extension if not exists pg_cron;

/**
 * Forfeit every past-due, unplayed, exactly-one-captainless match.
 * Returns the number of matches forfeited (for logging / tests).
 */
create or replace function sweep_auto_forfeits()
returns integer
language plpgsql
security definer
as $$
declare
  v_swept integer;
begin
  with due as (
    select
      m.id,
      m.home_team_id,
      m.away_team_id,
      ht.captain_id is not null as home_has_captain,
      at.captain_id is not null as away_has_captain
    from matches m
    join season_weeks sw on sw.id = m.season_week_id
    join teams ht on ht.id = m.home_team_id
    join teams at on at.id = m.away_team_id
    where m.status = 'scheduled'
      and m.winner_team_id is null
      and sw.scheduled_date < current_date
  )
  update matches m
  set
    winner_team_id = case
      when d.home_has_captain and not d.away_has_captain then d.home_team_id
      when d.away_has_captain and not d.home_has_captain then d.away_team_id
    end,
    status = 'completed'
  from due d
  where m.id = d.id
    -- exactly one side captainless (XOR): the other forfeits to the captained side.
    and (d.home_has_captain <> d.away_has_captain);

  get diagnostics v_swept = row_count;
  return v_swept;
end;
$$;

comment on function sweep_auto_forfeits() is
'Daily auto-forfeit sweep. Forfeits past-due, unplayed matches where exactly one
team is captainless (winner = the captained team, status = completed). Both-
captained matches are left for real play; neither-captained is skipped (deferred
double-forfeit edge). Forfeit SCORING (points) is deferred. Self-healing: keyed
on past-due + unplayed, so a skipped run is swept the next day.';

-- Schedule daily at 06:00 UTC. Unschedule any prior version first so re-running
-- this migration is idempotent. (Timezone/per-league timing is a future refinement;
-- the self-healing design makes the exact hour non-critical.)
do $$
begin
  perform cron.unschedule('auto-forfeit-sweep');
exception
  when others then null; -- no prior job to remove
end $$;

select cron.schedule('auto-forfeit-sweep', '0 6 * * *', $cron$ select sweep_auto_forfeits(); $cron$);
