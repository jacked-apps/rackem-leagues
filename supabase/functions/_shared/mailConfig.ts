/**
 * @fileoverview Pure helpers for app email sent from Edge Functions (invites,
 * the test email): read the SMTP settings and escape user text for HTML.
 *
 * App email goes through the same MXroute mailbox Supabase Auth uses for
 * sign-in codes (`noreply@rackemleagues.com`), sent over SMTP on port 465.
 * Supabase blocks outgoing ports 25 and 587 from Edge Functions, not 465
 * (https://supabase.com/docs/guides/functions/limits).
 *
 * No Deno or npm imports here on purpose, so vitest can test it
 * (src/__tests__/unit/mailConfig.test.ts). The sending itself is in sendMail.ts.
 *
 * Settings are Supabase function secrets, set once per environment by Jack
 * (docs/ops/mxroute-app-email.md). Never put the password in code or chat.
 */

/** SMTP settings for sending. */
export interface MailConfig {
  host: string;
  port: number;
  /** TLS from the first byte (port 465). False only for a local test inbox. */
  secure: boolean;
  user: string;
  pass: string;
  /** Sender address. Defaults to the login, which MXroute requires to match. */
  from: string;
  fromName: string;
}

/**
 * Read the SMTP settings from environment secrets.
 *
 * @param env - Looks up one variable (Deno.env.get in a function)
 * @returns The settings, or null when host/user/password aren't all set
 *   (email is then skipped and the caller reports email_sent: false)
 * @example readMailConfig((k) => Deno.env.get(k))
 */
export function readMailConfig(env: (key: string) => string | undefined): MailConfig | null {
  const host = env('SMTP_HOST');
  const user = env('SMTP_USER');
  const pass = env('SMTP_PASS');
  if (!host || !user || !pass) return null;
  const port = Number(env('SMTP_PORT') ?? '465');
  return {
    host,
    port,
    // Port 465 is TLS from the start. Anything else (the local test inbox on
    // 1025) is plain unless SMTP_SECURE=true says otherwise.
    secure: env('SMTP_SECURE') ? env('SMTP_SECURE') === 'true' : port === 465,
    user,
    pass,
    from: env('SMTP_FROM') || user,
    fromName: env('SMTP_FROM_NAME') || "Rack'em Leagues",
  };
}

/**
 * Escape text before putting it in an email's HTML. Team and captain names are
 * typed by users; without this, a name like `<a href=...>` would become a real
 * link in an email sent from our domain.
 *
 * @param text - User-provided text
 * @returns The same text, safe inside HTML
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
