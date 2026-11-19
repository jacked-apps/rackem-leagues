/**
 * @fileoverview Tests for Button's double-tap lock.
 *
 * The promise tracking in button.tsx only protects handlers that return their
 * save. Three kinds slipped past it and each shipped a double-tap bug: a
 * handler that fires `mutate()` and returns nothing (Save Game), a
 * `loadingText="none"` button (Deny), and a handler that navigates (the back
 * button). The lock ignores a second tap on the same button that lands within
 * DOUBLE_TAP_WINDOW_MS, whatever the handler does. Steppers opt out with
 * `allowRapidClicks`.
 */

import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button, DOUBLE_TAP_WINDOW_MS } from '../button';

describe('Button double-tap lock', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-16T20:00:00'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('ignores a quick second tap on a handler that returns nothing', () => {
    // The Save Game shape: fire a save, hand nothing back.
    const onClick = vi.fn();
    render(
      <Button loadingText="Saving..." onClick={onClick}>
        Save
      </Button>
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);
    fireEvent.click(button);

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('ignores a quick second tap on a loadingText="none" button', () => {
    // The Deny and back-button shape.
    const onClick = vi.fn();
    render(
      <Button variant="outline" loadingText="none" onClick={onClick}>
        Back
      </Button>
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);
    vi.advanceTimersByTime(DOUBLE_TAP_WINDOW_MS - 1);
    fireEvent.click(button);

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('takes a tap again once the window has passed', () => {
    const onClick = vi.fn();
    render(
      <Button loadingText="none" onClick={onClick}>
        Next
      </Button>
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);
    vi.advanceTimersByTime(DOUBLE_TAP_WINDOW_MS);
    fireEvent.click(button);

    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it('stops a double tap from submitting a form twice', () => {
    const onSubmit = vi.fn((e: { preventDefault: () => void }) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Button type="submit" loadingText="none">
          Send
        </Button>
      </form>
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);
    fireEvent.click(button);

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('locks each button on its own, so a quick tap on another one still works', () => {
    const onYes = vi.fn();
    const onNo = vi.fn();
    render(
      <>
        <Button loadingText="none" onClick={onYes}>
          Yes
        </Button>
        <Button loadingText="none" onClick={onNo}>
          No
        </Button>
      </>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
    fireEvent.click(screen.getByRole('button', { name: 'No' }));

    expect(onYes).toHaveBeenCalledTimes(1);
    expect(onNo).toHaveBeenCalledTimes(1);
  });

  it('allowRapidClicks lets a stepper take fast taps', () => {
    const onClick = vi.fn();
    render(
      <Button variant="outline" allowRapidClicks onClick={onClick}>
        +
      </Button>
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.click(button);

    expect(onClick).toHaveBeenCalledTimes(3);
  });
});
