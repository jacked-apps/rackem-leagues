/**
 * @fileoverview Pure checks for the domain's email DNS records (SPF, DKIM,
 * DMARC, MX), so mail sent through MXroute is trusted by Gmail/Outlook.
 *
 * Split from the CLI (`scripts/check-email-dns.mjs`) so the rules are
 * unit-testable without the network. Input is the raw shape Node's
 * `dns.promises.resolveTxt` returns: an array of RECORDS, each an array of
 * STRINGS (one long record may be stored as several strings; that's fine and
 * they're joined). Several RECORDS where one is expected is the real bug this
 * catches: a DNS screen that cuts a long DKIM key into separate records breaks
 * the signature (found on rackemleagues.com, 2026-11-19).
 *
 * @see docs/ops/mxroute-production-email.md
 */

/** SPF includes MXroute has used; `mxlogin.com` is the current one. */
const MXROUTE_SPF_INCLUDES = ['include:mxlogin.com', 'include:mxroute.com'];

/** A 2048-bit RSA public key is ~390 base64 chars; anything far shorter is cut off. */
const MIN_DKIM_KEY_LENGTH = 300;

/**
 * Check the email DNS records.
 *
 * @param {object} records
 * @param {string[][]} records.root  - TXT records at the domain (holds SPF)
 * @param {string[][]} records.dkim  - TXT records at `<selector>._domainkey.<domain>`
 * @param {string[][]} records.dmarc - TXT records at `_dmarc.<domain>`
 * @param {{exchange: string}[]} records.mx - MX records at the domain
 * @returns {{name: string, ok: boolean, message: string}[]} one result per check
 */
export function evaluateEmailDns({ root, dkim, dmarc, mx }) {
  const join = (rs) => rs.map((r) => r.join(''));
  return [checkSpf(join(root)), checkDkim(join(dkim)), checkDmarc(join(dmarc)), checkMx(mx)];
}

/** Exactly one SPF record (two is a permanent SPF error), and it allows MXroute. */
function checkSpf(txt) {
  const spf = txt.filter((t) => t.startsWith('v=spf1'));
  if (spf.length !== 1) {
    return fail('SPF', `found ${spf.length} SPF records; there must be exactly one`);
  }
  const allowsMxroute = MXROUTE_SPF_INCLUDES.some((inc) => spf[0].includes(inc));
  return allowsMxroute
    ? pass('SPF', spf[0])
    : fail('SPF', `"${spf[0]}" does not include MXroute (${MXROUTE_SPF_INCLUDES[0]})`);
}

/** Exactly one DKIM record, starting `v=DKIM1`, holding a full-length key. */
function checkDkim(txt) {
  if (txt.length !== 1) {
    return fail(
      'DKIM',
      `found ${txt.length} separate records; it must be ONE record holding the whole key. ` +
        'Delete them all and add one TXT record with the full value from the MXroute panel.',
    );
  }
  const key = /(?:^|;)\s*p=([^;\s]*)/.exec(txt[0])?.[1] ?? '';
  if (!txt[0].startsWith('v=DKIM1') || key.length < MIN_DKIM_KEY_LENGTH) {
    return fail('DKIM', `record is not a complete DKIM key (key length ${key.length})`);
  }
  return pass('DKIM', `one record, key length ${key.length}`);
}

/** Exactly one DMARC record. `p=none` is fine to start. */
function checkDmarc(txt) {
  const dmarc = txt.filter((t) => t.startsWith('v=DMARC1'));
  return dmarc.length === 1
    ? pass('DMARC', dmarc[0])
    : fail('DMARC', `found ${dmarc.length} DMARC records; there must be exactly one`);
}

/** Mail for the domain is handled by MXroute; its host is also the SMTP server. */
function checkMx(mx) {
  const host = mx.map((r) => r.exchange).find((h) => h.endsWith('.mxrouting.net'));
  return host
    ? pass('MX', `${host} (use this as the SMTP host)`)
    : fail('MX', 'no MX record points at MXroute (*.mxrouting.net)');
}

const pass = (name, message) => ({ name, ok: true, message });
const fail = (name, message) => ({ name, ok: false, message });
