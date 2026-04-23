/**
 * @fileoverview Claim Placeholder Edge Function
 *
 * Phase 5: Handles merging a placeholder player into an existing registered user.
 * This is called when an already-registered user clicks an invite link.
 *
 * Two scenarios:
 *   1. User clicks link and is NOT logged in -> redirect to login, then call this
 *   2. User clicks link and IS logged in -> call this directly
 *
 * Request body:
 *   - placeholderMemberId: UUID of the placeholder player to claim
 *   - token: The invite token from the email link (for validation)
 *
 * Authorization:
 *   - Requires Bearer token (user must be authenticated)
 *   - The authenticated user's member record will receive the PP's history
 *
 * Security:
 *   - Validates the token exists and is pending (not claimed/expired/cancelled)
 *   - CRITICAL: Verifies the authenticated user's email matches the invite's email
 *     This prevents stolen links from being used by unauthorized users
 *   - Token can only be used once (marked as claimed after merge)
 *
 * Behavior:
 *   - Validates the token matches the placeholder
 *   - Verifies email match between auth user and invite
 *   - Finds the authenticated user's member record
 *   - Calls merge_placeholder_into_member() to transfer all data
 *   - Returns success with merge stats
 *
 * Usage:
 *   POST /functions/v1/claim-placeholder
 *   Authorization: Bearer {user_jwt}
 *   {
 *     "placeholderMemberId": "pp-uuid-here",
 *     "token": "invite-token-uuid"
 *   }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

// CORS headers for browser requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check Supabase credentials
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({ error: "Supabase credentials not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get the authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid authorization header" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const userJwt = authHeader.replace("Bearer ", "");

    // Create admin client for database operations
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify the user's JWT and get their user_id
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(userJwt);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired authentication token" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Parse request body
    const { placeholderMemberId, token } = await req.json();

    // Validate required fields
    if (!placeholderMemberId) {
      return new Response(
        JSON.stringify({ error: "Missing required field: placeholderMemberId" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    if (!token) {
      return new Response(
        JSON.stringify({ error: "Missing required field: token" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate the token (include email for security verification)
    const { data: tokenData, error: tokenError } = await supabaseAdmin
      .from("invite_tokens")
      .select("id, member_id, email, status, expires_at")
      .eq("token", token)
      .single();

    if (tokenError || !tokenData) {
      return new Response(
        JSON.stringify({ error: "Invalid invite token" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // SECURITY: Verify the authenticated user's email matches the invite email
    // This prevents someone from stealing a link and claiming another user's PP
    const userEmail = user.email?.toLowerCase();
    const inviteEmail = tokenData.email?.toLowerCase();

    if (!userEmail || !inviteEmail || userEmail !== inviteEmail) {
      console.warn(`Email mismatch: invite sent to ${inviteEmail}, claimed by ${userEmail}`);
      return new Response(
        JSON.stringify({
          error: "Email mismatch",
          details: "This invite was sent to a different email address. Please log in with the correct account."
        }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check token status
    if (tokenData.status === "claimed") {
      return new Response(
        JSON.stringify({ error: "This invite has already been claimed" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (tokenData.status === "expired" || new Date(tokenData.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "This invite has expired" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (tokenData.status === "cancelled") {
      return new Response(
        JSON.stringify({ error: "This invite has been cancelled" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Verify token matches the placeholder
    if (tokenData.member_id !== placeholderMemberId) {
      return new Response(
        JSON.stringify({ error: "Token does not match the specified placeholder" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Find the authenticated user's member record
    const { data: userMember, error: memberError } = await supabaseAdmin
      .from("members")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (memberError || !userMember) {
      return new Response(
        JSON.stringify({
          error: "No member record found for authenticated user",
          details: "You need to complete registration before claiming a placeholder"
        }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Resolve the invite's organization_id via team_id -> teams -> seasons -> leagues.
    // merge_v2 requires this as an authz parameter. Sourcing it from the invite's
    // team_id (rather than from a client body field) means a caller cannot spoof
    // a different org — the invite itself pins the org.
    const { data: teamRow, error: teamError } = await supabaseAdmin
      .from("teams")
      .select("seasons!inner(leagues!inner(organization_id))")
      .eq("id", tokenData.team_id)
      .single();

    // deno-lint-ignore no-explicit-any
    const organizationId = (teamRow as any)?.seasons?.leagues?.organization_id;
    if (teamError || !organizationId) {
      console.error("Failed to resolve organization_id from invite team", teamError);
      return new Response(
        JSON.stringify({ error: "Could not resolve invite organization" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Call the snapshot-capturing v2 merge. actor_member_id is the caller (the
    // invited user self-claiming); actor_role is 'invite_accept'. organization_id
    // comes from the invite, not from client input, so the authz check inside
    // the RPC re-verifies the placeholder belongs to that org via its team chain.
    const { data: mergeResult, error: mergeError } = await supabaseAdmin
      .rpc("merge_placeholder_into_member_v2", {
        p_placeholder_member_id: placeholderMemberId,
        p_target_member_id: userMember.id,
        p_actor_member_id: userMember.id,
        p_actor_role: "invite_accept",
        p_organization_id: organizationId,
      });

    if (mergeError) {
      console.error("Merge error:", mergeError);
      return new Response(
        JSON.stringify({ error: "Failed to merge placeholder", details: mergeError.message }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check merge result
    const result = mergeResult?.[0];
    if (!result?.success) {
      return new Response(
        JSON.stringify({ error: "Merge failed", details: result?.error_message }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Build a stats breakdown for the UI by reading the archive's transferred_rows.
    // Shape is preserved (teamsJoined / gamesTransferred / lineupsTransferred) so
    // the existing ClaimPlayer.tsx display keeps working during the Phase D rollout.
    const { data: archive } = await supabaseAdmin
      .from("archived_placeholders")
      .select("transferred_rows")
      .eq("id", result.archive_id)
      .single();

    // deno-lint-ignore no-explicit-any
    const rows: any[] = Array.isArray(archive?.transferred_rows) ? archive.transferred_rows : [];
    const teamsJoined = rows.filter((r) => r?.t === "team_players" && r?.op === "inserted_for_target").length;
    const lineupsTransferred = rows.filter((r) => r?.t === "match_lineups" && r?.op === "rewritten").length;
    const gamesTransferred = rows.filter((r) => r?.t === "match_games" && r?.op === "rewritten").length;

    return new Response(
      JSON.stringify({
        success: true,
        message: "Placeholder successfully merged into your account!",
        archive_id: result.archive_id,
        stats: {
          teamsJoined,
          gamesTransferred,
          lineupsTransferred,
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
