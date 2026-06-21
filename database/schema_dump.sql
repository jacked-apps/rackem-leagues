


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."moderation_action" AS ENUM (
    'warning',
    'temporary_suspension',
    'permanent_ban',
    'account_deletion',
    'no_action'
);


ALTER TYPE "public"."moderation_action" OWNER TO "postgres";


CREATE TYPE "public"."preference_action" AS ENUM (
    'blackout',
    'ignore'
);


ALTER TYPE "public"."preference_action" OWNER TO "postgres";


CREATE TYPE "public"."preference_type" AS ENUM (
    'holiday',
    'championship',
    'custom'
);


ALTER TYPE "public"."preference_type" OWNER TO "postgres";


CREATE TYPE "public"."report_category" AS ENUM (
    'inappropriate_message',
    'harassment',
    'fake_account',
    'cheating',
    'poor_sportsmanship',
    'impersonation',
    'spam',
    'other'
);


ALTER TYPE "public"."report_category" OWNER TO "postgres";


CREATE TYPE "public"."report_severity" AS ENUM (
    'low',
    'medium',
    'high',
    'critical'
);


ALTER TYPE "public"."report_severity" OWNER TO "postgres";


CREATE TYPE "public"."report_status" AS ENUM (
    'pending',
    'under_review',
    'escalated',
    'action_taken',
    'resolved',
    'dismissed'
);


ALTER TYPE "public"."report_status" OWNER TO "postgres";


CREATE TYPE "public"."user_role" AS ENUM (
    'player',
    'league_operator',
    'developer'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_create_match_lineups"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  home_lineup_uuid UUID;
  away_lineup_uuid UUID;
BEGIN
  -- Create empty home team lineup
  INSERT INTO match_lineups (
    match_id,
    team_id,
    player1_id,
    player1_handicap,
    player2_id,
    player2_handicap,
    player3_id,
    player3_handicap,
    player4_id,
    player4_handicap,
    player5_id,
    player5_handicap,
    home_team_modifier,
    locked,
    locked_at
  ) VALUES (
    NEW.id,
    NEW.home_team_id,
    NULL,
    0,
    NULL,
    0,
    NULL,
    0,
    NULL,
    0,
    NULL,
    0,
    0,
    false,
    NULL
  ) RETURNING id INTO home_lineup_uuid;

  -- Create empty away team lineup
  INSERT INTO match_lineups (
    match_id,
    team_id,
    player1_id,
    player1_handicap,
    player2_id,
    player2_handicap,
    player3_id,
    player3_handicap,
    player4_id,
    player4_handicap,
    player5_id,
    player5_handicap,
    home_team_modifier,
    locked,
    locked_at
  ) VALUES (
    NEW.id,
    NEW.away_team_id,
    NULL,
    0,
    NULL,
    0,
    NULL,
    0,
    NULL,
    0,
    NULL,
    0,
    0,
    false,
    NULL
  ) RETURNING id INTO away_lineup_uuid;

  -- Update the match record with the lineup IDs
  UPDATE matches
  SET
    home_lineup_id = home_lineup_uuid,
    away_lineup_id = away_lineup_uuid
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."auto_create_match_lineups"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."auto_create_match_lineups"() IS 'Automatically creates empty lineup records for both home and away teams when a new match is inserted. This ensures real-time subscriptions have records to watch and eliminates client-side lineup creation logic.';



CREATE OR REPLACE FUNCTION "public"."auto_delete_match_lineups"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Delete home team lineup if it exists
  IF OLD.home_lineup_id IS NOT NULL THEN
    DELETE FROM match_lineups WHERE id = OLD.home_lineup_id;
  END IF;

  -- Delete away team lineup if it exists
  IF OLD.away_lineup_id IS NOT NULL THEN
    DELETE FROM match_lineups WHERE id = OLD.away_lineup_id;
  END IF;

  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."auto_delete_match_lineups"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."auto_delete_match_lineups"() IS 'Automatically deletes lineup records for both home and away teams when a match is deleted. This prevents orphaned lineup records and maintains referential integrity.';



CREATE OR REPLACE FUNCTION "public"."check_delete_time_limit"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Allow deletes within 15 minutes of creation
  IF OLD.created_at + INTERVAL '15 minutes' < NOW() THEN
    RAISE EXCEPTION 'Cannot delete message after 15 minutes';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."check_delete_time_limit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_edit_time_limit"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Allow edits within 5 minutes of creation
  IF OLD.created_at + INTERVAL '5 minutes' < NOW() THEN
    RAISE EXCEPTION 'Cannot edit message after 5 minutes';
  END IF;

  -- Mark as edited
  NEW.is_edited = TRUE;
  NEW.edited_at = NOW();

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."check_edit_time_limit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_announcement_conversation"("p_season_id" "uuid", "p_title" "text", "p_member_ids" "uuid"[]) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_conversation_id UUID;
  v_member_id UUID;
BEGIN
  -- Check if conversation already exists for this season
  SELECT id INTO v_conversation_id
  FROM conversations
  WHERE scope_type = 'season'
    AND scope_id = p_season_id
    AND conversation_type = 'announcements';

  -- If conversation doesn't exist, create it
  IF v_conversation_id IS NULL THEN
    INSERT INTO conversations (
      title,
      conversation_type,
      scope_type,
      scope_id,
      auto_managed
    )
    VALUES (
      p_title,
      'announcements',
      'season',
      p_season_id,
      true
    )
    RETURNING id INTO v_conversation_id;

    -- Add all members as participants
    FOREACH v_member_id IN ARRAY p_member_ids
    LOOP
      INSERT INTO conversation_participants (
        conversation_id,
        user_id
      )
      VALUES (
        v_conversation_id,
        v_member_id
      )
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  RETURN v_conversation_id;
END;
$$;


ALTER FUNCTION "public"."create_announcement_conversation"("p_season_id" "uuid", "p_title" "text", "p_member_ids" "uuid"[]) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."create_announcement_conversation"("p_season_id" "uuid", "p_title" "text", "p_member_ids" "uuid"[]) IS 'Creates or retrieves a season announcement conversation with all participants. Uses SECURITY DEFINER to bypass RLS.';



CREATE OR REPLACE FUNCTION "public"."create_dm_conversation"("user1_id" "uuid", "user2_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  new_conversation_id UUID;
  existing_conversation_id UUID;
BEGIN
  -- First check if conversation already exists between these two users
  -- Must be exactly 2 participants (DM), not a group conversation
  SELECT cp1.conversation_id INTO existing_conversation_id
  FROM conversation_participants cp1
  INNER JOIN conversation_participants cp2
    ON cp1.conversation_id = cp2.conversation_id
  INNER JOIN conversations c
    ON c.id = cp1.conversation_id
  WHERE cp1.user_id = user1_id
    AND cp2.user_id = user2_id
    AND cp1.user_id != cp2.user_id
    AND cp1.left_at IS NULL
    AND cp2.left_at IS NULL
    AND c.auto_managed = FALSE
    -- Ensure exactly 2 participants (DM only, not groups)
    AND (
      SELECT COUNT(*)
      FROM conversation_participants cp3
      WHERE cp3.conversation_id = cp1.conversation_id
        AND cp3.left_at IS NULL
    ) = 2
  LIMIT 1;

  -- If conversation exists, return it
  IF existing_conversation_id IS NOT NULL THEN
    RETURN existing_conversation_id;
  END IF;

  -- Create new conversation
  INSERT INTO conversations (auto_managed, conversation_type, scope_type, scope_id)
  VALUES (false, null, 'none', null)
  RETURNING id INTO new_conversation_id;

  -- Add both participants
  INSERT INTO conversation_participants (conversation_id, user_id)
  VALUES
    (new_conversation_id, user1_id),
    (new_conversation_id, user2_id);

  RETURN new_conversation_id;
END;
$$;


ALTER FUNCTION "public"."create_dm_conversation"("user1_id" "uuid", "user2_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."create_dm_conversation"("user1_id" "uuid", "user2_id" "uuid") IS 'Creates or returns existing DM conversation between two users (NOT groups), bypassing RLS for conversation creation';



CREATE OR REPLACE FUNCTION "public"."create_group_conversation"("creator_id" "uuid", "group_name" "text", "member_ids" "uuid"[]) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  new_conversation_id UUID;
  member_id UUID;
BEGIN
  -- Validate inputs
  IF group_name IS NULL OR trim(group_name) = '' THEN
    RAISE EXCEPTION 'Group name is required';
  END IF;

  IF array_length(member_ids, 1) IS NULL OR array_length(member_ids, 1) < 2 THEN
    RAISE EXCEPTION 'Group must have at least 2 members';
  END IF;

  IF array_length(member_ids, 1) > 25 THEN
    RAISE EXCEPTION 'Group cannot have more than 25 members';
  END IF;

  -- Create the conversation
  -- For manual groups: conversation_type = NULL, scope_type = 'none', auto_managed = FALSE
  INSERT INTO conversations (title, conversation_type, scope_type, auto_managed)
  VALUES (trim(group_name), NULL, 'none', FALSE)
  RETURNING id INTO new_conversation_id;

  -- Add all members as participants
  FOREACH member_id IN ARRAY member_ids
  LOOP
    INSERT INTO conversation_participants (conversation_id, user_id)
    VALUES (new_conversation_id, member_id)
    ON CONFLICT (conversation_id, user_id) DO NOTHING;
  END LOOP;

  RETURN new_conversation_id;
END;
$$;


ALTER FUNCTION "public"."create_group_conversation"("creator_id" "uuid", "group_name" "text", "member_ids" "uuid"[]) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."create_group_conversation"("creator_id" "uuid", "group_name" "text", "member_ids" "uuid"[]) IS 'Create a new group conversation with multiple participants. Bypasses RLS using SECURITY DEFINER.';



CREATE OR REPLACE FUNCTION "public"."create_organization_announcement_conversation"("p_organization_id" "uuid", "p_title" "text", "p_member_ids" "uuid"[]) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_conversation_id UUID;
  v_member_id UUID;
BEGIN
  -- Check if conversation already exists for this organization
  SELECT id INTO v_conversation_id
  FROM conversations
  WHERE scope_type = 'organization'
    AND scope_id = p_organization_id
    AND conversation_type = 'announcements';

  -- If conversation doesn't exist, create it
  IF v_conversation_id IS NULL THEN
    INSERT INTO conversations (
      title,
      conversation_type,
      scope_type,
      scope_id,
      auto_managed
    )
    VALUES (
      p_title,
      'announcements',
      'organization',
      p_organization_id,
      true
    )
    RETURNING id INTO v_conversation_id;

    -- Add all members as participants
    FOREACH v_member_id IN ARRAY p_member_ids
    LOOP
      INSERT INTO conversation_participants (
        conversation_id,
        user_id
      )
      VALUES (
        v_conversation_id,
        v_member_id
      )
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  RETURN v_conversation_id;
END;
$$;


ALTER FUNCTION "public"."create_organization_announcement_conversation"("p_organization_id" "uuid", "p_title" "text", "p_member_ids" "uuid"[]) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."create_organization_announcement_conversation"("p_organization_id" "uuid", "p_title" "text", "p_member_ids" "uuid"[]) IS 'Creates or retrieves an organization announcement conversation with all participants. Uses SECURITY DEFINER to bypass RLS.';



CREATE OR REPLACE FUNCTION "public"."get_current_member_id"() RETURNS "uuid"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN (SELECT id FROM members WHERE user_id = auth.uid() LIMIT 1);
END;
$$;


ALTER FUNCTION "public"."get_current_member_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_unread_count"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Increment unread count for all participants except the sender
  UPDATE conversation_participants
  SET unread_count = unread_count + 1
  WHERE conversation_id = NEW.conversation_id
    AND user_id != NEW.sender_id
    AND left_at IS NULL;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."increment_unread_count"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."increment_unread_count"() IS 'Increments unread_count for participants except sender (SECURITY DEFINER)';



CREATE OR REPLACE FUNCTION "public"."is_conversation_participant"("conv_id" "uuid", "uid" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM conversation_participants
    WHERE conversation_id = conv_id
      AND user_id = uid
      AND left_at IS NULL
  );
END;
$$;


ALTER FUNCTION "public"."is_conversation_participant"("conv_id" "uuid", "uid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_report_status_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF OLD.status != NEW.status THEN
    INSERT INTO report_updates (
      report_id,
      updater_id,
      updater_role,
      old_status,
      new_status,
      update_notes
    ) VALUES (
      NEW.id,
      (SELECT id FROM members WHERE user_id = auth.uid() LIMIT 1),
      (CASE
        WHEN EXISTS (SELECT 1 FROM league_operators WHERE member_id = (SELECT id FROM members WHERE user_id = auth.uid() LIMIT 1)) THEN 'operator'
        WHEN EXISTS (SELECT 1 FROM members WHERE user_id = auth.uid() AND role = 'developer') THEN 'developer'
        ELSE 'unknown'
      END),
      OLD.status,
      NEW.status,
      NULL
    );
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_report_status_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_blocked_user_dm"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  participant_ids UUID[];
  is_dm BOOLEAN;
BEGIN
  -- Check if this is a DM conversation (2 participants, not auto-managed)
  SELECT
    (SELECT auto_managed FROM conversations WHERE id = NEW.conversation_id) = FALSE
    AND (SELECT COUNT(*) FROM conversation_participants WHERE conversation_id = NEW.conversation_id) = 1
  INTO is_dm;

  -- If this is a DM, check for blocks
  IF is_dm THEN
    -- Get the other participant's ID
    SELECT ARRAY_AGG(user_id)
    INTO participant_ids
    FROM conversation_participants
    WHERE conversation_id = NEW.conversation_id;

    -- Check if either user has blocked the other
    IF EXISTS (
      SELECT 1 FROM blocked_users
      WHERE (blocker_id = NEW.user_id AND blocked_id = ANY(participant_ids))
         OR (blocker_id = ANY(participant_ids) AND blocked_id = NEW.user_id)
    ) THEN
      RAISE EXCEPTION 'Cannot join conversation with blocked user';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."prevent_blocked_user_dm"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reset_unread_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- When last_read_at is updated, reset unread count to 0
  IF NEW.last_read_at IS DISTINCT FROM OLD.last_read_at THEN
    NEW.unread_count = 0;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."reset_unread_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_reviewed_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- When status changes from pending to anything else, set reviewed_at
  IF OLD.status = 'pending' AND NEW.status != 'pending' THEN
    NEW.reviewed_at = NOW();
    NEW.reviewed_by = auth.uid();
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_reviewed_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_championship_date_options_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_championship_date_options_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_championship_dates_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_championship_dates_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_conversation_last_message"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Update conversation with new message info
  UPDATE conversations
  SET
    last_message_at = NEW.created_at,
    last_message_preview = CASE
      WHEN LENGTH(NEW.content) > 100 THEN SUBSTRING(NEW.content FROM 1 FOR 100) || '...'
      ELSE NEW.content
    END
  WHERE id = NEW.conversation_id;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_conversation_last_message"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_conversation_on_message_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  last_msg RECORD;
BEGIN
  -- Find the most recent non-deleted message
  SELECT created_at, content INTO last_msg
  FROM messages
  WHERE conversation_id = NEW.conversation_id
    AND is_deleted = FALSE
  ORDER BY created_at DESC
  LIMIT 1;

  -- Update conversation with most recent non-deleted message
  IF last_msg IS NOT NULL THEN
    UPDATE conversations
    SET
      last_message_at = last_msg.created_at,
      last_message_preview = CASE
        WHEN LENGTH(last_msg.content) > 100 THEN SUBSTRING(last_msg.content FROM 1 FOR 100) || '...'
        ELSE last_msg.content
      END
    WHERE id = NEW.conversation_id;
  ELSE
    -- No messages left, clear preview
    UPDATE conversations
    SET
      last_message_at = NULL,
      last_message_preview = NULL
    WHERE id = NEW.conversation_id;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_conversation_on_message_delete"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_conversations_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_conversations_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_league_operators_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_league_operators_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_league_venues_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_league_venues_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_leagues_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_leagues_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_match_lineups_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  IF NEW.locked = true AND OLD.locked = false THEN
    NEW.locked_at = now();
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_match_lineups_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_match_venues_on_team_venue_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  match_count INTEGER;
BEGIN
  -- Only proceed if home_venue_id actually changed
  IF OLD.home_venue_id IS DISTINCT FROM NEW.home_venue_id THEN
    RAISE NOTICE 'Trigger fired! Team ID: %, Old Venue: %, New Venue: %',
      NEW.id, OLD.home_venue_id, NEW.home_venue_id;

    -- Update all matches where this team is the home team
    UPDATE matches
    SET
      scheduled_venue_id = NEW.home_venue_id,
      updated_at = NOW()
    WHERE home_team_id = NEW.id
      AND status IN ('scheduled', 'in_progress');

    GET DIAGNOSTICS match_count = ROW_COUNT;

    RAISE NOTICE 'Updated % matches for team % with new venue %',
      match_count, NEW.id, NEW.home_venue_id;
  ELSE
    RAISE NOTICE 'Trigger fired but venue unchanged for team %', NEW.id;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_match_venues_on_team_venue_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_matches_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_matches_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_members_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_members_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_messages_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_messages_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_operator_blackout_preferences_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_operator_blackout_preferences_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_report_resolved_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.status IN ('resolved', 'dismissed', 'action_taken') AND OLD.resolved_at IS NULL THEN
    NEW.resolved_at = NOW();
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_report_resolved_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_report_reviewed_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF OLD.status = 'pending' AND NEW.status != 'pending' THEN
    NEW.reviewed_at = NOW();
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_report_reviewed_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_season_weeks_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_season_weeks_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_seasons_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_seasons_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_team_players_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_team_players_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_teams_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_teams_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_reports_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_user_reports_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_venue_owners_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_venue_owners_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_venues_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_venues_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."blocked_users" (
    "blocker_id" "uuid" NOT NULL,
    "blocked_id" "uuid" NOT NULL,
    "blocked_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reason" "text",
    CONSTRAINT "cannot_block_self" CHECK (("blocker_id" <> "blocked_id"))
);


ALTER TABLE "public"."blocked_users" OWNER TO "postgres";


COMMENT ON TABLE "public"."blocked_users" IS 'Tracks user blocking relationships for direct messages';



COMMENT ON COLUMN "public"."blocked_users"."blocker_id" IS 'User who initiated the block';



COMMENT ON COLUMN "public"."blocked_users"."blocked_id" IS 'User who was blocked';



COMMENT ON COLUMN "public"."blocked_users"."blocked_at" IS 'When the block was created';



COMMENT ON COLUMN "public"."blocked_users"."reason" IS 'Optional reason for block (user-facing, for their own reference)';



CREATE TABLE IF NOT EXISTS "public"."championship_date_options" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization" "text" NOT NULL,
    "year" integer NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "vote_count" integer DEFAULT 1 NOT NULL,
    "dev_verified" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "championship_date_options_organization_check" CHECK (("organization" = ANY (ARRAY['BCA'::"text", 'APA'::"text"]))),
    CONSTRAINT "championship_date_options_vote_count_check" CHECK (("vote_count" >= 1)),
    CONSTRAINT "championship_date_options_year_check" CHECK ((("year" >= 2024) AND ("year" <= 2050))),
    CONSTRAINT "valid_date_range" CHECK (("end_date" > "start_date"))
);


ALTER TABLE "public"."championship_date_options" OWNER TO "postgres";


COMMENT ON TABLE "public"."championship_date_options" IS 'Stores championship tournament dates with community vote counts. Dev-verified dates are authoritative and bypass user selection.';



COMMENT ON COLUMN "public"."championship_date_options"."organization" IS 'Tournament organization: BCA or APA';



COMMENT ON COLUMN "public"."championship_date_options"."year" IS 'Championship year (used for cleanup of past dates)';



COMMENT ON COLUMN "public"."championship_date_options"."vote_count" IS 'Number of operators who have confirmed these dates';



COMMENT ON COLUMN "public"."championship_date_options"."dev_verified" IS 'When true, these dates are authoritative and can auto-fill in wizard';



CREATE TABLE IF NOT EXISTS "public"."conversation_participants" (
    "conversation_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" character varying(50) DEFAULT 'participant'::character varying NOT NULL,
    "is_muted" boolean DEFAULT false NOT NULL,
    "notifications_enabled" boolean DEFAULT true NOT NULL,
    "last_read_at" timestamp with time zone,
    "unread_count" integer DEFAULT 0 NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "left_at" timestamp with time zone,
    CONSTRAINT "conversation_participants_role_check" CHECK ((("role")::"text" = ANY (ARRAY[('admin'::character varying)::"text", ('participant'::character varying)::"text"]))),
    CONSTRAINT "valid_participant" CHECK ((("left_at" IS NULL) OR ("left_at" >= "joined_at")))
);


ALTER TABLE "public"."conversation_participants" OWNER TO "postgres";


COMMENT ON TABLE "public"."conversation_participants" IS 'Join table connecting users to conversations with per-user settings';



COMMENT ON COLUMN "public"."conversation_participants"."role" IS 'User role in conversation: admin (can add/remove users) or participant';



COMMENT ON COLUMN "public"."conversation_participants"."is_muted" IS 'User has muted notifications for this conversation';



COMMENT ON COLUMN "public"."conversation_participants"."notifications_enabled" IS 'User wants push notifications for this conversation';



COMMENT ON COLUMN "public"."conversation_participants"."last_read_at" IS 'Last time user viewed messages in this conversation (for unread tracking)';



COMMENT ON COLUMN "public"."conversation_participants"."unread_count" IS 'Number of unread messages for this user in this conversation';



COMMENT ON COLUMN "public"."conversation_participants"."left_at" IS 'When user left conversation (NULL if still participating)';



CREATE TABLE IF NOT EXISTS "public"."conversations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "title" character varying(200),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_message_at" timestamp with time zone,
    "last_message_preview" "text",
    "auto_managed" boolean DEFAULT false NOT NULL,
    "conversation_type" character varying(50),
    "scope_type" character varying(50),
    "scope_id" "uuid",
    CONSTRAINT "conversations_conversation_type_check" CHECK ((("conversation_type")::"text" = ANY (ARRAY[('direct'::character varying)::"text", ('team_chat'::character varying)::"text", ('captains_chat'::character varying)::"text", ('announcements'::character varying)::"text"]))),
    CONSTRAINT "conversations_scope_type_check" CHECK ((("scope_type")::"text" = ANY (ARRAY[('team'::character varying)::"text", ('season'::character varying)::"text", ('organization'::character varying)::"text", ('none'::character varying)::"text"]))),
    CONSTRAINT "valid_auto_managed" CHECK (((("auto_managed" = false) AND ("conversation_type" IS NULL) AND (("scope_type")::"text" = 'none'::"text")) OR (("auto_managed" = true) AND ("conversation_type" IS NOT NULL) AND ("scope_type" IS NOT NULL) AND ("scope_id" IS NOT NULL))))
);


ALTER TABLE "public"."conversations" OWNER TO "postgres";


COMMENT ON TABLE "public"."conversations" IS 'Represents conversations between 2+ users including DMs, team chats, and announcements';



COMMENT ON COLUMN "public"."conversations"."last_message_at" IS 'Timestamp of most recent message, used for sorting conversation list';



COMMENT ON COLUMN "public"."conversations"."last_message_preview" IS 'Preview text of last message, shown in conversation list';



COMMENT ON COLUMN "public"."conversations"."auto_managed" IS 'True for system-created conversations (team chat, captains chat, announcements)';



COMMENT ON COLUMN "public"."conversations"."conversation_type" IS 'Type of conversation: direct, team_chat, captains_chat, or announcements';



COMMENT ON COLUMN "public"."conversations"."scope_type" IS 'What entity this conversation is scoped to: team, season, organization, or none';



COMMENT ON COLUMN "public"."conversations"."scope_id" IS 'Foreign key to the team, season, or organization (stored as UUID)';



CREATE TABLE IF NOT EXISTS "public"."league_operators" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "member_id" "uuid" NOT NULL,
    "organization_name" character varying(255) NOT NULL,
    "organization_address" character varying(255) NOT NULL,
    "organization_city" character varying(100) NOT NULL,
    "organization_state" character varying(2) NOT NULL,
    "organization_zip_code" character varying(10) NOT NULL,
    "contact_disclaimer_acknowledged" boolean DEFAULT false NOT NULL,
    "league_email" character varying(255) NOT NULL,
    "email_visibility" character varying(20) DEFAULT 'in_app_only'::character varying NOT NULL,
    "league_phone" character varying(20) NOT NULL,
    "phone_visibility" character varying(20) DEFAULT 'in_app_only'::character varying NOT NULL,
    "stripe_customer_id" character varying(100) NOT NULL,
    "payment_method_id" character varying(100) NOT NULL,
    "card_last4" character varying(4) NOT NULL,
    "card_brand" character varying(20) NOT NULL,
    "expiry_month" integer NOT NULL,
    "expiry_year" integer NOT NULL,
    "billing_zip" character varying(10) NOT NULL,
    "payment_verified" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "profanity_filter_enabled" boolean DEFAULT false,
    CONSTRAINT "league_operators_email_visibility_check" CHECK ((("email_visibility")::"text" = ANY (ARRAY[('in_app_only'::character varying)::"text", ('my_organization'::character varying)::"text", ('my_team_captains'::character varying)::"text", ('my_teams'::character varying)::"text", ('anyone'::character varying)::"text"]))),
    CONSTRAINT "league_operators_expiry_month_check" CHECK ((("expiry_month" >= 1) AND ("expiry_month" <= 12))),
    CONSTRAINT "league_operators_expiry_year_check" CHECK (("expiry_year" >= 2025)),
    CONSTRAINT "league_operators_phone_visibility_check" CHECK ((("phone_visibility")::"text" = ANY (ARRAY[('in_app_only'::character varying)::"text", ('my_organization'::character varying)::"text", ('my_team_captains'::character varying)::"text", ('my_teams'::character varying)::"text", ('anyone'::character varying)::"text"])))
);


ALTER TABLE "public"."league_operators" OWNER TO "postgres";


COMMENT ON COLUMN "public"."league_operators"."profanity_filter_enabled" IS 'Organization-wide profanity validation setting. When enabled, team names and public content containing profanity will be rejected.';



CREATE TABLE IF NOT EXISTS "public"."league_venues" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "league_id" "uuid" NOT NULL,
    "venue_id" "uuid" NOT NULL,
    "available_bar_box_tables" integer DEFAULT 0 NOT NULL,
    "available_regulation_tables" integer DEFAULT 0 NOT NULL,
    "available_total_tables" integer GENERATED ALWAYS AS (("available_bar_box_tables" + "available_regulation_tables")) STORED,
    "added_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "league_venue_must_have_tables" CHECK (("available_total_tables" > 0)),
    CONSTRAINT "league_venues_available_bar_box_tables_check" CHECK (("available_bar_box_tables" >= 0)),
    CONSTRAINT "league_venues_available_regulation_tables_check" CHECK (("available_regulation_tables" >= 0))
);


