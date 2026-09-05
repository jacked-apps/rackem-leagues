-- ============================================================================
-- NOTIFICATION CONTROLS — Unit 1: schema + resolver
-- ============================================================================
--
-- Gives a member real control over push without ever letting a lower level
-- shout through a higher one.
--
-- THE RULE (read this before changing anything below): each level is a VETO,
-- not an override. A notification is sent only when EVERY level allows it:
--
--     master switch  AND  not in quiet hours  AND  type allows  AND  chat allows
--
-- A per-chat setting can make a conversation quieter. It can never make one
-- louder than the level above it. "Notify me for everything except one chat" is
-- expressed as master ON plus that chat OFF — not as a chat overriding a master
-- that is off. The payoff is that "why was I not notified?" always has exactly
-- one answer.
--
-- Do NOT "fix" this into an override cascade. It looks like the app's
-- resolved_league_preferences view and behaves the opposite way on purpose.
--
-- See docs/plans/2026-09-04-001-feat-notification-controls-plan.md
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Per-member, per-conversation-kind defaults
-- ----------------------------------------------------------------------------
--
-- One row per (member, kind). Absence of a row means "no restriction from this
-- level" — the same as the veto rule everywhere else, so a member who has never
-- opened settings behaves exactly like today.
--
-- A table rather than JSONB on `members` so `get_push_recipients` can resolve
-- the whole chain in one query, and so adding a conversation kind later is a
-- row rather than a migration.

CREATE TABLE IF NOT EXISTS member_notification_prefs (
  member_id         uuid    NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  conversation_kind text    NOT NULL,
  -- false = this member vetoes the entire kind.
  push_enabled      boolean NOT NULL DEFAULT true,
  -- Minutes of quiet after a notification for one conversation of this kind.
  -- NULL = no rate limiting (every message may notify). NULL for `direct`:
  -- a DM is one person talking to you, and holding those back reads as the app
  -- swallowing messages rather than as restraint.
  interval_minutes  integer,
  PRIMARY KEY (member_id, conversation_kind),
  CONSTRAINT member_notification_prefs_interval_sane
    CHECK (interval_minutes IS NULL OR (interval_minutes > 0 AND interval_minutes <= 1440))
);

COMMENT ON TABLE member_notification_prefs IS
  'Per-member notification defaults per conversation kind. A missing row means no restriction from this level. Sits UNDER push_type_policy (the system phase switch) and OVER the per-conversation setting; every level is a veto, never an override.';

COMMENT ON COLUMN member_notification_prefs.interval_minutes IS
  'Minutes of quiet after notifying for one conversation of this kind. NULL = no rate limiting. NULL for direct (DMs always buzz) — rate limiting exists for the many-people-in-one-room problem, which is a group-chat property.';


-- ----------------------------------------------------------------------------
-- 2. Per-conversation additions
-- ----------------------------------------------------------------------------
--
-- NOTE: `notification_mode` deliberately does NOT change. Under an override
-- model you would need to distinguish "explicitly all" from "unset", because
-- either could win. Under the veto model a chat can only subtract, so 'all' and
-- unset mean the same thing — neither restricts — and the check is just
-- `<> 'none'`. No nullable migration and no backfill, so no chance of silently
-- pinning every existing participant.
--
-- ('mentions' also correctly blocks today: with no @mention routing it can
-- never fire, so treating it as a veto is honest rather than a bug.)

ALTER TABLE conversation_participants
  -- NULL = this chat adds no timing restriction; the kind's value stands.
  -- Resolution is MAX(kind, chat): a chat can be quieter, never louder.
  ADD COLUMN IF NOT EXISTS notification_interval_minutes integer,
  -- When this member was last notified FOR THIS CONVERSATION. Written by the
  -- dispatcher after a successful send, so a failed send never opens a quiet
  -- period the member didn't get the benefit of.
  ADD COLUMN IF NOT EXISTS last_notified_at timestamptz;

