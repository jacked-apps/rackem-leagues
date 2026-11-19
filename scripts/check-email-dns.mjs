/**
 * @fileoverview Look up a domain's email DNS records and report PASS/FAIL for
 * each (SPF, DKIM, DMARC, MX), using the rules in `scripts/email-dns/evaluate.mjs`.
 *
 * Asks public resolvers (Cloudflare, Google) rather than the local router, so a
 * record that was just fixed isn't hidden by a stale local cache.
 *
 * Usage: pnpm run check:email-dns [domain] [dkim-selector]
 *        (defaults: rackemleagues.com, selector "x", which is MXroute's)
 * Exits 1 if any check fails.
 *
 * @see docs/ops/mxroute-production-email.md (Step 2)
 */

import { promises as dns } from 'node:dns';
import { evaluateEmailDns } from './email-dns/evaluate.mjs';

const [, , domain = 'rackemleagues.com', selector = 'x'] = process.argv;

dns.setServers(['1.1.1.1', '8.8.8.8']);

/**
 * Resolve, treating "no such record" as an empty list (a missing record is a
 * FAIL the evaluator reports, not a crash).
 */
async function lookup(fn, name) {
  try {
    return await fn(name);
  } catch (err) {
    if (err.code === 'ENOTFOUND' || err.code === 'ENODATA') return [];
    throw err;
  }
}

const results = evaluateEmailDns({
  root: await lookup(dns.resolveTxt, domain),
  dkim: await lookup(dns.resolveTxt, `${selector}._domainkey.${domain}`),
  dmarc: await lookup(dns.resolveTxt, `_dmarc.${domain}`),
  mx: await lookup(dns.resolveMx, domain),
});

console.log(`Email DNS for ${domain} (DKIM selector "${selector}")`);
for (const r of results) {
  console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name.padEnd(5)}  ${r.message}`);
}
process.exit(results.every((r) => r.ok) ? 0 : 1);