ALTER TABLE "public"."league_venues" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."leagues" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "operator_id" "uuid" NOT NULL,
    "game_type" character varying(20) NOT NULL,
    "day_of_week" character varying(10) NOT NULL,
    "division" character varying(50),
    "team_format" character varying(20) NOT NULL,
    "league_start_date" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "status" character varying(20) DEFAULT 'active'::character varying NOT NULL,
    "handicap_variant" "text" DEFAULT 'standard'::"text" NOT NULL,
    "team_handicap_variant" "text" DEFAULT 'standard'::"text" NOT NULL,
    "golden_break_counts_as_win" boolean DEFAULT true NOT NULL,
    "handicap_level" character varying(20) DEFAULT 'standard'::character varying NOT NULL,
    CONSTRAINT "leagues_day_of_week_check" CHECK ((("day_of_week")::"text" = ANY (ARRAY[('monday'::character varying)::"text", ('tuesday'::character varying)::"text", ('wednesday'::character varying)::"text", ('thursday'::character varying)::"text", ('friday'::character varying)::"text", ('saturday'::character varying)::"text", ('sunday'::character varying)::"text"]))),
    CONSTRAINT "leagues_game_type_check" CHECK ((("game_type")::"text" = ANY (ARRAY[('eight_ball'::character varying)::"text", ('nine_ball'::character varying)::"text", ('ten_ball'::character varying)::"text"]))),
    CONSTRAINT "leagues_handicap_level_check" CHECK ((("handicap_level")::"text" = ANY (ARRAY[('standard'::character varying)::"text", ('reduced'::character varying)::"text", ('none'::character varying)::"text"]))),
    CONSTRAINT "leagues_handicap_variant_check" CHECK (("handicap_variant" = ANY (ARRAY['standard'::"text", 'reduced'::"text", 'none'::"text"]))),
    CONSTRAINT "leagues_status_check" CHECK ((("status")::"text" = ANY (ARRAY[('active'::character varying)::"text", ('completed'::character varying)::"text", ('abandoned'::character varying)::"text"]))),
    CONSTRAINT "leagues_team_format_check" CHECK ((("team_format")::"text" = ANY (ARRAY[('5_man'::character varying)::"text", ('8_man'::character varying)::"text"]))),
    CONSTRAINT "leagues_team_handicap_variant_check" CHECK (("team_handicap_variant" = ANY (ARRAY['standard'::"text", 'reduced'::"text", 'none'::"text"])))
);


