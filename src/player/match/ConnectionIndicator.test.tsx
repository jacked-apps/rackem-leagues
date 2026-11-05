/**
 * @fileoverview Tests for ConnectionIndicator (live-scoring resilience,
 * Phase 1 / Unit 4).
 *
 * The contract is "looks like nothing is wrong": nothing while live, a quiet
 * pill while degraded, and a single calm note only after a *sustained* offline
 * outage — never a scary/red alarm.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { ConnectionIndicator } from './ConnectionIndicator';

describe('ConnectionIndicator', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing while live', () => {
    const { container } = render(<ConnectionIndicator health="live" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows a quiet "catching up" pill while realtime-down (no scary banner)', () => {
    render(<ConnectionIndicator health="realtime-down" />);
    expect(screen.getByText(/catching up/i)).toBeInTheDocument();
    // Not the sustained-outage note.
    expect(screen.queryByText(/scores are safe/i)).not.toBeInTheDocument();
  });

  it('shows only the quiet pill while offline but below the sustained threshold', () => {
    vi.useFakeTimers();
    render(<ConnectionIndicator health="offline" sustainedOutageMs={8000} />);

    // Before the threshold elapses: the calm pill, not the note.
    expect(screen.getByText(/catching up/i)).toBeInTheDocument();
    expect(screen.queryByText(/scores are safe/i)).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(7999);
    });
    expect(screen.queryByText(/scores are safe/i)).not.toBeInTheDocument();
  });

  it('upgrades to a single calm note after a sustained offline outage', () => {
    vi.useFakeTimers();
    render(<ConnectionIndicator health="offline" sustainedOutageMs={8000} />);

    act(() => {
      vi.advanceTimersByTime(8000);
    });

    expect(screen.getByText(/scores are safe/i)).toBeInTheDocument();
    // The calm note replaces the pill.
    expect(screen.queryByText(/catching up/i)).not.toBeInTheDocument();
  });

  it('resets the escalation when health recovers away from offline', () => {
    vi.useFakeTimers();
    const { rerender } = render(
      <ConnectionIndicator health="offline" sustainedOutageMs={8000} />
    );
    act(() => {
      vi.advanceTimersByTime(8000);
    });
    expect(screen.getByText(/scores are safe/i)).toBeInTheDocument();

    // Recover to realtime-down → back to the quiet pill, note gone.
    rerender(<ConnectionIndicator health="realtime-down" sustainedOutageMs={8000} />);
    expect(screen.queryByText(/scores are safe/i)).not.toBeInTheDocument();
    expect(screen.getByText(/catching up/i)).toBeInTheDocument();
  });
});
