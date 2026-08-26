-- ============================================================================
-- MESSAGE PUSH NOTIFICATIONS — v1 — UNIT 1
-- Schema foundations for Web Push delivery
-- ============================================================================
--
-- Greenfield schema for the message push-notification pipeline. Three additive
-- pieces, all consumed by later units of the plan:
--
--   1. push_subscriptions   — one row per subscribed DEVICE (a user may have
--                             several: phone + tablet + laptop). Stores the
--                             Web Push endpoint + the two encryption keys the
--                             dispatcher needs to send an encrypted push.
--                             `member_id` (not auth uid) is the endpoint→member
--                             mapping that also banks the v2 reply-from-
--                             notification forward-compat.
--
--   2. members.push_enabled — per-user master switch, independent of the
--                             browser permission. NULL = never prompted;
--                             TRUE = on; FALSE = globally off. The dispatcher
--                             notifies only when this is NOT FALSE.
--
--   3. push_type_policy      — the "which conversation kinds push" phase switch.
--                             One row per kind; v1 seeds only 'direct' = true
--                             (personal DMs + manual group chats, which carry
--                             conversation_type = NULL / auto_managed = false and
--                             normalize to the 'direct' kind). Later phases turn
--                             a channel on by UPDATE-ing a single row — no code
--                             change. The eventual per-user notification console
--                             is a separate layer, backed by the already-existing
--                             conversation_participants.notification_mode column.
--
-- RLS: none here — RLS is intentionally OFF until the pre-launch pass. NOTE for
-- that pass: push_subscriptions is a PRIORITY table — its rows are per-device
-- push credentials, so a spoofed row is an eavesdropping vector; write access
-- must be member-scoped at launch. push_type_policy should be admin-write-only.
--
-- See: docs/plans/2026-08-18-001-feat-message-push-notifications-plan.md (Unit 1)
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. push_subscriptions — one row per subscribed device
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id   uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  endpoint    text NOT NULL UNIQUE,
  p256dh      text NOT NULL,
  auth        text NOT NULL,
  user_agent  text,
  created_at  timestamp with time zone NOT NULL DEFAULT now(),
  last_seen_at timestamp with time zone
);

-- Fan-out lookup: "give me every device for this member" runs on every dispatch.
CREATE INDEX IF NOT EXISTS push_subscriptions_member_id_idx
  ON push_subscriptions (member_id);

COMMENT ON TABLE push_subscriptions IS
  'One row per subscribed browser/device for Web Push. member_id → members.id (not auth uid). endpoint is the push-service URL (unique); p256dh + auth are the RFC 8291 encryption keys. Pruned on 404/410 by the dispatcher. RLS-pass priority: rows are device push credentials.';

COMMENT ON COLUMN push_subscriptions.endpoint IS
  'Push-service endpoint URL. UNIQUE — the upsert/dedupe key for a device (also collapses re-subscribes and pushsubscriptionchange rotations).';


-- ----------------------------------------------------------------------------
-- 2. members.push_enabled — per-user global on/off
-- ----------------------------------------------------------------------------

ALTER TABLE members
  ADD COLUMN IF NOT EXISTS push_enabled boolean;

COMMENT ON COLUMN members.push_enabled IS
  'Global push master switch, independent of the browser permission. NULL = never prompted (onboarding re-prompts); TRUE = on; FALSE = globally off. Dispatcher notifies only when NOT FALSE.';


-- ----------------------------------------------------------------------------
-- 3. push_type_policy — per-conversation-kind push eligibility (phase switch)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS push_type_policy (
  conversation_kind text PRIMARY KEY,
  push_enabled      boolean NOT NULL DEFAULT false
);

COMMENT ON TABLE push_type_policy IS
  'Which conversation kinds are eligible for push, per phase. The dispatcher maps a conversation to its kind via COALESCE(conversation_type, ''direct'') and joins here. Turn a channel on by UPDATE-ing its row — no code change. v1 seeds only ''direct'' = true.';

-- v1: personal DMs + manual group chats (the 'direct' kind) only. The
-- auto-managed channels ship OFF and are lit up in later phases.
INSERT INTO push_type_policy (conversation_kind, push_enabled) VALUES
  ('direct',        true),
  ('team_chat',     false),
  ('captains_chat', false),
  ('announcements', false),
  ('match_chat',    false)
ON CONFLICT (conversation_kind) DO NOTHING;
