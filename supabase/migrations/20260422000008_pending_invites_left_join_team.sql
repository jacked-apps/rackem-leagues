-- Migration: get_my_pending_invites — LEFT JOIN teams instead of INNER
-- Purpose: The previous INNER JOIN silently dropped any invite whose
--          `team_id` is NULL. Now that invites auto-created by the
--          members trigger (migration 20260422000007) have NULL team_id,
--          the dashboard modal was showing nothing on login for those
--          invites — defeating the whole "log in and see your pending
--          invites" UX.
--
-- Change: `JOIN teams` -> `LEFT JOIN teams`. team_name becomes nullable in
-- the returned row. The modal component is updated in the same change to
-- render "your league" (or similar fallback) when team_name is null.
--
-- Reference: docs/plans/2026-04-22-001-feat-placeholder-player-lifecycle-plan.md

CREATE OR REPLACE FUNCTION public.get_my_pending_invites()
RETURNS TABLE(
  token UUID,
  member_id UUID,
  placeholder_first_name TEXT,
  placeholder_last_name TEXT,
  team_name TEXT,
  captain_name TEXT,
  invited_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  is_expired BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_email TEXT;
BEGIN
  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();

  IF v_user_email IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    it.token,
    it.member_id,
    m.first_name::TEXT AS placeholder_first_name,
    m.last_name::TEXT  AS placeholder_last_name,
    t.team_name::TEXT,
    (cm.first_name || ' ' || cm.last_name)::TEXT AS captain_name,
    it.created_at AS invited_at,
    it.expires_at,
    (it.expires_at <= now()) AS is_expired
  FROM invite_tokens it
  JOIN members m ON m.id = it.member_id
  LEFT JOIN teams t ON t.id = it.team_id
  LEFT JOIN members cm ON cm.id = it.invited_by_member_id
  WHERE LOWER(it.email) = LOWER(v_user_email)
    AND (
      (it.status = 'pending' AND it.expires_at > now())
      OR
      (it.status IN ('pending', 'expired') AND it.expires_at <= now())
    )
  ORDER BY
    (it.expires_at <= now()) ASC,
    it.created_at DESC;
END;
$$;
