-- Migration: get_invite_details — LEFT JOIN teams
-- Purpose: Same bug that bit get_my_pending_invites bit ClaimPlayer's
--          initial load too. The RPC was INNER JOIN teams — any invite
--          with team_id NULL got dropped, ClaimPlayer saw empty data and
--          told the user "Invalid invite."
--
-- Fix: LEFT JOIN teams. team_name and captain_name come back NULL when
-- there's no team context, and ClaimPlayer already handles that (it
-- fetches all teams the placeholder is on separately). Also add a
-- fallback path for captain_name via invite.invited_by_member_id when
-- there's no team.captain_id to draw from.
--
-- Reference: docs/plans/2026-04-22-001-feat-placeholder-player-lifecycle-plan.md

-- Return shape changes (field renames). Postgres doesn't allow CREATE OR
-- REPLACE to change the returned row type, so drop+create.
DROP FUNCTION IF EXISTS public.get_invite_details(UUID);

CREATE FUNCTION public.get_invite_details(p_token UUID)
RETURNS TABLE (
  is_valid       BOOLEAN,
  member_id      UUID,
  placeholder_first_name TEXT,
  placeholder_last_name  TEXT,
  team_name      TEXT,
  captain_name   TEXT,
  expires_at     TIMESTAMPTZ,
  error_message  TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invite invite_tokens%ROWTYPE;
BEGIN
  SELECT * INTO v_invite FROM invite_tokens it WHERE it.token = p_token;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::TEXT,
                        NULL::TEXT, NULL::TIMESTAMPTZ, 'Invalid invite link'::TEXT;
    RETURN;
  END IF;

  IF v_invite.status = 'claimed' THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::TEXT,
                        NULL::TEXT, NULL::TIMESTAMPTZ, 'This invite has already been used'::TEXT;
    RETURN;
  END IF;

  IF v_invite.status = 'expired' OR v_invite.expires_at < now() THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::TEXT,
                        NULL::TEXT, NULL::TIMESTAMPTZ, 'This invite has expired'::TEXT;
    RETURN;
  END IF;

  IF v_invite.status = 'cancelled' THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::TEXT,
                        NULL::TEXT, NULL::TIMESTAMPTZ, 'This invite has been cancelled'::TEXT;
    RETURN;
  END IF;

  IF v_invite.status = 'rejected' THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::TEXT,
                        NULL::TEXT, NULL::TIMESTAMPTZ, 'This invite was rejected'::TEXT;
    RETURN;
  END IF;

  -- LEFT JOIN teams — auto-created invites have team_id = NULL. In that
  -- case team_name comes back NULL and ClaimPlayer already handles the
  -- "fetch all teams the placeholder is on" fallback.
  -- Captain name falls back to invite.invited_by_member_id when there's
  -- no team.captain_id to resolve from.
  RETURN QUERY
  SELECT
    TRUE,
    m.id,
    m.first_name::TEXT,
    m.last_name::TEXT,
    t.team_name::TEXT,
    COALESCE(
      (cm.first_name || ' ' || cm.last_name),
      (inv.first_name || ' ' || inv.last_name)
    )::TEXT,
    v_invite.expires_at,
    NULL::TEXT
  FROM members m
  LEFT JOIN teams t    ON t.id = v_invite.team_id
  LEFT JOIN members cm ON cm.id = t.captain_id
  LEFT JOIN members inv ON inv.id = v_invite.invited_by_member_id
  WHERE m.id = v_invite.member_id;
END;
$$;

-- Re-grant — DROP removed the prior grants.
GRANT EXECUTE ON FUNCTION public.get_invite_details(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_invite_details(UUID) TO authenticated;
