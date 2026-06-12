/**
 * @fileoverview Tests for WeekOffReasonModal — focused on the `initialReason`
 * pre-fill (so a week-off on a conflict week defaults to the holiday name
 * instead of opening blank) plus the operator's ability to override it.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { WeekOffReasonModal } from './WeekOffReasonModal';

describe('WeekOffReasonModal', () => {
  it('opens blank when no initialReason is given', () => {
    render(<WeekOffReasonModal isOpen onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('textbox')).toHaveValue('');
  });

  it('pre-fills the reason from initialReason (the conflict name)', () => {
    render(
      <WeekOffReasonModal isOpen initialReason="Christmas" onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(screen.getByRole('textbox')).toHaveValue('Christmas');
  });

  it('re-seeds the reason each time the modal reopens (different conflict)', () => {
    const props = { onConfirm: vi.fn(), onCancel: vi.fn() };
    const { rerender } = render(
      <WeekOffReasonModal isOpen={false} initialReason="Christmas" {...props} />,
    );
    // First open → Christmas.
    rerender(<WeekOffReasonModal isOpen initialReason="Christmas" {...props} />);
    expect(screen.getByRole('textbox')).toHaveValue('Christmas');
    // Close, then reopen for a different conflict week → New Year's.
    rerender(<WeekOffReasonModal isOpen={false} initialReason="New Year's" {...props} />);
    rerender(<WeekOffReasonModal isOpen initialReason="New Year's" {...props} />);
    expect(screen.getByRole('textbox')).toHaveValue("New Year's");
  });

  it('confirms the pre-filled reason as-is when the operator does not edit it', () => {
    const onConfirm = vi.fn();
    render(
      <WeekOffReasonModal isOpen initialReason="Christmas" onConfirm={onConfirm} onCancel={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /insert week off/i }));
    expect(onConfirm).toHaveBeenCalledWith('Christmas');
  });

  it('lets the operator override the pre-filled reason', () => {
    const onConfirm = vi.fn();
    render(
      <WeekOffReasonModal isOpen initialReason="Christmas" onConfirm={onConfirm} onCancel={vi.fn()} />,
    );
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Facility Closed' } });
    fireEvent.click(screen.getByRole('button', { name: /insert week off/i }));
    expect(onConfirm).toHaveBeenCalledWith('Facility Closed');
  });
});
