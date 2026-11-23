/**
 * @fileoverview Send one test email through the app's MXroute mailbox, to prove
 * Edge Functions can send in an environment (the SMTP secrets are right and
 * Supabase lets port 465 out). Jack runs it once per environment
 * (docs/ops/mxroute-app-email.md, Step 3). The app never calls it.
 *
 * Locked with a shared secret: without it anyone could send mail from our
 * domain, and MXroute suspends a mailbox that goes over 400 emails an hour.
 * If EMAIL_TEST_SECRET isn't set, the function refuses everything.
 *
 * Usage:
 *   curl -X POST https://<project-ref>.supabase.co/functions/v1/send-test-email \
 *     -H "Content-Type: application/json" \
 *     -H "X-Email-Test-Secret: <EMAIL_TEST_SECRET>" \
 *     -d '{"to": "you@example.com"}'
 *
 * Response: { sent: true } or { sent: false, error: "<the SMTP error>" }.
 * The error is shown on purpose: it's how Jack tells a blocked port from a
 * wrong password.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { sendMail } from "../_shared/sendMail.ts";

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

serve(async (req) => {
  const secret = Deno.env.get("EMAIL_TEST_SECRET");
  if (!secret || req.headers.get("X-Email-Test-Secret") !== secret) {
    return json({ error: "Not allowed" }, 403);
  }

  const { to } = await req.json().catch(() => ({}));
  if (!to) return json({ error: "Missing 'to' email address" }, 400);

  const result = await sendMail({
    to,
    subject: "Rack'em Leagues test email",
    html: `<h1>It works! 🎱</h1>
<p>This test email was sent by a Rack'em Leagues Edge Function through our own mailbox.</p>
<p style="color:#666;font-size:12px">Sent at ${new Date().toISOString()}</p>`,
  });
  return json(result, result.sent ? 200 : 502);
});
