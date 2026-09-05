/**
 * @fileoverview Tests for the quiet-hours control.
 *
 * Quiet hours are the one setting with no per-chat escape, so the states that
 * matter are: off means genuinely off (both times null, never a half-set window
 * the resolver would misread), and an overnight window is presented as
 * intentional rather than looking like a mistake.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QuietHoursSetting } from '../QuietHoursSetting';

describe('QuietHoursSetting', () => {
  it('is off, with no time inputs, when unset', () => {
    render(<QuietHoursSetting start={null} end={null} onChange={vi.fn()} />);

    expect(screen.getByTestId('quiet-hours-switch')).not.toBeChecked();
    expect(screen.queryByTestId('quiet-hours-start')).not.toBeInTheDocument();
  });

  it('offers 10pm–7am when first switched on', () => {
    const onChange = vi.fn();
    render(<QuietHoursSetting start={null} end={null} onChange={onChange} />);

    fireEvent.click(screen.getByTestId('quiet-hours-switch'));

    expect(onChange).toHaveBeenCalledWith('22:00', '07:00');
  });

  it('clears BOTH times when switched off', () => {
    // A half-set window would be read by is_in_quiet_hours as "not configured"
    // anyway, but leaving one behind means the next toggle-on silently restores
    // a value the member never sees.
    const onChange = vi.fn();
    render(<QuietHoursSetting start="22:00:00" end="07:00:00" onChange={onChange} />);

    fireEvent.click(screen.getByTestId('quiet-hours-switch'));

    expect(onChange).toHaveBeenCalledWith(null, null);
  });

  it('renders stored HH:MM:SS values into the HH:MM inputs', () => {
    // Postgres returns time as 'HH:MM:SS'; an <input type="time"> shows nothing
    // for that, so the control would look empty despite being configured.
    render(<QuietHoursSetting start="22:00:00" end="07:00:00" onChange={vi.fn()} />);

    expect(screen.getByTestId('quiet-hours-start')).toHaveValue('22:00');
    expect(screen.getByTestId('quiet-hours-end')).toHaveValue('07:00');
  });

  it('says so when the window runs past midnight', () => {
    render(<QuietHoursSetting start="22:00:00" end="07:00:00" onChange={vi.fn()} />);

    expect(screen.getByTestId('quiet-hours-overnight')).toBeInTheDocument();
  });

  it('stays quiet about wrapping for a same-day window', () => {
    render(<QuietHoursSetting start="09:00:00" end="17:00:00" onChange={vi.fn()} />);

    expect(screen.queryByTestId('quiet-hours-overnight')).not.toBeInTheDocument();
  });

  it('keeps the other time when one is edited', () => {
    const onChange = vi.fn();
    render(<QuietHoursSetting start="22:00:00" end="07:00:00" onChange={onChange} />);

    fireEvent.change(screen.getByTestId('quiet-hours-end'), {
      target: { value: '08:30' },
    });

    expect(onChange).toHaveBeenCalledWith('22:00:00', '08:30');
  });
});