ALTER TABLE "public"."leagues" OWNER TO "postgres";


COMMENT ON COLUMN "public"."leagues"."handicap_variant" IS 'Determines player handicap range: standard (-2 to +2), reduced (-1 to +1), or none (all 0)';



COMMENT ON COLUMN "public"."leagues"."team_handicap_variant" IS 'Determines team bonus handicap: standard (every 2 ahead), reduced (every 3 ahead), or none (no bonus)';



COMMENT ON COLUMN "public"."leagues"."golden_break_counts_as_win" IS 'If true, sinking game ball on break (8BB/9BB) counts as a win. If false, breaker re-racks and breaks again.';



COMMENT ON COLUMN "public"."leagues"."handicap_level" IS 'Handicap level for the league: standard (full range 2,1,0,-1,-2), reduced (capped range 1,0,-1), or none (all players 0)';



CREATE TABLE IF NOT EXISTS "public"."match_games" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "match_id" "uuid" NOT NULL,
    "game_number" integer NOT NULL,
    "home_player_id" "uuid",
    "away_player_id" "uuid",
    "winner_team_id" "uuid",
    "winner_player_id" "uuid",
    "home_action" "text" NOT NULL,
    "away_action" "text" NOT NULL,
    "break_and_run" boolean DEFAULT false NOT NULL,
    "golden_break" boolean DEFAULT false NOT NULL,
    "confirmed_at" timestamp with time zone,
    "is_tiebreaker" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "game_type" character varying(20) NOT NULL,
    "confirmed_by_home" "uuid",
    "confirmed_by_away" "uuid",
    "vacate_requested_by" character varying(4),
    "home_position" integer,
    "away_position" integer,
    CONSTRAINT "match_games_away_action_check" CHECK (("away_action" = ANY (ARRAY['breaks'::"text", 'racks'::"text"]))),
    CONSTRAINT "match_games_away_position_check" CHECK ((("away_position" >= 1) AND ("away_position" <= 5))),
    CONSTRAINT "match_games_check" CHECK ((NOT (("break_and_run" = true) AND ("golden_break" = true)))),
    CONSTRAINT "match_games_game_type_check" CHECK ((("game_type")::"text" = ANY ((ARRAY['eight_ball'::character varying, 'nine_ball'::character varying, 'ten_ball'::character varying])::"text"[]))),
    CONSTRAINT "match_games_home_action_check" CHECK (("home_action" = ANY (ARRAY['breaks'::"text", 'racks'::"text"]))),
    CONSTRAINT "match_games_home_position_check" CHECK ((("home_position" >= 1) AND ("home_position" <= 5))),
    CONSTRAINT "match_games_vacate_requested_by_check" CHECK ((("vacate_requested_by")::"text" = ANY ((ARRAY['home'::character varying, 'away'::character varying])::"text"[])))
);


ALTER TABLE "public"."match_games" OWNER TO "postgres";


COMMENT ON COLUMN "public"."match_games"."break_and_run" IS 'Break and Run (B&R): Player breaks and runs the entire table. Always tracked for statistics.';



COMMENT ON COLUMN "public"."match_games"."golden_break" IS '8BB/9BB: Game ball sunk on break. Whether this counts as a win depends on league.golden_break_counts_as_win setting.';



COMMENT ON COLUMN "public"."match_games"."game_type" IS 'Denormalized from league for performance. Game type (eight_ball, nine_ball, ten_ball) for fast filtering.';



COMMENT ON COLUMN "public"."match_games"."confirmed_by_home" IS 'Member ID who confirmed this game result for home team';



COMMENT ON COLUMN "public"."match_games"."confirmed_by_away" IS 'Member ID who confirmed this game result for away team';



COMMENT ON COLUMN "public"."match_games"."vacate_requested_by" IS 'Indicates which team requested to vacate this game score. NULL = no request, ''home'' = home team requested, ''away'' = away team requested. Preserves original confirmation UUIDs during vacate request flow.';



COMMENT ON COLUMN "public"."match_games"."home_position" IS 'Lineup position (1-5) for home player. Used to differentiate games when same player appears in multiple positions (5v5 double duty).';



COMMENT ON COLUMN "public"."match_games"."away_position" IS 'Lineup position (1-5) for away player. Used to differentiate games when same player appears in multiple positions (5v5 double duty).';



CREATE TABLE IF NOT EXISTS "public"."match_lineups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "match_id" "uuid" NOT NULL,
    "team_id" "uuid" NOT NULL,
    "player1_id" "uuid",
    "player1_handicap" numeric(5,1) NOT NULL,
    "player2_id" "uuid",
    "player2_handicap" numeric(5,1) NOT NULL,
    "player3_id" "uuid",
    "player3_handicap" numeric(5,1) NOT NULL,
    "locked" boolean DEFAULT false NOT NULL,
    "locked_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "home_team_modifier" numeric(5,1) DEFAULT 0 NOT NULL,
    "player4_id" "uuid",
    "player4_handicap" numeric(5,1),
    "player5_id" "uuid",
    "player5_handicap" numeric(5,1),
    CONSTRAINT "player1_handicap_range" CHECK ((("player1_handicap" >= ('-10'::integer)::numeric) AND ("player1_handicap" <= (100)::numeric))),
    CONSTRAINT "player2_handicap_range" CHECK ((("player2_handicap" >= ('-10'::integer)::numeric) AND ("player2_handicap" <= (100)::numeric))),
    CONSTRAINT "player3_handicap_range" CHECK ((("player3_handicap" >= ('-10'::integer)::numeric) AND ("player3_handicap" <= (100)::numeric))),
    CONSTRAINT "player4_handicap_range" CHECK ((("player4_handicap" >= ('-10'::integer)::numeric) AND ("player4_handicap" <= (100)::numeric))),
    CONSTRAINT "player5_handicap_range" CHECK ((("player5_handicap" >= ('-10'::integer)::numeric) AND ("player5_handicap" <= (100)::numeric)))
);


ALTER TABLE "public"."match_lineups" OWNER TO "postgres";


COMMENT ON COLUMN "public"."match_lineups"."player1_handicap" IS 'Player 1 handicap at lineup lock. 3v3: -2 to +2 integer. 5v5: 0-100 percentage.';



COMMENT ON COLUMN "public"."match_lineups"."player2_handicap" IS 'Player 2 handicap at lineup lock. 3v3: -2 to +2 integer. 5v5: 0-100 percentage.';



COMMENT ON COLUMN "public"."match_lineups"."player3_handicap" IS 'Player 3 handicap at lineup lock. 3v3: -2 to +2 integer. 5v5: 0-100 percentage.';



COMMENT ON COLUMN "public"."match_lineups"."home_team_modifier" IS 'Home team standings modifier (bonus/penalty based on season record)';



COMMENT ON COLUMN "public"."match_lineups"."player4_id" IS 'Fourth player ID (used for 5v5 matches in 8-man team format)';



COMMENT ON COLUMN "public"."match_lineups"."player4_handicap" IS 'Player 4 handicap at lineup lock (5v5 only). 0-100 percentage.';



COMMENT ON COLUMN "public"."match_lineups"."player5_id" IS 'Fifth player ID (used for 5v5 matches in 8-man team format)';



COMMENT ON COLUMN "public"."match_lineups"."player5_handicap" IS 'Player 5 handicap at lineup lock (5v5 only). 0-100 percentage.';



CREATE TABLE IF NOT EXISTS "public"."matches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "season_id" "uuid" NOT NULL,
    "season_week_id" "uuid" NOT NULL,
    "home_team_id" "uuid",
    "away_team_id" "uuid",
    "scheduled_venue_id" "uuid",
    "actual_venue_id" "uuid",
    "match_number" integer NOT NULL,
    "status" "text" DEFAULT 'scheduled'::"text" NOT NULL,
    "home_team_score" integer,
    "away_team_score" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "home_lineup_id" "uuid",
    "away_lineup_id" "uuid",
    "home_games_to_win" integer,
    "away_games_to_win" integer,
    "home_games_to_tie" integer,
    "away_games_to_tie" integer,
    "home_games_won" integer DEFAULT 0 NOT NULL,
    "away_games_won" integer DEFAULT 0 NOT NULL,
    "home_points_earned" numeric(4,1) DEFAULT 0 NOT NULL,
    "away_points_earned" numeric(4,1) DEFAULT 0 NOT NULL,
    "winner_team_id" "uuid",
    "match_result" "text",
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "results_confirmed_by_home" boolean DEFAULT false NOT NULL,
    "results_confirmed_by_away" boolean DEFAULT false NOT NULL,
    "home_team_verified_by" "uuid",
    "away_team_verified_by" "uuid",
    "home_games_to_lose" integer,
    "away_games_to_lose" integer,
    "home_tiebreaker_verified_by" "uuid",
    "away_tiebreaker_verified_by" "uuid",
    CONSTRAINT "matches_match_result_check" CHECK (("match_result" = ANY (ARRAY['home_win'::"text", 'away_win'::"text", 'tie'::"text"]))),
    CONSTRAINT "matches_status_check" CHECK (("status" = ANY (ARRAY['scheduled'::"text", 'in_progress'::"text", 'awaiting_verification'::"text", 'completed'::"text", 'forfeited'::"text", 'postponed'::"text"])))
);


ALTER TABLE "public"."matches" OWNER TO "postgres";


COMMENT ON TABLE "public"."matches" IS 'Individual matches between teams for each week of the season';



COMMENT ON COLUMN "public"."matches"."scheduled_venue_id" IS 'Originally scheduled venue (usually home team venue)';



COMMENT ON COLUMN "public"."matches"."actual_venue_id" IS 'Actual venue if different from scheduled (e.g., venue conflict)';



COMMENT ON COLUMN "public"."matches"."match_number" IS 'Order of match on the night (1, 2, 3...) for scheduling table assignments';



COMMENT ON COLUMN "public"."matches"."status" IS 'Match status progression:
  - scheduled: Match created, awaiting lineups
  - in_progress: Scoring active (lineups locked, games being played)
  - results_ready: All games scored, awaiting results confirmation from both teams
  - finalized: Both teams confirmed results (end state for normal completion)
  - completed: Legacy status (may be used for admin-completed matches)
  - forfeited: Match forfeited by one team
  - postponed: Match postponed/rescheduled';



COMMENT ON COLUMN "public"."matches"."home_lineup_id" IS 'Lineup used by home team for this match (set at lineup lock)';



COMMENT ON COLUMN "public"."matches"."away_lineup_id" IS 'Lineup used by away team for this match (set at lineup lock)';



COMMENT ON COLUMN "public"."matches"."home_games_to_win" IS 'Number of games home team needs to win the match (from handicap chart)';



COMMENT ON COLUMN "public"."matches"."away_games_to_win" IS 'Number of games away team needs to win the match (from handicap chart)';



COMMENT ON COLUMN "public"."matches"."home_games_to_tie" IS 'Number of games home team needs to tie the match (null if ties not allowed)';



COMMENT ON COLUMN "public"."matches"."away_games_to_tie" IS 'Number of games away team needs to tie the match (null if ties not allowed)';



COMMENT ON COLUMN "public"."matches"."home_games_won" IS 'Current count of games won by home team (updated live during match)';



COMMENT ON COLUMN "public"."matches"."away_games_won" IS 'Current count of games won by away team (updated live during match)';



COMMENT ON COLUMN "public"."matches"."home_points_earned" IS 'Points earned by home team. Uses numeric(4,1) to support BCA scoring with decimal values (e.g., 1.5 for 70% bonus)';



COMMENT ON COLUMN "public"."matches"."away_points_earned" IS 'Points earned by away team. Uses numeric(4,1) to support BCA scoring with decimal values (e.g., 1.5 for 70% bonus)';



COMMENT ON COLUMN "public"."matches"."winner_team_id" IS 'Team that won the match (null if tie or not completed)';



COMMENT ON COLUMN "public"."matches"."match_result" IS 'Final result: home_win, away_win, or tie (set when match completes)';



COMMENT ON COLUMN "public"."matches"."started_at" IS 'Timestamp when first game was scored';



COMMENT ON COLUMN "public"."matches"."completed_at" IS 'Timestamp when match was completed (team reached games_to_win)';



COMMENT ON COLUMN "public"."matches"."results_confirmed_by_home" IS 'Whether the home team has confirmed the match results on the results page';



COMMENT ON COLUMN "public"."matches"."results_confirmed_by_away" IS 'Whether the away team has confirmed the match results on the results page';



COMMENT ON COLUMN "public"."matches"."home_team_verified_by" IS 'Member ID of home team player who verified final scores';



COMMENT ON COLUMN "public"."matches"."away_team_verified_by" IS 'Member ID of away team player who verified final scores';



COMMENT ON COLUMN "public"."matches"."home_games_to_lose" IS 'Number of games home team needs to lose the match (based on handicap thresholds)';



COMMENT ON COLUMN "public"."matches"."away_games_to_lose" IS 'Number of games away team needs to lose the match (based on handicap thresholds)';



COMMENT ON COLUMN "public"."matches"."home_tiebreaker_verified_by" IS 'Member who verified tiebreaker results for home team';



COMMENT ON COLUMN "public"."matches"."away_tiebreaker_verified_by" IS 'Member who verified tiebreaker results for away team';



CREATE TABLE IF NOT EXISTS "public"."members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "first_name" character varying(100) NOT NULL,
    "last_name" character varying(100) NOT NULL,
    "nickname" character varying(12),
    "phone" character varying(20) NOT NULL,
    "email" character varying(255) NOT NULL,
    "address" character varying(255) NOT NULL,
    "city" character varying(100) NOT NULL,
    "state" character varying(2) NOT NULL,
    "zip_code" character varying(10) NOT NULL,
    "date_of_birth" "date" NOT NULL,
    "role" "public"."user_role" DEFAULT 'player'::"public"."user_role",
    "system_player_number" integer NOT NULL,
    "bca_member_number" character varying(20),
    "membership_paid_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "profanity_filter_enabled" boolean DEFAULT false
);


ALTER TABLE "public"."members" OWNER TO "postgres";


