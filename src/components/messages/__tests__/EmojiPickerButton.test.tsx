/**
 * @fileoverview Tests for the Unit 13 emoji picker.
 *
 * Pins the contract: tap the trigger → grid opens with all 12 curated
 * emojis from `EMOJI_SET`, tap an emoji → `onPick(emoji)` fires with
 * that exact character AND the popover closes.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent } from '@/test/utils';
import { EmojiPickerButton } from '../EmojiPickerButton';
import { EMOJI_SET } from '../emojiSet';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('EmojiPickerButton', () => {
  it('renders the trigger and starts closed', () => {
    renderWithProviders(<EmojiPickerButton onPick={vi.fn()} />);
    expect(screen.getByTestId('emoji-picker-trigger')).toBeInTheDocument();
    // Content shouldn't be in the DOM when closed.
    expect(screen.queryByTestId('emoji-picker-content')).not.toBeInTheDocument();
  });

  it('opens the popover and shows all 12 curated emojis when triggered', async () => {
    const user = userEvent.setup();
    renderWithProviders(<EmojiPickerButton onPick={vi.fn()} />);

    await user.click(screen.getByTestId('emoji-picker-trigger'));

    expect(await screen.findByTestId('emoji-picker-content')).toBeInTheDocument();
    for (const emoji of EMOJI_SET) {
      expect(screen.getByTestId(`emoji-pick-${emoji}`)).toBeInTheDocument();
    }
  });

  it('calls onPick with the tapped emoji and closes the popover', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    renderWithProviders(<EmojiPickerButton onPick={onPick} />);

    await user.click(screen.getByTestId('emoji-picker-trigger'));
    await user.click(await screen.findByTestId('emoji-pick-🎱'));

    expect(onPick).toHaveBeenCalledWith('🎱');
    expect(onPick).toHaveBeenCalledTimes(1);
    // Popover should close after picking.
    expect(screen.queryByTestId('emoji-picker-content')).not.toBeInTheDocument();
  });

  it('is disabled when the disabled prop is set', () => {
    renderWithProviders(<EmojiPickerButton onPick={vi.fn()} disabled />);
    expect(screen.getByTestId('emoji-picker-trigger')).toBeDisabled();
  });
});
