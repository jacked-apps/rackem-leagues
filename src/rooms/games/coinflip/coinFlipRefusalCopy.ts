/**
 * @fileoverview Every way a flip RPC can say no, as a sentence. Most of these
 * are races (the other phone got there first) and read that way — nothing
 * here is the player's fault.
 */
import type { CoinFlipRefusal } from './coinFlipApi';

export function coinFlipRefusalCopy(reason: CoinFlipRefusal): string {
  switch (reason) {
    case 'not_signed_in':
      return 'Sign in to flip.';
    case 'not_found':
      return 'That flip is gone — start a new one.';
    case 'same_phone':
      return 'A flip takes two phones.';
    case 'phone_not_in_room':
      return "That phone isn't in this room any more.";
    case 'not_in_flip':
      return "You can only start a flip you're in.";
    case 'not_caller':
      return "It's not your call — the other phone picks heads or tails.";
    case 'not_flipper':
      return "It's not your throw — the other phone throws the coin.";
    case 'bad_call':
      return 'Heads or tails.';
    case 'no_call':
      return 'Wait for the call before throwing.';
    case 'already_thrown':
      return 'The coin has already landed.';
    default:
      return 'That didn’t go through — try again.';
  }
}
