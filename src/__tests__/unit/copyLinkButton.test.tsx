/**
 * @fileoverview Unit test for the `CopyLinkButton`.
 *
 * Verifies both clipboard paths: the happy case where the URL gets written
 * and a success toast fires, and the failure case where `writeText` rejects
 * and the error toast renders instead.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent } from '@/test/utils';

const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

import { CopyLinkButton } from '@/rules/CopyLinkButton';

describe('CopyLinkButton', () => {
  beforeEach(() => {
    toastSuccess.mockReset();
    toastError.mockReset();
  });

  it('writes the current URL to the clipboard and fires the success toast', async () => {
    // Setup userEvent FIRST (it installs its own clipboard mock), THEN
    // spy — otherwise our spy gets clobbered when user-event initializes.
    const user = userEvent.setup();
    const writeText = vi
      .spyOn(navigator.clipboard, 'writeText')
      .mockResolvedValue(undefined);
    renderWithProviders(<CopyLinkButton />);

    await user.click(screen.getByRole('button', { name: /copy link to this rule/i }));
    // handleClick is async; give the microtask queue a tick to flush before asserting.
    await Promise.resolve();

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith(window.location.href);
    expect(toastSuccess).toHaveBeenCalledWith('Link copied');
    expect(toastError).not.toHaveBeenCalled();
  });

  it('fires the error toast when clipboard.writeText rejects', async () => {
    const user = userEvent.setup();
    const writeText = vi
      .spyOn(navigator.clipboard, 'writeText')
      .mockRejectedValue(new Error('denied'));
    renderWithProviders(<CopyLinkButton />);

    await user.click(screen.getByRole('button', { name: /copy link to this rule/i }));
    await Promise.resolve();

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(toastError).toHaveBeenCalledWith(
      expect.stringMatching(/couldn't copy/i),
    );
    expect(toastSuccess).not.toHaveBeenCalled();
  });
});
