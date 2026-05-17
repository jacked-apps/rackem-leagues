-- ============================================================================
-- MESSAGING OVERHAUL — PHASE 1 — UNIT 14 (season-end release of cannot_leave)
-- When a season flips from 'active' to 'completed', flip cannot_leave to
-- FALSE for every participant of that season's team chats + captains chat.
-- ============================================================================
--
-- Per Ed's design (2026-05-15 polish triage): captains can't leave their
-- team / captains chat while the season is active (cannot_leave=TRUE set
-- by Unit 4's season-activation trigger + Unit 5's roster triggers). But
-- once the season ends, that restriction should lift — anyone (captain
-- included) should be able to leave / archive the chat.
--
-- Chats themselves are NOT deleted, NOT auto-archived — just made
-- leave-able. Leaving sets `left_at` (Unit 6), which moves the chat to
-- the "Archived" section of the inbox (Unit 20) where the past-member
-- can still read history.
--
-- This is the mirror of Unit 4's season-activation trigger. Simpler:
-- no chat creation, just a single UPDATE on conversation_participants.
--
-- Idempotency: re-firing on an already-completed season is a safe
-- no-op (the UPDATE just sets cannot_leave=FALSE where it's already
-- FALSE).
--
-- Same security shape as Unit 4/5: SECURITY DEFINER, explicit
-- search_path, REVOKE PUBLIC/authenticated. WHEN clause filters to
-- only the active→completed transition.
--
-- See: docs/plans/2026-05-09-001-feat-messaging-overhaul-phase-1-plan.md (Unit 14)
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Function
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.trg_seasons_release_cannot_leave_on_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  -- Flip cannot_leave=FALSE for every participant of:
  --   (a) the team chats of every team in this season, and
  --   (b) the captains chat for this season.
  -- Both join paths are unioned into the WHERE.
  UPDATE public.conversation_participants cp
  SET cannot_leave = FALSE
  WHERE cp.cannot_leave = TRUE
    AND cp.conversation_id IN (
      -- (a) team chats for this season's teams
      SELECT c.id
      FROM public.conversations c
      JOIN public.teams t ON t.id = c.scope_id
      WHERE c.scope_type = 'team'
        AND c.conversation_type = 'team_chat'
        AND c.auto_managed = TRUE
        AND t.season_id = NEW.id
      UNION
      -- (b) captains chat for this season
      SELECT c.id
      FROM public.conversations c
      WHERE c.scope_type = 'season'
        AND c.scope_id = NEW.id
        AND c.conversation_type = 'captains_chat'
        AND c.auto_managed = TRUE
    );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.trg_seasons_release_cannot_leave_on_completion() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trg_seasons_release_cannot_leave_on_completion() FROM authenticated;


-- ----------------------------------------------------------------------------
-- 2. Trigger
-- ----------------------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_seasons_release_cannot_leave_on_completion ON public.seasons;

CREATE TRIGGER trg_seasons_release_cannot_leave_on_completion
AFTER UPDATE OF status ON public.seasons
FOR EACH ROW
WHEN (OLD.status = 'active' AND NEW.status = 'completed')
EXECUTE FUNCTION public.trg_seasons_release_cannot_leave_on_completion();

COMMENT ON TRIGGER trg_seasons_release_cannot_leave_on_completion ON public.seasons IS
  'Unit 14. When a season flips active → completed, lift cannot_leave on every participant of that season''s team chats + captains chat. Chats themselves stay intact; the change just lets captains (and anyone else with cannot_leave=TRUE) leave / archive the chat now that the season is over. Idempotent re-firing.';
