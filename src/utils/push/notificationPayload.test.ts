/**
 * @fileoverview Unit tests for the push notification payload helpers (Unit 4).
 * Covers building a notification from the dispatcher payload (with defaults for
 * malformed input), the tap-to-open target path, and the suppress-if-viewing
 * predicate.
 */

import { describe, it, expect } from 'vitest';
import {
  buildNotification,
  deepLinkPath,
  isViewingConversation,
} from './notificationPayload';

describe('deepLinkPath', () => {
  it('targets a specific conversation when an id is given', () => {
    expect(deepLinkPath('conv-1')).toBe('/messages/conv-1');
  });
  it('falls back to the messages root without an id', () => {
    expect(deepLinkPath(undefined)).toBe('/messages');
    expect(deepLinkPath(null)).toBe('/messages');
  });
});

describe('buildNotification', () => {
  it('maps a well-formed payload to title/body/tag/url', () => {
    const built = buildNotification({
      web_push: 8030,
      notification: { title: 'Sally', body: 'you coming tonight?' },
      data: { conversationId: 'conv-1' },
    });
    expect(built).toEqual({
      title: 'Sally',
      options: {
        body: 'you coming tonight?',
        tag: 'conversation:conv-1',
        // Required alongside `tag` — see the renotify tests below.
        renotify: true,
        data: { url: '/messages/conv-1', conversationId: 'conv-1' },
      },
    });
  });

  it('uses generic fallbacks when title/body are missing', () => {
    const built = buildNotification({ data: { conversationId: 'conv-2' } });
    expect(built.title).toBe('New message');
    expect(built.options.body).toBe('You have a new message');
    expect(built.options.data.url).toBe('/messages/conv-2');
  });

  it('without a conversationId, targets the messages root and a generic tag', () => {
    const built = buildNotification({ notification: { title: 'Hi' } });
    expect(built.options.data.url).toBe('/messages');
    expect(built.options.data.conversationId).toBeUndefined();
    expect(built.options.tag).toBe('rackem-message');
  });

  it('never throws on null / garbage input', () => {
    expect(() => buildNotification(null)).not.toThrow();
    expect(() => buildNotification('nonsense')).not.toThrow();
    expect(buildNotification(undefined).title).toBe('New message');
  });
});

describe('isViewingConversation', () => {
  it('is true when the open window is on that conversation deep link', () => {
    expect(
      isViewingConversation('https://app.example/messages/conv-1', 'conv-1')
    ).toBe(true);
  });
  it('is false for a different conversation', () => {
    expect(
      isViewingConversation('https://app.example/messages/conv-2', 'conv-1')
    ).toBe(false);
  });
  it('is false on the bare messages list (conversation not in URL)', () => {
    expect(
      isViewingConversation('https://app.example/messages', 'conv-1')
    ).toBe(false);
  });
  it('is false when there is no conversation id or the url is malformed', () => {
    expect(isViewingConversation('https://app.example/messages/conv-1')).toBe(false);
    expect(isViewingConversation('not a url', 'conv-1')).toBe(false);
  });
});

describe('renotify (the chime on the 2nd+ message)', () => {
  // Regression: notifications are tagged one-per-conversation so rapid messages
  // collapse into a single banner. But a notification that REPLACES one with the
  // same tag does not re-alert unless renotify is set — so in the field the
  // first message in a thread rang and every one after it arrived silently.
  it('sets renotify alongside the tag so replacements still alert', () => {
    const { options } = buildNotification({
      web_push: 8030,
      notification: { title: 'Ed', body: 'your break' },
      data: { conversationId: 'c1' },
    });

    expect(options.tag).toBe('conversation:c1');
    expect(options.renotify).toBe(true);
  });

  it('sets renotify on the untagged fallback too', () => {
    const { options } = buildNotification({});

    expect(options.tag).toBe('rackem-message');
    expect(options.renotify).toBe(true);
  });
});
