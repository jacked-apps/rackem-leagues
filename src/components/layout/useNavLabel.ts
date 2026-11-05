/**
 * @fileoverview useNavLabel — adds live markers to menu entry labels.
 *
 * `navEntries` holds plain labels; this hook turns them into what the menu
 * shows: "Messages (4)" when there are unread messages, "What's New (New)"
 * when there are unseen release notes. The marker travels with the entry, so
 * it reads the same whether the entry sits in Favorites or in its fold.
 *
 * Markers are WORDS or numbers, never a coloured dot — Ed is colourblind, and
 * a menu state must read without colour.
 */

import { useUserProfile } from '@/api/hooks/useUserProfile';
import { useUnreadMessageCount } from '@/api/hooks/useMessages';
import { useHasUnseenWhatsNew } from '@/whatsNew/useWhatsNewSeen';
import type { NavEntry } from './navEntries';

/**
 * @returns `labelFor(entry)` (the decorated label) and `hasUnseenWhatsNew`
 *   (so the Info fold heading can say "(New)" while folded).
 */
export function useNavLabel() {
  const { member } = useUserProfile();
  const { data: unreadCount = 0 } = useUnreadMessageCount(member?.id);
  const hasUnseenWhatsNew = useHasUnseenWhatsNew();

  const labelFor = (entry: NavEntry): string => {
    if (entry.id === 'messages' && unreadCount > 0) return `${entry.label} (${unreadCount})`;
    if (entry.id === 'whats-new' && hasUnseenWhatsNew) return `${entry.label} (New)`;
    return entry.label;
  };

  return { labelFor, hasUnseenWhatsNew };
}
