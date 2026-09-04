-- ============================================================================
-- MESSAGE PUSH NOTIFICATIONS — v1 — UNIT 7
-- get_push_recipients(): the recipient policy, as a testable SQL function
-- ============================================================================
--
-- Given a message id, returns the devices that should receive a push for it,
-- with the per-recipient profanity flag + the message context the dispatcher
-- needs. Encapsulating the policy here keeps the edge function thin and lets a
-- DB test pin the selection logic directly.
--
-- v1 policy (one row per recipient DEVICE):
--   * the message is a real user message (is_system = false, not deleted)
--   * the conversation's kind — COALESCE(conversation_type, 'direct') — is
--     push-enabled in push_type_policy (v1 seeds only 'direct')
--   * the recipient is an active participant (left_at IS NULL), is NOT the
--     sender, and has notification_mode = 'all'
--   * members.push_enabled IS NOT FALSE (NULL/true pass)
--   * the recipient has >= 1 push_subscription (device)
--   * no block relationship exists between sender and recipient (either way)
--
-- See: docs/plans/2026-08-18-001-feat-message-push-notifications-plan.md (Unit 7)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_push_recipients(p_message_id uuid)
RETURNS TABLE (
  member_id uuid,
  endpoint text,
  p256dh text,
  auth text,
  profanity_filter_enabled boolean,
  sender_name text,
  message_content text,
  conversation_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH msg AS (
    SELECT m.sender_id,
           m.content,
           m.conversation_id,
           COALESCE(c.conversation_type, 'direct') AS conv_kind
    FROM messages m
    JOIN conversations c ON c.id = m.conversation_id
    WHERE m.id = p_message_id
      AND m.is_system = false
      AND m.is_deleted = false
      AND m.sender_id IS NOT NULL
  ),
  eligible AS (
    SELECT msg.*
    FROM msg
    JOIN push_type_policy p
      ON p.conversation_kind = msg.conv_kind
     AND p.push_enabled = true
  )
  SELECT
    cp.user_id                                       AS member_id,
    ps.endpoint,
    ps.p256dh,
    ps.auth,
    COALESCE(rm.profanity_filter_enabled, false)     AS profanity_filter_enabled,
    COALESCE(NULLIF(sm.nickname, ''), sm.first_name) AS sender_name,
    e.content                                        AS message_content,
    e.conversation_id
  FROM eligible e
  JOIN conversation_participants cp
    ON cp.conversation_id = e.conversation_id
   AND cp.user_id <> e.sender_id
   AND cp.left_at IS NULL
   AND cp.notification_mode = 'all'
  JOIN members rm ON rm.id = cp.user_id AND rm.push_enabled IS NOT FALSE
  JOIN push_subscriptions ps ON ps.member_id = cp.user_id
  JOIN members sm ON sm.id = e.sender_id
  WHERE NOT EXISTS (
    SELECT 1 FROM blocked_users b
    WHERE (b.blocker_id = e.sender_id AND b.blocked_id = cp.user_id)
       OR (b.blocker_id = cp.user_id  AND b.blocked_id = e.sender_id)
  );
$$;

COMMENT ON FUNCTION get_push_recipients(uuid) IS
  'Devices that should receive a push for a given message (v1 policy): real user message; conversation kind push-enabled in push_type_policy (v1: direct only); recipient is an active participant (left_at NULL, not the sender) with notification_mode = all and members.push_enabled not false and >=1 push_subscription; and no block relationship with the sender. One row per (recipient, device). Consumed by the dispatch-push-notifications edge function.';

GRANT EXECUTE ON FUNCTION get_push_recipients(uuid) TO service_role;
