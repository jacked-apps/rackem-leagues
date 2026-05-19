/**
 * @fileoverview Timeout test for the Unit 16 bounded-send wrapper.
 *
 * supabase-js doesn't impose a default request timeout. On a stalled
 * network (offline / very slow connection) `.insert()` hangs indefinitely
 * without rejecting, which leaves the composer locked and the optimistic
 * bubble in `'sending'` state forever. Unit 16 wraps `sendMessage` with
 * an `AbortController` that fires after `SEND_TIMEOUT_MS`; this test
 * pins the contract that a stalled request really does reject with a
 * timeout-flavoured error after that interval.
 *
 * Pattern: replace the `supabase` module with a query-builder mock whose
 * terminal `.abortSignal(signal)` method returns a Promise that never
 * resolves on its own — it only rejects when the AbortController fires.
 * Then advance fake timers past `SEND_TIMEOUT_MS` and assert the thrown
 * error.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/supabaseClient', () => {
  // Each call to `supabase.from('messages').insert(...).select().single()
  // .abortSignal(signal)` returns a Promise that rejects when the signal
  // aborts. supabase-js translates an aborted fetch into an error object
  // with a non-null `error` field rather than throwing, so we mirror that.
  const buildChain = () => {
    const chain = {
      insert: vi.fn(() => chain),
      select: vi.fn(() => chain),
      single: vi.fn(() => chain),
      abortSignal: vi.fn((signal: AbortSignal) => {
        return new Promise((resolve) => {
          signal.addEventListener('abort', () => {
            resolve({
              data: null,
              error: { message: 'AbortError', name: 'AbortError' },
            });
          });
          // No success branch — the test scenario is a stalled request.
        });
      }),
    };
    return chain;
  };
  return {
    supabase: {
      from: vi.fn(() => buildChain()),
    },
  };
});

import { sendMessage, SEND_TIMEOUT_MS } from '../messages';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('sendMessage — Unit 16 timeout', () => {
  it('rejects with a timeout-flavoured error after SEND_TIMEOUT_MS when the request stalls', async () => {
    const pending = sendMessage({
      conversationId: 'conv-1',
      senderId: 'user-1',
      content: 'hello',
    });

    // Attach a catch handler synchronously so the unhandled-rejection
    // tracker doesn't flag this — we'll await it after advancing timers.
    const caught = pending.catch((err) => err);

    // Advance just under the timeout — the promise should still be pending.
    await vi.advanceTimersByTimeAsync(SEND_TIMEOUT_MS - 1);

    // Race the still-pending promise against an immediate sentinel. If the
    // send had already rejected by now, the sentinel would lose.
    const beforeTimeout = await Promise.race([
      caught.then(() => 'rejected-too-early'),
      Promise.resolve('still-pending'),
    ]);
    expect(beforeTimeout).toBe('still-pending');

    // Advance past the timeout — the AbortController fires, the chain
    // resolves with an error, sendMessage throws.
    await vi.advanceTimersByTimeAsync(2);

    const err = await caught;
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toContain('timed out');
    expect((err as Error).message).toContain(String(SEND_TIMEOUT_MS / 1000));
  });
});
