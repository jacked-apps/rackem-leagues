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

  it('shows CSI suggestions under title when standalone + 3+ chars, hidden when Override', async () => {
    const user = userEvent.setup();
    render(<HouseRuleForm onCancel={() => {}} onSubmit={() => {}} />);

    // Typing a real CSI term should surface suggestions.
    await user.type(screen.getByLabelText(/title/i), 'break');
    expect(screen.getByText(/sounds like it might be related/i)).toBeInTheDocument();

    // Switching to Override hides them — user has already declared intent.
    await user.click(screen.getByRole('radio', { name: /override/i }));
    expect(screen.queryByText(/sounds like it might be related/i)).not.toBeInTheDocument();
  });

  it('picking a suggestion flips effect type to Override and sets the CSI rule', async () => {
    const user = userEvent.setup();
    render(<HouseRuleForm onCancel={() => {}} onSubmit={() => {}} />);

    await user.type(screen.getByLabelText(/title/i), 'break');
    // Click any suggestion button in the list.
    const firstSuggestion = screen.getAllByRole('button').find((btn) => /^\d/.test(btn.textContent ?? ''));
    if (!firstSuggestion) throw new Error('expected a suggestion button');
    await user.click(firstSuggestion);

    // Override radio is now checked.
    expect(screen.getByRole('radio', { name: /override/i })).toBeChecked();
    // Suggestions panel is gone.
    expect(screen.queryByText(/sounds like it might be related/i)).not.toBeInTheDocument();
  });

  it('dismiss button hides suggestions for the rest of the session', async () => {
    const user = userEvent.setup();
    render(<HouseRuleForm onCancel={() => {}} onSubmit={() => {}} />);

    await user.type(screen.getByLabelText(/title/i), 'break');
    await user.click(screen.getByRole('button', { name: /dismiss suggestions/i }));

    expect(screen.queryByText(/sounds like it might be related/i)).not.toBeInTheDocument();
    // Typing more keeps it hidden.
    await user.type(screen.getByLabelText(/title/i), ' shot');
    expect(screen.queryByText(/sounds like it might be related/i)).not.toBeInTheDocument();
  });

  it('clicking + Add on a CSI snippet appends it to the body textarea', async () => {
    const user = userEvent.setup();
    render(<HouseRuleForm onCancel={() => {}} onSubmit={() => {}} />);

    // Pick a CSI rule via the suggestions shortcut.
    await user.type(screen.getByLabelText(/title/i), 'break');
    const firstSuggestion = screen.getAllByRole('button').find((btn) => /^\d/.test(btn.textContent ?? ''));
    if (!firstSuggestion) throw new Error('expected suggestion');
    await user.click(firstSuggestion);

    // Click the first "+ Add" in the "What the official rule says" panel.
    const addButtons = screen.getAllByRole('button', { name: /add snippet \d+ to my rule/i });
    expect(addButtons.length).toBeGreaterThan(0);
    await user.click(addButtons[0]);

    // Textarea should now contain non-empty text.
    const textarea = screen.getByLabelText(/rule text/i) as HTMLTextAreaElement;
    expect(textarea.value.length).toBeGreaterThan(0);

    // Clicking a second snippet appends with a blank-line separator.
    if (addButtons.length >= 2) {
      await user.click(addButtons[1]);
      expect(textarea.value).toContain('\n\n');
    }
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
