-- ============================================================================
-- MESSAGING OVERHAUL — PHASE 1 — UNIT 5
-- Roster + captain lifecycle triggers
-- ============================================================================
--
-- Four triggers keep auto-managed chats in sync with the underlying roster
-- and captain state, with system-message posts narrating the changes:
--
--   1. team_players AFTER INSERT
--      → add the player to the team's auto-managed chat (re-activating any
--        prior past-membership row via ON CONFLICT DO UPDATE).
--      → post "<name> joined the team." ONLY on real inserts (`xmax = 0`),
--        not on conflict-update re-activations, so the operator
--        wholesale-replace updateTeam pattern doesn't spam the chat.
--
--   2. team_players AFTER DELETE
--      → mark the participant row's `left_at = now()` ONLY when it was
--        previously NULL (so idempotent deletes don't overwrite an earlier
--        departure timestamp).
--      → post "<name> left the team." only when the timestamp was newly set.
--
--   3. teams AFTER UPDATE OF captain_id
--      → in the team chat: new captain `cannot_leave = true`, old captain
--        `cannot_leave = false`.
--      → in the captain chat (if it exists for this season): same flips,
--        BUT only demote the old captain when they no longer captain any
--        other team in the same season — a multi-team-captain shouldn't
--        lose their forced-membership on the captain chat.
--      → post "<new_captain> is now team captain." in the team chat.
--
--   4. members AFTER UPDATE OF deleted_at (soft-delete)
--      → set `left_at = now()` on every conversation_participants row for
--        that member where `left_at IS NULL`. Captain-account-deletion case
--        from D24 of the messaging overhaul brainstorm.
--
-- All triggers are NO-OPs if the relevant auto-managed chat doesn't exist —
-- defensive against teams that pre-date chat creation or had their chat
-- manually deleted. The captain's manual-fallback button (Unit 3) is still
-- the recovery path in that case.
--
-- Security: every trigger function is SECURITY DEFINER with explicit
-- `search_path = public, pg_catalog`. After each CREATE, EXECUTE is revoked
-- from PUBLIC and authenticated — only the trigger context can call them.
--
-- See: docs/plans/2026-05-09-001-feat-messaging-overhaul-phase-1-plan.md (Unit 5)
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. team_players AFTER INSERT → add to team chat + maybe post system msg
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.trg_team_players_insert_to_team_chat()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_conv_id uuid;
  v_team_captain_id uuid;
  v_first_name text;
  v_last_name text;
  v_was_new_insert boolean;
BEGIN
  -- Find the team's auto-managed chat. Defensive no-op if absent.
  SELECT c.id, t.captain_id
    INTO v_conv_id, v_team_captain_id
  FROM conversations c
  JOIN teams t ON t.id = c.scope_id
  WHERE c.scope_type = 'team'
    AND c.scope_id = NEW.team_id
    AND c.auto_managed = true;

  IF v_conv_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- INSERT participant with ON CONFLICT DO UPDATE re-activate semantics.
  -- The xmax = 0 trick distinguishes a true insert (no prior row) from a
  -- conflict-update path (existing row was re-activated). We only post the
  -- "joined" message on real inserts so updateTeam's wholesale-replace
  -- pattern is silent on unchanged rosters.
  --
  -- Note: joined_at = now() is required on re-activation so the CHECK
  -- constraint (left_at >= joined_at) doesn't fail against a stale
  -- joined_at when left_at is also being cleared.
  INSERT INTO conversation_participants (
    conversation_id, user_id, role, cannot_leave, joined_at, left_at, notification_mode
  )
  VALUES (
    v_conv_id,
    NEW.member_id,
    'participant',
    (NEW.member_id = v_team_captain_id),
    NOW(),
    NULL,
    'all'
  )
  ON CONFLICT (conversation_id, user_id) DO UPDATE
    SET left_at = NULL,
        joined_at = NOW(),
        notification_mode = 'all',
        cannot_leave = (EXCLUDED.user_id = v_team_captain_id)
  RETURNING (xmax = 0) INTO v_was_new_insert;

  IF v_was_new_insert THEN
    SELECT first_name, last_name INTO v_first_name, v_last_name
    FROM members
    WHERE id = NEW.member_id;

    INSERT INTO messages (conversation_id, sender_id, is_system, content)
    VALUES (
      v_conv_id,
      NULL,
      true,
      COALESCE(v_first_name || ' ' || v_last_name, 'A new player') || ' joined the team.'
    );
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.trg_team_players_insert_to_team_chat() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trg_team_players_insert_to_team_chat() FROM authenticated;

