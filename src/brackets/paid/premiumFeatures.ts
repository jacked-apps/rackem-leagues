/**
 * @fileoverview The paid-tier "Premium features" catalog (tournament paid foundation).
 *
 * A plain constant list — one entry per paid feature — that drives the checklist
 * on the create page. A future feature ships by adding an entry here (the seam).
 * Kept deliberately un-abstracted (no registry framework) until there's a second
 * dimension to generalize over.
 *
 * IMPORTANT (v1): these features are listed so the checkout flow works end-to-end,
 * but most are not FUNCTIONAL yet — their engines land as their own brainstorms
 * (self-scoring #4, handicap races #5, venue/tables #2, alerts #6). Checking one
 * takes the (currently $0) payment; the feature starts working when it's built.
 *
 * Pricing (Ed, 2026-09-05): each feature is $1, and the whole tournament is
 * capped at $5 — so an organizer can turn everything on for five bucks. Kept
 * cheap on purpose: the goal is adoption. The charge itself is $0 today (mock
 * processor); Jack wires the real charge later.
 */

/** Every premium feature costs $1. */
export const FEATURE_PRICE_CENTS = 100;

/** A tournament is capped at $5 total, however many features are turned on. */
export const PRICE_CAP_CENTS = 500;

export interface PremiumFeature {
  /** Stable key stored in brackets.premium_features. */
  key: string;
  /** Short label for the checklist row. */
  label: string;
  /** One-line "what this gives you" shown in the row + verify popup. */
  blurb: string;
  /** Price in cents. Every feature is $1 (FEATURE_PRICE_CENTS). */
  priceCents: number;
  /**
   * If set, this feature needs configuration before it runs — the row shows
   * "(some setup required)" + an info button with this text explaining what the
   * organizer will set up (or that they can just use the defaults).
   */
  setupInfo?: string;
}

/** The paid features, in display order. Add a row to ship a new one. */
export const PREMIUM_FEATURES: readonly PremiumFeature[] = [
  {
    key: 'real_players',
    label: 'Real players & sign-up',
    blurb:
      'Players join with a real account by scanning a QR code — and carry into your reusable pool, so you never re-type your regulars.',
    priceCents: FEATURE_PRICE_CENTS,
  },
  {
    key: 'payment_tracker',
    label: 'Entry-fee tracker',
    blurb:
      'Keep a running list of who’s paid their entry fee and who hasn’t. You collect the cash — we just track it, no money runs through the app.',
    priceCents: FEATURE_PRICE_CENTS,
  },
  {
    key: 'self_scoring',
    label: 'Players score their own matches',
    blurb: 'Each pair confirms their own winner from their phones — you stop being the sole scorekeeper.',
    priceCents: FEATURE_PRICE_CENTS,
    setupInfo:
      'You’ll pick one thing: how a match with an unregistered walk-up is scored — trust the registered player’s word, or you enter it yourself. Registered-vs-registered always self-scores.',
  },
  {
    key: 'handicap_races',
    label: 'Handicapped races',
    blurb: 'Each match gets a race-to-N from the players’ ratings, so the stronger player has to win more.',
    priceCents: FEATURE_PRICE_CENTS,
    setupInfo:
      'Before you run this you’ll set a few things: which handicap system to use, each NEW player’s handicap (players we already know keep theirs), and the race lengths — the longest race, the shortest race, and how much shorter the loser’s-side race is. Or just use our defaults and tweak later.',
  },
  {
    key: 'venue_tables',
    label: 'Venue & tables (auto next-up)',
    blurb: 'Set your tables; as they free up the tool calls the next pair to an open table and tracks who’s on deck.',
    priceCents: FEATURE_PRICE_CENTS,
    setupInfo:
      'You’ll add your tables (how many, and their numbers) so the tool can call the next pair to an open table. Set it once and it’s saved for next time.',
  },
  {
    key: 'notifications',
    label: 'Phone alerts',
    blurb: 'Players get a push when they’re up (“Table 4”) or on deck — no more hunting people down.',
    priceCents: FEATURE_PRICE_CENTS,
  },
] as const;

/** Look up a feature by key. */
export function getPremiumFeature(key: string): PremiumFeature | undefined {
  return PREMIUM_FEATURES.find((f) => f.key === key);
}

/**
 * Whether a tournament bought a given premium feature.
 *
 * Every feature is sold and priced on its own, so each one must also GATE on
 * its own — a tournament that bought sign-up links but not the entry-fee
 * tracker must see no paid/unpaid anything, and vice versa. Read through this
 * helper rather than reaching into the array, so the null/undefined case (a
 * free tournament) can't be forgotten at a call site.
 *
 * @param features - `brackets.premium_features`, which is nullable.
 * @param key - The feature key, e.g. 'payment_tracker'.
 *
 * @example
 * hasPremiumFeature(bracket.premium_features, 'payment_tracker')
 */
export function hasPremiumFeature(
  features: readonly string[] | null | undefined,
  key: string
): boolean {
  return features?.includes(key) ?? false;
}

/**
 * Total price for the selected features — $1 each, capped at $5 (PRICE_CAP_CENTS).
 * So turning everything on never costs more than five bucks.
 */
export function totalPriceCents(selectedKeys: readonly string[]): number {
  const raw = selectedKeys.reduce(
    (sum, key) => sum + (getPremiumFeature(key)?.priceCents ?? 0),
    0
  );
  return Math.min(raw, PRICE_CAP_CENTS);
}

/** Format cents as a USD price string (e.g. 500 → "$5.00"). */
export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
