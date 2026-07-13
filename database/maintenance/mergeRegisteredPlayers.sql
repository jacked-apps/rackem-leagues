-- =============================================================================
-- mergeRegisteredPlayers.sql  —  DEVELOPER-ONLY manual account merge
-- =============================================================================
--
-- @fileoverview One-off maintenance script to merge TWO REAL (registered)
-- accounts that belong to the same human — e.g. a player who signed up twice
-- (second account created after a problem with the first) and has since played
-- matches under BOTH logins. The LO has verified they are the same person.
--
-- WHY THIS IS A RAW SQL SCRIPT (and not a UI button / edge function):
--   This must NOT be a normal, self-serve action. The in-app "attach
--   placeholder" merge deliberately REFUSES to merge two real accounts
--   (merge_placeholder_into_member_v2 requires the source to have
--   user_id IS NULL). Keeping this as a script that only runs from the
--   Supabase SQL editor means only a developer with service access can do it.
--   There is nothing to deploy — paste + run against the target database.
--
-- HOW IT WORKS:
--   We reuse the SAME battle-tested RPC the placeholder flow uses
--   (merge_placeholder_into_member_v2). It moves EVERYTHING from the discard
--   account into the keep account (matches, lineups, rosters, stats, every FK
--   reference), writes an archived_placeholders + placeholder_audit_log row
--   (so the merge stays UNDOABLE via the normal lo-undo-merge path), and
--   re-validates org scope + same-match collisions.
--   The only trick: we first null the discard account's user_id so the RPC
--   accepts it as a "placeholder." Everything runs in ONE transaction — any
--   problem raises an exception and rolls the whole thing back, including the
--   user_id null.
--
-- HOW TO USE (three steps):
--   1. Run STEP 1 (read-only preview). Confirm both member IDs are non-null,
--      the emails are the right way round, and same_match_conflict IS NULL.
--   2. Run STEP 2 (the merge). Note the printed archive_id and the dead
--      auth-user id from the NOTICE output.
--   3. Delete the dead login in Supabase -> Authentication -> Users (paste the
--      printed auth-user id). This cascades its identities/sessions cleanly.
--      The discard MEMBER row is already gone; this removes the orphan LOGIN
--      so the person can only ever sign in with the kept account.
--
-- IF same_match_conflict IS NOT NULL: the two accounts were both entered into
--   the SAME match. The RPC will (correctly) refuse, to avoid a duplicate
--   player in one match. Fix that one match by hand first (remove the wrong
--   entry from match_lineups), then re-run.
--
-- TO UNDO a merge: call the lo-undo-merge edge function with the archive_id
--   printed by STEP 2 (or restore from archived_placeholders manually).
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1 — READ-ONLY PREVIEW  (makes no changes; safe to run repeatedly)
-- ─────────────────────────────────────────────────────────────────────────────
-- Edit the two emails, run, and inspect the single result row.
WITH input AS (
  SELECT
    lower('KEEP_EMAIL_HERE')    AS keep_email,     -- account they KEEP going forward
    lower('DISCARD_EMAIL_HERE') AS discard_email   -- account folded in, then deleted
),
k AS (
  SELECT m.id AS member_id, m.user_id, u.email
  FROM members m JOIN auth.users u ON u.id = m.user_id, input
  WHERE lower(u.email) = input.keep_email
),
d AS (
  SELECT m.id AS member_id, m.user_id, u.email
  FROM members m JOIN auth.users u ON u.id = m.user_id, input
  WHERE lower(u.email) = input.discard_email
)
SELECT
  (SELECT email     FROM k) AS keep_email,
  (SELECT member_id FROM k) AS keep_member,
  (SELECT count(*)  FROM match_lineups ml WHERE (SELECT member_id FROM k) IN
     (ml.player1_id, ml.player2_id, ml.player3_id, ml.player4_id, ml.player5_id))
                            AS keep_match_rows,
  (SELECT email     FROM d) AS discard_email,
  (SELECT member_id FROM d) AS discard_member,
  (SELECT count(*)  FROM match_lineups ml WHERE (SELECT member_id FROM d) IN
     (ml.player1_id, ml.player2_id, ml.player3_id, ml.player4_id, ml.player5_id))
                            AS discard_match_rows,
  -- If non-null, both accounts appear in the same match(es) -> merge will
  -- refuse. Resolve those matches by hand before running STEP 2.
  (SELECT array_agg(DISTINCT ml_p.match_id)
     FROM match_lineups ml_p
     JOIN match_lineups ml_t ON ml_t.match_id = ml_p.match_id
     WHERE (SELECT member_id FROM d) IN
       (ml_p.player1_id, ml_p.player2_id, ml_p.player3_id, ml_p.player4_id, ml_p.player5_id)
       AND (SELECT member_id FROM k) IN
       (ml_t.player1_id, ml_t.player2_id, ml_t.player3_id, ml_t.player4_id, ml_t.player5_id)
  ) AS same_match_conflict;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2 — PERFORM THE MERGE  (one transaction; rolls back on any error)
