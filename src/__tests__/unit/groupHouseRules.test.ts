/**
 * @fileoverview Unit tests for the TOC interleave grouping helper.
 */

import { describe, it, expect } from 'vitest';

import { groupHouseRules } from '@/rules/groupHouseRules';
import type { Rule } from '@/rules/rulebook.types';
import type { HouseRule } from '@/rules/house-rules.types';

const csi = (id: string, heading: string): Rule => ({
  id,
  game: '8-ball',
  heading,
  body: [],
  order: 0,
});

const hr = (partial: Partial<HouseRule>): HouseRule => ({
  id: 'hr-' + Math.random(),
  organization_id: null,
  league_id: 'league-1',
  scope_type: 'league',
  scope_name: "Ed's Leagues",
  parent_org_name: "Ed's Leagues",
  game: '8-ball',
  effect_type: 'standalone',
  related_rule_id: null,
  title: 'House rule',
  body: [],
  created_at: '',
  updated_at: '',
  updated_by: null,
  ...partial,
});

describe('groupHouseRules', () => {
  it('pairs override house rules with matching CSI rules', () => {
    const rules = [csi('2-1', 'Break'), csi('2-3', 'Legal Shot')];
    const houseRules = [
      hr({ id: 'a', effect_type: 'override', related_rule_id: '8-ball:2-1', title: 'No early 8' }),
      hr({ id: 'b', effect_type: 'enhance', related_rule_id: '8-ball:2-3', title: 'Combos allowed' }),
    ];

    const { entries, standalones } = groupHouseRules(rules, houseRules, '8-ball');

    expect(standalones).toHaveLength(0);
    expect(entries[0].csi.id).toBe('2-1');
    expect(entries[0].matching.map((r) => r.id)).toEqual(['a']);
    expect(entries[1].matching.map((r) => r.id)).toEqual(['b']);
  });

  it('sorts matches league-first then org (specificity)', () => {
    const rules = [csi('2-1', 'Break')];
    const houseRules = [
      hr({ id: 'org', scope_type: 'organization', league_id: null, organization_id: 'o1', effect_type: 'override', related_rule_id: '8-ball:2-1' }),
      hr({ id: 'lg', scope_type: 'league', effect_type: 'override', related_rule_id: '8-ball:2-1' }),
    ];
    const { entries } = groupHouseRules(rules, houseRules, '8-ball');
    expect(entries[0].matching.map((r) => r.id)).toEqual(['lg', 'org']);
  });

  it('collects standalones at the top', () => {
    const rules = [csi('2-1', 'Break')];
    const houseRules = [
      hr({ id: 'st', effect_type: 'standalone', related_rule_id: null, title: 'No jump cues' }),
    ];
    const { standalones, entries } = groupHouseRules(rules, houseRules, '8-ball');
    expect(standalones.map((r) => r.id)).toEqual(['st']);
    expect(entries[0].matching).toHaveLength(0);
  });

  it('ignores house rules for other games', () => {
    const rules = [csi('2-1', 'Break')];
    const houseRules = [hr({ id: 'nine', game: '9-ball', effect_type: 'standalone' })];
    const { standalones, entries } = groupHouseRules(rules, houseRules, '8-ball');
    expect(standalones).toHaveLength(0);
    expect(entries[0].matching).toHaveLength(0);
  });

  it('leaves CSI rules untouched when no house rules match', () => {
    const rules = [csi('2-1', 'Break'), csi('2-3', 'Legal Shot')];
    const { entries, standalones } = groupHouseRules(rules, [], '8-ball');
    expect(standalones).toHaveLength(0);
    expect(entries.map((e) => e.matching)).toEqual([[], []]);
  });
});
