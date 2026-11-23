/**
 * @fileoverview Send one email through the app's SMTP mailbox (MXroute).
 * Used by send-invite and send-test-email. Settings come from function
 * secrets via readMailConfig (mailConfig.ts).
 *
 * Folders starting with `_` are shared code, not deployed as functions.
 */

import nodemailer from "npm:nodemailer@6.9.16";
import { readMailConfig } from "./mailConfig.ts";

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
}

/** What happened. `error` is for logs and the test function, never shown to players. */
export type MailResult = { sent: true } | { sent: false; error: string };

/**
 * Send one email. Never throws: a send problem comes back as `sent: false`,
 * so the caller's main job (e.g. saving the invite token) still succeeds.
 *
 * @param message - Recipient, subject and HTML body
 * @returns Whether it was handed to the mail server, and why not if it wasn't
 */
export async function sendMail(message: MailMessage): Promise<MailResult> {
  const config = readMailConfig((k) => Deno.env.get(k));
  if (!config) return { sent: false, error: "SMTP secrets not set (SMTP_HOST, SMTP_USER, SMTP_PASS)" };

  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass },
    // Fail fast: a blocked port or a bad host should not hang the function.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });

  try {
    await transport.sendMail({
      from: { name: config.fromName, address: config.from },
      to: message.to,
      subject: message.subject,
      html: message.html,
    });
    return { sent: true };
  } catch (err) {
    return { sent: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    transport.close();
  }
}