COMMENT ON TABLE "public"."members" IS 'Player/member records. Includes two special substitute members with fixed UUIDs:
  - 00000000-0000-0000-0000-000000000001: Home team substitute placeholder
  - 00000000-0000-0000-0000-000000000002: Away team substitute placeholder
  These allow tracking substitute wins/losses in match games.';



COMMENT ON COLUMN "public"."members"."profanity_filter_enabled" IS 'Personal profanity filter preference for message display. Forced ON for users under 18, optional for adults.';



CREATE SEQUENCE IF NOT EXISTS "public"."members_system_player_number_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."members_system_player_number_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."members_system_player_number_seq" OWNED BY "public"."members"."system_player_number";



CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "edited_at" timestamp with time zone,
    "deleted_at" timestamp with time zone,
    "is_edited" boolean DEFAULT false NOT NULL,
    "is_deleted" boolean DEFAULT false NOT NULL,
    CONSTRAINT "messages_content_check" CHECK ((("length"("content") > 0) AND ("length"("content") <= 2000)))
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


COMMENT ON TABLE "public"."messages" IS 'Individual messages within conversations, supporting edit/delete with time limits';



COMMENT ON COLUMN "public"."messages"."content" IS 'Message text content (max 2000 characters)';



COMMENT ON COLUMN "public"."messages"."edited_at" IS 'Last time message was edited (NULL if never edited)';



COMMENT ON COLUMN "public"."messages"."deleted_at" IS 'Soft delete timestamp (NULL if not deleted)';



COMMENT ON COLUMN "public"."messages"."is_edited" IS 'True if message has been edited';



COMMENT ON COLUMN "public"."messages"."is_deleted" IS 'True if message has been soft-deleted';



CREATE TABLE IF NOT EXISTS "public"."operator_blackout_preferences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "operator_id" "uuid" NOT NULL,
    "preference_type" "public"."preference_type" NOT NULL,
    "preference_action" "public"."preference_action" NOT NULL,
    "holiday_name" "text",
    "championship_id" "uuid",
    "custom_name" "text",
    "custom_start_date" "date",
    "custom_end_date" "date",
    "auto_apply" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "valid_championship_preference" CHECK ((("preference_type" <> 'championship'::"public"."preference_type") OR ("championship_id" IS NOT NULL))),
    CONSTRAINT "valid_custom_preference" CHECK ((("preference_type" <> 'custom'::"public"."preference_type") OR (("custom_name" IS NOT NULL) AND ("custom_start_date" IS NOT NULL) AND ("custom_end_date" IS NOT NULL) AND ("custom_end_date" >= "custom_start_date")))),
    CONSTRAINT "valid_holiday_preference" CHECK ((("preference_type" <> 'holiday'::"public"."preference_type") OR ("holiday_name" IS NOT NULL)))
);


ALTER TABLE "public"."operator_blackout_preferences" OWNER TO "postgres";


COMMENT ON TABLE "public"."operator_blackout_preferences" IS 'Stores operator preferences for automatic blackouts and ignored conflicts. Supports championship dates, holidays, and custom recurring dates. Used to reduce repetitive data entry and filter noise from conflict warnings.';



COMMENT ON COLUMN "public"."operator_blackout_preferences"."preference_type" IS 'Type of preference: holiday (e.g., Christmas), championship (BCA/APA), or custom (local tournaments)';



COMMENT ON COLUMN "public"."operator_blackout_preferences"."preference_action" IS 'Action to take: blackout (insert blackout week) or ignore (suppress conflict warning)';



COMMENT ON COLUMN "public"."operator_blackout_preferences"."holiday_name" IS 'Name of holiday (e.g., "Christmas", "Tax Day") - required when preference_type = holiday';



COMMENT ON COLUMN "public"."operator_blackout_preferences"."championship_id" IS 'Reference to championship_date_options - required when preference_type = championship';



COMMENT ON COLUMN "public"."operator_blackout_preferences"."auto_apply" IS 'If true, automatically apply this preference when creating new seasons (future feature)';



CREATE TABLE IF NOT EXISTS "public"."report_actions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "report_id" "uuid" NOT NULL,
    "actor_id" "uuid" NOT NULL,
    "actor_role" character varying(50) NOT NULL,
    "action_type" "public"."moderation_action" NOT NULL,
    "action_notes" "text" NOT NULL,
    "suspension_until" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."report_actions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."report_updates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "report_id" "uuid" NOT NULL,
    "updater_id" "uuid" NOT NULL,
    "updater_role" character varying(50) NOT NULL,
    "old_status" "public"."report_status" NOT NULL,
    "new_status" "public"."report_status" NOT NULL,
    "update_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."report_updates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."season_weeks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "season_id" "uuid" NOT NULL,
    "scheduled_date" "date" NOT NULL,
    "week_name" "text" NOT NULL,
    "week_type" character varying(20) NOT NULL,
    "week_completed" boolean DEFAULT false NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "season_weeks_week_type_check" CHECK ((("week_type")::"text" = ANY (ARRAY[('regular'::character varying)::"text", ('blackout'::character varying)::"text", ('playoffs'::character varying)::"text"])))
);


ALTER TABLE "public"."season_weeks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."seasons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "league_id" "uuid" NOT NULL,
    "season_name" "text" NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "season_length" integer NOT NULL,
    "status" character varying(20) DEFAULT 'upcoming'::character varying NOT NULL,
    "season_completed" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "seasons_season_length_check" CHECK ((("season_length" >= 10) AND ("season_length" <= 52)))
);


ALTER TABLE "public"."seasons" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."team_players" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "team_id" "uuid" NOT NULL,
    "member_id" "uuid" NOT NULL,
    "season_id" "uuid" NOT NULL,
    "is_captain" boolean DEFAULT false,
    "individual_wins" integer DEFAULT 0,
    "individual_losses" integer DEFAULT 0,
    "skill_level" integer,
    "status" character varying(20) DEFAULT 'active'::character varying,
    "joined_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "team_players_individual_losses_check" CHECK (("individual_losses" >= 0)),
    CONSTRAINT "team_players_individual_wins_check" CHECK (("individual_wins" >= 0)),
    CONSTRAINT "team_players_skill_level_check" CHECK ((("skill_level" >= 1) AND ("skill_level" <= 9))),
    CONSTRAINT "team_players_status_check" CHECK ((("status")::"text" = ANY (ARRAY[('active'::character varying)::"text", ('inactive'::character varying)::"text", ('dropped'::character varying)::"text"])))
);


ALTER TABLE "public"."team_players" OWNER TO "postgres";


COMMENT ON TABLE "public"."team_players" IS 'Join table linking players to teams for specific seasons. Tracks roster membership and stats.';



COMMENT ON COLUMN "public"."team_players"."team_id" IS 'Which team this player is on';



COMMENT ON COLUMN "public"."team_players"."member_id" IS 'Which player/member';



COMMENT ON COLUMN "public"."team_players"."season_id" IS 'Denormalized season reference for fast queries without joining teams';



COMMENT ON COLUMN "public"."team_players"."is_captain" IS 'True if this player is the captain (redundant with teams.captain_id but useful)';



COMMENT ON COLUMN "public"."team_players"."skill_level" IS 'BCA skill level (1-9) for handicap calculations';



COMMENT ON COLUMN "public"."team_players"."status" IS 'Player status: active (playing), inactive (benched), dropped (removed from team)';



CREATE TABLE IF NOT EXISTS "public"."teams" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "season_id" "uuid" NOT NULL,
    "league_id" "uuid" NOT NULL,
    "captain_id" "uuid" NOT NULL,
    "home_venue_id" "uuid",
    "team_name" character varying(100) NOT NULL,
    "roster_size" integer NOT NULL,
    "wins" integer DEFAULT 0,
    "losses" integer DEFAULT 0,
    "ties" integer DEFAULT 0,
    "points" integer DEFAULT 0,
    "games_won" integer DEFAULT 0,
    "games_lost" integer DEFAULT 0,
    "status" character varying(20) DEFAULT 'active'::character varying,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "teams_games_lost_check" CHECK (("games_lost" >= 0)),
    CONSTRAINT "teams_games_won_check" CHECK (("games_won" >= 0)),
    CONSTRAINT "teams_losses_check" CHECK (("losses" >= 0)),
    CONSTRAINT "teams_points_check" CHECK (("points" >= 0)),
    CONSTRAINT "teams_roster_size_check" CHECK (("roster_size" = ANY (ARRAY[5, 8]))),
    CONSTRAINT "teams_status_check" CHECK ((("status")::"text" = ANY (ARRAY[('active'::character varying)::"text", ('withdrawn'::character varying)::"text", ('forfeited'::character varying)::"text"]))),
    CONSTRAINT "teams_ties_check" CHECK (("ties" >= 0)),
    CONSTRAINT "teams_wins_check" CHECK (("wins" >= 0))
);


ALTER TABLE "public"."teams" OWNER TO "postgres";


COMMENT ON TABLE "public"."teams" IS 'Teams competing in specific seasons. Season-specific: each season gets new team records.';



COMMENT ON COLUMN "public"."teams"."season_id" IS 'Which season this team is competing in';



COMMENT ON COLUMN "public"."teams"."league_id" IS 'Denormalized league reference for fast queries without joining seasons';



COMMENT ON COLUMN "public"."teams"."captain_id" IS 'Team captain who can edit team name, venue, and manage roster';



COMMENT ON COLUMN "public"."teams"."home_venue_id" IS 'Where team plays home games. Captain chooses from league authorized venues.';



COMMENT ON COLUMN "public"."teams"."roster_size" IS 'Max players: 5 for 5-man format, 8 for 8-man format';



COMMENT ON COLUMN "public"."teams"."status" IS 'Team status: active (playing), withdrawn (left league), forfeited (disqualified)';



CREATE TABLE IF NOT EXISTS "public"."user_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reporter_id" "uuid" NOT NULL,
    "reported_user_id" "uuid" NOT NULL,
    "category" "public"."report_category" NOT NULL,
    "description" "text" NOT NULL,
    "evidence_snapshot" "jsonb",
    "context_data" "jsonb",
    "severity" "public"."report_severity" DEFAULT 'medium'::"public"."report_severity",
    "auto_flagged" boolean DEFAULT false,
    "status" "public"."report_status" DEFAULT 'pending'::"public"."report_status",
    "assigned_operator_id" "uuid",
    "escalated_to_dev" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reviewed_at" timestamp with time zone,
    "resolved_at" timestamp with time zone,
    CONSTRAINT "cannot_report_self" CHECK (("reporter_id" <> "reported_user_id")),
    CONSTRAINT "description_not_empty" CHECK (("length"(TRIM(BOTH FROM "description")) > 0))
);


ALTER TABLE "public"."user_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."venue_owners" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "business_name" character varying(255) NOT NULL,
    "contact_name" character varying(255) NOT NULL,
    "contact_phone" character varying(20) NOT NULL,
    "contact_email" character varying(255) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."venue_owners" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."venues" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_by_operator_id" "uuid",
    "venue_owner_id" "uuid",
    "name" character varying(255) NOT NULL,
    "street_address" character varying(255) NOT NULL,
    "city" character varying(100) NOT NULL,
    "state" character varying(2) NOT NULL,
    "zip_code" character varying(10) NOT NULL,
    "phone" character varying(20) NOT NULL,
    "bar_box_tables" integer DEFAULT 0 NOT NULL,
    "regulation_tables" integer DEFAULT 0 NOT NULL,
    "total_tables" integer GENERATED ALWAYS AS (("bar_box_tables" + "regulation_tables")) STORED,
    "proprietor_name" character varying(255),
    "proprietor_phone" character varying(20),
    "league_contact_name" character varying(255),
    "league_contact_phone" character varying(20),
    "league_contact_email" character varying(255),
    "website" character varying(500),
    "business_hours" "text",
    "notes" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "venue_must_have_tables" CHECK (("total_tables" > 0)),
    CONSTRAINT "venues_bar_box_tables_check" CHECK (("bar_box_tables" >= 0)),
    CONSTRAINT "venues_regulation_tables_check" CHECK (("regulation_tables" >= 0))
);


ALTER TABLE "public"."venues" OWNER TO "postgres";


COMMENT ON COLUMN "public"."venues"."created_by_operator_id" IS 'Operator who first created this venue. NULL if operator deleted. Venues persist independently.';



ALTER TABLE ONLY "public"."members" ALTER COLUMN "system_player_number" SET DEFAULT "nextval"('"public"."members_system_player_number_seq"'::"regclass");



ALTER TABLE ONLY "public"."blocked_users"
    ADD CONSTRAINT "blocked_users_pkey" PRIMARY KEY ("blocker_id", "blocked_id");