ALTER TABLE conversation_participants
  DROP CONSTRAINT IF EXISTS conversation_participants_interval_sane;
ALTER TABLE conversation_participants
  ADD CONSTRAINT conversation_participants_interval_sane
  CHECK (notification_interval_minutes IS NULL
         OR (notification_interval_minutes > 0 AND notification_interval_minutes <= 1440));

COMMENT ON COLUMN conversation_participants.notification_interval_minutes IS
  'Per-conversation quiet window in minutes. NULL = defer to the kind default. Effective value is MAX(kind, this) — a chat may only make itself quieter.';
COMMENT ON COLUMN conversation_participants.last_notified_at IS
  'Last successful push to this member for this conversation; the rate-limit window is measured from here.';

-- Legacy Phase 1 columns. The Phase 1 plan said drop these in a Phase 2 cleanup
-- once nothing read them; verified 2026-09-04 that no application code does —
-- `notification_mode` superseded both.
ALTER TABLE conversation_participants
  DROP COLUMN IF EXISTS is_muted,
  DROP COLUMN IF EXISTS notifications_enabled;


-- ----------------------------------------------------------------------------
-- 3. Quiet hours (global per member)
-- ----------------------------------------------------------------------------
--
-- Quiet hours are a property of the person's day, not of any conversation, so
-- they are global and absolute — no per-chat exception.
--
-- Stored as local wall-clock times plus the member's IANA zone. "22:00" is
-- meaningless without knowing whose clock; the venue/org timezones discussed
-- elsewhere are the wrong unit here, since this follows the person.

ALTER TABLE members
  ADD COLUMN IF NOT EXISTS quiet_hours_start time,
  ADD COLUMN IF NOT EXISTS quiet_hours_end   time,
  ADD COLUMN IF NOT EXISTS timezone          text;

COMMENT ON COLUMN members.quiet_hours_start IS
  'Local wall-clock start of quiet hours. NULL (or a NULL end) means quiet hours are off. May wrap midnight — 22:00 to 07:00 is the expected shape.';
COMMENT ON COLUMN members.timezone IS
  'IANA zone (e.g. America/New_York) for interpreting quiet hours. Captured from the browser; NULL disables quiet hours rather than guessing a zone.';


-- ----------------------------------------------------------------------------
-- 4. is_in_quiet_hours() — one place, so the wrap-around is written once
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION is_in_quiet_hours(
  p_start time,
  p_end   time,
  p_tz    text
)
RETURNS boolean
LANGUAGE sql
-- STABLE, not IMMUTABLE: this reads now(). Marking a clock-reading function
-- IMMUTABLE lets the planner fold it to a constant, so quiet hours would be
-- evaluated once and then reused — silently wrong in exactly the way that is
-- hardest to notice.
STABLE
AS $$
  SELECT CASE
    -- Not configured, or no zone to interpret it in → never quiet.
    WHEN p_start IS NULL OR p_end IS NULL OR p_tz IS NULL THEN false
    -- Degenerate equal bounds would otherwise mean "always quiet", which is a
    -- silent way to lose every notification. Treat as off.
    WHEN p_start = p_end THEN false
    -- Same-day window, e.g. 13:00–15:00.
    WHEN p_start < p_end THEN
      (now() AT TIME ZONE p_tz)::time >= p_start
      AND (now() AT TIME ZONE p_tz)::time < p_end
    -- Wraps midnight, e.g. 22:00–07:00 — the expected shape.
    ELSE
      (now() AT TIME ZONE p_tz)::time >= p_start
      OR (now() AT TIME ZONE p_tz)::time < p_end
  END;
$$;

COMMENT ON FUNCTION is_in_quiet_hours(time, time, text) IS
  'True when the member''s local wall-clock time falls inside their quiet-hours window. Handles the midnight wrap. Unconfigured or zone-less returns false (never quiet) rather than guessing.';


