-- Migration: Payment methods — per-PLAYER card-on-file (tournament paid foundation, Phase A)
--
-- A player's saved card lives in ONE place and is reusable for anything they pay
-- for (tournament entry, BCA dues, ...). Matches Stripe's model: one saved payment
-- method per row, owned by a member; everything that charges references it by id.
-- Mock today (PaymentCardForm returns a fake token); Jack's real Stripe install
-- backs stripe_customer_id / stripe_payment_method_id with a live customer + PM.
--
-- The existing LO card on `organizations` is deliberately LEFT AS-IS for now — the
-- unification (point the org at a payment_method_id) is Jack's payment
-- consolidation, not this work.
--
-- A paid tournament charges the chosen card at Start via brackets.payment_method_id
-- (the $0 charge-at-start seam).


CREATE TABLE IF NOT EXISTS "public"."payment_methods" (
    "id"                       uuid DEFAULT gen_random_uuid() NOT NULL,
    "member_id"                uuid NOT NULL,
    "stripe_customer_id"       text,
    "stripe_payment_method_id" text,   -- processor token / Stripe PM ref (mock tok_ today)
    "card_last4"               text,
    "card_brand"               text,
    "verified_at"              timestamp with time zone,
    "is_default"               boolean NOT NULL DEFAULT true,
    "created_at"               timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT "payment_methods_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "payment_methods_member_id_fkey"
      FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE CASCADE
);

ALTER TABLE "public"."payment_methods" OWNER TO "postgres";

CREATE INDEX IF NOT EXISTS "payment_methods_member_id_idx"
  ON "public"."payment_methods" ("member_id");
-- At most one default card per member.
CREATE UNIQUE INDEX IF NOT EXISTS "payment_methods_one_default_per_member"
  ON "public"."payment_methods" ("member_id") WHERE "is_default";

COMMENT ON TABLE "public"."payment_methods" IS
  'Per-player saved card-on-file, reusable across everything they pay for (tournaments, dues, ...). Owned by member_id; charges reference a row by id. Mock token today; Jack''s Stripe install backs stripe_customer_id/stripe_payment_method_id. The LO org card (organizations) is separate for now — future consolidation points it here.';
COMMENT ON COLUMN "public"."payment_methods"."stripe_payment_method_id" IS
  'Processor token / Stripe payment-method reference used to charge this card (mock tok_ today).';
COMMENT ON COLUMN "public"."payment_methods"."is_default" IS
  'The player''s default card. Partial-unique: at most one default per member (re-verify upserts the default).';


-- A paid tournament charges this player card-on-file at Start.
ALTER TABLE "public"."brackets"
  ADD COLUMN IF NOT EXISTS "payment_method_id" uuid;
ALTER TABLE "public"."brackets" DROP CONSTRAINT IF EXISTS "brackets_payment_method_id_fkey";
ALTER TABLE "public"."brackets"
  ADD CONSTRAINT "brackets_payment_method_id_fkey"
  FOREIGN KEY ("payment_method_id") REFERENCES "public"."payment_methods"("id") ON DELETE SET NULL;

COMMENT ON COLUMN "public"."brackets"."payment_method_id" IS
  'The player card-on-file (payment_methods) charged when this paid tournament starts. NULL for free / no card chosen yet.';
