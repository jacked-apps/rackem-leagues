/**
 * @fileoverview The email DNS checker (scripts/email-dns/evaluate.mjs): mail
 * sent through MXroute is only trusted if SPF, DKIM and DMARC are each ONE
 * correct record and MX points at MXroute.
 *
 * The case that matters most is the one found live on 2026-11-19: the DKIM key
 * stored as four separate TXT records (a DNS screen cut it up), which breaks the
 * signature even though every piece of the key is "there".
 *
 * @see docs/ops/mxroute-production-email.md
 */

import { describe, it, expect } from 'vitest';
import { evaluateEmailDns } from '../../../scripts/email-dns/evaluate.mjs';

/** A 2048-bit RSA public key is ~392 base64 characters. */
const FULL_KEY = 'A'.repeat(392);

/** Every record correct, as MXroute documents them. */
const good = {
  root: [['v=spf1 include:mxlogin.com -all'], ['google-site-verification=abc']],
  // One record stored as two strings is legal: resolvers join them.
  dkim: [[`v=DKIM1;k=rsa;p=${FULL_KEY.slice(0, 200)}`, FULL_KEY.slice(200)]],
  dmarc: [['v=DMARC1; p=none;']],
  mx: [{ exchange: 'heracles.mxrouting.net', priority: 10 }],
};

/** Result for one named check. */
const check = (records: typeof good, name: string) =>
  evaluateEmailDns(records).find((r: { name: string }) => r.name === name);

describe('evaluateEmailDns', () => {
  it('passes every check when each record is one correct record', () => {
    expect(evaluateEmailDns(good).map((r: { ok: boolean }) => r.ok)).toEqual([true, true, true, true]);
  });

  it('fails DKIM when the key is split across separate records (the live bug)', () => {
    const split = {
      ...good,
      dkim: [
        [FULL_KEY.slice(100, 250)],
        [FULL_KEY.slice(250)],
        [FULL_KEY.slice(0, 100)],
        ['v=DKIM1;k=rsa;p=MIIBIjANBgkq'],
      ],
    };
    const dkim = check(split, 'DKIM');
    expect(dkim.ok).toBe(false);
    expect(dkim.message).toContain('found 4 separate records');
  });

  it('fails DKIM when the single record holds a cut-off key', () => {
    expect(check({ ...good, dkim: [['v=DKIM1;k=rsa;p=MIIBIjANBgkq']] }, 'DKIM').ok).toBe(false);
  });

  it('fails DKIM when there is no record at all', () => {
    expect(check({ ...good, dkim: [] }, 'DKIM').ok).toBe(false);
  });

  it('fails SPF when two SPF records exist (a permanent SPF error)', () => {
    const two = { ...good, root: [['v=spf1 include:mxlogin.com -all'], ['v=spf1 include:_spf.google.com -all']] };
    expect(check(two, 'SPF').ok).toBe(false);
  });

  it('fails SPF when it does not allow MXroute', () => {
    expect(check({ ...good, root: [['v=spf1 include:_spf.google.com -all']] }, 'SPF').ok).toBe(false);
  });

  it('accepts the older include:mxroute.com SPF form', () => {
    expect(check({ ...good, root: [['v=spf1 include:mxroute.com -all']] }, 'SPF').ok).toBe(true);
  });

  it('fails DMARC when it is missing', () => {
    expect(check({ ...good, dmarc: [] }, 'DMARC').ok).toBe(false);
  });

  it('fails MX when mail is not routed to MXroute, and names the host when it is', () => {
    expect(check({ ...good, mx: [{ exchange: 'aspmx.l.google.com', priority: 1 }] }, 'MX').ok).toBe(false);
    expect(check(good, 'MX').message).toContain('heracles.mxrouting.net');
  });
});
