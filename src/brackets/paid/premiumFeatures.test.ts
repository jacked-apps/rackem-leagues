/**
 * @fileoverview Unit tests for the premium-features catalog helpers.
 */

import { describe, it, expect } from 'vitest';
import {
  PREMIUM_FEATURES,
  PRICE_CAP_CENTS,
  FEATURE_PRICE_CENTS,
  getPremiumFeature,
  totalPriceCents,
  formatPrice,
} from './premiumFeatures';

describe('premiumFeatures helpers', () => {
  it('has a real_players feature as the first entry, every feature $1', () => {
    expect(PREMIUM_FEATURES[0].key).toBe('real_players');
    expect(PREMIUM_FEATURES.every((f) => f.key && f.label && f.blurb)).toBe(true);
    expect(PREMIUM_FEATURES.every((f) => f.priceCents === FEATURE_PRICE_CENTS)).toBe(true);
    expect(FEATURE_PRICE_CENTS).toBe(100);
  });

  it('caps the total at $5 (turn everything on for five bucks)', () => {
    const allKeys = PREMIUM_FEATURES.map((f) => f.key);
    expect(PRICE_CAP_CENTS).toBe(500);
    // 5 features × $1 = $5 = the cap; more features would still cap at $5.
    expect(totalPriceCents(allKeys)).toBe(PRICE_CAP_CENTS);
    expect(totalPriceCents([...allKeys, ...allKeys])).toBe(PRICE_CAP_CENTS);
  });

  it('getPremiumFeature finds by key and returns undefined for unknown', () => {
    expect(getPremiumFeature('self_scoring')?.label).toMatch(/score/i);
    expect(getPremiumFeature('nope')).toBeUndefined();
  });

  it('totalPriceCents sums selected features and ignores unknown keys', () => {
    const rp = getPremiumFeature('real_players')!.priceCents;
    const ss = getPremiumFeature('self_scoring')!.priceCents;
    expect(totalPriceCents([])).toBe(0);
    expect(totalPriceCents(['real_players'])).toBe(rp);
    expect(totalPriceCents(['real_players', 'self_scoring'])).toBe(rp + ss);
    expect(totalPriceCents(['real_players', 'bogus'])).toBe(rp);
  });

  it('formatPrice renders cents as USD', () => {
    expect(formatPrice(0)).toBe('$0.00');
    expect(formatPrice(500)).toBe('$5.00');
    expect(formatPrice(1300)).toBe('$13.00');
  });
});