DROP TRIGGER IF EXISTS trg_team_players_insert_chat ON team_players;
CREATE TRIGGER trg_team_players_insert_chat
AFTER INSERT ON team_players
FOR EACH ROW
EXECUTE FUNCTION public.trg_team_players_insert_to_team_chat();


-- ----------------------------------------------------------------------------
-- 2. team_players AFTER DELETE → past-member the team chat row + maybe msg
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.trg_team_players_delete_from_team_chat()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_conv_id uuid;
  v_first_name text;
  v_last_name text;
  v_rows_updated integer;
BEGIN
  SELECT id INTO v_conv_id
  FROM conversations
  WHERE scope_type = 'team'
    AND scope_id = OLD.team_id
    AND auto_managed = true;

  IF v_conv_id IS NULL THEN
    RETURN OLD;
  END IF;

  -- Only set left_at when it's currently NULL. Idempotent deletes (a player
  -- already past-membered) are a no-op AND skip the system message.
  UPDATE conversation_participants
    SET left_at = NOW(),
        cannot_leave = false
  WHERE conversation_id = v_conv_id
    AND user_id = OLD.member_id
    AND left_at IS NULL;

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

  IF v_rows_updated > 0 THEN
    SELECT first_name, last_name INTO v_first_name, v_last_name
    FROM members
    WHERE id = OLD.member_id;

    INSERT INTO messages (conversation_id, sender_id, is_system, content)
    VALUES (
      v_conv_id,
      NULL,
      true,
      COALESCE(v_first_name || ' ' || v_last_name, 'A player') || ' left the team.'
    );
  END IF;

  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION public.trg_team_players_delete_from_team_chat() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trg_team_players_delete_from_team_chat() FROM authenticated;

DROP TRIGGER IF EXISTS trg_team_players_delete_chat ON team_players;
CREATE TRIGGER trg_team_players_delete_chat
AFTER DELETE ON team_players
FOR EACH ROW
EXECUTE FUNCTION public.trg_team_players_delete_from_team_chat();


-- ----------------------------------------------------------------------------
-- 3. teams AFTER UPDATE OF captain_id → flip cannot_leave + post msg
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.trg_teams_captain_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_team_conv_id uuid;
  v_captain_conv_id uuid;
  v_first_name text;
  v_last_name text;
  v_old_still_captains_in_season boolean;
