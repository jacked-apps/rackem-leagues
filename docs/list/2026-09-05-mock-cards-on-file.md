---
summary: Decide what happens to beta mock cards on file once real Stripe is live
kind: task
added: 2026-09-05
checked: 2026-11-04
---

Waits on Jack's real Stripe going live.

During beta the tournament payment flow saves a real, persistent card on file
per player (`payment_methods`), reused across tournaments. The token is a mock:
`PaymentCardForm` returns `tok_mock_<ts>`, with no real Stripe. Mock tokens are
identifiable by the `tok_mock_%` prefix.

Two options. Ed prefers keep.

- Keep and comp (preferred): at the charge-at-checkout seam (`chargeForStart`),
  if the card's token is a mock, skip the real charge and mark the tournament
  paid. Beta users keep playing free. Pairs with coupon codes.
- Purge (force re-enter): delete rows from `public.payment_methods` where
  `stripe_payment_method_id` is like `tok_mock_%`.

If a firmer marker than the token prefix is wanted, add an `is_mock boolean`
column.