ALTER TABLE ONLY "public"."championship_date_options"
    ADD CONSTRAINT "championship_date_options_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversation_participants"
    ADD CONSTRAINT "conversation_participants_pkey" PRIMARY KEY ("conversation_id", "user_id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."league_operators"
    ADD CONSTRAINT "league_operators_member_id_key" UNIQUE ("member_id");



ALTER TABLE ONLY "public"."league_operators"
    ADD CONSTRAINT "league_operators_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."league_venues"
    ADD CONSTRAINT "league_venues_league_id_venue_id_key" UNIQUE ("league_id", "venue_id");



ALTER TABLE ONLY "public"."league_venues"
    ADD CONSTRAINT "league_venues_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leagues"
    ADD CONSTRAINT "leagues_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."match_games"
    ADD CONSTRAINT "match_games_match_id_game_number_key" UNIQUE ("match_id", "game_number");



ALTER TABLE ONLY "public"."match_games"
    ADD CONSTRAINT "match_games_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."match_lineups"
    ADD CONSTRAINT "match_lineups_match_id_team_id_key" UNIQUE ("match_id", "team_id");



ALTER TABLE ONLY "public"."match_lineups"
    ADD CONSTRAINT "match_lineups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."members"
    ADD CONSTRAINT "members_bca_member_number_key" UNIQUE ("bca_member_number");



ALTER TABLE ONLY "public"."members"
    ADD CONSTRAINT "members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."members"
    ADD CONSTRAINT "members_system_player_number_key" UNIQUE ("system_player_number");



ALTER TABLE ONLY "public"."members"
    ADD CONSTRAINT "members_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."operator_blackout_preferences"
    ADD CONSTRAINT "operator_blackout_preferences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."report_actions"
    ADD CONSTRAINT "report_actions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."report_updates"
    ADD CONSTRAINT "report_updates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."season_weeks"
    ADD CONSTRAINT "season_weeks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."seasons"
    ADD CONSTRAINT "seasons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."team_players"
    ADD CONSTRAINT "team_players_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."team_players"
    ADD CONSTRAINT "team_players_team_id_member_id_key" UNIQUE ("team_id", "member_id");



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."season_weeks"
    ADD CONSTRAINT "unique_season_date" UNIQUE ("season_id", "scheduled_date");



ALTER TABLE ONLY "public"."user_reports"
    ADD CONSTRAINT "user_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."venue_owners"
    ADD CONSTRAINT "venue_owners_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."venue_owners"
    ADD CONSTRAINT "venue_owners_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."venues"
    ADD CONSTRAINT "venues_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_blocked_users_blocked" ON "public"."blocked_users" USING "btree" ("blocked_id");



CREATE INDEX "idx_blocked_users_blocker" ON "public"."blocked_users" USING "btree" ("blocker_id");



CREATE INDEX "idx_championship_dev_verified" ON "public"."championship_date_options" USING "btree" ("organization", "year", "dev_verified");



CREATE INDEX "idx_championship_end_date" ON "public"."championship_date_options" USING "btree" ("end_date");



CREATE INDEX "idx_championship_org_year" ON "public"."championship_date_options" USING "btree" ("organization", "year");



CREATE INDEX "idx_conversation_participants_active" ON "public"."conversation_participants" USING "btree" ("user_id", "conversation_id") WHERE ("left_at" IS NULL);



CREATE INDEX "idx_conversation_participants_conversation" ON "public"."conversation_participants" USING "btree" ("conversation_id");



CREATE INDEX "idx_conversation_participants_unread" ON "public"."conversation_participants" USING "btree" ("user_id", "unread_count") WHERE ("unread_count" > 0);



CREATE INDEX "idx_conversation_participants_user" ON "public"."conversation_participants" USING "btree" ("user_id");



CREATE INDEX "idx_conversations_auto_managed" ON "public"."conversations" USING "btree" ("auto_managed");



CREATE INDEX "idx_conversations_last_message_at" ON "public"."conversations" USING "btree" ("last_message_at" DESC);



CREATE INDEX "idx_conversations_scope" ON "public"."conversations" USING "btree" ("scope_type", "scope_id") WHERE ("auto_managed" = true);



CREATE INDEX "idx_conversations_type" ON "public"."conversations" USING "btree" ("conversation_type") WHERE ("conversation_type" IS NOT NULL);



CREATE INDEX "idx_league_operators_member_id" ON "public"."league_operators" USING "btree" ("member_id");



CREATE INDEX "idx_league_operators_org_name" ON "public"."league_operators" USING "btree" ("organization_name");



CREATE INDEX "idx_league_operators_stripe_customer" ON "public"."league_operators" USING "btree" ("stripe_customer_id");



CREATE INDEX "idx_league_venues_league" ON "public"."league_venues" USING "btree" ("league_id");



CREATE INDEX "idx_league_venues_venue" ON "public"."league_venues" USING "btree" ("venue_id");



CREATE INDEX "idx_leagues_day_of_week" ON "public"."leagues" USING "btree" ("day_of_week");



CREATE INDEX "idx_leagues_operator_id" ON "public"."leagues" USING "btree" ("operator_id");



CREATE INDEX "idx_leagues_status" ON "public"."leagues" USING "btree" ("status");



CREATE INDEX "idx_match_games_away_position_player" ON "public"."match_games" USING "btree" ("away_position", "away_player_id", "game_type", "created_at" DESC) WHERE ("winner_player_id" IS NOT NULL);



CREATE INDEX "idx_match_games_game_type" ON "public"."match_games" USING "btree" ("game_type");



CREATE INDEX "idx_match_games_home_position_player" ON "public"."match_games" USING "btree" ("home_position", "home_player_id", "game_type", "created_at" DESC) WHERE ("winner_player_id" IS NOT NULL);



CREATE INDEX "idx_match_games_match_id" ON "public"."match_games" USING "btree" ("match_id");



CREATE INDEX "idx_match_games_player_game_type_created" ON "public"."match_games" USING "btree" ("home_player_id", "game_type", "created_at" DESC) WHERE ("winner_player_id" IS NOT NULL);



CREATE INDEX "idx_match_games_player_game_type_created_away" ON "public"."match_games" USING "btree" ("away_player_id", "game_type", "created_at" DESC) WHERE ("winner_player_id" IS NOT NULL);



CREATE INDEX "idx_match_games_tiebreaker" ON "public"."match_games" USING "btree" ("is_tiebreaker");



CREATE INDEX "idx_match_games_winner_player" ON "public"."match_games" USING "btree" ("winner_player_id");



CREATE INDEX "idx_match_lineups_locked" ON "public"."match_lineups" USING "btree" ("locked");



CREATE INDEX "idx_match_lineups_match_id" ON "public"."match_lineups" USING "btree" ("match_id");



CREATE INDEX "idx_match_lineups_team_id" ON "public"."match_lineups" USING "btree" ("team_id");



CREATE INDEX "idx_matches_actual_venue_id" ON "public"."matches" USING "btree" ("actual_venue_id");



CREATE INDEX "idx_matches_away_team_id" ON "public"."matches" USING "btree" ("away_team_id");



CREATE INDEX "idx_matches_completed_season" ON "public"."matches" USING "btree" ("season_id", "status") WHERE ("status" = 'completed'::"text");



CREATE INDEX "idx_matches_home_team_id" ON "public"."matches" USING "btree" ("home_team_id");



CREATE INDEX "idx_matches_scheduled_venue_id" ON "public"."matches" USING "btree" ("scheduled_venue_id");



CREATE INDEX "idx_matches_season_id" ON "public"."matches" USING "btree" ("season_id");



CREATE INDEX "idx_matches_season_week_id" ON "public"."matches" USING "btree" ("season_week_id");



CREATE INDEX "idx_matches_status" ON "public"."matches" USING "btree" ("status");



CREATE INDEX "idx_matches_status_season_week" ON "public"."matches" USING "btree" ("status", "season_id", "season_week_id") WHERE ("status" = ANY (ARRAY['in_progress'::"text", 'scheduled'::"text"]));



CREATE INDEX "idx_members_bca_number" ON "public"."members" USING "btree" ("bca_member_number");



CREATE INDEX "idx_members_email" ON "public"."members" USING "btree" ("email");



CREATE INDEX "idx_members_role" ON "public"."members" USING "btree" ("role");



CREATE INDEX "idx_members_state" ON "public"."members" USING "btree" ("state");



CREATE INDEX "idx_members_system_number" ON "public"."members" USING "btree" ("system_player_number");



CREATE INDEX "idx_members_user_id" ON "public"."members" USING "btree" ("user_id");



CREATE INDEX "idx_messages_active" ON "public"."messages" USING "btree" ("conversation_id", "created_at" DESC) WHERE ("is_deleted" = false);



CREATE INDEX "idx_messages_conversation" ON "public"."messages" USING "btree" ("conversation_id", "created_at" DESC);



CREATE INDEX "idx_messages_created_at" ON "public"."messages" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_messages_sender" ON "public"."messages" USING "btree" ("sender_id");



CREATE INDEX "idx_operator_blackout_preferences_championship_id" ON "public"."operator_blackout_preferences" USING "btree" ("championship_id") WHERE ("championship_id" IS NOT NULL);



CREATE INDEX "idx_operator_blackout_preferences_operator_id" ON "public"."operator_blackout_preferences" USING "btree" ("operator_id");



CREATE INDEX "idx_operator_blackout_preferences_type_action" ON "public"."operator_blackout_preferences" USING "btree" ("preference_type", "preference_action");



CREATE INDEX "idx_report_actions_actor" ON "public"."report_actions" USING "btree" ("actor_id");



CREATE INDEX "idx_report_actions_created" ON "public"."report_actions" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_report_actions_report" ON "public"."report_actions" USING "btree" ("report_id");



CREATE INDEX "idx_report_updates_report" ON "public"."report_updates" USING "btree" ("report_id");



CREATE INDEX "idx_season_weeks_completed" ON "public"."season_weeks" USING "btree" ("week_completed");



CREATE INDEX "idx_season_weeks_date" ON "public"."season_weeks" USING "btree" ("scheduled_date");



CREATE INDEX "idx_season_weeks_season_id" ON "public"."season_weeks" USING "btree" ("season_id");



CREATE INDEX "idx_season_weeks_type" ON "public"."season_weeks" USING "btree" ("week_type");



CREATE INDEX "idx_seasons_dates" ON "public"."seasons" USING "btree" ("start_date", "end_date");



CREATE INDEX "idx_seasons_league_id" ON "public"."seasons" USING "btree" ("league_id");



CREATE INDEX "idx_seasons_status" ON "public"."seasons" USING "btree" ("status");



CREATE INDEX "idx_team_players_captain" ON "public"."team_players" USING "btree" ("team_id", "is_captain");



CREATE INDEX "idx_team_players_member" ON "public"."team_players" USING "btree" ("member_id");



CREATE INDEX "idx_team_players_season" ON "public"."team_players" USING "btree" ("season_id");



CREATE INDEX "idx_team_players_team" ON "public"."team_players" USING "btree" ("team_id");



CREATE INDEX "idx_teams_captain" ON "public"."teams" USING "btree" ("captain_id");



CREATE INDEX "idx_teams_league" ON "public"."teams" USING "btree" ("league_id");



CREATE INDEX "idx_teams_season" ON "public"."teams" USING "btree" ("season_id");



CREATE INDEX "idx_teams_status" ON "public"."teams" USING "btree" ("status");



CREATE INDEX "idx_teams_venue" ON "public"."teams" USING "btree" ("home_venue_id");



CREATE INDEX "idx_user_reports_assigned_operator" ON "public"."user_reports" USING "btree" ("assigned_operator_id");



CREATE INDEX "idx_user_reports_category" ON "public"."user_reports" USING "btree" ("category");



CREATE INDEX "idx_user_reports_created_at" ON "public"."user_reports" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_user_reports_escalated" ON "public"."user_reports" USING "btree" ("escalated_to_dev") WHERE ("escalated_to_dev" = true);



CREATE INDEX "idx_user_reports_reported_user" ON "public"."user_reports" USING "btree" ("reported_user_id");



CREATE INDEX "idx_user_reports_reporter" ON "public"."user_reports" USING "btree" ("reporter_id");



CREATE INDEX "idx_user_reports_severity" ON "public"."user_reports" USING "btree" ("severity");



CREATE INDEX "idx_user_reports_status" ON "public"."user_reports" USING "btree" ("status");



CREATE INDEX "idx_venue_owners_user" ON "public"."venue_owners" USING "btree" ("user_id");



CREATE INDEX "idx_venues_active" ON "public"."venues" USING "btree" ("is_active");



CREATE INDEX "idx_venues_city_state" ON "public"."venues" USING "btree" ("city", "state");



CREATE INDEX "idx_venues_operator" ON "public"."venues" USING "btree" ("created_by_operator_id");



CREATE UNIQUE INDEX "unique_dates_per_org_year" ON "public"."championship_date_options" USING "btree" ("organization", "year", "start_date", "end_date");



CREATE OR REPLACE TRIGGER "championship_date_options_updated_at_trigger" BEFORE UPDATE ON "public"."championship_date_options" FOR EACH ROW EXECUTE FUNCTION "public"."update_championship_date_options_updated_at"();



CREATE OR REPLACE TRIGGER "enforce_delete_time_limit" BEFORE UPDATE OF "is_deleted" ON "public"."messages" FOR EACH ROW WHEN ((("new"."is_deleted" = true) AND ("old"."is_deleted" = false))) EXECUTE FUNCTION "public"."check_delete_time_limit"();



CREATE OR REPLACE TRIGGER "enforce_edit_time_limit" BEFORE UPDATE OF "content" ON "public"."messages" FOR EACH ROW WHEN (("old"."content" IS DISTINCT FROM "new"."content")) EXECUTE FUNCTION "public"."check_edit_time_limit"();



CREATE OR REPLACE TRIGGER "increment_unread_on_message" AFTER INSERT ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."increment_unread_count"();



CREATE OR REPLACE TRIGGER "league_operators_updated_at" BEFORE UPDATE ON "public"."league_operators" FOR EACH ROW EXECUTE FUNCTION "public"."update_league_operators_updated_at"();



CREATE OR REPLACE TRIGGER "league_venues_updated_at" BEFORE UPDATE ON "public"."league_venues" FOR EACH ROW EXECUTE FUNCTION "public"."update_league_venues_updated_at"();



CREATE OR REPLACE TRIGGER "leagues_updated_at_trigger" BEFORE UPDATE ON "public"."leagues" FOR EACH ROW EXECUTE FUNCTION "public"."update_leagues_updated_at"();



CREATE OR REPLACE TRIGGER "members_updated_at" BEFORE UPDATE ON "public"."members" FOR EACH ROW EXECUTE FUNCTION "public"."update_members_updated_at"();



CREATE OR REPLACE TRIGGER "operator_blackout_preferences_updated_at_trigger" BEFORE UPDATE ON "public"."operator_blackout_preferences" FOR EACH ROW EXECUTE FUNCTION "public"."update_operator_blackout_preferences_updated_at"();



CREATE OR REPLACE TRIGGER "prevent_dm_with_blocked_user" BEFORE INSERT ON "public"."conversation_participants" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_blocked_user_dm"();



CREATE OR REPLACE TRIGGER "reset_unread_on_read" BEFORE UPDATE ON "public"."conversation_participants" FOR EACH ROW EXECUTE FUNCTION "public"."reset_unread_count"();



CREATE OR REPLACE TRIGGER "season_weeks_updated_at" BEFORE UPDATE ON "public"."season_weeks" FOR EACH ROW EXECUTE FUNCTION "public"."update_season_weeks_updated_at"();



CREATE OR REPLACE TRIGGER "seasons_updated_at" BEFORE UPDATE ON "public"."seasons" FOR EACH ROW EXECUTE FUNCTION "public"."update_seasons_updated_at"();



CREATE OR REPLACE TRIGGER "set_conversations_updated_at" BEFORE UPDATE ON "public"."conversations" FOR EACH ROW EXECUTE FUNCTION "public"."update_conversations_updated_at"();



CREATE OR REPLACE TRIGGER "set_messages_updated_at" BEFORE UPDATE ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."update_messages_updated_at"();



CREATE OR REPLACE TRIGGER "team_players_updated_at" BEFORE UPDATE ON "public"."team_players" FOR EACH ROW EXECUTE FUNCTION "public"."update_team_players_updated_at"();



CREATE OR REPLACE TRIGGER "teams_updated_at" BEFORE UPDATE ON "public"."teams" FOR EACH ROW EXECUTE FUNCTION "public"."update_teams_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_auto_create_match_lineups" AFTER INSERT ON "public"."matches" FOR EACH ROW EXECUTE FUNCTION "public"."auto_create_match_lineups"();



CREATE OR REPLACE TRIGGER "trigger_auto_delete_match_lineups" BEFORE DELETE ON "public"."matches" FOR EACH ROW EXECUTE FUNCTION "public"."auto_delete_match_lineups"();



CREATE OR REPLACE TRIGGER "trigger_log_report_status_change" AFTER UPDATE ON "public"."user_reports" FOR EACH ROW WHEN (("old"."status" IS DISTINCT FROM "new"."status")) EXECUTE FUNCTION "public"."log_report_status_change"();



CREATE OR REPLACE TRIGGER "trigger_update_match_lineups_updated_at" BEFORE UPDATE ON "public"."match_lineups" FOR EACH ROW EXECUTE FUNCTION "public"."update_match_lineups_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_match_venues_on_team_venue_change" AFTER UPDATE OF "home_venue_id" ON "public"."teams" FOR EACH ROW EXECUTE FUNCTION "public"."update_match_venues_on_team_venue_change"();



CREATE OR REPLACE TRIGGER "trigger_update_matches_updated_at" BEFORE UPDATE ON "public"."matches" FOR EACH ROW EXECUTE FUNCTION "public"."update_matches_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_report_resolved_at" BEFORE UPDATE ON "public"."user_reports" FOR EACH ROW EXECUTE FUNCTION "public"."update_report_resolved_at"();



CREATE OR REPLACE TRIGGER "trigger_update_report_reviewed_at" BEFORE UPDATE ON "public"."user_reports" FOR EACH ROW EXECUTE FUNCTION "public"."update_report_reviewed_at"();



CREATE OR REPLACE TRIGGER "update_conversation_on_message_soft_delete" AFTER UPDATE OF "is_deleted" ON "public"."messages" FOR EACH ROW WHEN ((("new"."is_deleted" = true) AND ("old"."is_deleted" = false))) EXECUTE FUNCTION "public"."update_conversation_on_message_delete"();



CREATE OR REPLACE TRIGGER "update_conversation_on_new_message" AFTER INSERT ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."update_conversation_last_message"();



CREATE OR REPLACE TRIGGER "venue_owners_updated_at" BEFORE UPDATE ON "public"."venue_owners" FOR EACH ROW EXECUTE FUNCTION "public"."update_venue_owners_updated_at"();



CREATE OR REPLACE TRIGGER "venues_updated_at" BEFORE UPDATE ON "public"."venues" FOR EACH ROW EXECUTE FUNCTION "public"."update_venues_updated_at"();



ALTER TABLE ONLY "public"."blocked_users"
    ADD CONSTRAINT "blocked_users_blocked_id_fkey" FOREIGN KEY ("blocked_id") REFERENCES "public"."members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."blocked_users"
    ADD CONSTRAINT "blocked_users_blocker_id_fkey" FOREIGN KEY ("blocker_id") REFERENCES "public"."members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversation_participants"
    ADD CONSTRAINT "conversation_participants_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversation_participants"
    ADD CONSTRAINT "conversation_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."league_operators"
    ADD CONSTRAINT "league_operators_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."league_venues"
    ADD CONSTRAINT "league_venues_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."league_venues"
    ADD CONSTRAINT "league_venues_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."leagues"
    ADD CONSTRAINT "leagues_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "public"."league_operators"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."match_games"
    ADD CONSTRAINT "match_games_confirmed_by_away_member_fkey" FOREIGN KEY ("confirmed_by_away") REFERENCES "public"."members"("id");



ALTER TABLE ONLY "public"."match_games"
    ADD CONSTRAINT "match_games_confirmed_by_home_member_fkey" FOREIGN KEY ("confirmed_by_home") REFERENCES "public"."members"("id");



ALTER TABLE ONLY "public"."match_games"
    ADD CONSTRAINT "match_games_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."match_games"
    ADD CONSTRAINT "match_games_winner_team_id_fkey" FOREIGN KEY ("winner_team_id") REFERENCES "public"."teams"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."match_lineups"
    ADD CONSTRAINT "match_lineups_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."match_lineups"
    ADD CONSTRAINT "match_lineups_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_actual_venue_id_fkey" FOREIGN KEY ("actual_venue_id") REFERENCES "public"."venues"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_away_lineup_id_fkey" FOREIGN KEY ("away_lineup_id") REFERENCES "public"."match_lineups"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_away_team_id_fkey" FOREIGN KEY ("away_team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_away_team_verified_by_fkey" FOREIGN KEY ("away_team_verified_by") REFERENCES "public"."members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_away_tiebreaker_verified_by_fkey" FOREIGN KEY ("away_tiebreaker_verified_by") REFERENCES "public"."members"("id");



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_home_lineup_id_fkey" FOREIGN KEY ("home_lineup_id") REFERENCES "public"."match_lineups"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_home_team_id_fkey" FOREIGN KEY ("home_team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_home_team_verified_by_fkey" FOREIGN KEY ("home_team_verified_by") REFERENCES "public"."members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_home_tiebreaker_verified_by_fkey" FOREIGN KEY ("home_tiebreaker_verified_by") REFERENCES "public"."members"("id");



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_scheduled_venue_id_fkey" FOREIGN KEY ("scheduled_venue_id") REFERENCES "public"."venues"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_season_week_id_fkey" FOREIGN KEY ("season_week_id") REFERENCES "public"."season_weeks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_winner_team_id_fkey" FOREIGN KEY ("winner_team_id") REFERENCES "public"."teams"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."members"
    ADD CONSTRAINT "members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."operator_blackout_preferences"
    ADD CONSTRAINT "operator_blackout_preferences_championship_id_fkey" FOREIGN KEY ("championship_id") REFERENCES "public"."championship_date_options"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."operator_blackout_preferences"
    ADD CONSTRAINT "operator_blackout_preferences_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "public"."league_operators"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."report_actions"
    ADD CONSTRAINT "report_actions_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."report_actions"
    ADD CONSTRAINT "report_actions_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "public"."user_reports"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."report_updates"
    ADD CONSTRAINT "report_updates_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "public"."user_reports"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."report_updates"
    ADD CONSTRAINT "report_updates_updater_id_fkey" FOREIGN KEY ("updater_id") REFERENCES "public"."members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."season_weeks"
    ADD CONSTRAINT "season_weeks_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."seasons"
    ADD CONSTRAINT "seasons_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_players"
    ADD CONSTRAINT "team_players_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_players"
    ADD CONSTRAINT "team_players_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_players"
    ADD CONSTRAINT "team_players_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_captain_id_fkey" FOREIGN KEY ("captain_id") REFERENCES "public"."members"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_home_venue_id_fkey" FOREIGN KEY ("home_venue_id") REFERENCES "public"."venues"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_reports"
    ADD CONSTRAINT "user_reports_assigned_operator_id_fkey" FOREIGN KEY ("assigned_operator_id") REFERENCES "public"."league_operators"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_reports"
    ADD CONSTRAINT "user_reports_reported_user_id_fkey" FOREIGN KEY ("reported_user_id") REFERENCES "public"."members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_reports"
    ADD CONSTRAINT "user_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "public"."members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."venue_owners"
    ADD CONSTRAINT "venue_owners_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."venues"
    ADD CONSTRAINT "venues_created_by_operator_id_fkey" FOREIGN KEY ("created_by_operator_id") REFERENCES "public"."league_operators"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."venues"
    ADD CONSTRAINT "venues_venue_owner_id_fkey" FOREIGN KEY ("venue_owner_id") REFERENCES "public"."venue_owners"("id") ON DELETE SET NULL;



CREATE POLICY "Allow authenticated users to create report updates" ON "public"."report_updates" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Anyone can view report updates" ON "public"."report_updates" FOR SELECT USING ((("report_id" IN ( SELECT "user_reports"."id"
   FROM "public"."user_reports"
  WHERE ("user_reports"."reporter_id" = ( SELECT "members"."id"
           FROM "public"."members"
          WHERE ("members"."user_id" = "auth"."uid"()))))) OR (EXISTS ( SELECT 1
   FROM "public"."members"
  WHERE (("members"."user_id" = "auth"."uid"()) AND (("members"."role" = 'developer'::"public"."user_role") OR ("members"."role" = 'league_operator'::"public"."user_role")))))));