-- ----------------------------------------------------------------------------
-- 5. get_push_recipients — the veto chain
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_push_recipients(p_message_id uuid)
RETURNS TABLE(
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
SET search_path TO 'public'
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
  -- LEVEL 0 — system phase switch. Not a user setting: decides whether this
  -- kind of conversation pushes at all, in any environment.
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
   -- LEVEL 3 — this conversation. 'all' and 'mentions' differ only once
   -- @mention routing exists; until then only 'none' is a veto... and
   -- 'mentions' can never fire, so it vetoes too. Hence: must be 'all'.
   AND cp.notification_mode = 'all'
  -- LEVEL 1 — the member's master switch.
  JOIN members rm
    ON rm.id = cp.user_id
   AND rm.push_enabled IS NOT FALSE
   -- LEVEL 2 — quiet hours. Global and absolute; no per-chat escape.
   AND NOT is_in_quiet_hours(rm.quiet_hours_start, rm.quiet_hours_end, rm.timezone)
  JOIN push_subscriptions ps ON ps.member_id = cp.user_id
  JOIN members sm ON sm.id = e.sender_id
  -- LEVEL 2b — the member's default for this kind of conversation.
  -- A missing row means no restriction, so LEFT JOIN and treat NULL as allow.
  LEFT JOIN member_notification_prefs mnp
    ON mnp.member_id = cp.user_id
   AND mnp.conversation_kind = e.conv_kind
  WHERE COALESCE(mnp.push_enabled, true) = true
    -- RATE LIMIT — effective window is MAX(kind default, this chat): a chat may
    -- make itself quieter, never louder. NULL on both sides means no limit,
    -- which is how DMs always buzz.
    AND (
      GREATEST(
        COALESCE(mnp.interval_minutes, 0),
        COALESCE(cp.notification_interval_minutes, 0)
      ) = 0
      OR cp.last_notified_at IS NULL
      OR cp.last_notified_at < now() - make_interval(
           mins => GREATEST(
             COALESCE(mnp.interval_minutes, 0),
             COALESCE(cp.notification_interval_minutes, 0)
           )
         )
    )
    AND NOT EXISTS (
      SELECT 1 FROM blocked_users b
      WHERE (b.blocker_id = e.sender_id AND b.blocked_id = cp.user_id)
         OR (b.blocker_id = cp.user_id  AND b.blocked_id = e.sender_id)
    );
$$;

COMMENT ON FUNCTION get_push_recipients(uuid) IS
  'Who should receive a push for this message. Every level is a VETO — system kind policy, member master switch, quiet hours, member per-kind default, per-conversation setting, and the rate-limit window must ALL allow it. No level can re-enable what a higher one turned off. Do not refactor into an override cascade.';


-- ----------------------------------------------------------------------------
-- 6. mark_push_notified() — stamp the window after a SUCCESSFUL send
-- ----------------------------------------------------------------------------
--
-- Separate from the read above so the dispatcher stamps only the devices it
-- actually reached. Stamping at selection time would open a quiet period for
-- someone whose push then failed — they'd get silence instead of a retry.

CREATE OR REPLACE FUNCTION mark_push_notified(
  p_conversation_id uuid,
  p_member_ids      uuid[]
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  UPDATE conversation_participants
     SET last_notified_at = now()
   WHERE conversation_id = p_conversation_id
     AND user_id = ANY(p_member_ids);
$$;

COMMENT ON FUNCTION mark_push_notified(uuid, uuid[]) IS
  'Opens the rate-limit window for the members actually pushed to. Called by the dispatcher AFTER a successful send, never at selection time.';

-- Anon must not be able to read the recipient list or stamp windows; these are
-- called by the dispatcher with the service role.
REVOKE ALL ON FUNCTION get_push_recipients(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION mark_push_notified(uuid, uuid[]) FROM PUBLIC, anon;
