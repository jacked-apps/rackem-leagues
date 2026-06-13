/**
 * @fileoverview Tests for InstallAppCard — the platform-adaptive install entry
 * point: native prompt (Android/desktop), iPhone Safari instructions, Android
 * menu instructions, and the hidden states (installed / unsupported).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { UseInstallApp } from '@/hooks/useInstallApp';

const mockUseInstallApp = vi.fn<[], UseInstallApp>();
vi.mock('@/hooks/useInstallApp', () => ({
  useInstallApp: () => mockUseInstallApp(),
}));

import { InstallAppCard } from './InstallAppCard';

const base: UseInstallApp = {
  isStandalone: false,
  canPromptInstall: false,
  platform: 'other',
  promptInstall: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUseInstallApp.mockReturnValue({ ...base, promptInstall: vi.fn() });
});

describe('InstallAppCard', () => {
  it('renders nothing when the app is already installed', () => {
    mockUseInstallApp.mockReturnValue({ ...base, isStandalone: true });
    const { container } = render(<InstallAppCard />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing on an unsupported browser (no prompt, non-touch platform)', () => {
    mockUseInstallApp.mockReturnValue({ ...base, platform: 'other', canPromptInstall: false });
    const { container } = render(<InstallAppCard />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows a native Install button and fires the prompt (Android/desktop)', () => {
    const promptInstall = vi.fn();
    mockUseInstallApp.mockReturnValue({
      ...base,
      canPromptInstall: true,
      platform: 'android',
      promptInstall,
    });
    render(<InstallAppCard />);

    // Native mode → no instructions, just the install button.
    expect(screen.queryByRole('button', { name: /add to home screen/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /install app/i }));
    expect(promptInstall).toHaveBeenCalledTimes(1);
  });

  it('iPhone: offers Add to Home Screen → Safari share-sheet instructions', () => {
    mockUseInstallApp.mockReturnValue({ ...base, platform: 'ios', canPromptInstall: false });
    render(<InstallAppCard />);

    fireEvent.click(screen.getByRole('button', { name: /add to home screen/i }));
    expect(screen.getByText(/your iPhone/i)).toBeInTheDocument();
    expect(screen.getByText(/Scroll down/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Safari/).length).toBeGreaterThan(0);
  });

  it('Android without a captured prompt: offers browser-menu instructions', () => {
    mockUseInstallApp.mockReturnValue({ ...base, platform: 'android', canPromptInstall: false });
    render(<InstallAppCard />);

    fireEvent.click(screen.getByRole('button', { name: /add to home screen/i }));
    expect(screen.getByText(/your phone/i)).toBeInTheDocument();
    expect(screen.getByText(/Tap the menu/i)).toBeInTheDocument();
  });
});
