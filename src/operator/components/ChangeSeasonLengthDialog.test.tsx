/**
 * @fileoverview Tests for ChangeSeasonLengthDialog — the two-step set→review→confirm
 * flow, with the apply helper mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent, waitFor } from '@/test/utils';
import { ChangeSeasonLengthDialog, type DialogWeek } from './ChangeSeasonLengthDialog';
import { applySeasonLengthChange } from '@/utils/applySeasonLengthChange';

vi.mock('@/utils/applySeasonLengthChange', () => ({
  applySeasonLengthChange: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockApply = vi.mocked(applySeasonLengthChange);

/** 16 regular weeks (Wednesdays) + break + playoff. */
function buildWeeks(): DialogWeek[] {
  const weeks: DialogWeek[] = [];
  for (let i = 0; i < 16; i++) {
    const d = new Date(2026, 6, 1 + i * 7);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    weeks.push({ weekName: `Week ${i + 1}`, date: iso, weekType: 'regular' });
  }
  weeks.push({ weekName: 'Season End Break', date: '2026-10-21', weekType: 'season_end_break' });
  weeks.push({ weekName: 'Playoffs', date: '2026-10-28', weekType: 'playoffs' });
  return weeks;
}

function renderDialog() {
  const onOpenChange = vi.fn();
  const onApplied = vi.fn();
  renderWithProviders(
    <ChangeSeasonLengthDialog
      open
      onOpenChange={onOpenChange}
      seasonId="season-1"
      currentLength={16}
      weeks={buildWeeks()}
      onApplied={onApplied}
    />,
  );
  return { onOpenChange, onApplied };
}

describe('ChangeSeasonLengthDialog', () => {
  beforeEach(() => {
    mockApply.mockReset();
  });

  it('lengthen: review shows the added weeks and confirm applies the target', async () => {
    mockApply.mockResolvedValue({ success: true, newEndDate: '2026-11-11' });
    const { onApplied, onOpenChange } = renderDialog();
    const user = userEvent.setup();

    // 16 → 18 via the stepper.
    await user.click(screen.getByRole('button', { name: '+' }));
    await user.click(screen.getByRole('button', { name: '+' }));
    expect(screen.getByText('18')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Review' }));
    expect(screen.getByText(/Adds 2 weeks/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    // `user.click` awaits the click, NOT the async work the handler kicks off.
    // `onApplied` fires after the mocked apply resolves, so asserting
    // synchronously here races the microtask queue — which is exactly how this
    // file failed intermittently under parallel load on 2026-09-05.
    await waitFor(() => expect(onApplied).toHaveBeenCalled());
    expect(mockApply).toHaveBeenCalledWith('season-1', 18);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('shorten: review lists the removed weeks and confirm applies the target', async () => {
    mockApply.mockResolvedValue({ success: true, newEndDate: '2026-10-14' });
    const { onApplied } = renderDialog();
    const user = userEvent.setup();

    // 16 → 14.
    await user.click(screen.getByRole('button', { name: '−' }));
    await user.click(screen.getByRole('button', { name: '−' }));
    expect(screen.getByText('14')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Review' }));
    // The two removed tail weeks are listed.
    expect(screen.getByText(/Week 15/)).toBeInTheDocument();
    expect(screen.getByText(/Week 16/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    // Wait for the async apply to settle before asserting its effects.
    await waitFor(() => expect(onApplied).toHaveBeenCalled());
    expect(mockApply).toHaveBeenCalledWith('season-1', 14);
  });

  it('surfaces a guard/error from apply without closing', async () => {
    mockApply.mockResolvedValue({
      success: false,
      blockedWeekName: 'Week 16',
      error: "Can't shorten — Week 16 already has a match that's been played.",
    });
    const { onApplied, onOpenChange } = renderDialog();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: '−' }));
    await user.click(screen.getByRole('button', { name: 'Review' }));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    // The error only renders once the rejected-guard result comes back.
    await waitFor(() =>
      expect(
        screen.getByText(/already has a match that's been played/i)
      ).toBeInTheDocument()
    );
    // Checked AFTER the wait above: asserting "didn't happen" before the async
    // work has run would pass even if it were about to happen.
    expect(onApplied).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('disables Review when the length is unchanged', () => {
    renderDialog();
    expect(screen.getByRole('button', { name: 'Review' })).toBeDisabled();
  });
});
