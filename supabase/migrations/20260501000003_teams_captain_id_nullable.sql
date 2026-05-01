-- Migration: teams.captain_id — drop NOT NULL
-- Purpose: Allow bye-team rows (status='bye') to exist with no captain.
--
-- A bye is a placeholder team — no roster, no captain, no real identity.
-- Real teams (status='active') still always have a captain; that's enforced
-- by the operator UI (TeamEditorModal requires a captain selection), not
-- the schema. Schema relaxation here only enables the bye row's INSERT.
--
-- After this change, code that reads team.captain_id must handle the null
-- case for bye rows. Audit list: every consumer of the
-- `captain:members!captain_id(...)` join, plus direct reads of
-- `team.captain_id`. Audited and updated in Unit 1.5 of this PR.
--
-- Reference: docs/plans/2026-04-29-001-fix-team-cascade-deletion-plan.md (PR 1 Unit 1.1, R3a)

ALTER TABLE teams ALTER COLUMN captain_id DROP NOT NULL;

COMMENT ON COLUMN teams.captain_id IS
'Captain''s member ID. NULL for bye-team rows (status=''bye'') — those have no captain by design. Real (active/withdrawn/forfeited) teams always have a captain set; that invariant is enforced in the team-creation UI, not the schema.';
