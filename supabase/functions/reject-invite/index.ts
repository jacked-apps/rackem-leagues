/**
 * @fileoverview Reject Placeholder Invite Edge Function
 *
 * Called when the invited user views the placeholder details on
 * /claim-player, recognizes the record isn't theirs, and clicks
 * "This isn't me." Marks the invite_tokens row as 'rejected' (status
 * added in migration 20260422000006).
 *
 * No merge fires. The placeholder row is untouched — the LO's queue
 * still shows it as needing attention.
 *
 * Request body:
 *   - token: The invite token (from the email link URL param)
 *
 * Authorization:
 *   - Bearer token required (user must be authenticated).
 *   - Authenticated user's email must match the invite's email — same
 *     anti-link-theft gate as claim-placeholder. A stolen link can't be
 *     used to poison an unrelated user's invite queue.
 *
 * Behavior:
 *   - Valid token + email match + status='pending' → status becomes 'rejected'
 *   - Already-claimed / expired / cancelled / rejected → no-op, returns
 *     a clear error message so the UI can tell the user.
 *
 * Usage:
 *   POST /functions/v1/reject-invite
 *   Authorization: Bearer {user_jwt}
 *   { "token": "invite-token-uuid" }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({ error: "Supabase credentials not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid authorization header" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    const userJwt = authHeader.replace("Bearer ", "");

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(userJwt);
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired authentication token" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { token } = await req.json();
    if (!token) {
      return new Response(
        JSON.stringify({ error: "Missing required field: token" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Load the invite. Same email-match gate as claim-placeholder — a
    // stolen link can't be used to mess with another user's invite state.
    const { data: tokenData, error: tokenError } = await supabaseAdmin
      .from("invite_tokens")
      .select("id, email, status")
      .eq("token", token)
      .single();

    if (tokenError || !tokenData) {
      return new Response(
        JSON.stringify({ error: "Invalid invite token" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const userEmail = user.email?.toLowerCase();
    const inviteEmail = tokenData.email?.toLowerCase();
    if (!userEmail || !inviteEmail || userEmail !== inviteEmail) {
      console.warn(`Reject email mismatch: invite=${inviteEmail}, caller=${userEmail}`);
      return new Response(
        JSON.stringify({
          error: "Email mismatch",
          details: "This invite was sent to a different email address."
        }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Only pending invites can be rejected. Already-claimed / expired /
    // cancelled / already-rejected all return distinct errors so the UI
    // can tell the user what actually happened.
    if (tokenData.status !== "pending") {
      return new Response(
        JSON.stringify({
          error: `Invite is ${tokenData.status}`,
          details: `This invite is ${tokenData.status} and can no longer be rejected.`,
          invite_status: tokenData.status,
        }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { error: updateError } = await supabaseAdmin
      .from("invite_tokens")
      .update({ status: "rejected" })
      .eq("id", tokenData.id)
      .eq("status", "pending"); // optimistic concurrency: only flip if still pending

    if (updateError) {
      console.error("Reject update error:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to reject invite", details: updateError.message }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: "Invite rejected" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
