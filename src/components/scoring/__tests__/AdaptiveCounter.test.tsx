/**
 * @fileoverview Tests for AdaptiveCounter — the calculator-driven per-game
 * value input introduced by Branch A Unit 3 of the scoring-modal-plumbing
 * plan.
 *
 * Coverage maps to the test scenarios enumerated in the plan:
 *   - Happy path: 0-7 grid renders 8 buttons; selection styling; clicks fire.
 *   - Edge: non-zero min (5-12); min === max degenerate; value=0 valid;
 *     value=null no selection; disabled state; range > 8 throws.
 *
 * The component is fully controlled — no internal state. Tests verify both
 * the rendered structure and the change callback wiring.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdaptiveCounter } from '../AdaptiveCounter';

describe('AdaptiveCounter — grid mode (range ≤ 8)', () => {
  describe('happy path: Fargo 0-7 default case', () => {
    it('renders 8 buttons labeled 0 through 7', () => {
      render(
        <AdaptiveCounter
          min={0}
          max={7}
          label="Loser balls pocketed"
          value={null}
          onChange={vi.fn()}
        />,
      );

      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(8);
      expect(buttons.map((b) => b.textContent)).toEqual([
        '0',
        '1',
        '2',
        '3',
        '4',
        '5',
        '6',
        '7',
      ]);
    });

    it('renders the label text', () => {
      render(
        <AdaptiveCounter
          min={0}
          max={7}
          label="Loser balls pocketed"
          value={null}
          onChange={vi.fn()}
        />,
      );
      expect(screen.getByText('Loser balls pocketed')).toBeInTheDocument();
    });

    it('clicking a button calls onChange with that button value', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <AdaptiveCounter
          min={0}
          max={7}
          label="Loser balls pocketed"
          value={null}
          onChange={onChange}
        />,
      );

      await user.click(screen.getByRole('button', { name: '3' }));
      expect(onChange).toHaveBeenCalledWith(3);
      expect(onChange).toHaveBeenCalledTimes(1);
    });
  });

  describe('selection styling', () => {
    it('selected button uses default variant; others use outline', () => {
      render(
        <AdaptiveCounter
          min={0}
          max={7}
          label="Loser balls pocketed"
          value={3}
          onChange={vi.fn()}
        />,
      );

      const selected = screen.getByRole('button', { name: '3' });
      const unselected = screen.getByRole('button', { name: '5' });

      // shadcn Button renders different class strings for default vs outline
      // variants. The selected button should NOT have the outline class
      // marker (which contains "border" combined with hover bg overrides).
      expect(selected.className).not.toEqual(unselected.className);
    });

    it('value=0 is a valid explicit selection', () => {
      render(
        <AdaptiveCounter
          min={0}
          max={7}
          label="Loser balls pocketed"
          value={0}
          onChange={vi.fn()}
        />,
      );

      const zeroBtn = screen.getByRole('button', { name: '0' });
      const oneBtn = screen.getByRole('button', { name: '1' });
      // The 0 button is selected (different styling than others).
      expect(zeroBtn.className).not.toEqual(oneBtn.className);
    });

    it('value=null leaves all buttons in the unselected style', () => {
      render(
        <AdaptiveCounter
          min={0}
          max={7}
          label="Loser balls pocketed"
          value={null}
          onChange={vi.fn()}
        />,
      );

      const buttons = screen.getAllByRole('button');
      // All buttons share the same className when none is selected.
      const firstClass = buttons[0].className;
      buttons.forEach((b) => {
        expect(b.className).toBe(firstClass);
      });
    });
  });

  describe('non-zero min (e.g., a future 5-12 calculator)', () => {
    it('renders 8 buttons labeled 5 through 12', () => {
      render(
        <AdaptiveCounter
          min={5}
          max={12}
          label="Winner points"
          value={null}
          onChange={vi.fn()}
        />,
      );

      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(8);
      expect(buttons.map((b) => b.textContent)).toEqual([
        '5',
        '6',
        '7',
        '8',
        '9',
        '10',
        '11',
        '12',
      ]);
    });

    it('clicking the 8 button calls onChange(8) — not onChange(3)', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <AdaptiveCounter
          min={5}
          max={12}
          label="Winner points"
          value={null}
          onChange={onChange}
        />,
      );

      await user.click(screen.getByRole('button', { name: '8' }));
      expect(onChange).toHaveBeenCalledWith(8);
    });
  });

  describe('degenerate cases', () => {
    it('min === max renders a fixed-points label, no buttons', () => {
      render(
        <AdaptiveCounter
          min={10}
          max={10}
          label="Winner points"
          value={null}
          onChange={vi.fn()}
        />,
      );

      // Label is shown.
      expect(screen.getByText('Winner points')).toBeInTheDocument();
      // The fixed value is shown.
      expect(screen.getByText('10')).toBeInTheDocument();
      // No buttons are rendered.
      expect(screen.queryAllByRole('button')).toHaveLength(0);
    });

    it('min === max does not call onChange when re-rendered', () => {
      const onChange = vi.fn();
      render(
        <AdaptiveCounter
          min={10}
          max={10}
          label="Winner points"
          value={null}
          onChange={onChange}
        />,
      );
      expect(onChange).not.toHaveBeenCalled();
    });

    it('range > 8 throws with a clear error', () => {
      // Suppress React's error logging for this test — the throw is expected.
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() =>
        render(
          <AdaptiveCounter
            min={0}
            max={20}
            label="Winner points"
            value={null}
            onChange={vi.fn()}
          />,
        ),
      ).toThrow(/AdaptiveCounter: range 0-20.*not yet implemented/);

      consoleErrorSpy.mockRestore();
    });
  });

  describe('disabled state', () => {
    it('all buttons render with disabled prop when disabled={true}', () => {
      render(
        <AdaptiveCounter
          min={0}
          max={7}
          label="Loser balls pocketed"
          value={null}
          onChange={vi.fn()}
          disabled
        />,
      );

      const buttons = screen.getAllByRole('button');
      buttons.forEach((b) => {
        expect(b).toBeDisabled();
      });
    });

    it('clicking a disabled button does not call onChange', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <AdaptiveCounter
          min={0}
          max={7}
          label="Loser balls pocketed"
          value={null}
          onChange={onChange}
          disabled
        />,
      );

      await user.click(screen.getByRole('button', { name: '3' }));
      expect(onChange).not.toHaveBeenCalled();
    });
  });
});
