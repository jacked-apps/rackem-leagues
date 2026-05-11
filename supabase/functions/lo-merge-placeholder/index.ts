/**
 * @fileoverview LO-initiated Merge Placeholder Edge Function
 *
 * Called by an organization's operator/staff to directly attach a
 * placeholder to a registered user — no email-invite round trip. Common
 * scenario: "I already registered, I can't see my team" → LO hops on the
 * placeholder record, picks the user from their org, clicks Attach.
 *
 * Differs from claim-placeholder:
 *   - actor_role = 'lo_initiated' (vs 'invite_accept')
 *   - actor_member_id = the LO (not the target)
 *   - No email/token validation — authz is the LO's org-staff membership
 *
 * Request body:
 *   - placeholderMemberId: the placeholder to merge FROM
 *   - targetMemberId:      the registered user to merge INTO
 *
 * Authorization:
 *   - Bearer token required
 *   - Caller must be organization_staff of the placeholder's org (or the
 *     org owner). Anyone can claim their OWN placeholder via
 *     claim-placeholder; only org staff can unilaterally attach someone
 *     else's placeholder to another user.
 *
 * Behavior:
 *   - Resolves placeholder's organization_id (via members.organization_id,
 *     fallback via its team chain)
 *   - Verifies caller is staff/owner of that org
 *   - Calls merge_placeholder_into_member_v2 with actor_role='lo_initiated'
 *   - Returns archive_id (so a future Undo UI can reverse it)
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

    const { placeholderMemberId, targetMemberId } = await req.json();
    if (!placeholderMemberId || !targetMemberId) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields",
          required: ["placeholderMemberId", "targetMemberId"],
        }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Resolve the caller's member row — needed for actor_member_id and for
    // the org-staff check.
    const { data: callerMember, error: callerError } = await supabaseAdmin
      .from("members")
      .select("id")
      .eq("user_id", user.id)
      .single();
    if (callerError || !callerMember) {
      return new Response(
        JSON.stringify({ error: "No member record found for authenticated caller" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Resolve placeholder's organization_id. Same priority as
    // claim-placeholder: placeholder's organization_id first (populated by
    // the trigger), fallback via team chain.
    let organizationId: string | null = null;
    const { data: placeholderRow } = await supabaseAdmin
      .from("members")
      .select("organization_id")
      .eq("id", placeholderMemberId)
      .maybeSingle();
    organizationId = placeholderRow?.organization_id ?? null;

    if (!organizationId) {
      // Fallback: any team the placeholder is on → its org.
      const { data: teamRow } = await supabaseAdmin
        .from("team_players")
        .select("teams!inner(seasons!inner(leagues!inner(organization_id)))")
        .eq("member_id", placeholderMemberId)
        .limit(1)
        .maybeSingle();
      // deno-lint-ignore no-explicit-any
      organizationId =
        (teamRow as any)?.teams?.seasons?.leagues?.organization_id ?? null;
    }

    if (!organizationId) {
      return new Response(
        JSON.stringify({ error: "Could not resolve placeholder organization" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Org-staff authz. Caller must be organization_staff of this org OR
    // the org's owner (organizations.created_by).
    const { data: staffRow } = await supabaseAdmin
      .from("organization_staff")
      .select("member_id")
      .eq("member_id", callerMember.id)
      .eq("organization_id", organizationId)
      .maybeSingle();

    let isAuthorized = !!staffRow;
    if (!isAuthorized) {
      const { data: orgRow } = await supabaseAdmin
        .from("organizations")
        .select("created_by")
        .eq("id", organizationId)
        .maybeSingle();
      isAuthorized = orgRow?.created_by === callerMember.id;
    }

    if (!isAuthorized) {
      return new Response(
        JSON.stringify({
          error: "Not authorized",
          details: "You must be organization staff to attach placeholders.",
        }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Fire the merge. merge_v2 re-validates everything (placeholder is
    // actually a placeholder, target is registered, org-scope, same-match
    // collisions) so even if the UI state is stale we won't corrupt data.
    const { data: mergeResult, error: mergeError } = await supabaseAdmin
      .rpc("merge_placeholder_into_member_v2", {
        p_placeholder_member_id: placeholderMemberId,
        p_target_member_id: targetMemberId,
        p_actor_member_id: callerMember.id,
        p_actor_role: "lo_initiated",
        p_organization_id: organizationId,
      });

    if (mergeError) {
      console.error("Merge error:", mergeError);
      return new Response(
        JSON.stringify({ error: "Failed to merge placeholder", details: mergeError.message }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const result = mergeResult?.[0];
    if (!result?.success) {
      return new Response(
        JSON.stringify({ error: "Merge failed", details: result?.error_message }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        archive_id: result.archive_id,
        tables_updated: result.tables_updated,
        total_rows_updated: result.total_rows_updated,
      }),
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
