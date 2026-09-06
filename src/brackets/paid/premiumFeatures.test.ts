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
  hasPremiumFeature,
  chargeBreakdown,
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

describe('hasPremiumFeature', () => {
  it('is true only for a feature the tournament actually bought', () => {
    expect(hasPremiumFeature(['real_players'], 'real_players')).toBe(true);
    // The point of the helper: sign-up links must NOT imply the fee tracker.
    expect(hasPremiumFeature(['real_players'], 'payment_tracker')).toBe(false);
  });

  it('treats a free tournament (no features) as having none', () => {
    expect(hasPremiumFeature(null, 'payment_tracker')).toBe(false);
    expect(hasPremiumFeature(undefined, 'payment_tracker')).toBe(false);
    expect(hasPremiumFeature([], 'payment_tracker')).toBe(false);
  });
});

describe('chargeBreakdown', () => {
  it('itemises the features that were bought', () => {
    const result = chargeBreakdown(['real_players', 'payment_tracker']);
    expect(result.lines.map((l) => l.key)).toEqual(['real_players', 'payment_tracker']);
    expect(result.subtotalCents).toBe(200);
    expect(result.totalCents).toBe(200);
    expect(result.capDiscountCents).toBe(0);
  });

  it('surfaces the cap as its own amount when it bites', () => {
    // Six features at $1 come to $6, but the tournament is capped at $5 — the
    // items must be shown adding up to the number on the button.
    const all = PREMIUM_FEATURES.map((f) => f.key);
    const result = chargeBreakdown(all);
    expect(result.subtotalCents).toBe(all.length * FEATURE_PRICE_CENTS);
    expect(result.totalCents).toBe(PRICE_CAP_CENTS);
    expect(result.capDiscountCents).toBe(result.subtotalCents - PRICE_CAP_CENTS);
    expect(result.subtotalCents - result.capDiscountCents).toBe(result.totalCents);
  });

  it('always agrees with the price actually charged', () => {
    const keys = ['real_players', 'payment_tracker', 'self_scoring'];
    expect(chargeBreakdown(keys).totalCents).toBe(totalPriceCents(keys));
  });

  it('skips a key no longer in the catalog rather than showing a blank row', () => {
    const result = chargeBreakdown(['real_players', 'retired_feature']);
    expect(result.lines).toHaveLength(1);
    expect(result.totalCents).toBe(FEATURE_PRICE_CENTS);
  });

  it('handles a tournament with nothing bought', () => {
    expect(chargeBreakdown([])).toMatchObject({
      lines: [],
      subtotalCents: 0,
      totalCents: 0,
    });
  });
});
