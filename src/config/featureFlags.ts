/**
 * @fileoverview Feature flags / launch gates.
 *
 * Centralizes runtime feature toggles. Defaults are chosen so a new,
 * not-yet-production-ready capability is OFF in production builds but available
 * in local dev, and can be force-enabled per environment via a Vite env var.
 */

/**
 * Passwordless one-door sign-in (email OTP code + social shortcuts).
 *
 * LAUNCH GATE: enabled by default only in local dev (`import.meta.env.DEV`). In a
 * production build it stays OFF unless `VITE_PASSWORDLESS_SIGN_IN === 'true'` is
 * explicitly set — so the new flow cannot reach real users before the production
 * Supabase config is verified (custom SMTP, email confirmations ON, redirect
 * allow-list). See PRE_LAUNCH_CHECKLIST.md.
 */
export const PASSWORDLESS_SIGN_IN_ENABLED =
  import.meta.env.VITE_PASSWORDLESS_SIGN_IN === 'true' || import.meta.env.DEV;

/**
 * Email invites — the `send-invite` edge-function path that emails a player a
 * claim/register link.
 *
 * DISABLED EVERYWHERE (including dev). The edge function still sends `from:
 * onboarding@resend.dev` (Resend's sandbox), which only delivers to the Resend
 * account owner — so a real player's invite email never arrives, and the UI
 * doesn't surface the failure (it ignores `email_sent`). Rather than ship a
 * silently-broken "Email" button, the email-send triggers are hidden behind this
 * flag. The scaffolding (the function, the handlers, the templates) is preserved
 * for revival once a real verified sender is wired into the edge function (the
 * app's email provider, or a verified Resend domain + updated `from`).
 *
 * No `|| import.meta.env.DEV` — the sandbox sender is broken in dev too. Force-
 * enable for testing with `VITE_EMAIL_INVITES === 'true'`.
 *
 * NOTE: this does NOT gate the new join-link cascade or "Invite Only" (token +
 * manual share-link) — those don't send email and work fine.
 */
export const EMAIL_INVITES_ENABLED = import.meta.env.VITE_EMAIL_INVITES === 'true';

/**
 * Tournament bracket tool (Free Tier v1) — the standalone single/double-elim
 * bracket a logged-in user can run and share.
 *
 * LAUNCH GATE: enabled by default only in local dev (`import.meta.env.DEV`);
 * OFF in a production build unless `VITE_BRACKETS === 'true'`. The route AND
 * every entry point (dashboard card) are gated on this same flag together, so
 * production never shows a door to a not-yet-live room. See LIST_FOR_ED.md and
 * PRE_LAUNCH_CHECKLIST.md (RLS pass: bracket writes must require created_by =
 * calling member; the public share view stays a names-only RPC read).
 */
export const BRACKETS_ENABLED =
  import.meta.env.VITE_BRACKETS === 'true' || import.meta.env.DEV;
