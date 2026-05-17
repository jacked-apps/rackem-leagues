-- ============================================================================
-- MESSAGING OVERHAUL — PHASE 1 — UNIT 18 (short titles)
-- Shorten auto-managed chat titles for mobile + move long org/league
-- context names into the read-only banner where they have room.
-- ============================================================================
--
-- Ed flagged on 2026-05-16 during the Phase 1 end-to-end test pass that
-- the auto-managed chat titles ("8-Ball Tuesday Standard 5v5 Spring 2026
-- — Announcements", "Tester Org — Announcements", etc.) wrap badly on
-- a phone-width conversation list. The full org/league name doesn't
-- belong in the row title; it belongs in the read-only banner where
-- there's vertical space.
--
-- New title patterns (set by this migration AND by the matching JS
-- helpers in src/api/mutations/autoConversations.ts):
--
--   team_chat         : <team.name>                       (drop "— Team Chat")
--   captains_chat     : "Captains — <division|day>"       (reorder; drop "Chat")
--   season_announce.  : "League Announcements"            (context → banner)
--   org_announce.     : "Global Announcements"            (context → banner)
--
-- The matching ReadOnlyBanner copy now interpolates the org/league name:
--
--   "Only staff from <Org Name> can post here."           (org_announcements)
--   "Only staff from <League Name> can post here."        (season_announcements)
--
-- This migration does TWO things:
--   1. CREATE OR REPLACE auto_create_season_conversations with the new
--      title patterns so future season activations use them.
--   2. UPDATE existing auto-managed chat rows to the new pattern. In
--      production this is a no-op (no chats yet). In dev (where seed
--      data has activated seasons), it retroactively shortens existing
--      titles so devs don't have to db:reset to see the new behavior.
--
-- See: docs/plans/2026-05-09-001-feat-messaging-overhaul-phase-1-plan.md (Unit 18)
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Retroactive UPDATE on existing chats so dev DBs match the new patterns
--    without requiring a full db:reset.
-- ----------------------------------------------------------------------------

-- team_chat: drop the " — Team Chat" suffix. Only touch auto-managed rows
-- whose current title actually ends with that suffix; leave anything else
-- alone (e.g., a captain-edited title from future Unit 19).
UPDATE public.conversations
SET title = REPLACE(title, ' — Team Chat', '')
WHERE auto_managed = TRUE
  AND conversation_type = 'team_chat'
  AND title LIKE '% — Team Chat';

-- captains_chat: rebuild as "Captains — <division or day_of_week>".
-- Source the new label by joining season → league.
WITH new_titles AS (
  SELECT
    c.id AS conv_id,
    'Captains — ' || COALESCE(l.division, l.day_of_week, 'League') AS new_title
  FROM public.conversations c
  JOIN public.seasons s ON s.id = c.scope_id
  JOIN public.leagues l ON l.id = s.league_id
  WHERE c.auto_managed = TRUE
    AND c.conversation_type = 'captains_chat'
    AND c.scope_type = 'season'
)
UPDATE public.conversations c
SET title = nt.new_title
FROM new_titles nt
WHERE c.id = nt.conv_id;

-- season_announcements: collapse to "League Announcements"; context name
-- moves to the banner.
UPDATE public.conversations
SET title = 'League Announcements'
WHERE auto_managed = TRUE
  AND conversation_type = 'announcements'
  AND scope_type = 'season';

-- org_announcements: collapse to "Global Announcements"; context name
-- moves to the banner.
UPDATE public.conversations
SET title = 'Global Announcements'
WHERE auto_managed = TRUE
  AND conversation_type = 'announcements'
  AND scope_type = 'organization';


-- ----------------------------------------------------------------------------
-- 2. CREATE OR REPLACE the season-activation trigger function with the
--    new title patterns so all future activations use them.
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
  SELECT s.league_id, s.season_name, l.organization_id, l.division, l.day_of_week, o.organization_name
    INTO v_league_id, v_season_name, v_organization_id, v_league_division, v_league_day_of_week, v_org_name
  FROM seasons s
  JOIN leagues l ON l.id = s.league_id
  JOIN organizations o ON o.id = l.organization_id
  WHERE s.id = p_season_id;

  IF v_league_id IS NULL THEN
    RAISE EXCEPTION 'auto_create_season_conversations: season % not found', p_season_id;
  END IF;

  -- ── Team chats ────────────────────────────────────────────────────────────
  FOR v_team IN
    SELECT id AS team_id, team_name, captain_id
    FROM teams
    WHERE season_id = p_season_id
  LOOP
    BEGIN
      SELECT id INTO v_conv_id
      FROM conversations
      WHERE scope_type = 'team'
        AND scope_id = v_team.team_id
        AND auto_managed = true;

      IF v_conv_id IS NULL THEN
        -- Unit 18: team chat title is just the team name (no "— Team Chat" suffix).
        INSERT INTO conversations (title, conversation_type, scope_type, scope_id, auto_managed)
        VALUES (v_team.team_name, 'team_chat', 'team', v_team.team_id, true)
        RETURNING id INTO v_conv_id;

        INSERT INTO conversation_participants (conversation_id, user_id, role, cannot_leave)
        SELECT v_conv_id, tp.member_id, 'participant', (tp.member_id = v_team.captain_id)
        FROM team_players tp
        WHERE tp.team_id = v_team.team_id
        ON CONFLICT DO NOTHING;

        INSERT INTO messages (conversation_id, sender_id, is_system, content)
        VALUES (v_conv_id, NULL, true, 'Team chat created.');
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'auto_create_season_conversations: team chat failed for team_id=% (%): %', v_team.team_id, v_team.team_name, SQLERRM;
    END;
  END LOOP;

  -- ── Captain chat ──────────────────────────────────────────────────────────
  BEGIN
    SELECT id INTO v_conv_id
    FROM conversations
    WHERE scope_type = 'season'
      AND scope_id = p_season_id
      AND conversation_type = 'captains_chat'
      AND auto_managed = true;

    IF v_conv_id IS NULL THEN
      -- Unit 18: "Captains — <division|day>" instead of "<...> Captains Chat".
      v_title := 'Captains — ' || COALESCE(v_league_division, v_league_day_of_week, 'League');

      INSERT INTO conversations (title, conversation_type, scope_type, scope_id, auto_managed)
      VALUES (v_title, 'captains_chat', 'season', p_season_id, true)
      RETURNING id INTO v_conv_id;

      INSERT INTO conversation_participants (conversation_id, user_id, role, cannot_leave)
      SELECT DISTINCT v_conv_id, t.captain_id, 'participant', true
      FROM teams t
      WHERE t.season_id = p_season_id
        AND t.captain_id IS NOT NULL
      ON CONFLICT DO NOTHING;

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

  -- ── Season announcements ──────────────────────────────────────────────────
  BEGIN
    SELECT id INTO v_conv_id
    FROM conversations
    WHERE scope_type = 'season'
      AND scope_id = p_season_id
      AND conversation_type = 'announcements'
      AND auto_managed = true;

    IF v_conv_id IS NULL THEN
      -- Unit 18: universal "League Announcements"; context (the actual
      -- league name) is interpolated into the read-only banner instead.
      v_title := 'League Announcements';

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

  -- ── Org announcements ─────────────────────────────────────────────────────
  BEGIN
    SELECT id INTO v_conv_id
    FROM conversations
    WHERE scope_type = 'organization'
      AND scope_id = v_organization_id
      AND conversation_type = 'announcements'
      AND auto_managed = true;

    IF v_conv_id IS NULL THEN
      -- Unit 18: universal "Global Announcements"; context (the actual
      -- org name) is interpolated into the read-only banner instead.
      v_title := 'Global Announcements';

      INSERT INTO conversations (title, conversation_type, scope_type, scope_id, auto_managed)
      VALUES (v_title, 'announcements', 'organization', v_organization_id, true)
      RETURNING id INTO v_conv_id;

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
  'Phase 1 / Unit 4 (title patterns updated in Unit 18 2026-05-17). SECURITY DEFINER trigger helper. Creates the four chat types (team, captain, season announcements, org announcements) when a season activates. Each chat is in its own BEGIN/EXCEPTION block so a single failure does not strand the others or roll back the season UPDATE. Idempotent — safe to re-fire.';
