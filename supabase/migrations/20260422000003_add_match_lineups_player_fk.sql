-- Migration: Declare foreign keys on match_lineups.player{1-5}_id
-- Purpose: Close the latent data-integrity gap where these five columns hold
--          member UUIDs but were never declared as foreign keys.
--
-- The existing `merge_placeholder_into_member` RPC discovers FK columns via
-- `information_schema.referential_constraints` and dynamically rewrites each
-- one when merging a placeholder. Because player1..5_id had no declared FK,
-- the merge loop silently missed them — a placeholder could be merged, its
-- members row deleted, and lineup rows left pointing at a UUID no row owns
-- anymore. Declaring these as proper FKs auto-enrolls them in the merge
-- loop (and in the upcoming undo path).
--
-- ON DELETE NO ACTION matches `swap_new_player_id` (the only existing
-- member-referencing FK on this table) and is required: the merge RPC
-- must rewrite every reference before the placeholder row is deleted.
-- CASCADE would erase lineup history the moment a placeholder is deleted.
--
-- SAFETY: a pre-constraint orphan check runs first. If any existing row has
-- a non-NULL player{1-5}_id that doesn't match a `members.id`, the migration
-- aborts with a clear exception naming up to 20 offending rows. This makes
-- staging/prod deploys fail loudly at reconciliation time rather than
-- silently adding a constraint that will be violated by existing data.
--
-- Reference: docs/plans/2026-04-22-001-feat-placeholder-player-lifecycle-plan.md (Unit 1)

-- ============================================================================
-- Step 1: orphan check (aborts migration if any dangling references exist)
-- ============================================================================
DO $$
DECLARE
  v_count   INTEGER;
  v_preview TEXT;
  v_shown   INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM (
    SELECT ml.player1_id AS bad_id FROM match_lineups ml LEFT JOIN members m ON m.id = ml.player1_id WHERE ml.player1_id IS NOT NULL AND m.id IS NULL
    UNION ALL
    SELECT ml.player2_id FROM match_lineups ml LEFT JOIN members m ON m.id = ml.player2_id WHERE ml.player2_id IS NOT NULL AND m.id IS NULL
    UNION ALL
    SELECT ml.player3_id FROM match_lineups ml LEFT JOIN members m ON m.id = ml.player3_id WHERE ml.player3_id IS NOT NULL AND m.id IS NULL
    UNION ALL
    SELECT ml.player4_id FROM match_lineups ml LEFT JOIN members m ON m.id = ml.player4_id WHERE ml.player4_id IS NOT NULL AND m.id IS NULL
    UNION ALL
    SELECT ml.player5_id FROM match_lineups ml LEFT JOIN members m ON m.id = ml.player5_id WHERE ml.player5_id IS NOT NULL AND m.id IS NULL
  ) _;

  IF v_count > 0 THEN
    SELECT string_agg(format('  lineup_id=%s column=%s bad_member_id=%s', lineup_id, col, bad_id), E'\n')
      INTO v_preview
      FROM (
        SELECT ml.id AS lineup_id, 'player1_id' AS col, ml.player1_id AS bad_id FROM match_lineups ml LEFT JOIN members m ON m.id = ml.player1_id WHERE ml.player1_id IS NOT NULL AND m.id IS NULL
        UNION ALL
        SELECT ml.id, 'player2_id', ml.player2_id FROM match_lineups ml LEFT JOIN members m ON m.id = ml.player2_id WHERE ml.player2_id IS NOT NULL AND m.id IS NULL
        UNION ALL
        SELECT ml.id, 'player3_id', ml.player3_id FROM match_lineups ml LEFT JOIN members m ON m.id = ml.player3_id WHERE ml.player3_id IS NOT NULL AND m.id IS NULL
        UNION ALL
        SELECT ml.id, 'player4_id', ml.player4_id FROM match_lineups ml LEFT JOIN members m ON m.id = ml.player4_id WHERE ml.player4_id IS NOT NULL AND m.id IS NULL
        UNION ALL
        SELECT ml.id, 'player5_id', ml.player5_id FROM match_lineups ml LEFT JOIN members m ON m.id = ml.player5_id WHERE ml.player5_id IS NOT NULL AND m.id IS NULL
        LIMIT 20
      ) p;

    v_shown := LEAST(v_count, 20);

    RAISE EXCEPTION E'Cannot declare match_lineups.player{1-5}_id foreign keys: % orphan row(s) reference deleted members.\nFirst % shown:\n%\n\nReconcile these rows (delete the lineups or restore the missing members) before re-running this migration.',
      v_count, v_shown, v_preview;
  ELSE
    RAISE NOTICE 'Orphan check passed: 0 dangling player_id references in match_lineups. Declaring FKs...';
  END IF;
END $$;

-- ============================================================================
-- Step 2: declare the five foreign keys
-- ============================================================================
-- Single ALTER TABLE so all five are added atomically.
ALTER TABLE match_lineups
  ADD CONSTRAINT match_lineups_player1_id_fkey FOREIGN KEY (player1_id) REFERENCES members(id) ON DELETE NO ACTION,
  ADD CONSTRAINT match_lineups_player2_id_fkey FOREIGN KEY (player2_id) REFERENCES members(id) ON DELETE NO ACTION,
  ADD CONSTRAINT match_lineups_player3_id_fkey FOREIGN KEY (player3_id) REFERENCES members(id) ON DELETE NO ACTION,
  ADD CONSTRAINT match_lineups_player4_id_fkey FOREIGN KEY (player4_id) REFERENCES members(id) ON DELETE NO ACTION,
  ADD CONSTRAINT match_lineups_player5_id_fkey FOREIGN KEY (player5_id) REFERENCES members(id) ON DELETE NO ACTION;
