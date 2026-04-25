/**
 * @fileoverview LO Undo Merge Edge Function
 *
 * Reverses a merge that an LO regrets — restores the placeholder row from
 * its snapshot, walks back the FK rewrites, and pulls the placeholder's
 * teams off the target. Calls undo_merge_placeholder under the hood, with
 * caller-as-LO authorization.
 *
 * Request body:
 *   - archiveId: UUID of the archived_placeholders row to undo
 *
 * Authorization:
 *   - Bearer token required
 *   - Caller must be organization_staff of the archive's org (or owner)
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

    const { archiveId } = await req.json();
    if (!archiveId) {
      return new Response(
        JSON.stringify({ error: "Missing required field: archiveId" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Caller's member id (for actor + authz)
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

    // Look up the archive's org for the staff check + the RPC's authz arg.
    const { data: archiveRow, error: archiveError } = await supabaseAdmin
      .from("archived_placeholders")
      .select("organization_id, undone_at, expires_at")
      .eq("id", archiveId)
      .single();
    if (archiveError || !archiveRow) {
      return new Response(
        JSON.stringify({ error: "Archive entry not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Org-staff authz (matches lo-merge-placeholder's pattern)
    const { data: staffRow } = await supabaseAdmin
      .from("organization_staff")
      .select("member_id")
      .eq("member_id", callerMember.id)
      .eq("organization_id", archiveRow.organization_id)
      .maybeSingle();

    let isAuthorized = !!staffRow;
    if (!isAuthorized) {
      const { data: orgRow } = await supabaseAdmin
        .from("organizations")
        .select("created_by")
        .eq("id", archiveRow.organization_id)
        .maybeSingle();
      isAuthorized = orgRow?.created_by === callerMember.id;
    }

    if (!isAuthorized) {
      return new Response(
        JSON.stringify({
          error: "Not authorized",
          details: "You must be organization staff to undo merges in this org.",
        }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Fire the undo. The RPC re-validates everything (already_undone,
    // archive_expired, not_authorized via org match, etc.).
    const { data: undoResult, error: undoError } = await supabaseAdmin
      .rpc("undo_merge_placeholder", {
        p_archive_id: archiveId,
        p_caller_org_id: archiveRow.organization_id,
        p_actor_member_id: callerMember.id,
      });

    if (undoError) {
      console.error("Undo error:", undoError);
      return new Response(
        JSON.stringify({ error: "Failed to undo merge", details: undoError.message }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const result = undoResult?.[0];
    if (!result?.success) {
      return new Response(
        JSON.stringify({ error: "Undo failed", details: result?.error_message }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        rows_restored: result.rows_restored,
        missing_rows: result.missing_rows,
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
