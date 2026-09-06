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

// Message push notifications shipped un-gated on 2026-09-05. The old
// `PUSH_NOTIFICATIONS_ENABLED` flag existed because the client could subscribe
// before anything could SEND — subscribing to a dead channel. That's no longer
// true: dispatcher, trigger, suppress-if-viewing, quiet hours, per-type defaults
// and per-chat controls are all in place and verified on staging.
//
// Removed rather than left permanently true: a flag that must be ON in every
// environment is only a way to lose the feature when someone forgets an env var
// (which is exactly how push stayed invisible on staging for 8 days).
//
// What push DOES still depend on, per environment — see
// docs/ops/push-notifications-secrets.md:
//   - VITE_VAPID_PUBLIC_KEY at BUILD time (missing ⇒ subscribe fails silently)
//   - VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT /
//     DISPATCH_SHARED_SECRET as Supabase function secrets
//   - a `push_dispatch_config` row pointing at that env's dispatcher URL, with
//     a matching shared secret (empty secret ⇒ the trigger skips, silently)
//
// And `push_type_policy` still decides WHICH conversation kinds push at all.
// That's a deliberate per-environment switch, not a gate on the feature.

// The tournament bracket tool (Free Tier v1) shipped un-gated: it's the free
// product, complete and tested, so it's live in every environment. Its old
// `BRACKETS_ENABLED` launch gate is gone rather than left permanently true —
// a flag that must be ON everywhere is only a way to lose the feature when an
// env var is forgotten. Still tracked in PRE_LAUNCH_CHECKLIST.md for the RLS
// pass (bracket writes must require created_by = calling member; the public
// share view stays a names-only RPC read).
