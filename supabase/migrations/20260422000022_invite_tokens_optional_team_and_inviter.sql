-- Migration: invite_tokens — make team_id and invited_by_member_id optional
-- Purpose: The original invite_tokens schema required both of these
--          columns to be set. They were context for the email body,
--          never fundamental to the invite's identity. The claim flow
--          already handles multi-team placeholders by querying
--          team_players dynamically — the team on the token was only
--          used as a single-team display label. Relaxing them lets the
--          DB-level "every placeholder with an email has a pending
--          invite" invariant be enforced by a trigger that doesn't have
--          team or caller context (e.g., bulk-import paths, the org-
--          scoping trigger that creates invites at member-creation time).
--
-- The actual trigger that enforces the invariant lives in a later
-- migration (placeholder_org_scoping) so the column-existence ordering
-- is correct: members.created_by_member_id (added in
-- members_created_by_member_id) must exist before the trigger that
-- references NEW.created_by_member_id is created.
--
-- Reference: docs/plans/2026-04-22-001-feat-placeholder-player-lifecycle-plan.md

ALTER TABLE invite_tokens ALTER COLUMN team_id DROP NOT NULL;
ALTER TABLE invite_tokens ALTER COLUMN invited_by_member_id DROP NOT NULL;

COMMENT ON COLUMN invite_tokens.team_id IS
'Optional context (populated when a captain triggers the invite from a specific team). The invite itself binds an email to a member_id; team context is for email body display only.';

COMMENT ON COLUMN invite_tokens.invited_by_member_id IS
'Optional audit (populated when a captain/LO explicitly triggers the invite). Invites created by the auto-trigger inherit the value from members.created_by_member_id when known.';
