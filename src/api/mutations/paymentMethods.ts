/**
 * @fileoverview Writes for the per-player card-on-file (`payment_methods`).
 *
 * Verify-at-setup saves the player's card here (the mock `PaymentCardForm` gives
 * us a token). The card is the player's — reusable across tournaments, dues, etc.
 * — so we keep ONE default per member: re-verifying replaces the default in place
 * (the DB has a partial-unique on one default per member).
 *
 * SECURITY: only the non-sensitive display fields (last4, brand) and the token
 * are stored; the raw PAN/CVV never leave `PaymentCardForm`. The token goes
 * straight to the row — never into component state or localStorage.
 */

import { supabase } from '@/supabaseClient';

export interface SaveCardInput {
  /** The owning player (payment_methods.member_id). */
  memberId: string;
  /** Processor token from PaymentCardForm (mock `tok_...` today). */
  token: string;
  cardLast4: string;
  cardBrand: string;
  /** Optional player-given label (e.g. "Personal Visa"). */
  nickname?: string;
}

/**
 * Upsert the member's DEFAULT card on file, returning its id (used as
 * brackets.payment_method_id). If the member already has a default card, it is
 * updated in place (re-verify / new card); otherwise a new default row is
 * inserted.
 */
export async function upsertDefaultPaymentMethod(input: SaveCardInput): Promise<string> {
  const existing = await supabase
    .from('payment_methods')
    .select('id')
    .eq('member_id', input.memberId)
    .eq('is_default', true)
    .maybeSingle();
  if (existing.error) {
    throw new Error(`Failed to check card on file: ${existing.error.message}`);
  }

  const fields = {
    stripe_payment_method_id: input.token,
    card_last4: input.cardLast4,
    card_brand: input.cardBrand,
    nickname: input.nickname ?? null,
    verified_at: new Date().toISOString(),
  };

  if (existing.data) {
    const { error } = await supabase
      .from('payment_methods')
      .update(fields)
      .eq('id', existing.data.id);
    if (error) throw new Error(`Failed to update card on file: ${error.message}`);
    return existing.data.id;
  }

  const { data, error } = await supabase
    .from('payment_methods')
    .insert({ member_id: input.memberId, is_default: true, ...fields })
    .select('id')
    .single();
  if (error) throw new Error(`Failed to save card on file: ${error.message}`);
  return data.id;
}