-- ─────────────────────────────────────────────────────────────────────────────
-- Use the SAME two emails you previewed above.
DO $$
DECLARE
  v_keep_email    TEXT := 'KEEP_EMAIL_HERE';     -- <-- must match STEP 1
  v_discard_email TEXT := 'DISCARD_EMAIL_HERE';  -- <-- must match STEP 1

  v_keep         UUID;
  v_discard      UUID;
  v_discard_user UUID;
  v_org          UUID;
  v_conflict     UUID[];
  v_res          RECORD;
BEGIN
  -- Resolve both member rows from their login emails.
  SELECT m.id INTO v_keep
    FROM members m JOIN auth.users u ON u.id = m.user_id
    WHERE lower(u.email) = lower(v_keep_email);
  SELECT m.id, m.user_id INTO v_discard, v_discard_user
    FROM members m JOIN auth.users u ON u.id = m.user_id
    WHERE lower(u.email) = lower(v_discard_email);

  IF v_keep IS NULL     THEN RAISE EXCEPTION 'Keep account % not found (or has no member row)', v_keep_email; END IF;
  IF v_discard IS NULL  THEN RAISE EXCEPTION 'Discard account % not found (or has no member row)', v_discard_email; END IF;
  IF v_keep = v_discard THEN RAISE EXCEPTION 'Both emails resolve to the same member row'; END IF;

  -- Resolve org: prefer the discard account's team chain, fall back to its
  -- direct attribution column. The RPC re-validates this org scope.
  SELECT l.organization_id INTO v_org
    FROM team_players tp
    JOIN teams   t ON t.id = tp.team_id
    JOIN seasons s ON s.id = t.season_id
    JOIN leagues l ON l.id = s.league_id
    WHERE tp.member_id = v_discard
    LIMIT 1;
  IF v_org IS NULL THEN
    SELECT organization_id INTO v_org FROM members WHERE id = v_discard;
  END IF;
  IF v_org IS NULL THEN RAISE EXCEPTION 'Could not resolve an organization for the discard account'; END IF;

  -- Same-match collision guard (the RPC checks this too; we fail early with a
  -- clearer message so nothing is mutated).
  SELECT array_agg(DISTINCT ml_p.match_id) INTO v_conflict
    FROM match_lineups ml_p
    JOIN match_lineups ml_t ON ml_t.match_id = ml_p.match_id
    WHERE v_discard IN (ml_p.player1_id, ml_p.player2_id, ml_p.player3_id, ml_p.player4_id, ml_p.player5_id)
      AND v_keep    IN (ml_t.player1_id, ml_t.player2_id, ml_t.player3_id, ml_t.player4_id, ml_t.player5_id);
  IF v_conflict IS NOT NULL AND array_length(v_conflict, 1) > 0 THEN
    RAISE EXCEPTION 'Both accounts share match(es): % — resolve those by hand first', v_conflict;
  END IF;

  -- Demote the discard account to a "placeholder" so merge_v2 will accept it.
  -- (If anything below fails, this UPDATE rolls back with the transaction.)
  UPDATE members SET user_id = NULL WHERE id = v_discard;

  -- Fire the same merge the placeholder flow uses. actor = keep member,
  -- role = lo_initiated (LO-authorized attach).
  SELECT * INTO v_res FROM merge_placeholder_into_member_v2(
    v_discard,        -- p_placeholder_member_id (source, folded in + deleted)
    v_keep,           -- p_target_member_id      (destination, kept)
    v_keep,           -- p_actor_member_id       (recorded in the audit row)
    'lo_initiated',   -- p_actor_role
    v_org             -- p_organization_id
  );

  IF NOT v_res.success THEN
    RAISE EXCEPTION 'Merge failed: %', v_res.error_message;
  END IF;

  RAISE NOTICE '=======================================================';
  RAISE NOTICE 'MERGE OK.  archive_id = %', v_res.archive_id;
  RAISE NOTICE '           tables updated = %, rows moved = %', v_res.tables_updated, v_res.total_rows_updated;
  RAISE NOTICE 'NEXT: delete the dead login in Supabase -> Authentication -> Users';
  RAISE NOTICE '      auth user id to delete = %', v_discard_user;
  RAISE NOTICE 'TO UNDO: run lo-undo-merge with the archive_id above';
  RAISE NOTICE '=======================================================';
END $$;
