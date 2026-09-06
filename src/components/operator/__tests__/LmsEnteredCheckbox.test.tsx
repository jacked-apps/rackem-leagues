/**
 * @fileoverview Tests for <LmsEnteredCheckbox> — the "entered into LMS" marker
 * an operator ticks after hand-typing a match into the CSI / FargoRate site.
 *
 * The behaviour that matters here is that state is never conveyed by the
 * checkbox alone: operators work this as a backlog across weeks, so the row has
 * to read as done/not-done at a glance, including for a colorblind reader.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const updateResult = { error: null as { message: string } | null };

/**
 * When set, the next write hangs on this promise instead of resolving straight
 * away — the only way to observe the in-flight state, since an immediately
 * resolved mock settles before the assertion can run.
 */
let hold: Promise<unknown> | null = null;

const eqSpy = vi.fn(async () => {
  if (hold) await hold;
  return updateResult;
});
const updateSpy = vi.fn(() => ({ eq: eqSpy }));

vi.mock('@/supabaseClient', () => ({
  supabase: { from: () => ({ update: updateSpy }) },
}));

import { LmsEnteredCheckbox } from '../LmsEnteredCheckbox';

function renderCheckbox(enteredAt: string | null) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <LmsEnteredCheckbox matchId="m1" enteredAt={enteredAt} seasonId="s1" />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  updateResult.error = null;
  hold = null;
});

describe('LmsEnteredCheckbox', () => {
  it('reads as not-entered in TEXT, not just by the checkbox state', () => {
    renderCheckbox(null);

    expect(screen.getByTestId('lms-entered-checkbox')).not.toBeChecked();
    // The word is the point — a colorblind operator scanning the backlog must
    // be able to tell done from not-done without relying on the control alone.
    expect(screen.getByText('Not entered')).toBeInTheDocument();
  });

  it('reads as entered in TEXT when the marker is set', () => {
    renderCheckbox('2026-09-04T12:00:00Z');

    expect(screen.getByTestId('lms-entered-checkbox')).toBeChecked();
    expect(screen.getByText('Entered')).toBeInTheDocument();
  });

  it('stamps a timestamp when ticked', async () => {
    renderCheckbox(null);
    fireEvent.click(screen.getByTestId('lms-entered-checkbox'));

    await waitFor(() => expect(updateSpy).toHaveBeenCalledTimes(1));
    const written = updateSpy.mock.calls[0][0] as { lms_entered_at: string | null };
    expect(written.lms_entered_at).toEqual(expect.any(String));
    expect(eqSpy).toHaveBeenCalledWith('id', 'm1');
  });

  it('clears back to NULL when un-ticked, so the match returns to the to-do list', async () => {
    renderCheckbox('2026-09-04T12:00:00Z');
    fireEvent.click(screen.getByTestId('lms-entered-checkbox'));

    await waitFor(() => expect(updateSpy).toHaveBeenCalledTimes(1));
    const written = updateSpy.mock.calls[0][0] as { lms_entered_at: string | null };
    expect(written.lms_entered_at).toBeNull();
  });

  it('flips immediately on click, while the write is still in flight', async () => {
    // Operators tick the box and navigate straight on (Next match / back to the
    // picker). If the control only updated after the round-trip, that navigation
    // would race the response and the checkmark would look lost.
    let release!: () => void;
    hold = new Promise<void>((resolve) => {
      release = resolve;
    });

    renderCheckbox(null);
    fireEvent.click(screen.getByTestId('lms-entered-checkbox'));

    // Server has NOT answered yet — the control already reads as done.
    await waitFor(() => expect(screen.getByText('Entered')).toBeInTheDocument());
    expect(screen.getByTestId('lms-entered-checkbox')).toBeChecked();

    release();
  });

  it('rolls back to the previous state if the write fails', async () => {
    updateResult.error = { message: 'nope' };
    renderCheckbox(null);

    fireEvent.click(screen.getByTestId('lms-entered-checkbox'));
    await waitFor(() => expect(updateSpy).toHaveBeenCalled());

    // Never leave a false "done" on screen — that would cause a skipped match.
    await waitFor(() =>
      expect(screen.getByTestId('lms-entered-checkbox')).not.toBeChecked()
    );
    expect(screen.getByText('Not entered')).toBeInTheDocument();
  });
});