CREATE POLICY "Authenticated users can create conversations" ON "public"."conversations" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can view member profiles" ON "public"."members" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Captains can add players to their team" ON "public"."team_players" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."teams"
     JOIN "public"."members" ON (("teams"."captain_id" = "members"."id")))
  WHERE (("teams"."id" = "team_players"."team_id") AND ("members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Captains can remove players from their team" ON "public"."team_players" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM (("public"."teams"
     JOIN "public"."members" "captain" ON (("teams"."captain_id" = "captain"."id")))
     JOIN "public"."members" "player" ON (("team_players"."member_id" = "player"."id")))
  WHERE (("teams"."id" = "team_players"."team_id") AND ("captain"."user_id" = "auth"."uid"()) AND ("player"."id" <> "captain"."id")))));



CREATE POLICY "Captains can update their team" ON "public"."teams" FOR UPDATE USING (("captain_id" IN ( SELECT "members"."id"
   FROM "public"."members"
  WHERE ("members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Championship dates are viewable by everyone" ON "public"."championship_date_options" FOR SELECT USING (true);



CREATE POLICY "Developers can update all reports" ON "public"."user_reports" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."members"
  WHERE (("members"."user_id" = "auth"."uid"()) AND ("members"."role" = 'developer'::"public"."user_role")))));



CREATE POLICY "Developers can view all reports" ON "public"."user_reports" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."members"
  WHERE (("members"."user_id" = "auth"."uid"()) AND ("members"."role" = 'developer'::"public"."user_role")))));



CREATE POLICY "League operators can delete their league matches" ON "public"."matches" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM ((("public"."seasons" "s"
     JOIN "public"."leagues" "l" ON (("s"."league_id" = "l"."id")))
     JOIN "public"."league_operators" "lo" ON (("l"."operator_id" = "lo"."id")))
     JOIN "public"."members" "m" ON (("lo"."member_id" = "m"."id")))
  WHERE (("s"."id" = "matches"."season_id") AND ("m"."user_id" = "auth"."uid"())))));



CREATE POLICY "League operators can insert matches" ON "public"."matches" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ((("public"."seasons" "s"
     JOIN "public"."leagues" "l" ON (("s"."league_id" = "l"."id")))
     JOIN "public"."league_operators" "lo" ON (("l"."operator_id" = "lo"."id")))
     JOIN "public"."members" "m" ON (("lo"."member_id" = "m"."id")))
  WHERE (("s"."id" = "matches"."season_id") AND ("m"."user_id" = "auth"."uid"())))));



CREATE POLICY "League operators can manage all lineups" ON "public"."match_lineups" USING ((EXISTS ( SELECT 1
   FROM "public"."members"
  WHERE (("members"."user_id" = "auth"."uid"()) AND ("members"."role" = ANY (ARRAY['league_operator'::"public"."user_role", 'developer'::"public"."user_role"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."members"
  WHERE (("members"."user_id" = "auth"."uid"()) AND ("members"."role" = ANY (ARRAY['league_operator'::"public"."user_role", 'developer'::"public"."user_role"]))))));



CREATE POLICY "League operators can update their league matches" ON "public"."matches" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM ((("public"."seasons" "s"
     JOIN "public"."leagues" "l" ON (("s"."league_id" = "l"."id")))
     JOIN "public"."league_operators" "lo" ON (("l"."operator_id" = "lo"."id")))
     JOIN "public"."members" "m" ON (("lo"."member_id" = "m"."id")))
  WHERE (("s"."id" = "matches"."season_id") AND ("m"."user_id" = "auth"."uid"())))));



CREATE POLICY "League operators can view all lineups" ON "public"."match_lineups" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."members"
  WHERE (("members"."user_id" = "auth"."uid"()) AND ("members"."role" = ANY (ARRAY['league_operator'::"public"."user_role", 'developer'::"public"."user_role"]))))));



CREATE POLICY "Matches are viewable by everyone" ON "public"."matches" FOR SELECT USING (true);



CREATE POLICY "Operators and Devs can create report actions" ON "public"."report_actions" FOR INSERT WITH CHECK ((("actor_id" IN ( SELECT "members"."id"
   FROM "public"."members"
  WHERE ("members"."user_id" = "auth"."uid"()))) AND (EXISTS ( SELECT 1
   FROM "public"."members"
  WHERE (("members"."user_id" = "auth"."uid"()) AND (("members"."role" = 'developer'::"public"."user_role") OR ("members"."role" = 'league_operator'::"public"."user_role")))))));



CREATE POLICY "Operators and Devs can view report actions" ON "public"."report_actions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."members"
  WHERE (("members"."user_id" = "auth"."uid"()) AND (("members"."role" = 'developer'::"public"."user_role") OR ("members"."role" = 'league_operator'::"public"."user_role"))))));



