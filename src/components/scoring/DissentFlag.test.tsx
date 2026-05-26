/**
 * @fileoverview Render tests for the dissent flag (many-eyes Unit 5).
 *
 * Light-touch — the component is intentionally tiny (a styled Alert with three
 * text slots). We pin the visible-text shape so a copy or structure regression
 * is caught, but don't reach into the shadcn Alert internals.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DissentFlag } from './DissentFlag';

describe('<DissentFlag />', () => {
  it('shows the game number and dissenter name in the title', () => {
    render(
      <DissentFlag
        gameNumber={3}
        dissenterName="Jack"
        agreeingConfirmerNames={['A', 'B', 'C']}
      />
    );
    // Title is one line; partial match is enough to pin shape without locking copy.
    expect(screen.getByText(/Game 3/)).toBeInTheDocument();
    expect(screen.getByText(/Jack/)).toBeInTheDocument();
  });

  it('lists agreeing confirmer names when present', () => {
    render(
      <DissentFlag
        gameNumber={1}
        dissenterName="Jack"
        agreeingConfirmerNames={['Alice', 'Bob', 'Cara']}
      />
    );
    expect(screen.getByText(/Alice, Bob, Cara/)).toBeInTheDocument();
  });

  it('omits the agree line when there are no agreeing confirmers', () => {
    const { container } = render(
      <DissentFlag
        gameNumber={5}
        dissenterName="Jack"
        agreeingConfirmerNames={[]}
      />
    );
    // No "Also confirmed by" line — only the dissenter title + the call-to-action.
    expect(container.textContent).not.toMatch(/confirmed by/i);
  });

  it('renders the call-to-action so the prompt is conversational, not adjudicative', () => {
    render(
      <DissentFlag
        gameNumber={2}
        dissenterName="Jack"
        agreeingConfirmerNames={[]}
      />
    );
    // Pins the "talk it over / vacate-and-rescore" tone without locking exact wording.
    expect(screen.getByText(/vacate/i)).toBeInTheDocument();
  });
});
