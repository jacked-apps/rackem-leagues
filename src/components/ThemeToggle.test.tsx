/**
 * @fileoverview ThemeToggle — Light / Dark / System must always mean the
 * standard look: picking one after a custom scheme fully switches the scheme
 * off (Ed, 2026-10-29: "changing themes … should not change the other themes").
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const setTheme = vi.fn();
vi.mock('next-themes', () => ({ useTheme: () => ({ theme: 'light', setTheme }) }));
vi.mock('@/config/environment', () => ({ isProduction: false }));

import { ThemeToggle } from './ThemeToggle';

describe('ThemeToggle', () => {
  beforeEach(() => {
    setTheme.mockClear();
    localStorage.clear();
    delete document.documentElement.dataset.palette;
  });

  it('Custom applies the first scheme and switches to its mode', () => {
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole('button', { name: /custom colour scheme/i }));
    expect(document.documentElement.dataset.palette).toBe('pastel');
    expect(setTheme).toHaveBeenLastCalledWith('light');
  });

  it.each(['Light', 'Dark', 'System'])('%s after a custom scheme clears it completely', (label) => {
    localStorage.setItem('rackem-colour-scheme', 'pastel');
    document.documentElement.dataset.palette = 'pastel';
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole('button', { name: `Switch to ${label} theme` }));
    expect(document.documentElement.dataset.palette).toBeUndefined();
    expect(localStorage.getItem('rackem-colour-scheme')).toBeNull();
    expect(setTheme).toHaveBeenLastCalledWith(label.toLowerCase());
  });
});
