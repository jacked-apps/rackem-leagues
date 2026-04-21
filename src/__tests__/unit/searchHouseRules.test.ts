/**
 * @fileoverview Unit tests for `searchHouseRules`. Pure function; no network.
 */

import { describe, it, expect } from 'vitest';

import { searchHouseRules } from '@/rules/searchHouseRules';
import type { HouseRule } from '@/rules/house-rules.types';

function makeRule(overrides: Partial<HouseRule> = {}): HouseRule {
  return {
    id: 'r1',
    organization_id: 'org-1',
    league_id: null,
    scope_type: 'organization',
    scope_name: "Ed's Leagues",
    parent_org_name: "Ed's Leagues",
    game: '8-ball',
    effect_type: 'override',
    related_rule_id: '8-ball:2-2',
    title: '8 on the break counts as a win',
    body: [
      'If the 8-ball is pocketed on the break, the breaking player wins immediately.',
      'This overrides CSI 2-2.',
    ],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    updated_by: null,
    ...overrides,
  };
}

describe('searchHouseRules', () => {
  const corpus: HouseRule[] = [
    makeRule({ id: 'r1', title: '8 on the break counts as a win' }),
    makeRule({
      id: 'r2',
      title: 'No jump cues',
      effect_type: 'standalone',
      related_rule_id: null,
      body: ['Jump cues are not allowed in any match.'],
    }),
    makeRule({
      id: 'r3',
      title: 'Time limits',
      effect_type: 'standalone',
      related_rule_id: null,
      body: ['Each shot must be taken within 45 seconds.'],
    }),
  ];

  it('returns empty for an empty query', () => {
    expect(searchHouseRules('', corpus)).toEqual([]);
  });

  it('returns empty for whitespace-only queries', () => {
    expect(searchHouseRules('   ', corpus)).toEqual([]);
  });

  it('returns empty when nothing matches', () => {
    expect(searchHouseRules('xyzzy-nonsense', corpus)).toEqual([]);
  });

  it('matches against the title (case-insensitive)', () => {
    const results = searchHouseRules('JUMP', corpus);
    expect(results).toHaveLength(1);
    expect(results[0].rule.id).toBe('r2');
    expect(results[0].matchType).toBe('title');
  });

  it('matches against the body when title has no match', () => {
    const results = searchHouseRules('45 seconds', corpus);
    expect(results).toHaveLength(1);
    expect(results[0].rule.id).toBe('r3');
    expect(results[0].matchType).toBe('body');
    expect(results[0].bodyParagraphIndex).toBe(0);
  });

  it('treats regex-special chars literally', () => {
    expect(() => searchHouseRules('(rule*?', corpus)).not.toThrow();
  });

  it('returns one result per matching rule (title wins over body)', () => {
    // A rule with "jump" in both title and body should be ranked as title match.
    const mixed = makeRule({
      id: 'r4',
      title: 'Jump rules',
      body: ['No jump cues may be used.'],
    });
    const results = searchHouseRules('jump', [...corpus, mixed]);
    const r4 = results.find((r) => r.rule.id === 'r4');
    expect(r4?.matchType).toBe('title');
  });
});
