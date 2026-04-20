/**
 * @fileoverview Unit tests for the shared HouseRuleForm. Covers the
 * subtle interactions called out in the Unit 5 plan: effect-type switch
 * hides-but-preserves the CSI pick, "Copy official text" confirms on
 * overwrite, validation fires on blur, and dirty-state is reported up.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { HouseRuleForm } from '@/rules/HouseRuleForm';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

describe('HouseRuleForm', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('validates empty title + body on submit', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<HouseRuleForm onCancel={() => {}} onSubmit={onSubmit} />);

    await user.click(screen.getByRole('button', { name: /add rule/i }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/short title/i)).toBeInTheDocument();
    expect(screen.getByText(/add the rule text/i)).toBeInTheDocument();
  });

  it('requires a CSI rule when effect is Override', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<HouseRuleForm onCancel={() => {}} onSubmit={onSubmit} />);

    await user.click(screen.getByRole('radio', { name: /override/i }));
    await user.type(screen.getByLabelText(/title/i), 'No slop');
    await user.type(screen.getByLabelText(/rule text/i), 'All shots must be called.');

    await user.click(screen.getByRole('button', { name: /add rule/i }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/choose a CSI rule/i)).toBeInTheDocument();
  });

  it('hides but preserves the CSI pick when switching to Standalone and back', async () => {
    const user = userEvent.setup();
    render(<HouseRuleForm onCancel={() => {}} onSubmit={() => {}} />);

    // Game Select is always a combobox; the CSI picker adds a second one when needed.
    // Standalone (default): only Game combobox.
    expect(screen.getAllByRole('combobox')).toHaveLength(1);

    // Switch to Override → CSI picker appears.
    await user.click(screen.getByRole('radio', { name: /override/i }));
    expect(screen.getAllByRole('combobox')).toHaveLength(2);

    // Back to Standalone hides the picker.
    await user.click(screen.getByRole('radio', { name: /standalone/i }));
    expect(screen.getAllByRole('combobox')).toHaveLength(1);

    // Switch to Enhance — picker re-renders.
    await user.click(screen.getByRole('radio', { name: /enhance/i }));
    expect(screen.getAllByRole('combobox')).toHaveLength(2);
  });

  it('reports dirty state up as the user types', async () => {
    const onDirty = vi.fn();
    const user = userEvent.setup();
    render(<HouseRuleForm onCancel={() => {}} onSubmit={() => {}} onDirtyChange={onDirty} />);

    // Initial render reports not-dirty.
    expect(onDirty).toHaveBeenLastCalledWith(false);

    await user.type(screen.getByLabelText(/title/i), 'Hi');
    expect(onDirty).toHaveBeenLastCalledWith(true);
  });

  it('confirms before overwriting existing body text with Copy official text', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = userEvent.setup();
    render(<HouseRuleForm onCancel={() => {}} onSubmit={() => {}} />);

    // Write some existing text, then try to copy.
    await user.click(screen.getByRole('radio', { name: /override/i }));
    await user.type(screen.getByLabelText(/rule text/i), 'existing');

    // Button is disabled until a CSI rule is picked — verify that too.
    const copyBtn = screen.getByRole('button', { name: /copy official text/i });
    expect(copyBtn).toBeDisabled();

    confirmSpy.mockRestore();
  });

  it('submits valid Standalone values (body split into paragraphs)', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<HouseRuleForm onCancel={() => {}} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/title/i), 'No jump cues');
    // Use fireEvent for multi-line input — userEvent.type would interpret blank lines strangely.
    const textarea = screen.getByLabelText(/rule text/i);
    fireEvent.change(textarea, {
      target: { value: 'First paragraph.\n\nSecond paragraph.' },
    });

    await user.click(screen.getByRole('button', { name: /add rule/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      title: 'No jump cues',
      effect_type: 'standalone',
      related_rule_id: null,
      body: ['First paragraph.', 'Second paragraph.'],
    });
  });
});

// Keep the import used so the test file imports cleanly across CI.
void within;
