/**
 * @fileoverview The receiving half of the "Show me what's new" flow.
 *
 * `PWAUpdatePrompt` sets a sessionStorage flag and reloads; its own tests cover
 * that side. These cover what happens on the other side of the reload — the
 * flag being read, acted on, and cleared — plus the page the member lands on.
 *
 * Worth testing together because the two halves are separated by a full page
 * reload, so nothing at runtime ever fails loudly if they stop agreeing: a
 * mismatched key would simply mean nobody is ever taken to the notes, silently.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { renderWithProviders, screen } from '@/test/utils';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>(
    'react-router-dom'
  );
  return { ...actual, useNavigate: () => mockNavigate };
});

// The page records "seen" against the logged-in member; that path has its own
// concerns (network, auth) and isn't what these tests are about.
vi.mock('../useWhatsNewSeen', () => ({
  useMarkWhatsNewSeen: () => vi.fn(),
  useHasUnseenWhatsNew: () => false,
}));

import {
  requestWhatsNewAfterUpdate,
  useShowWhatsNewAfterUpdate,
} from '../useShowWhatsNewAfterUpdate';
import WhatsNewPage from '../WhatsNewPage';
import { RELEASES, UNRELEASED } from '../releases';
import { groupEntries } from '../releaseSelectors';

/** Render the hook inside a router, which it needs for `useNavigate`. */
function renderFlagHook() {
  return renderHook(() => useShowWhatsNewAfterUpdate(), {
    wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter>,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useShowWhatsNewAfterUpdate', () => {
  it('takes the member to the notes when the update asked for it', () => {
    requestWhatsNewAfterUpdate();
    renderFlagHook();
    expect(mockNavigate).toHaveBeenCalledWith('/whats-new', { replace: true });
  });

  it('stays put when no update asked for it', () => {
    renderFlagHook();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('clears the flag, so a later reload does not drag them back', () => {
    requestWhatsNewAfterUpdate();
    const first = renderFlagHook();
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    first.unmount();

    mockNavigate.mockClear();
    renderFlagHook();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('replaces the history entry, so Back does not return to the notes', () => {
    requestWhatsNewAfterUpdate();
    renderFlagHook();
    expect(mockNavigate).toHaveBeenCalledWith(
      '/whats-new',
      expect.objectContaining({ replace: true })
    );
  });

  it('does not break when storage is unavailable (private window)', () => {
    // Spy on the instance, not Storage.prototype — the DOM implementation
    // under test does not necessarily route sessionStorage through it.
    vi.spyOn(sessionStorage, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });
    vi.spyOn(sessionStorage, 'setItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });
    // The update itself must survive this too — requesting is best-effort.
    expect(() => requestWhatsNewAfterUpdate()).not.toThrow();
    expect(() => renderFlagHook()).not.toThrow();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

describe('WhatsNewPage', () => {
  it('shows the current notes, and the build the member is actually running', () => {
    renderWithProviders(<WhatsNewPage />);

    // Every authored entry reaches the page — the real risk here is an entry
    // silently dropped by grouping, not the wording.
    const current = RELEASES.find(
      (r) => r.entries.length > 0 || r.noUserFacingChanges
    );
    expect(current).toBeDefined();
    for (const entry of current!.entries) {
      expect(screen.getByText(entry.text)).toBeInTheDocument();
    }

    expect(groupEntries(current!.entries).length).toBeGreaterThan(0);
    expect(screen.getByText(/You're running version/)).toBeInTheDocument();
  });

  it('never tells a reader that a shipped change is still coming', () => {
    // This file ships WITH the app, so anything visible on this page is in the
    // build being read. "Coming soon" cannot be true here, and saying it told
    // people their working features were unreleased.
    renderWithProviders(<WhatsNewPage />);
    expect(screen.queryByText('Coming soon')).not.toBeInTheDocument();
    expect(screen.queryByText('In progress')).not.toBeInTheDocument();
  });

  it('heads an un-versioned block "Latest changes" rather than inventing a version', () => {
    const current = RELEASES.find(
      (r) => r.entries.length > 0 || r.noUserFacingChanges
    );
    renderWithProviders(<WhatsNewPage />);

    if (current?.version === UNRELEASED) {
      expect(screen.getByText('Latest changes')).toBeInTheDocument();
    } else {
      expect(
        screen.getByText(`Version ${current!.version}`)
      ).toBeInTheDocument();
    }
  });
});
