-- ============================================================================
-- Messaging smoothness pass — last_message_sender_id
-- ============================================================================
--
-- Adds a denormalized `last_message_sender_id` column on `conversations`
-- so the conversation-list query can render iMessage/WhatsApp-style
-- preview prefixes without an N+1 lookup against `messages`:
--
--   - "You: nice shot"        — when last message was sent by current user
--   - "Jack: nice shot"       — when last message in a GROUP chat was sent
--                                by another participant
--   - "nice shot"             — default (DM where the other person sent it,
--                                or system messages with sender_id = NULL)
--
-- Pattern mirrors the existing `last_message_preview` / `last_message_at`
-- denormalization (also driven by the same trigger), so the only
-- additional cost is one UUID column + a UUID assignment per insert.
--
-- System messages (Unit 5 roster narration, Unit 4 season activation,
-- etc.) have `sender_id IS NULL`, which is fine — the column inherits
-- NULL, and the UI treats NULL as "system message, no prefix."
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Add the column. Nullable (system messages, brand-new conversations).
--    ON DELETE SET NULL so deleting a member doesn't cascade-delete the
--    conversation; the preview just loses the "Jack: " prefix and becomes
--    unprefixed, which is the correct degraded behavior.
-- ----------------------------------------------------------------------------
ALTER TABLE "public"."conversations"
  ADD COLUMN IF NOT EXISTS "last_message_sender_id" uuid
  REFERENCES "public"."members"("id") ON DELETE SET NULL;

COMMENT ON COLUMN "public"."conversations"."last_message_sender_id" IS
  'Denormalized sender_id of the last non-deleted message in this conversation. NULL for system messages or empty conversations. Maintained by the update_conversation_last_message + update_conversation_on_message_delete triggers. Used by the conversation-list UI to render "You: ..." / "Jack: ..." preview prefixes without an N+1 messages lookup.';

-- ----------------------------------------------------------------------------
-- 2. Replace `update_conversation_last_message` to also set sender_id.
--    Trigger fires AFTER INSERT on messages (existing trigger,
--    unchanged otherwise).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "public"."update_conversation_last_message"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Update conversation with new message info, including denormalized
  -- sender_id for the conversation-list preview prefix.
  UPDATE conversations
  SET
    last_message_at = NEW.created_at,
    last_message_sender_id = NEW.sender_id,
    last_message_preview = CASE
      WHEN LENGTH(NEW.content) > 100 THEN SUBSTRING(NEW.content FROM 1 FOR 100) || '...'
      ELSE NEW.content
    END
  WHERE id = NEW.conversation_id;

  RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. Replace `update_conversation_on_message_delete` to also re-derive
--    sender_id from the new "most recent non-deleted message" lookup.
--    Trigger fires AFTER UPDATE OF is_deleted (soft-delete path; existing
--    trigger, unchanged otherwise).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "public"."update_conversation_on_message_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  last_msg RECORD;
BEGIN
  -- Find the most recent non-deleted message (now also pulling sender_id).
  SELECT created_at, content, sender_id INTO last_msg
  FROM messages
  WHERE conversation_id = NEW.conversation_id
    AND is_deleted = FALSE
  ORDER BY created_at DESC
  LIMIT 1;

  IF last_msg IS NOT NULL THEN
    UPDATE conversations
    SET
      last_message_at = last_msg.created_at,
      last_message_sender_id = last_msg.sender_id,
      last_message_preview = CASE
        WHEN LENGTH(last_msg.content) > 100 THEN SUBSTRING(last_msg.content FROM 1 FOR 100) || '...'
        ELSE last_msg.content
      END
    WHERE id = NEW.conversation_id;
  ELSE
    -- No messages left, clear preview + sender.
    UPDATE conversations
    SET
      last_message_at = NULL,
      last_message_sender_id = NULL,
      last_message_preview = NULL
    WHERE id = NEW.conversation_id;
  END IF;

  RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. Backfill existing conversations. For each conversation, find the
--    most recent non-deleted message and assign its sender_id. Idempotent:
--    re-running the migration just re-derives the same value.
-- ----------------------------------------------------------------------------
UPDATE "public"."conversations" c
SET last_message_sender_id = m.sender_id
FROM (
  SELECT DISTINCT ON (conversation_id)
    conversation_id,
    sender_id
  FROM "public"."messages"
  WHERE is_deleted = FALSE
  ORDER BY conversation_id, created_at DESC
) m
WHERE c.id = m.conversation_id;
