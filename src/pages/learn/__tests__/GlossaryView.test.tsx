/**
 * @fileoverview Unit 6 tests — GlossaryView's 3-state search UI and the
 * alias-match subtitle. Deep-link hash behavior is exercised manually in
 * the dev smoke walk; jsdom hash + scrollIntoView mocking adds noise
 * without catching real bugs.
 */

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { GlossaryView } from '../GlossaryView';

describe('GlossaryView', () => {
  it('renders the search input', () => {
    render(<GlossaryView />);
    expect(screen.getByLabelText(/search glossary/i)).toBeInTheDocument();
  });

  it('empty query shows the alphabetical browse (multiple letter headers)', () => {
    render(<GlossaryView />);
    // Letter group headings are rendered with role=heading level=2.
    // We expect at least F (FargoRate) and L (League).
    expect(screen.getByRole('heading', { level: 2, name: 'F' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'L' })).toBeInTheDocument();
  });

  it('shows the FargoRate entry in the empty-query browse', () => {
    render(<GlossaryView />);
    expect(screen.getByRole('heading', { level: 3, name: 'FargoRate' }))
      .toBeInTheDocument();
  });

  it('filters to a single entry when the query matches one canonical name', () => {
    render(<GlossaryView />);
    fireEvent.change(screen.getByLabelText(/search glossary/i), {
      target: { value: 'FargoRate' },
    });
    expect(screen.getByRole('heading', { level: 3, name: 'FargoRate' }))
      .toBeInTheDocument();
    // Browse-mode letter headings should be hidden.
    expect(screen.queryByRole('heading', { level: 2, name: 'L' }))
      .not.toBeInTheDocument();
  });

  it('renders the alias arrow subtitle when matching via an alias', () => {
    render(<GlossaryView />);
    fireEvent.change(screen.getByLabelText(/search glossary/i), {
      target: { value: 'fargo rating' },
    });
    // "fargo rating" appears twice — once in the alias-arrow subtitle and
    // once in the entry's "also called" line — both are correct.
    expect(screen.getAllByText(/fargo rating/i).length).toBeGreaterThanOrEqual(1);
    // The arrow specifically only renders for alias matches.
    expect(screen.getByText(/→/)).toBeInTheDocument();
  });

  it('shows the no-results message + browse list when nothing matches', () => {
    render(<GlossaryView />);
    fireEvent.change(screen.getByLabelText(/search glossary/i), {
      target: { value: 'totally-not-a-real-glossary-term' },
    });
    expect(
      screen.getByText(/no glossary terms match/i),
    ).toBeInTheDocument();
    // Browse list still visible underneath.
    expect(screen.getByRole('heading', { level: 2, name: 'F' }))
      .toBeInTheDocument();
  });
});
