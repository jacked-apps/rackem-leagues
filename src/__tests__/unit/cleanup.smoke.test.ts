/**
 * @fileoverview Smoke test for the cleaned rulebook data.
 *
 * Runs against the committed output of `scripts/clean-rulebook.ts` (not the
 * script itself — the script is an offline operator tool). The assertions
 * mirror the `verifyRulebook` checks so the committed dataset cannot silently
 * regress: if someone edits the generated files by hand or a re-run produces
 * broken data, this test fails fast in CI.
 */

import { describe, expect, it } from 'vitest';

import index from '@/officalBCARulebook/cleaned/index';
import generalRules from '@/officalBCARulebook/cleaned/general';
import eightBallRules from '@/officalBCARulebook/cleaned/8-ball';
import nineBallRules from '@/officalBCARulebook/cleaned/9-ball';

describe('cleaned rulebook — index', () => {
  it('declares nine game sections in source order', () => {
    expect(index.games.map((g) => g.slug)).toEqual([
      'general',
      '8-ball',
      '9-ball',
      '10-ball',
      'one-pocket',
      '14-1-continuous',
      'bank-pool',
      'wheelchair',
      'scotch-doubles',
    ]);
  });

  it('has CSI metadata and a stable edition string', () => {
    expect(index.publisher).toBe('CSI');
    expect(index.edition).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(index.defaultGame).toBe('8-ball');
  });

  it('idMap entries all resolve to a known (game, ruleId) pair', () => {
    for (const [key, ref] of Object.entries(index.idMap)) {
      expect(key).toBe(`${ref.game}:${ref.ruleId}`);
      expect(index.games.some((g) => g.slug === ref.game)).toBe(true);
    }
  });
});

describe('cleaned rulebook — game modules', () => {
  const samples = [
    { slug: 'general', rules: generalRules },
    { slug: '8-ball', rules: eightBallRules },
    { slug: '9-ball', rules: nineBallRules },
  ];

  for (const { slug, rules } of samples) {
    describe(slug, () => {
      it('has at least one rule', () => {
        expect(rules.length).toBeGreaterThan(0);
      });

      it('every rule has id, heading, and a body (allowing placeholders)', () => {
        for (const rule of rules) {
          expect(rule.id).toMatch(/^\d+-\d+$/);
          expect(rule.heading.length).toBeGreaterThan(0);
          // CSI reserves some rule slots for future use with placeholder
          // headings like "(Reserved for Future Use)". Those legitimately
          // have empty bodies; every other rule must have content.
          if (!/^\(Reserved\b/.test(rule.heading)) {
            expect(rule.body.length).toBeGreaterThan(0);
          }
        }
      });

      it('rule IDs are unique within the game', () => {
        const ids = rules.map((r) => r.id);
        expect(new Set(ids).size).toBe(ids.length);
      });

      it('no body paragraph contains the running-header string', () => {
        for (const rule of rules) {
          for (const para of rule.body) {
            expect(para).not.toContain('OFFICIAL RULES OF CUESPORTS INTERNATIONAL');
          }
        }
      });

      it('no body paragraph contains raw HTML-sensitive characters', () => {
        for (const rule of rules) {
          for (const para of rule.body) {
            expect(para).not.toMatch(/[<>]/);
          }
        }
      });
    });
  }
});
