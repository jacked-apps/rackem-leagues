/**
 * @fileoverview Tests for NameLinkTrigger, the tappable name shared by
 * PlayerNameLink and TeamNameLink.
 */

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { NameLinkTrigger } from './NameLinkTrigger';

describe('NameLinkTrigger', () => {
  it('is a non-submitting button that keeps caller classes', () => {
    render(<NameLinkTrigger className="text-sm">Ben</NameLinkTrigger>);
    const btn = screen.getByRole('button', { name: 'Ben' });
    // type="button" so a name inside a form never submits it.
    expect(btn).toHaveAttribute('type', 'button');
    expect(btn.className).toContain('text-sm');
    expect(btn.className).toContain('text-info');
  });

  it('works as a PopoverTrigger asChild child (opens the popover)', () => {
    render(
      <Popover>
        <PopoverTrigger asChild>
          <NameLinkTrigger>Sharks</NameLinkTrigger>
        </PopoverTrigger>
        <PopoverContent>Roster here</PopoverContent>
      </Popover>
    );
    expect(screen.queryByText('Roster here')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sharks' }));
    expect(screen.getByText('Roster here')).toBeInTheDocument();
  });
});
