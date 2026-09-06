/**
 * @fileoverview Tests for Button's automatic in-flight handling.
 *
 * Background: `loadingText` alone used to do nothing — the button only spun and
 * disabled itself when a caller ALSO passed `isLoading`. Across 200+ call sites
 * plenty didn't, so those buttons stayed live for the whole request and a
 * double-tap fired the action twice. That shipped two user-visible bugs on
 * 2026-09-05 (duplicate team chats, a dead-looking PWA update button), neither
 * caught by a test.
 *
 * The button now tracks an async onClick itself. These tests pin that, and pin
 * the two escape hatches that must keep working: an explicit `isLoading`, and
 * `loadingText="none"`.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Button } from '../button';

/** A promise we resolve by hand, so the in-flight state is observable. */
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('Button — automatic in-flight state', () => {
  it('shows loadingText and disables while an async onClick is pending', async () => {
    const { promise, resolve } = deferred();
    render(
      <Button loadingText="Saving..." onClick={() => promise}>
        Save
      </Button>
    );

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled()
    );

    resolve();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /save/i })).toBeEnabled()
    );
  });

  it('ignores repeat clicks while pending — the double-submit bug', async () => {
    const { promise, resolve } = deferred();
    const onClick = vi.fn(() => promise);
    render(
      <Button loadingText="Creating..." onClick={onClick}>
        Create
      </Button>
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);
    await waitFor(() => expect(button).toBeDisabled());
    fireEvent.click(button);
    fireEvent.click(button);

    expect(onClick).toHaveBeenCalledTimes(1);
    resolve();
  });

  it('recovers when the handler rejects, rather than staying stuck', async () => {
    // A failed save must leave the button usable so it can be retried.
    // The wrapper must log an uncaught handler error, not swallow it — a
    // silently-failed action that just re-enables its button is
    // indistinguishable from one that did nothing.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onClick = vi.fn(() => Promise.reject(new Error('nope')));
    render(
      <Button loadingText="Saving..." onClick={onClick}>
        Save
      </Button>
    );

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /save/i })).toBeEnabled()
    );
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('leaves synchronous handlers completely alone', () => {
    const onClick = vi.fn();
    render(
      <Button loadingText="Saving..." onClick={onClick}>
        Save
      </Button>
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);
    fireEvent.click(button);

    expect(onClick).toHaveBeenCalledTimes(2);
    expect(button).toBeEnabled();
  });

  it('an explicit isLoading still wins, so existing call sites are untouched', () => {
    render(
      <Button loadingText="Saving..." isLoading onClick={vi.fn()}>
        Save
      </Button>
    );

    expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled();
  });

  it('an explicit isLoading={false} suppresses the automatic state', async () => {
    // A caller driving this from a mutation's isPending owns the decision
    // entirely; the button must not second-guess it.
    const { promise, resolve } = deferred();
    render(
      <Button loadingText="Saving..." isLoading={false} onClick={() => promise}>
        Save
      </Button>
    );

    fireEvent.click(screen.getByRole('button'));

    expect(screen.getByRole('button', { name: /save/i })).toBeEnabled();
    resolve();
  });

  it('loadingText="none" opts out entirely, even for an async handler', async () => {
    // Cancel and Close buttons shouldn't start disabling themselves just
    // because their handler happens to be async.
    const { promise, resolve } = deferred();
    const onClick = vi.fn(() => promise);
    render(
      <Button variant="outline" loadingText="none" onClick={onClick}>
        Cancel
      </Button>
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);
    fireEvent.click(button);

    expect(button).toBeEnabled();
    expect(onClick).toHaveBeenCalledTimes(2);
    resolve();
  });

  it('still respects an explicit disabled prop', () => {
    const onClick = vi.fn();
    render(
      <Button loadingText="Saving..." disabled onClick={onClick}>
        Save
      </Button>
    );

    fireEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });
});
