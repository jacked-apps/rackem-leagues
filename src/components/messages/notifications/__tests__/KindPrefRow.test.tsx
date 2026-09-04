/**
 * @fileoverview Tests for a single conversation kind's notification default.
 *
 * The behaviour worth pinning is the DM rule: direct messages get no interval
 * control at all — not a disabled one — because a control that never becomes
 * usable sends people hunting for whatever unlocks it.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { KindPrefRow } from '../KindPrefRow';
import { kindDisplay } from '../notificationKinds';

const DIRECT = kindDisplay('direct')!;
const TEAM = kindDisplay('team_chat')!;

describe('KindPrefRow', () => {
  it('shows no interval control for direct messages', () => {
    render(
      <KindPrefRow
        kind={DIRECT}
        pushEnabled
        intervalMinutes={null}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByTestId('kind-switch-direct')).toBeInTheDocument();
    // Absent, not disabled — DMs always buzz, so there is nothing to choose.
    expect(screen.queryByTestId('kind-interval-direct')).not.toBeInTheDocument();
  });

  it('shows an interval control for a group kind', () => {
    render(
      <KindPrefRow kind={TEAM} pushEnabled intervalMinutes={5} onChange={vi.fn()} />
    );

    expect(screen.getByTestId('kind-interval-team_chat')).toBeInTheDocument();
  });

  it('hides the interval while the kind is switched off', () => {
    // A timing choice underneath an off switch is noise — it can't do anything.
    render(
      <KindPrefRow
        kind={TEAM}
        pushEnabled={false}
        intervalMinutes={5}
        onChange={vi.fn()}
      />
    );

    expect(screen.queryByTestId('kind-interval-team_chat')).not.toBeInTheDocument();
  });

  it('preserves the interval when toggling the kind off', () => {
    // Turning a kind off then back on shouldn't silently reset the member's
    // chosen timing.
    const onChange = vi.fn();
    render(
      <KindPrefRow kind={TEAM} pushEnabled intervalMinutes={30} onChange={onChange} />
    );

    fireEvent.click(screen.getByTestId('kind-switch-team_chat'));

    expect(onChange).toHaveBeenCalledWith(false, 30);
  });

  it('reports the kind label in the switch accessible name', () => {
    render(
      <KindPrefRow kind={TEAM} pushEnabled intervalMinutes={5} onChange={vi.fn()} />
    );

    expect(
      screen.getByRole('switch', { name: /team chats notifications on/i })
    ).toBeInTheDocument();
  });
});
