-- @fileoverview Add an optional league scope to organization_staff.
--
-- Phase 1 of the designations / organization-permissions work
-- (docs/brainstorms/2026-09-16-member-designations-requirements.md, req O3/O4).
--
-- WHY NOW: The scope column must exist from day one, before the granular
-- permission list is written. Retrofitting scope onto an unscoped grant table
-- later forces touching every permission check site — the most commonly
-- regretted omission in this problem space (O4).
--
-- SEMANTICS:
--   league_id IS NULL  -> the grant applies org-wide (every league in the org).
--   league_id IS set   -> the grant applies to that ONE league only.
-- This is how "total access" vs "scoped staff" is expressed without inventing a
-- second concept (O3). Grants are additive / most-permissive-wins at ask time.
--
-- INTEGRITY: A league-scoped grant must point at a league that actually belongs
-- to the same organization as the grant. We enforce that in the DATABASE with a
-- composite foreign key (organization_id, league_id) -> leagues (organization_id, id),
-- rather than trusting application code. Because league_id is nullable and the
-- default MATCH SIMPLE rule skips the check when any referenced column is NULL,
-- an org-wide grant (league_id NULL) is correctly left unconstrained.

-- A composite FK requires a matching unique constraint on the target columns.
-- leagues.id is already the primary key (so it is unique), which means this
-- composite unique can never actually be violated — it exists only to serve as
-- the FK target.
ALTER TABLE public.leagues
  ADD CONSTRAINT leagues_org_id_id_unique UNIQUE (organization_id, id);

ALTER TABLE public.organization_staff
  ADD COLUMN league_id uuid;

COMMENT ON COLUMN public.organization_staff.league_id IS
  'Optional league scope for this staff grant. NULL = org-wide (every league); '
  'set = this one league only. FK guarantees the league belongs to organization_id.';

ALTER TABLE public.organization_staff
  ADD CONSTRAINT organization_staff_league_scope_fkey
  FOREIGN KEY (organization_id, league_id)
  REFERENCES public.leagues (organization_id, id)
  ON DELETE CASCADE;

-- Lookups resolve a member's grants and answer "who is scoped to this league?",
-- so index the new scope column.
CREATE INDEX organization_staff_league_id_idx
  ON public.organization_staff (league_id);
