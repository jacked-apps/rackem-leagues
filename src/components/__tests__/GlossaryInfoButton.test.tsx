/**
 * @fileoverview Unit 2 tests — GlossaryInfoButton wrapper.
 *
 * Covers the happy path (renders entry, popover shows shortDef +
 * Learn-more link), prop pass-through, and click-propagation guard
 * (the bug R-INFRA1 was built to prevent).
 *
 * Unknown-slug paths aren't tested via type-cast bypass here — the
 * compile-time slug union is the primary defense; the runtime fallback
 * is a safety net that should never fire in normal use.
 *
 * @see docs/plans/2026-05-28-001-feat-operator-help-system-phase-1-plan.md
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { GlossaryInfoButton } from '../GlossaryInfoButton';

describe('GlossaryInfoButton', () => {
  it('renders the popover trigger', () => {
    render(<GlossaryInfoButton slug="fargorate" />);
    // The trigger is the "?" button rendered by the underlying InfoButton.
    expect(screen.getByTitle('More information'))
      .toBeInTheDocument();
  });

  it('opens the popover with the entry canonical name and shortDef on click', () => {
    render(<GlossaryInfoButton slug="fargorate" />);
    fireEvent.click(screen.getByTitle('More information'));

    expect(screen.getByText('FargoRate')).toBeInTheDocument();
    expect(
      screen.getByText(/national pool skill rating maintained by FargoRate/i),
    ).toBeInTheDocument();
  });

  it('renders a "Learn more →" link to the operator-learn deep anchor in a new tab', () => {
    render(<GlossaryInfoButton slug="fargorate" />);
    fireEvent.click(screen.getByTitle('More information'));

    const learnMore = screen.getByRole('link', { name: /learn more/i });
    expect(learnMore).toHaveAttribute('href', '/learn#fargorate');
    expect(learnMore).toHaveAttribute('target', '_blank');
    expect(learnMore).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('passes label through to the underlying InfoButton', () => {
    render(<GlossaryInfoButton slug="fargorate" label="Skill rating" />);
    expect(screen.getByText('Skill rating')).toBeInTheDocument();
  });

  it('prevents trigger clicks from bubbling to a parent button', () => {
    const parentClick = vi.fn();
    render(
      <button type="button" onClick={parentClick}>
        <GlossaryInfoButton slug="fargorate" />
      </button>,
    );

    fireEvent.click(screen.getByTitle('More information'));
    expect(parentClick).not.toHaveBeenCalled();
  });

  it('prevents "Learn more →" clicks from bubbling to a parent button', () => {
    const parentClick = vi.fn();
    render(
      <button type="button" onClick={parentClick}>
        <GlossaryInfoButton slug="fargorate" />
      </button>,
    );

    fireEvent.click(screen.getByTitle('More information'));
    fireEvent.click(screen.getByRole('link', { name: /learn more/i }));
    expect(parentClick).not.toHaveBeenCalled();
  });

  it('resolves an aliased canonical name (entry lookup is by slug, aliases are search-only)', () => {
    // Sanity check that slug → canonical works directly; aliases live in
    // searchGlossary, not getGlossaryEntry.
    render(<GlossaryInfoButton slug="handicap" />);
    fireEvent.click(screen.getByTitle('More information'));
    expect(screen.getByText('Handicap')).toBeInTheDocument();
  });
});
