/**
 * @fileoverview Unit tests for resolveDeepLinkTarget — the /messages/:id
 * deep-link decision (Unit 3 of message push notifications).
 *
 * Covers the plan's three scenarios: a valid id opens that conversation, an
 * unknown id falls back to the list, and a bare /messages (no param) leaves
 * selection untouched. Plus the loading (optimistic) case.
 */

import { describe, it, expect } from 'vitest';
import { resolveDeepLinkTarget } from './resolveDeepLinkTarget';

describe('resolveDeepLinkTarget', () => {
  const ids = ['conv-a', 'conv-b', 'conv-c'];

  it('opens a valid deep-linked conversation the user belongs to', () => {
    expect(
      resolveDeepLinkTarget({
        routeConversationId: 'conv-b',
        conversationIds: ids,
        isLoading: false,
      })
    ).toEqual({ conversationId: 'conv-b', status: 'open' });
  });

  it('falls back to the list for an unknown / forbidden id', () => {
    expect(
      resolveDeepLinkTarget({
        routeConversationId: 'conv-not-mine',
        conversationIds: ids,
        isLoading: false,
      })
    ).toEqual({ conversationId: null, status: 'notfound' });
  });

  it('leaves selection alone when there is no deep-link param (bare /messages)', () => {
    expect(
      resolveDeepLinkTarget({
        routeConversationId: undefined,
        conversationIds: ids,
        isLoading: false,
      })
    ).toEqual({ conversationId: null, status: 'none' });
  });

  it('treats an empty-string param as no deep link', () => {
    expect(
      resolveDeepLinkTarget({
        routeConversationId: '',
        conversationIds: ids,
        isLoading: false,
      })
    ).toEqual({ conversationId: null, status: 'none' });
  });

  it('opens optimistically while the conversation list is still loading', () => {
    // Tap-to-open on a cold start: the list is fetching, but we open the target
    // immediately so it does not feel laggy; validity is re-checked once loaded.
    expect(
      resolveDeepLinkTarget({
        routeConversationId: 'conv-b',
        conversationIds: [],
        isLoading: true,
      })
    ).toEqual({ conversationId: 'conv-b', status: 'pending' });
  });
});
