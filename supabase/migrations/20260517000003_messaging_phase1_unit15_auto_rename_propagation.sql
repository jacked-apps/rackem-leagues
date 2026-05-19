-- ============================================================================
-- MESSAGING OVERHAUL — PHASE 1 — UNIT 15 (auto-rename propagation)
-- Two triggers that keep auto-managed chat titles in sync with entity
-- renames. Skip rows where the user has explicitly renamed the chat
-- (title_user_edited_at IS NOT NULL — see Unit 19).
-- ============================================================================
--
-- Discovered by Ed during the Phase 1 UI walkthrough on 2026-05-16:
-- "if i change the name of the team does that update the name of the
-- chat?" — at the time the answer was no, the chat title took a
-- snapshot of the team name at creation and never updated.
--
-- Originally scoped to 4 triggers (teams / leagues / seasons /
-- organizations renames). Reduced to 2 after Unit 18 made the
-- announcement titles universal ("League Announcements" / "Global
-- Announcements") — those titles no longer reference the entity name,
-- so org / season renames don't need to propagate. The remaining two
-- chat types still embed entity names in their titles per the Unit 18
-- patterns:
--
--   team_chat     title = `<team.name>`                          (Unit 18)
--   captains_chat title = `'Captains — ' || COALESCE(...)`       (Unit 18)
--
-- The banner context name (org / league for announcements) is fetched
-- live by `useMessageComposerStatus.contextName` on every chat open,
-- so it's always current without any rename trigger.
--
-- Respects Unit 19's `title_user_edited_at`: triggers only touch rows
-- where that column IS NULL. A captain who has renamed their team chat
-- via the EditConversationTitleDialog keeps their custom title even
-- when the underlying team gets renamed in the operator UI.
--
-- Same security shape as Unit 5's roster + captain triggers:
-- SECURITY DEFINER, explicit search_path, REVOKE PUBLIC/authenticated.
--
-- See: docs/plans/2026-05-09-001-feat-messaging-overhaul-phase-1-plan.md (Unit 15)
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. teams.team_name UPDATE → team_chat title
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.trg_teams_rename_propagate_chat_title()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  UPDATE public.conversations
  SET title = NEW.team_name
  WHERE scope_type = 'team'
    AND scope_id = NEW.id
    AND conversation_type = 'team_chat'
    AND auto_managed = TRUE
    AND title_user_edited_at IS NULL;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.trg_teams_rename_propagate_chat_title() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trg_teams_rename_propagate_chat_title() FROM authenticated;

DROP TRIGGER IF EXISTS trg_teams_rename_propagate_chat_title ON public.teams;

CREATE TRIGGER trg_teams_rename_propagate_chat_title
AFTER UPDATE OF team_name ON public.teams
FOR EACH ROW
WHEN (OLD.team_name IS DISTINCT FROM NEW.team_name)
EXECUTE FUNCTION public.trg_teams_rename_propagate_chat_title();

COMMENT ON TRIGGER trg_teams_rename_propagate_chat_title ON public.teams IS
  'Unit 15. When a team is renamed, propagate the new name to the auto-managed team chat title. Skips chats where the captain has set a custom title (title_user_edited_at IS NOT NULL — see Unit 19).';


-- ----------------------------------------------------------------------------
-- 2. leagues.division OR day_of_week UPDATE → captains_chat title (for
--    every season belonging to this league)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.trg_leagues_rename_propagate_chat_title()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  -- captains_chat is per-SEASON (scope_type='season'), not per-league.
  -- Join through seasons to find all the captains chats whose season
  -- belongs to this league.
  UPDATE public.conversations c
  SET title = 'Captains — ' || COALESCE(NEW.division, NEW.day_of_week, 'League')
  FROM public.seasons s
  WHERE c.scope_type = 'season'
    AND c.scope_id = s.id
    AND c.conversation_type = 'captains_chat'
    AND c.auto_managed = TRUE
    AND c.title_user_edited_at IS NULL
    AND s.league_id = NEW.id;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.trg_leagues_rename_propagate_chat_title() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trg_leagues_rename_propagate_chat_title() FROM authenticated;

DROP TRIGGER IF EXISTS trg_leagues_rename_propagate_chat_title ON public.leagues;

CREATE TRIGGER trg_leagues_rename_propagate_chat_title
AFTER UPDATE OF division, day_of_week ON public.leagues
FOR EACH ROW
WHEN (
  OLD.division IS DISTINCT FROM NEW.division
  OR OLD.day_of_week IS DISTINCT FROM NEW.day_of_week
)
EXECUTE FUNCTION public.trg_leagues_rename_propagate_chat_title();

COMMENT ON TRIGGER trg_leagues_rename_propagate_chat_title ON public.leagues IS
  'Unit 15. When a league''s division or day_of_week changes, propagate the new "Captains — <division|day>" title to every auto-managed captains chat in every season of this league. Skips chats with a user-set title (title_user_edited_at IS NOT NULL — see Unit 19).';
