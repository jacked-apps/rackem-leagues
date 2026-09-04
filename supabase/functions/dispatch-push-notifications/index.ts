/**
 * @fileoverview Dispatch Push Notifications Edge Function (Unit 7).
 *
 * Given a `message_id`, fans out encrypted Web Push to the devices that should
 * receive it. Invoked server-side by the message-insert trigger (Unit 8) via
 * pg_net — NOT from the browser.
 *
 * Flow:
 *   1. Authenticate the caller with the shared secret (X-Dispatch-Secret). The
 *      function is verify_jwt = false, so this header IS the auth — a browser
 *      caller without the secret is rejected. The secret (not the service-role
 *      key) is what the trigger sends, so nothing sensitive lands in pg_net's
 *      queryable request tables.
 *   2. Ask the DB for recipients via get_push_recipients() (the policy lives in
 *      SQL and is unit-tested separately).
 *   3. Per recipient device: build the payload (declarative web_push:8030
 *      envelope so iOS renders it without waking the SW, + a data object for
 *      tap-to-open + a per-conversation tag), and send it.
 *   4. Prune subscriptions the push service reports as gone (404 / 410).
 *
 * Library note: the plan named jsr:@negrel/webpush, but that expects its own
 * JWKS key format; our VAPID keys are standard web-push base64url (generated in
 * Unit 2), so we use npm:web-push here (the plan's documented fallback), which
 * consumes those keys directly and exposes WebPushError.statusCode for pruning.
 *
 * Profanity note: rather than depend on @2toad/profanity running in Deno, a
 * recipient with the profanity filter on gets a generic "New message" preview
 * (also the safe choice for minors) instead of the message text; others get the
 * capped real preview. Exact server-side censoring is a future enhancement.
 *
 * See: docs/plans/2026-08-18-001-feat-message-push-notifications-plan.md (Unit 7)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY");
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT");
const DISPATCH_SHARED_SECRET = Deno.env.get("DISPATCH_SHARED_SECRET");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Dispatch-Secret",
};

const PREVIEW_MAX = 120; // lock-screen privacy: cap the body length

interface RecipientRow {
  member_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  profanity_filter_enabled: boolean;
  sender_name: string | null;
  message_content: string;
  conversation_id: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

/** Build the push payload for one recipient (respects their profanity setting). */
function buildPayload(row: RecipientRow): string {
  const title = row.sender_name?.trim() || "New message";
  const preview = row.profanity_filter_enabled
    ? "New message"
    : row.message_content.slice(0, PREVIEW_MAX) +
      (row.message_content.length > PREVIEW_MAX ? "…" : "");
  const navigate = `/messages/${row.conversation_id}`;
  return JSON.stringify({
    // Declarative Web Push envelope (iOS 18.4+ renders without running the SW).
    web_push: 8030,
    notification: { title, body: preview, navigate },
    // Read by the SW push/notificationclick handlers on Chrome/Android.
    data: { conversationId: row.conversation_id, url: navigate },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  // Auth: this function is only ever called by our own DB trigger.
  if (!DISPATCH_SHARED_SECRET) {
    return json({ error: "Dispatch secret not configured" }, 500);
  }
  if (req.headers.get("X-Dispatch-Secret") !== DISPATCH_SHARED_SECRET) {
    return json({ error: "Unauthorized" }, 401);
  }

  if (
    !SUPABASE_URL ||
    !SUPABASE_SERVICE_ROLE_KEY ||
    !VAPID_PUBLIC_KEY ||
    !VAPID_PRIVATE_KEY ||
    !VAPID_SUBJECT
  ) {
    return json({ error: "Push not configured (VAPID / Supabase env missing)" }, 500);
  }

  let messageId: string | undefined;
  try {
    ({ message_id: messageId } = await req.json());
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  if (!messageId) {
    return json({ error: "message_id is required" }, 400);
  }

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase.rpc("get_push_recipients", {
    p_message_id: messageId,
  });
  if (error) {
    return json({ error: "Failed to load recipients", details: error.message }, 500);
  }

  const recipients = (data ?? []) as RecipientRow[];
  let dispatched = 0;
  let pruned = 0;
  let failed = 0;

  for (const row of recipients) {
    const subscription = {
      endpoint: row.endpoint,
      keys: { p256dh: row.p256dh, auth: row.auth },
    };
    try {
      await webpush.sendNotification(subscription, buildPayload(row));
      dispatched++;
    } catch (err) {
      const statusCode = (err as { statusCode?: number })?.statusCode;
      if (statusCode === 404 || statusCode === 410) {
        // The subscription is gone — prune it so we stop trying.
        await supabase.from("push_subscriptions").delete().eq("endpoint", row.endpoint);
        pruned++;
      } else {
        failed++;
        console.error("push send failed", {
          endpoint: row.endpoint.slice(0, 40),
          statusCode,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  // Structured counts so a silently-broken pipeline is diagnosable from logs.
  console.log("dispatch-push-notifications", { messageId, dispatched, pruned, failed });
  return json({ success: true, dispatched, pruned, failed });
});