CREATE POLICY "Operators can add players to own league teams" ON "public"."team_players" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ((("public"."teams"
     JOIN "public"."leagues" ON (("teams"."league_id" = "leagues"."id")))
     JOIN "public"."league_operators" ON (("leagues"."operator_id" = "league_operators"."id")))
     JOIN "public"."members" ON (("league_operators"."member_id" = "members"."id")))
  WHERE (("teams"."id" = "team_players"."team_id") AND ("members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Operators can add venues to own leagues" ON "public"."league_venues" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM (("public"."leagues"
     JOIN "public"."league_operators" ON (("leagues"."operator_id" = "league_operators"."id")))
     JOIN "public"."members" ON (("league_operators"."member_id" = "members"."id")))
  WHERE (("leagues"."id" = "league_venues"."league_id") AND ("members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Operators can create own leagues" ON "public"."leagues" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."league_operators"
     JOIN "public"."members" ON (("members"."id" = "league_operators"."member_id")))
  WHERE (("league_operators"."id" = "leagues"."operator_id") AND ("members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Operators can create season weeks for own leagues" ON "public"."season_weeks" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ((("public"."seasons"
     JOIN "public"."leagues" ON (("seasons"."league_id" = "leagues"."id")))
     JOIN "public"."league_operators" ON (("leagues"."operator_id" = "league_operators"."id")))
     JOIN "public"."members" ON (("league_operators"."member_id" = "members"."id")))
  WHERE (("seasons"."id" = "season_weeks"."season_id") AND ("members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Operators can create seasons for own leagues" ON "public"."seasons" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM (("public"."leagues"
     JOIN "public"."league_operators" ON (("leagues"."operator_id" = "league_operators"."id")))
     JOIN "public"."members" ON (("league_operators"."member_id" = "members"."id")))
  WHERE (("leagues"."id" = "seasons"."league_id") AND ("members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Operators can create teams in own leagues" ON "public"."teams" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM (("public"."leagues"
     JOIN "public"."league_operators" ON (("leagues"."operator_id" = "league_operators"."id")))
     JOIN "public"."members" ON (("league_operators"."member_id" = "members"."id")))
  WHERE (("leagues"."id" = "teams"."league_id") AND ("members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Operators can create venues" ON "public"."venues" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."league_operators"
     JOIN "public"."members" ON (("league_operators"."member_id" = "members"."id")))
  WHERE (("league_operators"."id" = "venues"."created_by_operator_id") AND ("members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Operators can delete own league season weeks" ON "public"."season_weeks" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM ((("public"."seasons"
     JOIN "public"."leagues" ON (("seasons"."league_id" = "leagues"."id")))
     JOIN "public"."league_operators" ON (("leagues"."operator_id" = "league_operators"."id")))
     JOIN "public"."members" ON (("league_operators"."member_id" = "members"."id")))
  WHERE (("seasons"."id" = "season_weeks"."season_id") AND ("members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Operators can delete own league seasons" ON "public"."seasons" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM (("public"."leagues"
     JOIN "public"."league_operators" ON (("leagues"."operator_id" = "league_operators"."id")))
     JOIN "public"."members" ON (("league_operators"."member_id" = "members"."id")))
  WHERE (("leagues"."id" = "seasons"."league_id") AND ("members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Operators can delete own league teams" ON "public"."teams" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM (("public"."leagues"
     JOIN "public"."league_operators" ON (("leagues"."operator_id" = "league_operators"."id")))
     JOIN "public"."members" ON (("league_operators"."member_id" = "members"."id")))
  WHERE (("leagues"."id" = "teams"."league_id") AND ("members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Operators can delete own leagues" ON "public"."leagues" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM ("public"."league_operators"
     JOIN "public"."members" ON (("members"."id" = "league_operators"."member_id")))
  WHERE (("league_operators"."id" = "leagues"."operator_id") AND ("members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Operators can delete own venues" ON "public"."venues" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM ("public"."league_operators"
     JOIN "public"."members" ON (("league_operators"."member_id" = "members"."id")))
  WHERE (("league_operators"."id" = "venues"."created_by_operator_id") AND ("members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Operators can delete their own preferences" ON "public"."operator_blackout_preferences" FOR DELETE USING (("operator_id" IN ( SELECT "league_operators"."id"
   FROM "public"."league_operators"
  WHERE ("league_operators"."member_id" IN ( SELECT "members"."id"
           FROM "public"."members"
          WHERE ("members"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Operators can insert their own preferences" ON "public"."operator_blackout_preferences" FOR INSERT WITH CHECK (("operator_id" IN ( SELECT "league_operators"."id"
   FROM "public"."league_operators"
  WHERE ("league_operators"."member_id" IN ( SELECT "members"."id"
           FROM "public"."members"
          WHERE ("members"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Operators can manage their own profile" ON "public"."league_operators" USING (("member_id" IN ( SELECT "members"."id"
   FROM "public"."members"
  WHERE ("members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Operators can remove players from own league teams" ON "public"."team_players" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM ((("public"."teams"
     JOIN "public"."leagues" ON (("teams"."league_id" = "leagues"."id")))
     JOIN "public"."league_operators" ON (("leagues"."operator_id" = "league_operators"."id")))
     JOIN "public"."members" ON (("league_operators"."member_id" = "members"."id")))
  WHERE (("teams"."id" = "team_players"."team_id") AND ("members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Operators can remove venues from own leagues" ON "public"."league_venues" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM (("public"."leagues"
     JOIN "public"."league_operators" ON (("leagues"."operator_id" = "league_operators"."id")))
     JOIN "public"."members" ON (("league_operators"."member_id" = "members"."id")))
  WHERE (("leagues"."id" = "league_venues"."league_id") AND ("members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Operators can submit championship dates" ON "public"."championship_date_options" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Operators can update championship dates" ON "public"."championship_date_options" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text")) WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Operators can update league reports" ON "public"."user_reports" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM (((("public"."league_operators" "lo"
     JOIN "public"."leagues" "l" ON (("l"."operator_id" = "lo"."id")))
     JOIN "public"."seasons" "s" ON ((("s"."league_id" = "l"."id") AND (("s"."status")::"text" = 'active'::"text"))))
     JOIN "public"."teams" "t" ON (("t"."season_id" = "s"."id")))
     JOIN "public"."team_players" "tp" ON (("tp"."team_id" = "t"."id")))
  WHERE (("lo"."member_id" = ( SELECT "members"."id"
           FROM "public"."members"
          WHERE ("members"."user_id" = "auth"."uid"()))) AND ("tp"."member_id" = "user_reports"."reported_user_id")))));



CREATE POLICY "Operators can update own league season weeks" ON "public"."season_weeks" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM ((("public"."seasons"
     JOIN "public"."leagues" ON (("seasons"."league_id" = "leagues"."id")))
     JOIN "public"."league_operators" ON (("leagues"."operator_id" = "league_operators"."id")))
     JOIN "public"."members" ON (("league_operators"."member_id" = "members"."id")))
  WHERE (("seasons"."id" = "season_weeks"."season_id") AND ("members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Operators can update own league seasons" ON "public"."seasons" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM (("public"."leagues"
     JOIN "public"."league_operators" ON (("leagues"."operator_id" = "league_operators"."id")))
     JOIN "public"."members" ON (("league_operators"."member_id" = "members"."id")))
  WHERE (("leagues"."id" = "seasons"."league_id") AND ("members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Operators can update own league team players" ON "public"."team_players" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM ((("public"."teams"
     JOIN "public"."leagues" ON (("teams"."league_id" = "leagues"."id")))
     JOIN "public"."league_operators" ON (("leagues"."operator_id" = "league_operators"."id")))
     JOIN "public"."members" ON (("league_operators"."member_id" = "members"."id")))
  WHERE (("teams"."id" = "team_players"."team_id") AND ("members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Operators can update own league teams" ON "public"."teams" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM (("public"."leagues"
     JOIN "public"."league_operators" ON (("leagues"."operator_id" = "league_operators"."id")))
     JOIN "public"."members" ON (("league_operators"."member_id" = "members"."id")))
  WHERE (("leagues"."id" = "teams"."league_id") AND ("members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Operators can update own league venues" ON "public"."league_venues" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM (("public"."leagues"
     JOIN "public"."league_operators" ON (("leagues"."operator_id" = "league_operators"."id")))
     JOIN "public"."members" ON (("league_operators"."member_id" = "members"."id")))
  WHERE (("leagues"."id" = "league_venues"."league_id") AND ("members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Operators can update own leagues" ON "public"."leagues" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM ("public"."league_operators"
     JOIN "public"."members" ON (("members"."id" = "league_operators"."member_id")))
  WHERE (("league_operators"."id" = "leagues"."operator_id") AND ("members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Operators can update own venues" ON "public"."venues" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM ("public"."league_operators"
     JOIN "public"."members" ON (("league_operators"."member_id" = "members"."id")))
  WHERE (("league_operators"."id" = "venues"."created_by_operator_id") AND ("members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Operators can update their own preferences" ON "public"."operator_blackout_preferences" FOR UPDATE USING (("operator_id" IN ( SELECT "league_operators"."id"
   FROM "public"."league_operators"
  WHERE ("league_operators"."member_id" IN ( SELECT "members"."id"
           FROM "public"."members"
          WHERE ("members"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Operators can view all venues" ON "public"."venues" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."league_operators"
     JOIN "public"."members" ON (("league_operators"."member_id" = "members"."id")))
  WHERE ("members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Operators can view league reports" ON "public"."user_reports" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (((("public"."league_operators" "lo"
     JOIN "public"."leagues" "l" ON (("l"."operator_id" = "lo"."id")))
     JOIN "public"."seasons" "s" ON ((("s"."league_id" = "l"."id") AND (("s"."status")::"text" = 'active'::"text"))))
     JOIN "public"."teams" "t" ON (("t"."season_id" = "s"."id")))
     JOIN "public"."team_players" "tp" ON (("tp"."team_id" = "t"."id")))
  WHERE (("lo"."member_id" = ( SELECT "members"."id"
           FROM "public"."members"
          WHERE ("members"."user_id" = "auth"."uid"()))) AND ("tp"."member_id" = "user_reports"."reported_user_id")))));



CREATE POLICY "Operators can view own league season weeks" ON "public"."season_weeks" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ((("public"."seasons"
     JOIN "public"."leagues" ON (("seasons"."league_id" = "leagues"."id")))
     JOIN "public"."league_operators" ON (("leagues"."operator_id" = "league_operators"."id")))
     JOIN "public"."members" ON (("league_operators"."member_id" = "members"."id")))
  WHERE (("seasons"."id" = "season_weeks"."season_id") AND ("members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Operators can view own league seasons" ON "public"."seasons" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (("public"."leagues"
     JOIN "public"."league_operators" ON (("leagues"."operator_id" = "league_operators"."id")))
     JOIN "public"."members" ON (("league_operators"."member_id" = "members"."id")))
  WHERE (("leagues"."id" = "seasons"."league_id") AND ("members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Operators can view own league team players" ON "public"."team_players" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ((("public"."teams"
     JOIN "public"."leagues" ON (("teams"."league_id" = "leagues"."id")))
     JOIN "public"."league_operators" ON (("leagues"."operator_id" = "league_operators"."id")))
     JOIN "public"."members" ON (("league_operators"."member_id" = "members"."id")))
  WHERE (("teams"."id" = "team_players"."team_id") AND ("members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Operators can view own league teams" ON "public"."teams" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (("public"."leagues"
     JOIN "public"."league_operators" ON (("leagues"."operator_id" = "league_operators"."id")))
     JOIN "public"."members" ON (("league_operators"."member_id" = "members"."id")))
  WHERE (("leagues"."id" = "teams"."league_id") AND ("members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Operators can view own league venues" ON "public"."league_venues" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (("public"."leagues"
     JOIN "public"."league_operators" ON (("leagues"."operator_id" = "league_operators"."id")))
     JOIN "public"."members" ON (("league_operators"."member_id" = "members"."id")))
  WHERE (("leagues"."id" = "league_venues"."league_id") AND ("members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Operators can view own leagues" ON "public"."leagues" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."league_operators"
     JOIN "public"."members" ON (("members"."id" = "league_operators"."member_id")))
  WHERE (("league_operators"."id" = "leagues"."operator_id") AND ("members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Operators can view their own preferences" ON "public"."operator_blackout_preferences" FOR SELECT USING (("operator_id" IN ( SELECT "league_operators"."id"
   FROM "public"."league_operators"
  WHERE ("league_operators"."member_id" IN ( SELECT "members"."id"
           FROM "public"."members"
          WHERE ("members"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Operators can view their own profile" ON "public"."league_operators" FOR SELECT USING (("member_id" IN ( SELECT "members"."id"
   FROM "public"."members"
  WHERE ("members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Participants can update conversation metadata" ON "public"."conversations" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."conversation_participants"
  WHERE (("conversation_participants"."conversation_id" = "conversations"."id") AND ("conversation_participants"."user_id" = "public"."get_current_member_id"()) AND ("conversation_participants"."left_at" IS NULL)))));



CREATE POLICY "Players can delete games for their matches" ON "public"."match_games" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM (("public"."matches" "m"
     JOIN "public"."team_players" "tp" ON ((("tp"."team_id" = "m"."home_team_id") OR ("tp"."team_id" = "m"."away_team_id"))))
     JOIN "public"."members" "mem" ON (("mem"."id" = "tp"."member_id")))
  WHERE (("m"."id" = "match_games"."match_id") AND ("mem"."user_id" = "auth"."uid"())))));



CREATE POLICY "Players can insert games for their matches" ON "public"."match_games" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM (("public"."matches" "m"
     JOIN "public"."team_players" "tp" ON ((("tp"."team_id" = "m"."home_team_id") OR ("tp"."team_id" = "m"."away_team_id"))))
     JOIN "public"."members" "mem" ON (("mem"."id" = "tp"."member_id")))
  WHERE (("m"."id" = "match_games"."match_id") AND ("mem"."user_id" = "auth"."uid"())))));



CREATE POLICY "Players can update games for their matches" ON "public"."match_games" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM (("public"."matches" "m"
     JOIN "public"."team_players" "tp" ON ((("tp"."team_id" = "m"."home_team_id") OR ("tp"."team_id" = "m"."away_team_id"))))
     JOIN "public"."members" "mem" ON (("mem"."id" = "tp"."member_id")))
  WHERE (("m"."id" = "match_games"."match_id") AND ("mem"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (("public"."matches" "m"
     JOIN "public"."team_players" "tp" ON ((("tp"."team_id" = "m"."home_team_id") OR ("tp"."team_id" = "m"."away_team_id"))))
     JOIN "public"."members" "mem" ON (("mem"."id" = "tp"."member_id")))
  WHERE (("m"."id" = "match_games"."match_id") AND ("mem"."user_id" = "auth"."uid"())))));



CREATE POLICY "Players can view games for their matches" ON "public"."match_games" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (("public"."matches" "m"
     JOIN "public"."team_players" "tp" ON ((("tp"."team_id" = "m"."home_team_id") OR ("tp"."team_id" = "m"."away_team_id"))))
     JOIN "public"."members" "mem" ON (("mem"."id" = "tp"."member_id")))
  WHERE (("m"."id" = "match_games"."match_id") AND ("mem"."user_id" = "auth"."uid"())))));



CREATE POLICY "Players can view lineups for their matches" ON "public"."match_lineups" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (("public"."matches" "m"
     JOIN "public"."team_players" "tp" ON ((("tp"."team_id" = "m"."home_team_id") OR ("tp"."team_id" = "m"."away_team_id"))))
     JOIN "public"."members" "mem" ON (("mem"."id" = "tp"."member_id")))
  WHERE (("m"."id" = "match_lineups"."match_id") AND ("mem"."user_id" = "auth"."uid"())))));



CREATE POLICY "Public can view active league team players" ON "public"."team_players" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."teams"
     JOIN "public"."leagues" ON (("teams"."league_id" = "leagues"."id")))
  WHERE (("teams"."id" = "team_players"."team_id") AND (("leagues"."status")::"text" = 'active'::"text") AND (("team_players"."status")::"text" = 'active'::"text")))));



CREATE POLICY "Public can view active league teams" ON "public"."teams" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."leagues"
  WHERE (("leagues"."id" = "teams"."league_id") AND (("leagues"."status")::"text" = 'active'::"text")))));



CREATE POLICY "Public can view active league venues" ON "public"."league_venues" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."leagues"
  WHERE (("leagues"."id" = "league_venues"."league_id") AND (("leagues"."status")::"text" = 'active'::"text")))));



CREATE POLICY "Public can view active leagues" ON "public"."leagues" FOR SELECT USING ((("status")::"text" = 'active'::"text"));



CREATE POLICY "Public can view active members" ON "public"."members" FOR SELECT USING (("role" IS NOT NULL));



CREATE POLICY "Public can view active season weeks" ON "public"."season_weeks" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."seasons"
  WHERE (("seasons"."id" = "season_weeks"."season_id") AND (("seasons"."status")::"text" = 'active'::"text")))));



CREATE POLICY "Public can view active seasons" ON "public"."seasons" FOR SELECT USING ((("status")::"text" = 'active'::"text"));



CREATE POLICY "Public can view active venues" ON "public"."venues" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Team members can insert lineup" ON "public"."match_lineups" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."team_players" "tp"
     JOIN "public"."members" "m" ON (("m"."id" = "tp"."member_id")))
  WHERE (("tp"."team_id" = "match_lineups"."team_id") AND ("m"."user_id" = "auth"."uid"())))));



CREATE POLICY "Team members can update their lineup" ON "public"."match_lineups" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM ("public"."team_players" "tp"
     JOIN "public"."members" "m" ON (("m"."id" = "tp"."member_id")))
  WHERE (("tp"."team_id" = "match_lineups"."team_id") AND ("m"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."team_players" "tp"
     JOIN "public"."members" "m" ON (("m"."id" = "tp"."member_id")))
  WHERE (("tp"."team_id" = "match_lineups"."team_id") AND ("m"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can block others" ON "public"."blocked_users" FOR INSERT WITH CHECK (("auth"."uid"() IN ( SELECT "members"."user_id"
   FROM "public"."members"
  WHERE ("members"."id" = "blocked_users"."blocker_id"))));



CREATE POLICY "Users can create reports" ON "public"."user_reports" FOR INSERT WITH CHECK (("reporter_id" IN ( SELECT "members"."id"
   FROM "public"."members"
  WHERE ("members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can delete their own messages" ON "public"."messages" FOR DELETE USING (("sender_id" = "public"."get_current_member_id"()));



CREATE POLICY "Users can edit their own messages" ON "public"."messages" FOR UPDATE USING (("sender_id" = "public"."get_current_member_id"())) WITH CHECK (("sender_id" = "public"."get_current_member_id"()));



CREATE POLICY "Users can insert their own member record" ON "public"."members" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can join conversations" ON "public"."conversation_participants" FOR INSERT WITH CHECK (("user_id" = "public"."get_current_member_id"()));



CREATE POLICY "Users can leave conversations" ON "public"."conversation_participants" FOR DELETE USING ((("user_id" = "public"."get_current_member_id"()) AND (EXISTS ( SELECT 1
   FROM "public"."conversations"
  WHERE (("conversations"."id" = "conversation_participants"."conversation_id") AND ("conversations"."auto_managed" = false))))));



CREATE POLICY "Users can send messages" ON "public"."messages" FOR INSERT TO "authenticated" WITH CHECK ((("sender_id" = "public"."get_current_member_id"()) AND (EXISTS ( SELECT 1
   FROM "public"."conversation_participants"
  WHERE (("conversation_participants"."conversation_id" = "messages"."conversation_id") AND ("conversation_participants"."user_id" = "messages"."sender_id") AND ("conversation_participants"."left_at" IS NULL))))));



CREATE POLICY "Users can unblock others" ON "public"."blocked_users" FOR DELETE USING (("auth"."uid"() IN ( SELECT "members"."user_id"
   FROM "public"."members"
  WHERE ("members"."id" = "blocked_users"."blocker_id"))));



CREATE POLICY "Users can update their conversations" ON "public"."conversations" FOR UPDATE USING (("public"."is_conversation_participant"("id", "auth"."uid"()) AND ("auto_managed" = false))) WITH CHECK (("public"."is_conversation_participant"("id", "auth"."uid"()) AND ("auto_managed" = false)));



CREATE POLICY "Users can update their own records" ON "public"."members" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own settings" ON "public"."conversation_participants" FOR UPDATE USING (("user_id" = "public"."get_current_member_id"())) WITH CHECK (("user_id" = "public"."get_current_member_id"()));



CREATE POLICY "Users can view actions on their reports" ON "public"."report_actions" FOR SELECT USING (("report_id" IN ( SELECT "user_reports"."id"
   FROM "public"."user_reports"
  WHERE ("user_reports"."reporter_id" = ( SELECT "members"."id"
           FROM "public"."members"
          WHERE ("members"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can view messages in their conversations" ON "public"."messages" FOR SELECT USING ((("is_deleted" = false) AND (EXISTS ( SELECT 1
   FROM "public"."conversation_participants"
  WHERE (("conversation_participants"."conversation_id" = "messages"."conversation_id") AND ("conversation_participants"."user_id" = "public"."get_current_member_id"()) AND ("conversation_participants"."left_at" IS NULL))))));



CREATE POLICY "Users can view participants in their conversations" ON "public"."conversation_participants" FOR SELECT USING ((("user_id" = "public"."get_current_member_id"()) OR "public"."is_conversation_participant"("conversation_id", "public"."get_current_member_id"())));



CREATE POLICY "Users can view their own blocks" ON "public"."blocked_users" FOR SELECT USING (("auth"."uid"() IN ( SELECT "members"."user_id"
   FROM "public"."members"
  WHERE ("members"."id" = "blocked_users"."blocker_id"))));



CREATE POLICY "Users can view their own conversations" ON "public"."conversations" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."conversation_participants"
  WHERE (("conversation_participants"."conversation_id" = "conversations"."id") AND ("conversation_participants"."user_id" = "public"."get_current_member_id"()) AND ("conversation_participants"."left_at" IS NULL)))));



CREATE POLICY "Users can view their own records" ON "public"."members" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own reports" ON "public"."user_reports" FOR SELECT USING (("reporter_id" IN ( SELECT "members"."id"
   FROM "public"."members"
  WHERE ("members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users cannot delete auto-managed conversations" ON "public"."conversations" FOR DELETE USING (("auto_managed" = false));



CREATE POLICY "Venue owners can create profile" ON "public"."venue_owners" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Venue owners can update own profile" ON "public"."venue_owners" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Venue owners can view own profile" ON "public"."venue_owners" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."blocked_users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."championship_date_options" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."conversation_participants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."conversations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."league_venues" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."operator_blackout_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."report_actions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."report_updates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."venue_owners" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_create_match_lineups"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_create_match_lineups"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_create_match_lineups"() TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_delete_match_lineups"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_delete_match_lineups"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_delete_match_lineups"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_delete_time_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_delete_time_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_delete_time_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_edit_time_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_edit_time_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_edit_time_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_announcement_conversation"("p_season_id" "uuid", "p_title" "text", "p_member_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."create_announcement_conversation"("p_season_id" "uuid", "p_title" "text", "p_member_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_announcement_conversation"("p_season_id" "uuid", "p_title" "text", "p_member_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."create_dm_conversation"("user1_id" "uuid", "user2_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_dm_conversation"("user1_id" "uuid", "user2_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_dm_conversation"("user1_id" "uuid", "user2_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_group_conversation"("creator_id" "uuid", "group_name" "text", "member_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."create_group_conversation"("creator_id" "uuid", "group_name" "text", "member_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_group_conversation"("creator_id" "uuid", "group_name" "text", "member_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."create_organization_announcement_conversation"("p_organization_id" "uuid", "p_title" "text", "p_member_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."create_organization_announcement_conversation"("p_organization_id" "uuid", "p_title" "text", "p_member_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_organization_announcement_conversation"("p_organization_id" "uuid", "p_title" "text", "p_member_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_current_member_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_current_member_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_current_member_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_unread_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."increment_unread_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_unread_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_conversation_participant"("conv_id" "uuid", "uid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_conversation_participant"("conv_id" "uuid", "uid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_conversation_participant"("conv_id" "uuid", "uid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."log_report_status_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_report_status_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_report_status_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_blocked_user_dm"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_blocked_user_dm"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_blocked_user_dm"() TO "service_role";



GRANT ALL ON FUNCTION "public"."reset_unread_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."reset_unread_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."reset_unread_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_reviewed_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_reviewed_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_reviewed_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_championship_date_options_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_championship_date_options_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_championship_date_options_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_championship_dates_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_championship_dates_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_championship_dates_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_conversation_last_message"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_conversation_last_message"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_conversation_last_message"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_conversation_on_message_delete"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_conversation_on_message_delete"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_conversation_on_message_delete"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_conversations_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_conversations_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_conversations_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_league_operators_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_league_operators_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_league_operators_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_league_venues_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_league_venues_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_league_venues_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_leagues_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_leagues_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_leagues_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_match_lineups_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_match_lineups_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_match_lineups_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_match_venues_on_team_venue_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_match_venues_on_team_venue_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_match_venues_on_team_venue_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_matches_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_matches_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_matches_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_members_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_members_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_members_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_messages_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_messages_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_messages_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_operator_blackout_preferences_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_operator_blackout_preferences_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_operator_blackout_preferences_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_report_resolved_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_report_resolved_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_report_resolved_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_report_reviewed_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_report_reviewed_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_report_reviewed_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_season_weeks_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_season_weeks_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_season_weeks_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_seasons_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_seasons_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_seasons_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_team_players_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_team_players_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_team_players_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_teams_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_teams_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_teams_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_reports_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_reports_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_reports_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_venue_owners_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_venue_owners_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_venue_owners_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_venues_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_venues_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_venues_updated_at"() TO "service_role";



GRANT ALL ON TABLE "public"."blocked_users" TO "anon";
GRANT ALL ON TABLE "public"."blocked_users" TO "authenticated";
GRANT ALL ON TABLE "public"."blocked_users" TO "service_role";



GRANT ALL ON TABLE "public"."championship_date_options" TO "anon";
GRANT ALL ON TABLE "public"."championship_date_options" TO "authenticated";
GRANT ALL ON TABLE "public"."championship_date_options" TO "service_role";



GRANT ALL ON TABLE "public"."conversation_participants" TO "anon";
GRANT ALL ON TABLE "public"."conversation_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."conversation_participants" TO "service_role";



GRANT ALL ON TABLE "public"."conversations" TO "anon";
GRANT ALL ON TABLE "public"."conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."conversations" TO "service_role";



GRANT ALL ON TABLE "public"."league_operators" TO "anon";
GRANT ALL ON TABLE "public"."league_operators" TO "authenticated";
GRANT ALL ON TABLE "public"."league_operators" TO "service_role";



GRANT ALL ON TABLE "public"."league_venues" TO "anon";
GRANT ALL ON TABLE "public"."league_venues" TO "authenticated";
GRANT ALL ON TABLE "public"."league_venues" TO "service_role";



GRANT ALL ON TABLE "public"."leagues" TO "anon";
GRANT ALL ON TABLE "public"."leagues" TO "authenticated";
GRANT ALL ON TABLE "public"."leagues" TO "service_role";



GRANT ALL ON TABLE "public"."match_games" TO "anon";
GRANT ALL ON TABLE "public"."match_games" TO "authenticated";
GRANT ALL ON TABLE "public"."match_games" TO "service_role";



GRANT ALL ON TABLE "public"."match_lineups" TO "anon";
GRANT ALL ON TABLE "public"."match_lineups" TO "authenticated";
GRANT ALL ON TABLE "public"."match_lineups" TO "service_role";



GRANT ALL ON TABLE "public"."matches" TO "anon";
GRANT ALL ON TABLE "public"."matches" TO "authenticated";
GRANT ALL ON TABLE "public"."matches" TO "service_role";



GRANT ALL ON TABLE "public"."members" TO "anon";
GRANT ALL ON TABLE "public"."members" TO "authenticated";
GRANT ALL ON TABLE "public"."members" TO "service_role";



GRANT ALL ON SEQUENCE "public"."members_system_player_number_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."members_system_player_number_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."members_system_player_number_seq" TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT ALL ON TABLE "public"."operator_blackout_preferences" TO "anon";
GRANT ALL ON TABLE "public"."operator_blackout_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."operator_blackout_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."report_actions" TO "anon";
GRANT ALL ON TABLE "public"."report_actions" TO "authenticated";
GRANT ALL ON TABLE "public"."report_actions" TO "service_role";



GRANT ALL ON TABLE "public"."report_updates" TO "anon";
GRANT ALL ON TABLE "public"."report_updates" TO "authenticated";
GRANT ALL ON TABLE "public"."report_updates" TO "service_role";



GRANT ALL ON TABLE "public"."season_weeks" TO "anon";
GRANT ALL ON TABLE "public"."season_weeks" TO "authenticated";
GRANT ALL ON TABLE "public"."season_weeks" TO "service_role";



GRANT ALL ON TABLE "public"."seasons" TO "anon";
GRANT ALL ON TABLE "public"."seasons" TO "authenticated";
GRANT ALL ON TABLE "public"."seasons" TO "service_role";



GRANT ALL ON TABLE "public"."team_players" TO "anon";
GRANT ALL ON TABLE "public"."team_players" TO "authenticated";
GRANT ALL ON TABLE "public"."team_players" TO "service_role";



GRANT ALL ON TABLE "public"."teams" TO "anon";
GRANT ALL ON TABLE "public"."teams" TO "authenticated";
GRANT ALL ON TABLE "public"."teams" TO "service_role";



GRANT ALL ON TABLE "public"."user_reports" TO "anon";
GRANT ALL ON TABLE "public"."user_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."user_reports" TO "service_role";



GRANT ALL ON TABLE "public"."venue_owners" TO "anon";
GRANT ALL ON TABLE "public"."venue_owners" TO "authenticated";
GRANT ALL ON TABLE "public"."venue_owners" TO "service_role";



GRANT ALL ON TABLE "public"."venues" TO "anon";
GRANT ALL ON TABLE "public"."venues" TO "authenticated";
GRANT ALL ON TABLE "public"."venues" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







