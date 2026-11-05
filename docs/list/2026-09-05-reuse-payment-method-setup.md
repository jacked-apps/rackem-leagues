---
summary: Make the LO application use the shared PaymentMethodSetup component
kind: task
added: 2026-09-05
checked: 2026-11-04
---

The tournament paid flow added a reusable "set up a payment method" component:
`src/components/PaymentMethodSetup.tsx`. It shows the no-charge-now note (the
caller supplies the charge timing), runs the `PaymentCardForm` verify, and
returns the card data for the caller to save.

The League Operator application does not use it. It wires `PaymentCardForm`
and the application reducer inline in
`src/operator/application/questionDefinitions.tsx` (the `paymentInfo` question).

To do: refactor the LO application to use `PaymentMethodSetup`, so payment
setup is one consistent component everywhere.

Good to bundle with Jack's payment consolidation. He owns that flow and the
eventual real Stripe wiring.
