-- Migration: Tournament paid foundation — "tournaments I'm in"
--
-- get_my_tournaments() — the tournaments the CALLER is playing in, as opposed
-- to the ones they are running.
--
-- Until now the tournaments list only answered "what did I create?" (a plain
-- `created_by` filter). A player who scanned a QR code had no way back to their
-- own tournament from inside the app — they had to keep the tab open or go find
-- the code again, which is not a thing you can do once you've walked away from
-- the wall it was taped to.
--
-- Returns the JOIN TOKEN, because the player's home for a tournament is the
-- join page — the live list of who's in, who's waiting, the rules, and the
-- bracket once it exists. It deliberately does NOT return the share token: this
-- is the player's own view, not the spectator one.
--
-- Tournaments the caller CREATED are excluded. The list already has a section
-- for those, and an organizer who also plays would otherwise appear in both.
--
-- Walk-ups get nothing here, and cannot: they have no account to look them up
-- by. Their only route back is the link their browser remembered (walkupMemory)
-- or scanning again. That is a real limit of being accountless, not an
-- oversight.

CREATE OR REPLACE FUNCTION "public"."get_my_tournaments"()
RETURNS "jsonb"
LANGUAGE "plpgsql"
STABLE
SECURITY DEFINER
SET "search_path" = "public"
AS $$
DECLARE
  v_member_id uuid;
  v_rows jsonb;
BEGIN
  SELECT id INTO v_member_id FROM members WHERE user_id = auth.uid();
  IF v_member_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT jsonb_agg(t ORDER BY t.created_at DESC)
    INTO v_rows
    FROM (
      SELECT DISTINCT ON (b.id)
             b.id,
             b.name,
             b.status,
             b.join_token,
             b.created_at,
             -- Where they stand, so the row can say "waiting" without a second
             -- read. Once the tournament starts the hopper row keeps its
             -- 'official' status, so this stays true after conversion.
             h.status AS entry_status
        FROM brackets b
        JOIN bracket_hopper h
          ON h.bracket_id = b.id
         AND h.member_id = v_member_id
       WHERE b.status <> 'closed'
         -- Their own tournaments are listed separately by the page.
         AND b.created_by <> v_member_id
       ORDER BY b.id, b.created_at DESC
    ) t;

  RETURN COALESCE(v_rows, '[]'::jsonb);
END;
$$;

REVOKE EXECUTE ON FUNCTION "public"."get_my_tournaments"() FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."get_my_tournaments"() TO "authenticated";

COMMENT ON FUNCTION "public"."get_my_tournaments"() IS
  'Tournaments the calling member is PLAYING in (from their bracket_hopper row), excluding closed ones and ones they created. Returns each tournament''s join_token so the player can get back to their own view of it. Member resolved from auth.uid(); authenticated-only. See docs/plans/2026-09-04-001.';