BEGIN
  -- Team chat: find it (no-op if absent).
  SELECT id INTO v_team_conv_id
  FROM conversations
  WHERE scope_type = 'team'
    AND scope_id = NEW.id
    AND auto_managed = true;

  -- Captain chat: scoped to the season.
  SELECT id INTO v_captain_conv_id
  FROM conversations
  WHERE scope_type = 'season'
    AND scope_id = NEW.season_id
    AND conversation_type = 'captains_chat'
    AND auto_managed = true;

  -- Team chat updates ----------------------------------------------------
  IF v_team_conv_id IS NOT NULL THEN
    IF OLD.captain_id IS NOT NULL THEN
      UPDATE conversation_participants
        SET cannot_leave = false
      WHERE conversation_id = v_team_conv_id
        AND user_id = OLD.captain_id;
    END IF;

    IF NEW.captain_id IS NOT NULL THEN
      -- Upsert in case the new captain wasn't already a participant
      -- (rare but possible — e.g., captain set without being on roster).
      INSERT INTO conversation_participants (conversation_id, user_id, role, cannot_leave)
      VALUES (v_team_conv_id, NEW.captain_id, 'participant', true)
      ON CONFLICT (conversation_id, user_id) DO UPDATE
        SET cannot_leave = true,
            left_at = NULL;

      SELECT first_name, last_name INTO v_first_name, v_last_name
      FROM members
      WHERE id = NEW.captain_id;

      INSERT INTO messages (conversation_id, sender_id, is_system, content)
      VALUES (
        v_team_conv_id,
        NULL,
        true,
        COALESCE(v_first_name || ' ' || v_last_name, 'A new captain') || ' is now team captain.'
      );
    END IF;
  END IF;

  -- Captain chat updates -------------------------------------------------
  IF v_captain_conv_id IS NOT NULL THEN
    -- Demote the old captain ONLY if they don't captain any other team in
    -- this season — a multi-team captain keeps their cannot_leave on the
    -- captain chat.
    IF OLD.captain_id IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1 FROM teams
        WHERE season_id = NEW.season_id
          AND captain_id = OLD.captain_id
          AND id <> NEW.id
      ) INTO v_old_still_captains_in_season;

      IF NOT v_old_still_captains_in_season THEN
        UPDATE conversation_participants
          SET cannot_leave = false
        WHERE conversation_id = v_captain_conv_id
          AND user_id = OLD.captain_id;
      END IF;
    END IF;

    IF NEW.captain_id IS NOT NULL THEN
      INSERT INTO conversation_participants (conversation_id, user_id, role, cannot_leave)
      VALUES (v_captain_conv_id, NEW.captain_id, 'participant', true)
      ON CONFLICT (conversation_id, user_id) DO UPDATE
        SET cannot_leave = true,
            left_at = NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.trg_teams_captain_change() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trg_teams_captain_change() FROM authenticated;

DROP TRIGGER IF EXISTS trg_teams_captain_change_chat ON teams;
CREATE TRIGGER trg_teams_captain_change_chat
AFTER UPDATE OF captain_id ON teams
FOR EACH ROW
WHEN (OLD.captain_id IS DISTINCT FROM NEW.captain_id)
EXECUTE FUNCTION public.trg_teams_captain_change();


-- ----------------------------------------------------------------------------
-- 4. members AFTER UPDATE OF deleted_at → past-member every chat they're in
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.trg_members_soft_delete_chats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  -- Only fire on a true soft-delete (NULL → timestamp). Un-deletes or
  -- timestamp adjustments are no-ops at the chat layer; the user is welcome
  -- back through normal roster INSERT triggers.
  UPDATE conversation_participants
    SET left_at = NOW(),
        cannot_leave = false
  WHERE user_id = NEW.id
    AND left_at IS NULL;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.trg_members_soft_delete_chats() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trg_members_soft_delete_chats() FROM authenticated;

DROP TRIGGER IF EXISTS trg_members_soft_delete_chats ON members;
CREATE TRIGGER trg_members_soft_delete_chats
AFTER UPDATE OF deleted_at ON members
FOR EACH ROW
WHEN (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL)
EXECUTE FUNCTION public.trg_members_soft_delete_chats();


-- ----------------------------------------------------------------------------
-- Documentation
-- ----------------------------------------------------------------------------

COMMENT ON FUNCTION public.trg_team_players_insert_to_team_chat() IS
  'Phase 1 / Unit 5. Mirrors a team_players INSERT into the team auto-managed chat. Re-activates past-membership via ON CONFLICT; posts "X joined" system message only on true inserts (xmax = 0) so updateTeam wholesale-replace stays silent.';

COMMENT ON FUNCTION public.trg_team_players_delete_from_team_chat() IS
  'Phase 1 / Unit 5. Marks the participant as left_at = now() when a team_players row is deleted. Idempotent: only posts the "X left" message when left_at was newly set.';

COMMENT ON FUNCTION public.trg_teams_captain_change() IS
  'Phase 1 / Unit 5. Flips cannot_leave between old and new captain in the team chat and captain chat on a captain_id change. Multi-team captains keep their cannot_leave on the captain chat. Posts a "X is now team captain" message in the team chat.';

COMMENT ON FUNCTION public.trg_members_soft_delete_chats() IS
  'Phase 1 / Unit 5. On members.deleted_at flipping from NULL to a timestamp, marks every active conversation_participants row for that member as left_at = now(). Captain account-deletion case from D24.';
