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
    expected_handicap_type: 'points',
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
    expect(saved.expected_handicap_type).toBe('points'); // declared input
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

  it('edits an embedded chart cell and saves the tweaked rows (chart view)', async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    const chartRow = makeRow({
      expansion_mode: 'home_away',
      definition: {
        operationKind: 'chart_lookup',
        operationArgs: {
          output_field: 'result_1',
          chart: {
            chartType: 'team_points',
            lookupMode: 'exact',
            rows: [{ comp_1: 0, comp_2: null, result_1: 10, result_2: 9, result_3: 8 }],
          },
        },
      },
    });
    render(<ThresholdEditor initial={chartRow} onSave={onSave} onCancel={() => {}} />);

    // Team chart, one row → 4 numeric cells: comp_1, win(result_1), tie, lose.
    const cells = screen.getAllByRole('spinbutton');
    fireEvent.change(cells[1], { target: { value: '12' } }); // win column

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const saved = onSave.mock.calls[0][0] as ThresholdRoomRow;
    const chart = saved.definition.operationArgs.chart as { rows: Array<{ result_1: number }> };
    expect(chart.rows[0].result_1).toBe(12);
  });

  it('shows a read-only built-in view for a dedicated-math threshold and preserves its definition', async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    const builtinRow = makeRow({
      expansion_mode: 'single',
      definition: { operationKind: 'read_pref', operationArgs: { pref_key: 'games_to_win' } },
    });
    render(<ThresholdEditor initial={builtinRow} onSave={onSave} onCancel={() => {}} />);

    // Built-in panel shown; no formula/chart toggle.
    expect(screen.getByText('Built-in calculation')).toBeTruthy();
    expect(screen.queryByText('How is the number figured out?')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const saved = onSave.mock.calls[0][0] as ThresholdRoomRow;
    expect(saved.definition.operationKind).toBe('read_pref');
    expect(saved.definition.operationArgs).toEqual({ pref_key: 'games_to_win' });
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
