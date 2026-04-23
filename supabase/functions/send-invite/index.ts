/**
 * @fileoverview Send Invite Edge Function
 *
 * Creates (or reuses) an invite_token for a placeholder player and
 * best-effort delivers an email. The invariant is that any placeholder
 * with an email MUST have a corresponding pending invite_token — this
 * function enforces that half of the contract.
 *
 * Email delivery is secondary. If RESEND_API_KEY isn't configured or
 * the Resend call fails/times out (common in local dev), the token is
 * still persisted and the response returns `success: true` with
 * `email_sent: false`. Callers can decide whether to surface the
 * delivery failure — the important thing is the DB state is correct.
 *
 * Two recipient flows:
 *   - Email belongs to an existing auth user → /claim-player
 *   - Email is new → /register
 *
 * If the user-lookup call fails locally (slow/unresponsive auth
 * service), we default to /claim-player because it handles both cases
 * (shows a login gate if not authenticated, then continues to claim).
 *
 * Request body:
 *   - memberId, email, teamId, invitedByMemberId, teamName, captainName, baseUrl
 *
 * Response:
 *   - { success: true, token_created: bool, email_sent: bool, inviteType: 'claim'|'register' }
 *   - Only returns a non-2xx status if token creation itself fails.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

/**
 * Wrap a promise with a timeout. Resolves to null on timeout/error so
 * callers can treat "couldn't do it" as a soft failure without try/catch
 * at every call site. Local-dev hangs (Resend without a valid key, slow
 * auth admin API) stop blocking the function past this cap.
 */
async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  try {
    return await Promise.race([
      p,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), ms)
      ),
    ]);
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { memberId, email, teamId, invitedByMemberId, teamName, captainName, baseUrl } =
      await req.json();

    // Validate inputs — these are required to even attempt token creation.
    if (!memberId || !email || !teamId || !invitedByMemberId || !baseUrl) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields",
          required: ["memberId", "email", "teamId", "invitedByMemberId", "baseUrl"],
        }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({ error: "Supabase credentials not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const emailLower = email.toLowerCase();

    // =====================================================================
    // Step 1: ENSURE the invite_token exists. This is the contract — if we
    // can't do this, we return an error. Everything after is best-effort.
    // =====================================================================
    let token: string;

    const { data: existingInvite } = await supabaseAdmin
      .from("invite_tokens")
      .select("token")
      .eq("member_id", memberId)
      .eq("email", emailLower)
      .eq("status", "pending")
      .maybeSingle();

    if (existingInvite?.token) {
      token = existingInvite.token;
      console.log("Reusing existing invite token for member:", memberId);
    } else {
      const { data: newInvite, error: insertError } = await supabaseAdmin
        .from("invite_tokens")
        .insert({
          member_id: memberId,
          email: emailLower,
          team_id: teamId,
          invited_by_member_id: invitedByMemberId,
          status: "pending",
        })
        .select("token")
        .single();

      if (insertError || !newInvite) {
        console.error("Error creating invite token:", insertError);
        return new Response(
          JSON.stringify({
            error: "Failed to create invite token",
            details: insertError?.message ?? "unknown",
          }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      token = newInvite.token;
      console.log("Created new invite token for member:", memberId);
    }

    // =====================================================================
    // Step 2: best-effort: figure out if the recipient already has an
    // account, so we can pick the right link type. 5-second cap so a slow
    // or misconfigured local auth service doesn't hang the function.
    // =====================================================================
    const listUsersResult = await withTimeout(
      supabaseAdmin.auth.admin.listUsers(),
      5000
    );

    // deno-lint-ignore no-explicit-any
    const existingUsers: any[] = listUsersResult?.data?.users ?? [];
    const isExistingUser = existingUsers.some(
      (u) => u?.email?.toLowerCase?.() === emailLower
    );

    // If we couldn't determine, default to /claim-player (handles both
    // authenticated and unauthenticated cases; /register does not).
    const linkPath = listUsersResult === null || isExistingUser
      ? "/claim-player"
      : "/register";
    const actionLink = `${baseUrl}${linkPath}?claim=${memberId}&token=${token}`;

    // =====================================================================
    // Step 3: best-effort email delivery. If RESEND_API_KEY isn't set or
    // the call fails/times out, we return success for the token part and
    // a clear email_sent=false flag for the caller.
    // =====================================================================
    let emailSent = false;

    if (RESEND_API_KEY) {
      const emailSubject = isExistingUser
        ? `Claim your player history on ${teamName || "Rack'em Leagues"}`
        : `You've been invited to ${teamName || "Rack'em Leagues"}`;

      const emailHtml = buildEmailHtml({
        isExistingUser,
        actionLink,
        captainName,
        teamName,
      });

      const sendResult = await withTimeout(
        fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: "onboarding@resend.dev",
            to: email,
            subject: emailSubject,
            html: emailHtml,
          }),
        }),
        5000
      );

      if (sendResult && sendResult.ok) {
        emailSent = true;
      } else {
        console.warn(
          "Email delivery failed or timed out — token is saved, UI can surface this"
        );
      }
    } else {
      console.warn("RESEND_API_KEY not configured — token saved, email skipped");
    }

    return new Response(
      JSON.stringify({
        success: true,
        token_created: true,
        email_sent: emailSent,
        inviteType: isExistingUser ? "claim" : "register",
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

interface EmailTemplateParams {
  isExistingUser: boolean;
  actionLink: string;
  captainName?: string | null;
  teamName?: string | null;
}

/**
 * Build the HTML email body. Separated for readability — the two flows
 * (existing-user claim, new-user register) differ only in copy.
 */
function buildEmailHtml({
  isExistingUser,
  actionLink,
  captainName,
  teamName,
}: EmailTemplateParams): string {
  const title = isExistingUser ? "Claim Your Player History" : "Join Your Team";
  const headline = isExistingUser
    ? `${captainName ? `<strong>${captainName}</strong> has` : "Your team captain has"}
       linked you to <strong>${teamName || "their team"}</strong> on Rack'em Leagues.`
    : `${captainName ? `<strong>${captainName}</strong> has` : "Your team captain has"}
       invited you to <strong>${teamName || "their team"}</strong> on Rack'em Leagues.`;
  const subText = isExistingUser
    ? "We noticed you already have an account! Click the button below to claim your player history and join the team:"
    : "Click below to create your account and join the team:";
  const buttonText = isExistingUser ? "Claim Player History" : "Join the Team";

  return `<!DOCTYPE html>
<html>
  <head><meta charset="utf-8"><title>${title}</title></head>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="text-align: center; margin-bottom: 30px;">
      <h1 style="color: #1a1a1a;">${title}</h1>
    </div>
    <p style="font-size: 16px;">${headline}</p>
    <p style="font-size: 16px;">${subText}</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${actionLink}"
         style="display: inline-block; background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
        ${buttonText}
      </a>
    </div>
    <p style="font-size: 14px; color: #666;">Or copy and paste this link into your browser:</p>
    <p style="font-size: 14px; color: #2563eb; word-break: break-all;">${actionLink}</p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
    <p style="font-size: 12px; color: #999; text-align: center;">
      This invite was sent via Rack'em Leagues. If you didn't expect this email, you can safely ignore it.
      <br>This link expires in 7 days.
    </p>
  </body>
</html>`;
}
