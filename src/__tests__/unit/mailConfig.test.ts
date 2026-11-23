/**
 * @fileoverview Tests for the app-email settings reader and HTML escaping used
 * by the send-invite and send-test-email Edge Functions
 * (supabase/functions/_shared/mailConfig.ts).
 *
 * Expected values come from the setup rules in docs/ops/mxroute-app-email.md:
 * MXroute is port 465 with TLS, the sender must be the login mailbox, and user
 * text must never become live HTML in an email from our domain.
 */

import { describe, it, expect } from 'vitest';
import { readMailConfig, escapeHtml } from '../../../supabase/functions/_shared/mailConfig';

const env = (vars: Record<string, string>) => (key: string) => vars[key];
const BASE = { SMTP_HOST: 'heracles.mxrouting.net', SMTP_USER: 'noreply@rackemleagues.com', SMTP_PASS: 'pw' };

describe('readMailConfig', () => {
  it('defaults to MXroute: port 465 with TLS, sending as the login mailbox', () => {
    expect(readMailConfig(env(BASE))).toEqual({
      host: 'heracles.mxrouting.net',
      port: 465,
      secure: true,
      user: 'noreply@rackemleagues.com',
      pass: 'pw',
      from: 'noreply@rackemleagues.com',
      fromName: "Rack'em Leagues",
    });
  });

  it('is plain (no TLS) on the local test inbox port', () => {
    expect(readMailConfig(env({ ...BASE, SMTP_PORT: '1025' }))?.secure).toBe(false);
  });

  it('returns null when any of host, user or password is missing, so email is skipped', () => {
    for (const missing of ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS']) {
      const vars: Record<string, string> = { ...BASE };
      delete vars[missing];
      expect(readMailConfig(env(vars))).toBeNull();
    }
  });
});

describe('escapeHtml', () => {
  it('turns a team name with HTML into plain text', () => {
    expect(escapeHtml(`<a href="x">Mike's</a> & Co`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;Mike&#39;s&lt;/a&gt; &amp; Co',
    );
  });
});
