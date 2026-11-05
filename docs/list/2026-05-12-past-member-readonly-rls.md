---
summary: Database rules so removed members and announcement chats are truly read-only
kind: task
added: 2026-05-12
checked: 2026-11-04
---

Waits on the RLS-enablement project (see `project_rls_disabled_in_dev`).
Medium priority: a defense-in-depth gap until then.

Unit 6 of the messaging Phase 1 plan called for a UI banner plus RLS policies.
Only the UI part (`ReadOnlyBanner`) shipped. A determined user can still call
`supabase-js .insert()` from the browser console and post into an
announcements chat or a chat they were removed from.

This is the full policy design, so nothing has to be re-derived from the plan.

## Policies to add (tables `messages` and `conversation_participants`)

1. `messages` SELECT: past members can read messages up to and including
   their `left_at`.

   ```
   EXISTS (
     SELECT 1 FROM conversation_participants cp
     WHERE cp.conversation_id = messages.conversation_id
       AND cp.user_id = get_current_member_id()
       AND (cp.left_at IS NULL OR messages.created_at <= cp.left_at)
   )
   ```

   Use `get_current_member_id()` (returns `members.id`). Do NOT compare
   `members.id` to `auth.uid()` directly; the helper handles the
   `auth.uid() -> members.user_id` step.

2. `messages` INSERT: active participants only.

   ```
   EXISTS (
     SELECT 1 FROM conversation_participants cp
     WHERE cp.conversation_id = messages.conversation_id
       AND cp.user_id = get_current_member_id()
       AND cp.left_at IS NULL
   )
   ```

3. Announcements INSERT gate: only `organization_staff` may insert into a
   conversation with `conversation_type='announcements'`.

   ```
   EXISTS (
     SELECT 1
     FROM conversations c
     LEFT JOIN seasons s ON s.id = c.scope_id AND c.scope_type = 'season'
     LEFT JOIN leagues l ON l.id = s.league_id
     JOIN organization_staff os
       ON os.organization_id = COALESCE(
            CASE WHEN c.scope_type = 'organization' THEN c.scope_id END,
            l.organization_id
          )
     WHERE c.id = messages.conversation_id
       AND c.conversation_type = 'announcements'
       AND os.member_id = get_current_member_id()
   )
   ```

   Combine with the active-participant INSERT policy via `OR`, or make it a
   separate policy that only applies to announcement conversations. Keep the
   `conversation_type='announcements'` guard so the staff-only gate doesn't
   close the door on other chats.

4. `conversation_participants` UPDATE/DELETE lockdown: only triggers
   (SECURITY DEFINER) and `service_role` may set `left_at`. Otherwise a user
   could push their own `left_at` into the future to keep reading, or set it
   to NULL to lift the INSERT block.

   ```
   REVOKE UPDATE (left_at), DELETE ON conversation_participants
     FROM authenticated;
   GRANT UPDATE (notification_mode, last_read_at, is_muted,
                 notifications_enabled, unread_count)
     ON conversation_participants TO authenticated;
   ```

## Tests required (from the plan)

- Past member SELECT before `left_at` succeeds; after `left_at` blocked.
- Past member INSERT blocked.
- Active member SELECT and INSERT work normally.
- Boundary: `left_at = messages.created_at` is INCLUSIVE on SELECT.
- Non-participant SELECT blocked.
- User tries to UPDATE their own `left_at`: blocked.
- A user whose `auth.uid()` matches no `members.id` they appear in (catches
  the `members.id = auth.uid()` bug class).

Keep passing: `src/__tests__/database/messaging.rls.test.ts` and
`src/__tests__/database/members.rls.test.ts`.

Migration: `supabase/migrations/<real UTC timestamp>_messaging_phase1_past_member_rls.sql`.

## Why it was deferred

Debugging Supabase RLS has been costly for Ed. The working pattern is "build
features RLS-off, harden with RLS later in one dedicated pass."

Source: Unit 6 of `docs/plans/2026-05-09-001-feat-messaging-overhaul-phase-1-plan.md`.
