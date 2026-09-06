/**
 * @fileoverview Tests for the opponent-handicap control.
 *
 * The behaviour worth pinning is what happens when someone toggles Range: the
 * number they already typed has to survive, in both directions. Losing it is
 * the difference between a control that helps and one that punishes you for
 * exploring.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent } from '@/test/utils';
import { HandicapFilter } from '../HandicapFilter';

function render(props: Partial<React.ComponentProps<typeof HandicapFilter>> = {}) {
  const onChange = vi.fn();
  renderWithProviders(
    <HandicapFilter
      min={null}
      max={null}
      onChange={onChange}
      lowest={350}
      highest={750}
      {...props}
    />
  );
  return { onChange };
}

const exactBox = () => screen.getByLabelText('Opponent handicap', { selector: 'input' });
const rangeToggle = () => screen.getByLabelText('Range');

beforeEach(() => vi.clearAllMocks());

describe('HandicapFilter — exact by default', () => {
  it('starts as one box, not a range', () => {
    render();
    expect(exactBox()).toBeInTheDocument();
    expect(screen.queryByLabelText('Opponent handicap to')).not.toBeInTheDocument();
  });

  it('pins both ends to the number typed, which is what "exactly 2" means', async () => {
    const user = userEvent.setup();
    const { onChange } = render();

    await user.type(exactBox(), '2');

    expect(onChange).toHaveBeenLastCalledWith({ min: 2, max: 2 });
  });

  it('treats an empty box as no constraint, not as zero', async () => {
    const user = userEvent.setup();
    const { onChange } = render({ min: 2, max: 2 });

    await user.clear(exactBox());

    expect(onChange).toHaveBeenLastCalledWith({ min: null, max: null });
  });

  it('accepts a negative handicap, which the points system uses', async () => {
    const user = userEvent.setup();
    const { onChange } = render();

    await user.type(exactBox(), '-2');

    expect(onChange).toHaveBeenLastCalledWith({ min: -2, max: -2 });
  });
});

describe('HandicapFilter — the Range toggle', () => {
  it('keeps the typed number as the lower end and opens the top', async () => {
    // Ticking Range next to "50" should read as "50 and over" straight away —
    // that is the reason someone reaches for it.
    const user = userEvent.setup();
    const { onChange } = render({ min: 50, max: 50 });

    await user.click(rangeToggle());

    expect(onChange).toHaveBeenLastCalledWith({ min: 50, max: null });
    expect(screen.getByLabelText('Opponent handicap from')).toBeInTheDocument();
    expect(screen.getByLabelText('Opponent handicap to')).toBeInTheDocument();
  });

  it('collapses back to the lower end rather than discarding it', async () => {
    const user = userEvent.setup();
    const { onChange } = render({ min: 400, max: 700 });

    // Starts in range mode because the two ends differ.
    expect(screen.getByLabelText('Opponent handicap from')).toBeInTheDocument();
    await user.click(rangeToggle());

    expect(onChange).toHaveBeenLastCalledWith({ min: 400, max: 400 });
  });

  it('opens in range mode when the ends already differ', () => {
    render({ min: 400, max: 700 });
    expect(screen.getByLabelText('Opponent handicap from')).toBeInTheDocument();
  });

  it('stays in exact mode when both ends are the same', () => {
    render({ min: 3, max: 3 });
    expect(screen.queryByLabelText('Opponent handicap to')).not.toBeInTheDocument();
  });

  it('sets each end independently once open', async () => {
    const user = userEvent.setup();
    const { onChange } = render({ min: 50, max: null });

    await user.click(rangeToggle()); // into range mode
    onChange.mockClear();
    await user.type(screen.getByLabelText('Opponent handicap to'), '9');

    expect(onChange).toHaveBeenLastCalledWith({ min: 50, max: 9 });
  });
});

describe('HandicapFilter — the hint', () => {
  it('says what handicaps are actually in view', () => {
    // Typing loses the discoverability a list gave: without this, "2" in a
    // Fargo league returns nothing and looks broken rather than empty.
    render({ lowest: 350, highest: 750 });
    expect(screen.getByText(/In view: 350 to 750/)).toBeInTheDocument();
  });

  it('says nothing when every opponent has the same handicap', () => {
    render({ lowest: 5, highest: 5 });
    expect(screen.queryByText(/In view:/)).not.toBeInTheDocument();
  });

  it('says nothing when there is nothing to report', () => {
    render({ lowest: null, highest: null });
    expect(screen.queryByText(/In view:/)).not.toBeInTheDocument();
  });
});
