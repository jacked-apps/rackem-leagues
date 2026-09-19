-- @fileoverview Introduce the designations store and move the developer
-- master key into it, deprecating members.role.
--
-- Phase 1 of the designations / organization-permissions work
-- (docs/brainstorms/2026-09-16-member-designations-requirements.md, reqs D1-D9).
--
-- A "designation" describes the PERSON (developer, and later host / may-own-org),
-- as opposed to a "permission" which says what someone may do and where (that
-- lives in organization_staff). The developer designation is the master key
-- (D7): it satisfies every check by definition.
--
-- After this migration nothing reads members.role to decide developer access —
-- the app, the audit trigger, and the RLS policy all ask the store via one
-- helper. members.role is left physically in place for now (it still carries a
-- benign 'player' default on member creation); dropping the column + the
-- user_role enum is the finishing step, done with the RLS security pass.

-- ---------------------------------------------------------------------------
-- Catalog: the set of possible designations is DATA, not schema (D4). Adding a
-- new one (host, may_own_organization, ...) is an INSERT here, not a migration.
-- A catalog table (rather than a bare text column) keeps the FK integrity that
-- stops a typo'd designation from silently never matching.
-- ---------------------------------------------------------------------------
CREATE TABLE public.designations (
  name text PRIMARY KEY,
  description text NOT NULL DEFAULT ''
);

INSERT INTO public.designations (name, description) VALUES
  ('developer', 'System master key — satisfies every permission and designation check by definition.');

-- ---------------------------------------------------------------------------
-- Grants: which member holds which designation, when granted, by whom, how, and
-- whether/when it ended (D2). A record with ended_at IS NULL is active.
-- ---------------------------------------------------------------------------
CREATE TABLE public.member_designations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  designation text NOT NULL REFERENCES public.designations(name),
  granted_at timestamptz NOT NULL DEFAULT now(),
  -- Who granted it, where a person was responsible (NULL = system / manual SQL).
  granted_by uuid REFERENCES public.members(id) ON DELETE SET NULL,
  -- How it was obtained: 'manual', 'migrated', later 'purchase', etc.
  source text NOT NULL DEFAULT 'manual',
  -- Scheduled expiry; NULL = never (D2). Phase 2 territory — developer never expires.
  ends_at timestamptz,
  -- The STORED end fact (D3): set when the record is closed. Active = NULL.
  ended_at timestamptz,
  -- Distinguish a lapse from a revoke after the fact (D5): 'lapsed' | 'revoked'.
  end_reason text
);

COMMENT ON TABLE public.member_designations IS
  'Designations a member holds (developer, and future host / may-own-org). '
  'A row with ended_at IS NULL is active. Grants are manual (SQL) in Phase 1.';

-- D3: at most one ACTIVE record per (member, designation), enforced on the
-- stored end fact — never on a time-varying "expiry in the future" predicate,
-- which Postgres cannot index.
CREATE UNIQUE INDEX member_designations_active_uniq
  ON public.member_designations (member_id, designation)
  WHERE ended_at IS NULL;

CREATE INDEX member_designations_member_idx
  ON public.member_designations (member_id);

-- ---------------------------------------------------------------------------
-- The one helper every SQL caller uses (M2/M3): "does the member behind this
-- auth user hold an active designation?" Written in plpgsql (not plain SQL) so
-- the planner cannot inline it and strip the SECURITY DEFINER context; STABLE so
-- it is evaluated once per statement; search_path pinned against escalation.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.member_has_designation(p_user_id uuid, p_designation text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.member_designations md
    JOIN public.members m ON m.id = md.member_id
    WHERE m.user_id = p_user_id
      AND md.designation = p_designation
      AND md.ended_at IS NULL
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Migrate any existing developers into the store (idempotent against the active
-- partial-unique index). Locally there are none; production keeps its developer.
-- ---------------------------------------------------------------------------
INSERT INTO public.member_designations (member_id, designation, source)
SELECT id, 'developer', 'migrated'
FROM public.members
WHERE role = 'developer'
ON CONFLICT (member_id, designation) WHERE (ended_at IS NULL) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Move the two SQL developer-checks off members.role and onto the helper.
-- ---------------------------------------------------------------------------

-- Audit trigger: the 'operator' branch already reads organization_staff; only
-- the 'developer' branch needed moving.
CREATE OR REPLACE FUNCTION public.log_report_status_change()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF OLD.status != NEW.status THEN
    INSERT INTO report_updates (
      report_id, updater_id, updater_role, old_status, new_status, update_notes
    ) VALUES (
      NEW.id,
      (SELECT id FROM members WHERE user_id = auth.uid() LIMIT 1),
      (CASE
        WHEN EXISTS (SELECT 1 FROM organization_staff WHERE member_id = (SELECT id FROM members WHERE user_id = auth.uid() LIMIT 1)) THEN 'operator'
        WHEN public.member_has_designation(auth.uid(), 'developer') THEN 'developer'
        ELSE 'unknown'
      END),
      OLD.status, NEW.status, NULL
    );
  END IF;
  RETURN NEW;
END;
$function$;

-- RLS policy on rules_page_events (RLS is currently disabled globally, but keep
-- the policy correct so the security pass inherits a store-based check).
DROP POLICY IF EXISTS "Developers can read rules page events" ON public.rules_page_events;
CREATE POLICY "Developers can read rules page events"
  ON public.rules_page_events
  FOR SELECT
  USING (public.member_has_designation(auth.uid(), 'developer'));
