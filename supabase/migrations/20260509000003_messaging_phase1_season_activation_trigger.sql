-- ============================================================================
-- MESSAGING OVERHAUL — PHASE 1 — UNIT 4
-- Season-activation trigger + auto-creation SQL function
-- ============================================================================
--
-- Wires a Postgres trigger on `seasons` AFTER UPDATE OF status that fires
-- when a season flips to 'active' and creates the four chat types defined
-- in Unit 3's TS utilities (which act as the functional spec):
--
--   * One team_chat per team in the season — full roster as participants,
--     captain has cannot_leave=true. Opens with a "Team chat created"
--     system message.
--   * One captains_chat per (league, season) — all team captains (deduped)
--     plus all org staff. Captains cannot leave; staff-only members can.
--   * One season-announcements chat — every distinct rostered player as
--     a cannot_leave participant.
--   * One org-announcements chat (only if not already present for the org)
--     — every distinct player across the org's currently-active seasons.
--
-- Failure isolation (R11): each of the four chat blocks is wrapped in
-- BEGIN ... EXCEPTION WHEN OTHERS so a malformed roster or constraint
-- violation on one chat does NOT roll back the season-activation UPDATE
-- or skip the other chats. Failures are logged via RAISE WARNING and the
-- captain's manual-fallback button (Unit 3 / CreateTeamChatPrompt) is the
-- recovery path for a stranded team.
--
-- Security: function is SECURITY DEFINER with explicit search_path so an
-- attacker cannot hijack name resolution via a schema shadowing. After
-- CREATE, EXECUTE is revoked from PUBLIC and authenticated — only the
-- trigger context (running as definer) needs to call it.
--
-- Realtime: `conversations` is added to the supabase_realtime publication
-- here so new chats are broadcast directly. Without this, clients only
-- learn about new chats indirectly via the conversation_participants /
-- messages INSERT path, which works but adds a one-row-of-latency.
--
-- See: docs/plans/2026-05-09-001-feat-messaging-overhaul-phase-1-plan.md (Unit 4)
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. auto_create_season_conversations()
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.auto_create_season_conversations(p_season_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_league_id uuid;
  v_organization_id uuid;
  v_season_name text;
  v_league_division text;
  v_league_day_of_week text;
  v_org_name text;
  v_team record;
  v_conv_id uuid;
  v_title text;
BEGIN
  -- Resolve season → league → org. Missing season is fatal (the trigger
  -- can't operate on a row that doesn't exist), so we don't wrap this
  -- in EXCEPTION — let it propagate.
  SELECT s.league_id, s.season_name, l.organization_id, l.division, l.day_of_week, o.organization_name
    INTO v_league_id, v_season_name, v_organization_id, v_league_division, v_league_day_of_week, v_org_name
  FROM seasons s
  JOIN leagues l ON l.id = s.league_id
  JOIN organizations o ON o.id = l.organization_id
  WHERE s.id = p_season_id;

  IF v_league_id IS NULL THEN
    RAISE EXCEPTION 'auto_create_season_conversations: season % not found', p_season_id;
  END IF;

  -- --------------------------------------------------------------------------
  -- Block 1: Team chats — one per team in the season.
  -- Each team is its own BEGIN/EXCEPTION so a single bad roster doesn't
  -- skip the rest. Mirrors Unit 3's createTeamChat().
  -- --------------------------------------------------------------------------
  FOR v_team IN
    SELECT id AS team_id, team_name, captain_id
    FROM teams
    WHERE season_id = p_season_id
  LOOP
    BEGIN
      -- Idempotency: skip if an auto-managed team chat already exists.
      SELECT id INTO v_conv_id
      FROM conversations
      WHERE scope_type = 'team'
        AND scope_id = v_team.team_id
        AND auto_managed = true;

      IF v_conv_id IS NULL THEN
        INSERT INTO conversations (title, conversation_type, scope_type, scope_id, auto_managed)
        VALUES (v_team.team_name || ' — Team Chat', 'team_chat', 'team', v_team.team_id, true)
        RETURNING id INTO v_conv_id;

        -- Roster as participants. Captain gets cannot_leave=true; the rest
        -- default to false. ON CONFLICT DO NOTHING guards against the rare
        -- duplicate-roster row.
        INSERT INTO conversation_participants (conversation_id, user_id, role, cannot_leave)
        SELECT v_conv_id, tp.member_id, 'participant', (tp.member_id = v_team.captain_id)
        FROM team_players tp
        WHERE tp.team_id = v_team.team_id
        ON CONFLICT DO NOTHING;

        -- Opening system message. Inserted AFTER participants so realtime
        -- clients see the participant rows first; the message broadcast is
        -- the inbox-refresh trigger.
        INSERT INTO messages (conversation_id, sender_id, is_system, content)
        VALUES (v_conv_id, NULL, true, 'Team chat created');
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'auto_create_season_conversations: team chat failed for team_id=% (%): %', v_team.team_id, v_team.team_name, SQLERRM;
    END;
  END LOOP;

  -- --------------------------------------------------------------------------
  -- Block 2: Captain chat — one per season. Mirrors createCaptainChat().
  -- --------------------------------------------------------------------------
  BEGIN
    SELECT id INTO v_conv_id
    FROM conversations
    WHERE scope_type = 'season'
      AND scope_id = p_season_id
      AND conversation_type = 'captains_chat'
      AND auto_managed = true;

    IF v_conv_id IS NULL THEN
      v_title := COALESCE(v_league_division, v_league_day_of_week, 'League') || ' Captains Chat';

      INSERT INTO conversations (title, conversation_type, scope_type, scope_id, auto_managed)
      VALUES (v_title, 'captains_chat', 'season', p_season_id, true)
      RETURNING id INTO v_conv_id;

      -- Captains (deduped) — cannot_leave=true. UNION with staff afterward,
      -- and the captain rule wins via ON CONFLICT … DO UPDATE.
      INSERT INTO conversation_participants (conversation_id, user_id, role, cannot_leave)
      SELECT DISTINCT v_conv_id, t.captain_id, 'participant', true
      FROM teams t
      WHERE t.season_id = p_season_id
        AND t.captain_id IS NOT NULL
      ON CONFLICT DO NOTHING;

      -- Org staff — staff-only members get cannot_leave=false. If a staff
      -- member is also a captain they're already in the table with
      -- cannot_leave=true; ON CONFLICT DO NOTHING leaves them alone.
      INSERT INTO conversation_participants (conversation_id, user_id, role, cannot_leave)
      SELECT v_conv_id, os.member_id, 'participant', false
      FROM organization_staff os
      WHERE os.organization_id = v_organization_id
      ON CONFLICT DO NOTHING;

      INSERT INTO messages (conversation_id, sender_id, is_system, content)
      VALUES (v_conv_id, NULL, true, 'Captains chat created.');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'auto_create_season_conversations: captain chat failed for season_id=%: %', p_season_id, SQLERRM;
  END;

  -- --------------------------------------------------------------------------
  -- Block 3: Season announcements. Mirrors createSeasonAnnouncementsChat().
  -- --------------------------------------------------------------------------
  BEGIN
    SELECT id INTO v_conv_id
    FROM conversations
    WHERE scope_type = 'season'
      AND scope_id = p_season_id
      AND conversation_type = 'announcements'
      AND auto_managed = true;

    IF v_conv_id IS NULL THEN
      v_title := COALESCE(v_season_name, 'Season') || ' — Announcements';

      INSERT INTO conversations (title, conversation_type, scope_type, scope_id, auto_managed)
      VALUES (v_title, 'announcements', 'season', p_season_id, true)
      RETURNING id INTO v_conv_id;

      INSERT INTO conversation_participants (conversation_id, user_id, role, cannot_leave)
      SELECT DISTINCT v_conv_id, tp.member_id, 'participant', true
      FROM team_players tp
      JOIN teams t ON t.id = tp.team_id
      WHERE t.season_id = p_season_id
      ON CONFLICT DO NOTHING;

      INSERT INTO messages (conversation_id, sender_id, is_system, content)
      VALUES (v_conv_id, NULL, true, 'Season announcements channel created. Only league staff can post here.');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'auto_create_season_conversations: season announcements failed for season_id=%: %', p_season_id, SQLERRM;
  END;

  -- --------------------------------------------------------------------------
  -- Block 4: Org announcements. Mirrors createOrgAnnouncementsChat().
  -- Idempotent per org — many seasons activate over time, only one chat.
  -- --------------------------------------------------------------------------
  BEGIN
    SELECT id INTO v_conv_id
    FROM conversations
    WHERE scope_type = 'organization'
      AND scope_id = v_organization_id
      AND conversation_type = 'announcements'
      AND auto_managed = true;

    IF v_conv_id IS NULL THEN
      v_title := COALESCE(v_org_name, 'Organization') || ' — Announcements';

      INSERT INTO conversations (title, conversation_type, scope_type, scope_id, auto_managed)
      VALUES (v_title, 'announcements', 'organization', v_organization_id, true)
      RETURNING id INTO v_conv_id;

      -- Players across all currently-active seasons in this org. Past
      -- players excluded — they were rostered in non-active seasons.
      INSERT INTO conversation_participants (conversation_id, user_id, role, cannot_leave)
      SELECT DISTINCT v_conv_id, tp.member_id, 'participant', true
      FROM team_players tp
      JOIN teams t ON t.id = tp.team_id
      JOIN seasons s ON s.id = t.season_id
      JOIN leagues l ON l.id = s.league_id
      WHERE l.organization_id = v_organization_id
        AND s.status = 'active'
      ON CONFLICT DO NOTHING;

      INSERT INTO messages (conversation_id, sender_id, is_system, content)
      VALUES (v_conv_id, NULL, true, 'Organization announcements channel created. Only league staff can post here.');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'auto_create_season_conversations: org announcements failed for org_id=%: %', v_organization_id, SQLERRM;
  END;
END;
$$;

COMMENT ON FUNCTION public.auto_create_season_conversations(uuid) IS
  'Phase 1 / Unit 4. SECURITY DEFINER trigger helper. Creates the four chat types (team, captain, season announcements, org announcements) when a season activates. Each chat is in its own BEGIN/EXCEPTION block so a single failure does not strand the others or roll back the season UPDATE. Idempotent — safe to re-fire.';

-- Lock the function down so only the trigger context (running as definer)
-- can call it. Default in Postgres is EXECUTE TO PUBLIC, which would let any
-- authenticated client invoke this RLS-bypassing function directly.
REVOKE ALL ON FUNCTION public.auto_create_season_conversations(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auto_create_season_conversations(uuid) FROM authenticated;


-- ----------------------------------------------------------------------------
-- 2. Trigger wrapper + trigger on seasons.status
-- ----------------------------------------------------------------------------
-- Postgres triggers can only EXECUTE 0-arg trigger functions; the wrapper
-- here exists solely to forward NEW.id into the main function. Keeping the
-- main function arg-driven means it stays directly callable (useful for
-- tests, manual recovery, and any future operator "regenerate chats" tool).

CREATE OR REPLACE FUNCTION public.trg_auto_create_season_conversations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  PERFORM public.auto_create_season_conversations(NEW.id);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.trg_auto_create_season_conversations() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trg_auto_create_season_conversations() FROM authenticated;

-- Drop+recreate idiom for re-runnability against environments where a prior
-- attempt left the trigger in place.
DROP TRIGGER IF EXISTS trg_seasons_auto_create_conversations ON seasons;

CREATE TRIGGER trg_seasons_auto_create_conversations
AFTER UPDATE OF status ON seasons
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM 'active' AND NEW.status = 'active')
EXECUTE FUNCTION public.trg_auto_create_season_conversations();

COMMENT ON TRIGGER trg_seasons_auto_create_conversations ON seasons IS
  'Fires when a season flips to status=active. Creates team chats, captain chat, and announcements channels via auto_create_season_conversations(). WHEN clause guards against firing on unrelated status changes (active→completed, upcoming→cancelled, etc.).';


-- ----------------------------------------------------------------------------
-- 3. Realtime publication — add conversations
-- ----------------------------------------------------------------------------
-- The supabase_realtime publication already includes messages and
-- conversation_participants. Adding conversations means new chat rows
-- broadcast directly so the Messages UI updates immediately on activation
-- without waiting for the participant/message INSERT path.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
  END IF;
END;
$$;
