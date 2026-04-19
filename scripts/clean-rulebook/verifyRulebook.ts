/**
 * @fileoverview Verification checks the cleanup pipeline runs against its
 * own output before committing. Fail loudly so the operator cannot ship a
 * corrupted dataset by accident. The checks:
 *   a. Per-game rule IDs are unique.
 *   b. No body paragraph contains the running-header string or a bare page
 *      number line — i.e., scrub worked.
 *   c. No body paragraph contains raw `<` or `>` — the PDF is text-only and
 *      we never want HTML sneaking into a React-rendered reader.
 *
 * Note on globally-unique IDs: the CSI rulebook uses section-prefixed
 * numbering (1-1 is General, 2-1 is 8-Ball, 3-1 is 9-Ball, …), so IDs are
 * already unique across games. We still keep the `<game>:<ruleId>` key in
 * `idMap` and the `/rules/:game/:ruleId` URL shape for UX clarity — the
 * game slug makes shared links self-describing.
 *
 * `verify()` returns `{ ok, violations, samples }`. The caller (the script
 * orchestrator) decides whether to abort. This module does not throw.
 */

import type { Rule } from '../../src/rules/rulebook.types';

export type VerificationResult = {
  ok: boolean;
  violations: string[];
  /** Small, flat summary for operator eyeball-QA. */
  samples: {
    gameSlug: string;
    ruleCount: number;
    firstThreeHeadings: string[];
  }[];
};

const HEADER_FRAGMENT = /OFFICIAL RULES OF CUESPORTS INTERNATIONAL/;
const BARE_PAGE_NUMBER = /^\s*\d{1,3}\s*$/;

export function verifyRulebook(
  rulesByGame: Record<string, Rule[]>,
): VerificationResult {
  const violations: string[] = [];
  const samples: VerificationResult['samples'] = [];

  // Check (a) and build per-game id sets for check (b).
  const idsByGame: Record<string, Set<string>> = {};
  for (const [slug, rules] of Object.entries(rulesByGame)) {
    idsByGame[slug] = new Set();
    for (const rule of rules) {
      if (idsByGame[slug].has(rule.id)) {
        violations.push(`[${slug}] duplicate rule id: ${rule.id}`);
      }
      idsByGame[slug].add(rule.id);
    }
    samples.push({
      gameSlug: slug,
      ruleCount: rules.length,
      firstThreeHeadings: rules.slice(0, 3).map((r) => `${r.id}  ${r.heading}`),
    });
  }

  // Checks (b) and (c) over every body paragraph.
  for (const [slug, rules] of Object.entries(rulesByGame)) {
    for (const rule of rules) {
      for (const para of rule.body) {
        if (HEADER_FRAGMENT.test(para)) {
          violations.push(
            `[${slug} ${rule.id}] body contains running-header text: "${para.slice(0, 80)}…"`,
          );
        }
        if (BARE_PAGE_NUMBER.test(para)) {
          violations.push(`[${slug} ${rule.id}] body paragraph is a bare page number: "${para}"`);
        }
        if (/[<>]/.test(para)) {
          violations.push(
            `[${slug} ${rule.id}] body paragraph contains raw < or >: "${para.slice(0, 80)}…"`,
          );
        }
      }
    }
  }

  return { ok: violations.length === 0, violations, samples };
}
