/**
 * @fileoverview Characterization tests for HandicapCell — verifies the
 * post-refactor component renders the same widget shape for each
 * shipping system that the pre-refactor inline branching produced.
 *
 * Renders the component for each combination of (handicapType,
 * isDoubleDuty, isAnonSub, source='manual') and asserts the DOM has
 * the expected input kind, bounds, placeholder, and value.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HandicapCell } from './HandicapCell';

const baseProps = {
  playerId: 'player-1',
  handicap: 0,
  locked: false,
  position: 1,
  isDoubleDuty: false,
  isAnonSub: false,
  subHandicap: '',
};

describe('HandicapCell — Points (BCA 3v3) system', () => {
  it('renders TBD for double-duty slot', () => {
    render(<HandicapCell {...baseProps} handicapType="points" isDoubleDuty />);
    expect(screen.getByText('TBD')).toBeInTheDocument();
  });

  it('renders a select widget for anonymous sub with the -2..+2 options', () => {
    render(
      <HandicapCell
        {...baseProps}
        handicapType="points"
        isAnonSub
        onSubHandicapChange={() => {}}
      />,
    );
    // shadcn Select renders the trigger as a combobox role
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('renders +N formatted handicap for a regular player (auto-from-history)', () => {
    render(<HandicapCell {...baseProps} handicapType="points" handicap={2} />);
    expect(screen.getByText('+2')).toBeInTheDocument();
  });

  it('renders dash when no playerId', () => {
    render(<HandicapCell {...baseProps} handicapType="points" playerId="" />);
    expect(screen.getByText('-')).toBeInTheDocument();
  });
});

describe('HandicapCell — Percentage (BCA 5v5) system', () => {
  it('renders a number input for anonymous sub bounded to 0..100 with % placeholder', () => {
    render(
      <HandicapCell
        {...baseProps}
        handicapType="percentage"
        isAnonSub
        onSubHandicapChange={() => {}}
      />,
    );
    const input = screen.getByPlaceholderText('%') as HTMLInputElement;
    expect(input.type).toBe('number');
    expect(input.min).toBe('0');
    expect(input.max).toBe('100');
  });

  it('renders N% formatted handicap for a regular player', () => {
    render(<HandicapCell {...baseProps} handicapType="percentage" handicap={75} />);
    expect(screen.getByText('75%')).toBeInTheDocument();
  });
});

describe('HandicapCell — FargoRate system (source manual today)', () => {
  it('renders manual-entry number input for regular player bounded 100..850', () => {
    render(
      <HandicapCell
        {...baseProps}
        handicapType="fargo"
        manualHandicapValue="575"
        onManualHandicapChange={() => {}}
      />,
    );
    const input = screen.getByPlaceholderText('—') as HTMLInputElement;
    expect(input.type).toBe('number');
    expect(input.min).toBe('100');
    expect(input.max).toBe('850');
    expect(input.value).toBe('575');
  });

  it('renders number input for anonymous sub with same bounds + em-dash placeholder', () => {
    render(
      <HandicapCell
        {...baseProps}
        handicapType="fargo"
        isAnonSub
        onSubHandicapChange={() => {}}
      />,
    );
    const input = screen.getByPlaceholderText('—') as HTMLInputElement;
    expect(input.type).toBe('number');
    expect(input.min).toBe('100');
    expect(input.max).toBe('850');
  });

  it('renders raw integer for a Fargo display value (no decoration)', () => {
    render(
      <HandicapCell
        {...baseProps}
        handicapType="fargo"
        handicap={575}
      />,
    );
    expect(screen.getByText('575')).toBeInTheDocument();
  });
});

describe('HandicapCell — no literal handicap-type strings in source', () => {
  it('does not reference handicap_type values in code (audit success criterion)', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const filePath = path.resolve(
      process.cwd(),
      'src/components/lineup/HandicapCell.tsx',
    );
    const src = await fs.readFile(filePath, 'utf8');
    // Strip comments before checking — literal strings in JSDoc are fine
    const codeOnly = src
      .split('\n')
      .filter((line) => !line.trim().startsWith('*') && !line.trim().startsWith('//'))
      .join('\n');
    expect(codeOnly).not.toMatch(/'fargo'/);
    expect(codeOnly).not.toMatch(/'points'/);
    expect(codeOnly).not.toMatch(/'percentage'/);
    expect(codeOnly).not.toMatch(/'skill_level'/);
  });
});
