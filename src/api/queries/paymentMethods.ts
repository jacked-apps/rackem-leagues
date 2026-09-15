/**
 * @fileoverview Reads for the per-player card-on-file (`payment_methods`).
 *
 * A player's saved card is reusable for anything they pay for (tournaments,
 * dues, ...). Here we only need the member's DEFAULT card (v1 = one card).
 */

import { supabase } from '@/supabaseClient';
import type { Tables } from '@/types/database.types';

export type PaymentMethodRow = Tables<'payment_methods'>;

/**
 * The member's default card on file, or null if they have none yet.
 * Used by the create flow to decide whether the verify popup shows the card form
 * or just a "your card ending in ••• will be charged at start" confirm.
 */
export async function getDefaultPaymentMethod(
  memberId: string
): Promise<PaymentMethodRow | null> {
  const { data, error } = await supabase
    .from('payment_methods')
    .select('*')
    .eq('member_id', memberId)
    .eq('is_default', true)
    .maybeSingle();

  if (error) throw new Error(`Failed to load card on file: ${error.message}`);
  return data;
}
