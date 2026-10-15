-- ─────────────────────────────────────────────────────────────────
-- STEP 1d — IS THAT ID EVEN A MEMBER?  (read-only; run if 1c returned nothing)
-- ─────────────────────────────────────────────────────────────────────────────
-- An id with no roster row anywhere is usually not a `members.id` at all. The
-- two ids get confused constantly because the Auth dashboard and the app show
-- different ones for the same human:
--   * auth.users.id   — the LOGIN. What Supabase -> Authentication -> Users
--                       lists, and what you get from a session/JWT.
--   * members.id      — the PLAYER. What lineups, games and stats reference.
--     members.user_id is the link between them, and it is NULLABLE: a
--     placeholder player entered by a captain has no login at all.
--
-- This looks the id up both ways. `matched_on` tells you which it was:
--   'members.id'      -> it IS a member; he has simply never been rostered.
--   'members.user_id' -> you had the LOGIN id. Use the member_id column this
--                        returns for every other step in this file.
--   (no rows)         -> the id is neither; wrong id entirely.
WITH input AS (
  SELECT 'bee0d3c8-a1c2-4168-95ea-eb027fbcfa30'::uuid AS probe
)
SELECT 'members.id'      AS matched_on,
       m.id              AS member_id,
       m.user_id,
       m.first_name || ' ' || m.last_name AS name,
       m.email
FROM members m CROSS JOIN input i
WHERE m.id = i.probe
UNION ALL
SELECT 'members.user_id' AS matched_on,
       m.id              AS member_id,
       m.user_id,
       m.first_name || ' ' || m.last_name AS name,
       m.email
FROM members m CROSS JOIN input i
WHERE m.user_id = i.probe;

