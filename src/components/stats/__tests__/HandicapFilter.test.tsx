/**
 * @fileoverview Tests for the opponent-handicap control.
 *
 * Two modes on purpose: picking an existing handicap is a list, while "50 and
 * over" is not in any list and needs typing.
 *
 * The behaviour worth pinning is what happens when someone toggles Range — the
 * number already chosen has to survive, in both directions. Losing it is the
 * difference between a control that helps and one that punishes you for
 * exploring.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent } from '@/test/utils';
import { HandicapFilter } from '../HandicapFilter';

const OPTIONS = [
  { value: 350, label: '350', count: 4 },
  { value: 500, label: '500', count: 9 },
  { value: 750, label: '750', count: 2 },
];

function render(props: Partial<React.ComponentProps<typeof HandicapFilter>> = {}) {
  const onChange = vi.fn();
  renderWithProviders(
    <HandicapFilter
      min={null}
      max={null}
      onChange={onChange}
      options={OPTIONS}
      {...props}
    />
  );
  return { onChange };
}

const picker = () => screen.getByLabelText('Opponent handicap');
const rangeToggle = () => screen.getByLabelText('Range');

beforeEach(() => vi.clearAllMocks());

describe('HandicapFilter — pick one by default', () => {
  it('starts as a single picker, not a range', () => {
    render();
    expect(picker()).toBeInTheDocument();
    expect(screen.queryByLabelText('Opponent handicap to')).not.toBeInTheDocument();
  });

  it('offers the handicaps actually available, with their counts', async () => {
    const user = userEvent.setup();
    render();

    await user.click(picker());

    expect(screen.getByRole('option', { name: 'Any' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '500 (9)' })).toBeInTheDocument();
  });

  it('pins both ends to the pick, which is what an exact match means', async () => {
    const user = userEvent.setup();
    const { onChange } = render();

    await user.click(picker());
    await user.click(screen.getByRole('option', { name: '500 (9)' }));

    expect(onChange).toHaveBeenLastCalledWith({ min: 500, max: 500 });
  });

  it('treats Any as no constraint, not as zero', async () => {
    const user = userEvent.setup();
    const { onChange } = render({ min: 500, max: 500 });

    await user.click(picker());
    await user.click(screen.getByRole('option', { name: 'Any' }));

    expect(onChange).toHaveBeenLastCalledWith({ min: null, max: null });
  });
});

describe('HandicapFilter — the Range toggle', () => {
  it('keeps the chosen number as the lower end and opens the top', async () => {
    // Switching to Range with 500 chosen should read at once as "500 and over",
    // which is the reason someone reaches for it.
    const user = userEvent.setup();
    const { onChange } = render({ min: 500, max: 500 });

    await user.click(rangeToggle());

    expect(onChange).toHaveBeenLastCalledWith({ min: 500, max: null });
    expect(screen.getByLabelText('Opponent handicap from')).toBeInTheDocument();
    expect(screen.getByLabelText('Opponent handicap to')).toBeInTheDocument();
  });

  it('collapses back to the lower end rather than discarding it', async () => {
    const user = userEvent.setup();
    const { onChange } = render({ min: 400, max: 700 });

    // Opens in range mode because the two ends differ.
    expect(screen.getByLabelText('Opponent handicap from')).toBeInTheDocument();
    await user.click(rangeToggle());

    expect(onChange).toHaveBeenLastCalledWith({ min: 400, max: 400 });
  });

  it('opens in range mode when the ends already differ', () => {
    render({ min: 400, max: 700 });
    expect(screen.getByLabelText('Opponent handicap from')).toBeInTheDocument();
  });

  it('stays in pick-one mode when both ends are the same', () => {
    render({ min: 350, max: 350 });
    expect(screen.queryByLabelText('Opponent handicap to')).not.toBeInTheDocument();
  });

  it('sets each end independently once open', async () => {
    const user = userEvent.setup();
    const { onChange } = render({ min: 500, max: null });

    await user.click(rangeToggle());
    onChange.mockClear();
    await user.type(screen.getByLabelText('Opponent handicap to'), '9');

    expect(onChange).toHaveBeenLastCalledWith({ min: 500, max: 9 });
  });

  it('accepts a negative end, which the points system uses', async () => {
    const user = userEvent.setup();
    const { onChange } = render();

    await user.click(rangeToggle());
    onChange.mockClear();
    await user.type(screen.getByLabelText('Opponent handicap from'), '-2');

    expect(onChange).toHaveBeenLastCalledWith({ min: -2, max: null });
  });

  it('treats an emptied box as no constraint, not as zero', async () => {
    const user = userEvent.setup();
    const { onChange } = render({ min: 400, max: 700 });

    await user.clear(screen.getByLabelText('Opponent handicap to'));

    expect(onChange).toHaveBeenLastCalledWith({ min: 400, max: null });
  });
});

describe('HandicapFilter — the hint', () => {
  it('reports the available span while typing a range', async () => {
    // Typing loses the discoverability the list gave: without this, entering a
    // points-scale number while filtered to Fargo returns nothing and reads as
    // broken rather than simply empty.
    const user = userEvent.setup();
    render();

    await user.click(rangeToggle());

    expect(screen.getByText(/In view: 350 to 750/)).toBeInTheDocument();
  });

  it('stays quiet in pick-one mode, where the list already shows them', () => {
    render();
    expect(screen.queryByText(/In view:/)).not.toBeInTheDocument();
  });

  it('says nothing when every opponent has the same handicap', async () => {
    const user = userEvent.setup();
    render({ options: [{ value: 5, label: '5', count: 3 }] });

    await user.click(rangeToggle());

    expect(screen.queryByText(/In view:/)).not.toBeInTheDocument();
  });
});
