/**
 * @fileoverview Tests for the threshold editor (formula view). Verifies it
 * emits an `evaluate_expression` definition on save and blocks an empty name.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThresholdEditor } from '../ThresholdEditor';
import type { ThresholdRoomRow } from '../useThresholdRoom';

function makeRow(overrides: Partial<ThresholdRoomRow> = {}): ThresholdRoomRow {
  return {
    id: 't1',
    name: 'threshold_x',
    label: 'My threshold',
    description: null,
    scope: 'user',
    author_id: 'm1',
    definition: {
      operationKind: 'evaluate_expression',
      operationArgs: { expression: { kind: 'const', value: 5 } },
    },
    expansion_mode: 'single',
    ...overrides,
  };
}

describe('ThresholdEditor', () => {
  it('saves an evaluate_expression definition built from the formula tokens', async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    render(<ThresholdEditor initial={makeRow()} onSave={onSave} onCancel={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const saved = onSave.mock.calls[0][0] as ThresholdRoomRow;
    expect(saved.label).toBe('My threshold');
    expect(saved.expansion_mode).toBe('single');
    expect(saved.definition.operationKind).toBe('evaluate_expression');
    expect(saved.definition.operationArgs.expression).toEqual({ kind: 'const', value: 5 });
  });

  it('blocks save when the name is empty', async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    render(<ThresholdEditor initial={makeRow()} onSave={onSave} onCancel={() => {}} />);

    const nameInput = screen.getByPlaceholderText('e.g. Finish line');
    fireEvent.change(nameInput, { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.getByText(/give your threshold a name/i)).toBeTruthy());
    expect(onSave).not.toHaveBeenCalled();
  });

  it('preserves the generic key while editing the display label', async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    render(<ThresholdEditor initial={makeRow()} onSave={onSave} onCancel={() => {}} />);

    fireEvent.change(screen.getByPlaceholderText('e.g. Finish line'), {
      target: { value: 'Renamed' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const saved = onSave.mock.calls[0][0] as ThresholdRoomRow;
    expect(saved.label).toBe('Renamed');
    expect(saved.name).toBe('threshold_x'); // generic key unchanged
  });
});
