/**
 * @fileoverview Tests for MessageInput's Unit 8 failed-send UX.
 *
 * Scenarios mirror the Phase 1 plan's Unit 8 test list:
 *  - Happy path: successful send clears the composer; no failed bubble.
 *  - Failure path: failed send surfaces a failed-state bubble above the
 *    input with the original content + the error reason from the
 *    rejection.
 *  - Retry path: clicking Retry re-runs `onSend` with the same content;
 *    on success the failed bubble disappears.
 *  - Persistent failure: a retry that also fails re-shows a failed bubble.
 *  - Stacking: multiple distinct failures show multiple bubbles, each
 *    independently retryable.
 *  - Composer independence: after a failure the composer is empty and the
 *    user can type / send a brand-new message; the prior failed bubble
 *    stays put.
 *
 * `useProfanityFilter` is mocked to keep the rendered content stable for
 * text assertions (no censoring side-effects).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent } from '@/test/utils';

vi.mock('@/hooks/useProfanityFilter', () => ({
  useProfanityFilter: () => ({
    shouldFilter: false,
    canToggle: true,
    isLoading: false,
  }),
}));

import { MessageInput } from '../MessageInput';

function renderInput(onSend: (c: string) => Promise<void>) {
  return renderWithProviders(<MessageInput onSend={onSend} />);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('MessageInput — happy path', () => {
  it('clears the composer after a successful send and does not show a failed bubble', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn().mockResolvedValue(undefined);
    renderInput(onSend);

    const input = screen.getByPlaceholderText(/type a message/i);
    await user.type(input, 'hello there');
    await user.keyboard('{Enter}');

    expect(onSend).toHaveBeenCalledWith('hello there');
    expect((input as HTMLInputElement).value).toBe('');
    expect(screen.queryByTestId('failed-messages-list')).not.toBeInTheDocument();
    expect(screen.queryByTestId('failed-message')).not.toBeInTheDocument();
  });
});

describe('MessageInput — failure path', () => {
  it('shows a failed bubble with the original content and the error reason when onSend rejects', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn().mockRejectedValue(new Error('Network error: offline'));
    renderInput(onSend);

    const input = screen.getByPlaceholderText(/type a message/i);
    await user.type(input, 'this will fail');
    await user.keyboard('{Enter}');

    const bubble = await screen.findByTestId('failed-message');
    expect(bubble).toBeInTheDocument();
    expect(bubble.textContent).toContain('this will fail');
    expect(screen.getByTestId('failed-message-error').textContent).toContain('Network error: offline');
    expect((input as HTMLInputElement).value).toBe('');
  });

  it('falls back to a generic "Failed to send" message when the rejection has no message', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn().mockRejectedValue(new Error(''));
    renderInput(onSend);

    await user.type(screen.getByPlaceholderText(/type a message/i), 'x');
    await user.keyboard('{Enter}');

    expect((await screen.findByTestId('failed-message-error')).textContent).toBe('Failed to send');
  });
});

describe('MessageInput — retry path', () => {
  it('removes the failed bubble when retry succeeds', async () => {
    const user = userEvent.setup();
    const onSend = vi
      .fn()
      .mockRejectedValueOnce(new Error('temporary'))
      .mockResolvedValueOnce(undefined);
    renderInput(onSend);

    await user.type(screen.getByPlaceholderText(/type a message/i), 'eventually ok');
    await user.keyboard('{Enter}');

    await screen.findByTestId('failed-message');
    await user.click(screen.getByRole('button', { name: /retry/i }));

    expect(onSend).toHaveBeenNthCalledWith(2, 'eventually ok');
    // After the successful retry the failed bubble is gone.
    expect(screen.queryByTestId('failed-message')).not.toBeInTheDocument();
  });

  it('re-shows a failed bubble when retry also fails (with a fresh error if different)', async () => {
    const user = userEvent.setup();
    const onSend = vi
      .fn()
      .mockRejectedValueOnce(new Error('first error'))
      .mockRejectedValueOnce(new Error('second error'));
    renderInput(onSend);

    await user.type(screen.getByPlaceholderText(/type a message/i), 'always fails');
    await user.keyboard('{Enter}');

    let bubble = await screen.findByTestId('failed-message');
    expect(bubble.textContent).toContain('first error');

    await user.click(screen.getByRole('button', { name: /retry/i }));

    bubble = await screen.findByTestId('failed-message');
    expect(bubble.textContent).toContain('always fails');
    expect(screen.getByTestId('failed-message-error').textContent).toContain('second error');
  });
});

describe('MessageInput — multiple failures stack independently', () => {
  it('shows one failed bubble per failed send', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn().mockRejectedValue(new Error('boom'));
    renderInput(onSend);

    const input = screen.getByPlaceholderText(/type a message/i);
    await user.type(input, 'first');
    await user.keyboard('{Enter}');
    await user.type(input, 'second');
    await user.keyboard('{Enter}');
    await user.type(input, 'third');
    await user.keyboard('{Enter}');

    const bubbles = await screen.findAllByTestId('failed-message');
    expect(bubbles).toHaveLength(3);
    expect(bubbles[0].textContent).toContain('first');
    expect(bubbles[1].textContent).toContain('second');
    expect(bubbles[2].textContent).toContain('third');
  });
});

describe('MessageInput — composer independence after a failure', () => {
  it('keeps the failed bubble in place when the user types a new draft', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn().mockRejectedValue(new Error('offline'));
    renderInput(onSend);

    const input = screen.getByPlaceholderText(/type a message/i);
    await user.type(input, 'failed one');
    await user.keyboard('{Enter}');
    await screen.findByTestId('failed-message');

    await user.type(input, 'a fresh draft');
    expect((input as HTMLInputElement).value).toBe('a fresh draft');
    // Failed bubble survives the new draft typing.
    expect(screen.getByTestId('failed-message').textContent).toContain('failed one');
  });

  it('lets the user send a brand new message that succeeds while a failed bubble is showing', async () => {
    const user = userEvent.setup();
    const onSend = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(undefined);
    renderInput(onSend);

    const input = screen.getByPlaceholderText(/type a message/i);
    await user.type(input, 'failed one');
    await user.keyboard('{Enter}');
    await screen.findByTestId('failed-message');

    await user.type(input, 'next one works');
    await user.keyboard('{Enter}');

    expect(onSend).toHaveBeenNthCalledWith(2, 'next one works');
    // The earlier failed bubble is still visible — it's separate from
    // the just-sent (now successful) message.
    expect(screen.getByTestId('failed-message').textContent).toContain('failed one');
    expect((input as HTMLInputElement).value).toBe('');
  });
});
