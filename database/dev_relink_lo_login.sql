-- ============================================================================
-- DEV-ONLY: Relink member rows to their local auth login after a prod clone.
-- ============================================================================
--
-- WHY THIS EXISTS
--   Cloning the production database only brings the `public` schema. The
--   `auth` schema (GoTrue's auth.users / auth.identities — the actual login
--   records) is Supabase-managed and does NOT come across in a public-schema
--   dump. So after a clone, every `members.user_id` still points at a
--   PRODUCTION login id that doesn't exist locally, and nobody can resolve to
--   their member/org-staff data when they log in.
--
--   The app resolves "who am I" purely by `members.user_id = auth.uid()`
--   (see src/api/queries/members.ts, src/rules/useMyMemberships.ts) — never by
--   email — so the fix is to repoint user_id at the LOCAL login that owns the
--   same email address.
--
-- WHAT THIS DOES
--   For every member whose email matches a LOCAL auth.users email but whose
--   user_id is stale (points at the wrong / non-existent login), repoint
--   members.user_id to the local auth.users.id for that email. This reconnects
--   your login to your member row, which reconnects organization_staff
--   (owner/admin) and everything downstream.
--
-- WHAT IT DOES NOT DO
--   - Does NOT create any auth.users rows. Sign up the accounts you need to
--     test as via the app first (or keep using your own login). Players you
--     never log in as don't need a local login at all.
--
-- HOW TO RUN
--   After a clone + after signing up locally with the email(s) you test as:
--     docker exec -i supabase_db_rackem-leagues \
--       psql -U postgres -d postgres -f - < database/dev_relink_lo_login.sql
--   ...or paste it into Supabase Studio's SQL editor. Idempotent — safe to
--   re-run; rows already linked correctly are skipped.
-- ============================================================================

UPDATE public.members m
SET user_id = u.id
FROM auth.users u
WHERE lower(m.email) = lower(u.email)
  AND m.user_id IS DISTINCT FROM u.id;

-- Show what's now linked, so you can confirm before browsing.
SELECT u.email          AS login,
       m.first_name || ' ' || m.last_name AS member,
       m.role
FROM auth.users u
JOIN public.members m ON m.user_id = u.id
ORDER BY u.email;
