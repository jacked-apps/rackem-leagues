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
