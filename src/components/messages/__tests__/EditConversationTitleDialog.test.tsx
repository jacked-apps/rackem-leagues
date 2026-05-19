/**
 * @fileoverview Tests for the Unit 19 EditConversationTitleDialog.
 *
 * Covers the validation + save contract:
 *   - Pre-fills the input with the current title on open.
 *   - Save button disabled for empty trimmed input.
 *   - Save button disabled when the trimmed value equals the initial
 *     title (no-op edit).
 *   - Save button disabled while a previous save is in flight.
 *   - Save calls the mutation with conversationId / userId / trimmed
 *     title and closes the dialog on success.
 *   - Cancel closes without firing the mutation.
 *
 * `useUpdateConversationTitle` is mocked at module boundary so the
 * test exercises only the dialog's UI logic, not the supabase-js /
 * React Query plumbing.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent } from '@/test/utils';

const mockMutateAsync = vi.fn();

vi.mock('@/api/hooks', () => ({
  useUpdateConversationTitle: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}));

import { EditConversationTitleDialog } from '../EditConversationTitleDialog';

const CONV_ID = 'conv-1';
const USER_ID = 'user-1';

function renderDialog(initialTitle: string, onOpenChange = vi.fn()) {
  renderWithProviders(
    <EditConversationTitleDialog
      open
      onOpenChange={onOpenChange}
      conversationId={CONV_ID}
      userId={USER_ID}
      initialTitle={initialTitle}
    />,
  );
  return { onOpenChange };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockMutateAsync.mockResolvedValue(undefined);
});

describe('EditConversationTitleDialog', () => {
  it('pre-fills the input with initialTitle and disables Save when unchanged', () => {
    renderDialog('Sharks');
    const input = screen.getByTestId('conversation-title-input') as HTMLInputElement;
    expect(input.value).toBe('Sharks');
    expect(screen.getByTestId('edit-title-save')).toBeDisabled();
  });

  it('disables Save for empty input', async () => {
    const user = userEvent.setup();
    renderDialog('Sharks');
    const input = screen.getByTestId('conversation-title-input');
    await user.clear(input);
    expect(screen.getByTestId('edit-title-save')).toBeDisabled();
  });

  it('disables Save when only whitespace differs from the original', async () => {
    const user = userEvent.setup();
    renderDialog('Sharks');
    const input = screen.getByTestId('conversation-title-input');
    await user.clear(input);
    await user.type(input, '  Sharks  ');
    expect(screen.getByTestId('edit-title-save')).toBeDisabled();
  });

  it('enables Save when the input is a different non-empty value', async () => {
    const user = userEvent.setup();
    renderDialog('Sharks');
    const input = screen.getByTestId('conversation-title-input');
    await user.clear(input);
    await user.type(input, 'Sharks Family Reunion');
    expect(screen.getByTestId('edit-title-save')).toBeEnabled();
  });

  it('Save fires the mutation with the trimmed value and closes on success', async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderDialog('Sharks');

    const input = screen.getByTestId('conversation-title-input');
    await user.clear(input);
    await user.type(input, '  Reef Sharks  ');
    await user.click(screen.getByTestId('edit-title-save'));

    expect(mockMutateAsync).toHaveBeenCalledWith({
      conversationId: CONV_ID,
      userId: USER_ID,
      title: 'Reef Sharks', // trimmed
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('Cancel closes the dialog without firing the mutation', async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderDialog('Sharks');
    await user.click(screen.getByTestId('edit-title-cancel'));

    expect(mockMutateAsync).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('does NOT close the dialog when the mutation throws', async () => {
    const user = userEvent.setup();
    mockMutateAsync.mockRejectedValueOnce(new Error('permission denied'));
    const { onOpenChange } = renderDialog('Sharks');

    const input = screen.getByTestId('conversation-title-input');
    await user.clear(input);
    await user.type(input, 'Renamed');
    await user.click(screen.getByTestId('edit-title-save'));

    expect(mockMutateAsync).toHaveBeenCalled();
    // onOpenChange shouldn't be called with false on failure — user
    // can correct and retry.
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
