-- ============================================================================
-- MESSAGE PUSH NOTIFICATIONS — v1 — UNIT 8
-- Fire the dispatcher when a real message is inserted
-- ============================================================================
--
-- Wires the last piece: an AFTER INSERT trigger on `messages` that fire-and-
-- forgets a push-dispatch request (via pg_net) to the dispatch-push-notifications
-- edge function. The trigger is exception-wrapped so a push problem can NEVER
-- abort the message insert — sending the message is authoritative; push is
-- best-effort on top.
--
-- Config lives in a single-row `push_dispatch_config` table (function URL +
-- shared secret + enabled) so the URL/secret are per-environment. The secret is
-- seeded EMPTY here and set out-of-band per env (never committed) — see
-- docs/ops/push-notifications-secrets.md. With an empty secret the trigger
-- skips, so a fresh env is inert until deliberately configured.
--
-- See: docs/plans/2026-08-18-001-feat-message-push-notifications-plan.md (Unit 8)
-- ============================================================================

-- pg_net: async outbound HTTP from Postgres (idempotent; already present locally,
-- ensured here for other environments).
CREATE EXTENSION IF NOT EXISTS pg_net;


-- ----------------------------------------------------------------------------
-- 1. push_dispatch_config — per-environment dispatcher endpoint + auth secret
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS push_dispatch_config (
  id            boolean PRIMARY KEY DEFAULT true,
  function_url  text NOT NULL,
  shared_secret text NOT NULL DEFAULT '',
  enabled       boolean NOT NULL DEFAULT true,
  CONSTRAINT push_dispatch_config_single_row CHECK (id)
);

COMMENT ON TABLE push_dispatch_config IS
  'Single-row config for the message push dispatcher: the edge-function URL + the X-Dispatch-Secret to send, per environment. shared_secret is seeded empty and set out-of-band (never committed); an empty secret makes the trigger skip. function_url is the local endpoint here; staging/prod override it with their https function URL.';

-- Seed the local endpoint. Secret intentionally EMPTY (set locally to match
-- supabase/functions/.env DISPATCH_SHARED_SECRET; the DB test sets its own).
INSERT INTO push_dispatch_config (id, function_url, shared_secret, enabled)
VALUES (
  true,
  'http://host.docker.internal:54321/functions/v1/dispatch-push-notifications',
  '',
  true
)
ON CONFLICT (id) DO NOTHING;


-- ----------------------------------------------------------------------------
-- 2. Trigger — fire-and-forget dispatch on real user messages
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION dispatch_message_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg public.push_dispatch_config;
BEGIN
  -- Only real user messages (system messages have is_system = true / sender NULL).
  IF NEW.is_system THEN
    RETURN NEW;
  END IF;

  -- A dispatch failure must never abort the message insert.
  BEGIN
    SELECT * INTO cfg FROM public.push_dispatch_config LIMIT 1;

    IF cfg.enabled AND cfg.shared_secret <> '' AND cfg.function_url <> '' THEN
      PERFORM net.http_post(
        url     := cfg.function_url,
        body    := jsonb_build_object('message_id', NEW.id),
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'X-Dispatch-Secret', cfg.shared_secret
        )
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'dispatch_message_push failed for message %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION dispatch_message_push() IS
  'AFTER INSERT trigger on messages: fire-and-forget a push-dispatch request (pg_net → dispatch-push-notifications edge function) for real user messages. Reads push_dispatch_config; skips if disabled/unconfigured. Wrapped in an exception block so a push failure never aborts the message insert. Runs alongside increment_unread_on_message.';

DROP TRIGGER IF EXISTS on_message_dispatch_push ON messages;
CREATE TRIGGER on_message_dispatch_push
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION dispatch_message_push();
