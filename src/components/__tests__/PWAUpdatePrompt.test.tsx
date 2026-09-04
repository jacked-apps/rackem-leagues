/**
 * @fileoverview Tests for <PWAUpdatePrompt>.
 *
 * This component is how every future fix actually reaches users, so the two
 * things pinned here are the two that were broken in the field:
 *
 *  1. Pressing "Update Now" must visibly do something. It returns a promise,
 *     but the Button needs an explicit `isLoading` — without it the press read
 *     as ignored and people pressed again.
 *  2. The page must end up on the new build even when the service worker never
 *     hands over. `updateServiceWorker(true)` reloads on `controllerchange`,
 *     which does not fire when nothing is in `waiting`.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const updateServiceWorker = vi.fn();
const setNeedRefresh = vi.fn();
let needRefresh = true;

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  }),
}));

vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { PWAUpdatePrompt } from '../PWAUpdatePrompt';
import { logger } from '@/utils/logger';

const reload = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  needRefresh = true;
  updateServiceWorker.mockReturnValue(new Promise(() => {})); // hangs by default
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, reload },
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('PWAUpdatePrompt', () => {
  it('renders nothing when there is no update waiting', () => {
    needRefresh = false;
    const { container } = render(<PWAUpdatePrompt />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows in-flight feedback the moment Update Now is pressed', async () => {
    render(<PWAUpdatePrompt />);
    fireEvent.click(screen.getByRole('button', { name: /update now/i }));

    // The bug: this used to stay "Update Now" with no disabled state, so the
    // press looked ignored.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /updating/i })).toBeInTheDocument()
    );
    expect(screen.getByRole('button', { name: /later/i })).toBeDisabled();
  });

  it('reloads anyway when the service worker never takes control', async () => {
    // updateServiceWorker hangs — i.e. controllerchange never fires because
    // nothing was in `waiting`. This is the "sometimes it just doesn't update"
    // half of the report.
    render(<PWAUpdatePrompt />);
    fireEvent.click(screen.getByRole('button', { name: /update now/i }));

    expect(reload).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(3000);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('reloads immediately if the update throws', async () => {
    updateServiceWorker.mockRejectedValue(new Error('skipWaiting failed'));
    render(<PWAUpdatePrompt />);
    fireEvent.click(screen.getByRole('button', { name: /update now/i }));

    await waitFor(() => expect(reload).toHaveBeenCalled());
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('forcing reload'),
      expect.objectContaining({ error: 'skipWaiting failed' })
    );
  });

  it('"Later" dismisses without updating or reloading', () => {
    render(<PWAUpdatePrompt />);
    fireEvent.click(screen.getByRole('button', { name: /later/i }));

    expect(setNeedRefresh).toHaveBeenCalledWith(false);
    expect(updateServiceWorker).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it('does not leave a reload timer running after unmount', async () => {
    const { unmount } = render(<PWAUpdatePrompt />);
    fireEvent.click(screen.getByRole('button', { name: /update now/i }));
    unmount();

    await vi.advanceTimersByTimeAsync(5000);
    expect(reload).not.toHaveBeenCalled();
  });
});
