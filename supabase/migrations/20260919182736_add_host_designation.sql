-- @fileoverview Add the game-room "host" designation to the catalog.
--
-- Designations Phase 1 follow-on. A host is a person-level designation (the
-- requirements doc reserves "host" for exactly this): it grants the ability to
-- host a game room, with no rooms to enumerate — pure Family 1.
--
-- Adding a designation is DATA, not schema (D4): this is a single catalog row.
-- It rides in a migration only so every environment gets it reproducibly.
--
-- CONSUMERS:
--   - The game room (separate service) checks host status by asking the helper
--     public.member_has_designation(user_id, 'host') — NOT members.role.
--   - The app can gate host-only UI via useUserProfile().hasDesignation('host').
--
-- Granting is manual (SQL) in Phase 1 — no UI, same as the developer key.
INSERT INTO public.designations (name, description)
VALUES ('host', 'Game-room host — may host a game room and invite others to play.')
ON CONFLICT (name) DO NOTHING;
