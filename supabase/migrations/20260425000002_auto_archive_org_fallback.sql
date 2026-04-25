-- Migration: auto_archive_orphan_placeholder — derive org from team chain
-- Purpose: The auto-archive trigger added in 20260425000001 fails when a
--          placeholder being removed has members.organization_id = NULL
--          (legacy placeholders that predate our org-attribution trigger).
--          The placeholder_audit_log INSERT then violates a NOT NULL on
--          organization_id and aborts the entire team-save transaction.
--
-- Fix: try harder to find an org. Use the team_id from the row being
-- deleted to walk team → season → league → organization. That always
-- works as long as the team exists. Only skip the audit row (still
-- archive the placeholder) if even that lookup yields nothing — the
-- archive itself is the load-bearing operation; the audit is bookkeeping.

CREATE OR REPLACE FUNCTION auto_archive_orphan_placeholder()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_member          RECORD;
  v_remaining_teams INT;
  v_merge_active    TEXT;
  v_org_id          UUID;
BEGIN
  -- Skip during a merge — merge_v2 owns its own archive flow.
  v_merge_active := current_setting('app.placeholder_merge_in_progress', true);
  IF v_merge_active = 'true' THEN
    RETURN OLD;
  END IF;

  SELECT id, user_id, archived_at, organization_id
    INTO v_member
    FROM members
   WHERE id = OLD.member_id;

  IF NOT FOUND
     OR v_member.user_id IS NOT NULL
     OR v_member.archived_at IS NOT NULL THEN
    RETURN OLD;
  END IF;

  SELECT COUNT(*)::INT INTO v_remaining_teams
    FROM team_players
   WHERE member_id = OLD.member_id;

  IF v_remaining_teams > 0 THEN
    RETURN OLD;
  END IF;

  -- Resolve org: members.organization_id first, fall back to the team
  -- the row was just removed from. Either is correct attribution; the
  -- column-on-member path is just faster.
  v_org_id := v_member.organization_id;
  IF v_org_id IS NULL THEN
    SELECT l.organization_id INTO v_org_id
    FROM teams t
    JOIN seasons s ON s.id = t.season_id
    JOIN leagues l ON l.id = s.league_id
    WHERE t.id = OLD.team_id;
  END IF;

  -- Archive regardless — the soft-inactivate is the contract this trigger
  -- exists to deliver. Audit is bookkeeping.
  UPDATE members SET archived_at = now() WHERE id = OLD.member_id;

  -- Best-effort audit. If we somehow can't resolve an org (would only
  -- happen if both the placeholder and the team's chain are off-org —
  -- effectively orphaned data) skip the audit insert rather than failing
  -- the surrounding team-save transaction.
  IF v_org_id IS NOT NULL THEN
    INSERT INTO placeholder_audit_log (
      action,
      actor_member_id,
      placeholder_member_id,
      target_member_id,
      organization_id,
      archive_id,
      affected_tables
    ) VALUES (
      'remove_from_team',
      OLD.member_id,
      OLD.member_id,
      NULL,
      v_org_id,
      NULL,
      jsonb_build_object(
        'op', 'auto_archive',
        'reason', 'no_remaining_teams_after_delete',
        'last_team_id', OLD.team_id,
        'org_source',
          CASE WHEN v_member.organization_id IS NOT NULL THEN 'member.organization_id'
               ELSE 'team_chain' END
      )
    );
  END IF;

  RETURN OLD;
END;
$$;
