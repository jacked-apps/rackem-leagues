/**
 * @fileoverview MemberCombobox Component
 *
 * Reusable combobox for searching and selecting members (players/captains).
 * Uses shadcn Command + Popover composition for autocomplete functionality.
 * Optionally allows creating placeholder players inline.
 */
import React, { useState } from 'react';
import { Check, ChevronsUpDown, X, UserPlus } from 'lucide-react';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import type { PartialMember } from '@/types/member';
import { getPlayerDisplayName, isPlaceholderMember } from '@/types/member';
import { logger } from '@/utils/logger';
import { CreatePlaceholderModal } from '@/components/CreatePlaceholderModal';
import { PlaceholderBadge } from '@/components/PlaceholderBadge';

interface MemberComboboxProps {
  /** List of members to choose from (only needs id, name, player number) */
  members: PartialMember[];
  /** Currently selected member ID */
  value: string;
  /** Called when selection changes */
  onValueChange: (memberId: string) => void;
  /** Placeholder text when no selection */
  placeholder?: string;
  /** Optional label for the combobox */
  label?: string;
  /** Disable the combobox */
  disabled?: boolean;
  /** Show clear button to remove selection */
  showClear?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Member IDs to exclude from dropdown (e.g., players already on other teams) */
  excludeIds?: string[];
  /** Show "Add Placeholder" button to create unregistered players */
  allowCreatePlaceholder?: boolean;
  /** Callback when a new placeholder is created - should refresh the members list */
  onPlaceholderCreated?: (member: PartialMember) => void;
  /** Optional team context — when provided, creating a placeholder with
   *  an email also fires send-invite for email delivery. Without this,
   *  the trigger-created invite_token is still saved and the recipient
   *  gets it via the dashboard pending-invites modal on next login. */
  teamId?: string;
  invitedByMemberId?: string;
  teamName?: string;
  captainName?: string;
  /** Prevent clearing placeholder members (used in captain mode) */
  preventClearPlaceholders?: boolean;
}

/**
 * MemberCombobox Component
 *
 * Searchable dropdown for selecting team members.
 * Shows member name and player number for easy identification.
 */
export const MemberCombobox: React.FC<MemberComboboxProps> = ({
  members,
  value,
  onValueChange,
  placeholder = 'Select member...',
  label,
  disabled = false,
  showClear = false,
  className = '',
  excludeIds = [],
  allowCreatePlaceholder = false,
  onPlaceholderCreated,
  teamId,
  invitedByMemberId,
  teamName,
  captainName,
  preventClearPlaceholders = false,
}) => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showPlaceholderModal, setShowPlaceholderModal] = useState(false);

  const selectedMember = members.find((member) => member.id === value);

  // Debug logging
  if (open && members.length === 0) {
    logger.warn('MemberCombobox opened but no members available');
  }

  // Filter out excluded IDs (players on other teams), then filter by search and sort
  const filteredMembers = (searchQuery
    ? members.filter((member) => {
        // Exclude members in excludeIds list (unless it's the currently selected value)
        if (excludeIds.includes(member.id) && member.id !== value) return false;
        const searchValue = getPlayerDisplayName(member).toLowerCase();
        return searchValue.includes(searchQuery.toLowerCase());
      })
    : members.filter((member) => !excludeIds.includes(member.id) || member.id === value)
  ).sort((a, b) => {
    // Sort by last name first
    const lastNameCompare = a.last_name.localeCompare(b.last_name);
    if (lastNameCompare !== 0) return lastNameCompare;
    // If last names are the same, sort by first name
    return a.first_name.localeCompare(b.first_name);
  });

  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-foreground mb-1">
          {label}
        </label>
      )}
      <div className="flex gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              role="combobox"
              aria-expanded={open}
              disabled={disabled}
              className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="truncate flex items-center gap-1.5">
                {selectedMember
                  ? (
                    <>
                      <span className="truncate">{getPlayerDisplayName(selectedMember)}</span>
                      {isPlaceholderMember(selectedMember) && <PlaceholderBadge size="sm" />}
                    </>
                  )
                  : placeholder}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </button>
          </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command shouldFilter={false}>
            {/* Search input - always at top with auto-focus */}
            <CommandInput
              placeholder="Search members..."
              className="h-9"
              value={searchQuery}
              onValueChange={setSearchQuery}
              autoFocus
            />

            {/* Add Placeholder Player button - prominent placement below search */}
            {allowCreatePlaceholder && (
              <div className="border-b px-2 py-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full justify-start text-info hover:text-info hover:bg-info/10"
                  onClick={() => {
                    setOpen(false);
                    setShowPlaceholderModal(true);
                  }}
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  Add Placeholder Player
                </Button>
              </div>
            )}

            {/* Filter Chips - future functionality */}
            <div className="flex gap-1 p-2 border-b">
              <button className="px-3 py-1 text-xs font-medium rounded-full bg-orange-500 text-white">
                All
              </button>
              <button className="px-3 py-1 text-xs font-medium rounded-full bg-muted text-foreground hover:bg-accent">
                My Org
              </button>
              <button className="px-3 py-1 text-xs font-medium rounded-full bg-muted text-foreground hover:bg-accent">
                State
              </button>
              <button className="px-3 py-1 text-xs font-medium rounded-full bg-muted text-foreground hover:bg-accent">
                Operators
              </button>
            </div>

            <CommandList>
              <CommandEmpty>No member found.</CommandEmpty>
              <CommandGroup>
                {members.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground">No members available</div>
                ) : (
                  filteredMembers.map((member) => (
                    <CommandItem
                      key={member.id}
                      value={member.id}
                      onSelect={() => {
                        onValueChange(member.id === value ? '' : member.id);
                        setSearchQuery('');
                        setOpen(false);
                      }}
                    >
                      <span className="flex items-center gap-1.5">
                        {getPlayerDisplayName(member)}
                        {isPlaceholderMember(member) && <PlaceholderBadge size="sm" />}
                      </span>
                      <Check
                        className={`ml-auto h-4 w-4 ${
                          member.id === value ? 'opacity-100' : 'opacity-0'
                        }`}
                      />
                    </CommandItem>
                  ))
                )}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {showClear && value && (() => {
        // Check if clearing is blocked for this placeholder member
        const isSelectedPlaceholder = isPlaceholderMember(selectedMember);
        const clearDisabled = disabled || (preventClearPlaceholders && isSelectedPlaceholder);

        return (
          <button
            type="button"
            onClick={() => !clearDisabled && onValueChange('')}
            disabled={clearDisabled}
            className="flex h-10 items-center justify-center px-3 rounded-md border border-input bg-background hover:bg-muted transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            title={clearDisabled && isSelectedPlaceholder
              ? "Placeholder players can only be removed by a league operator"
              : "Clear selection"}
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        );
      })()}
      </div>

      {/* Placeholder Creation Modal */}
      {allowCreatePlaceholder && (
        <CreatePlaceholderModal
          open={showPlaceholderModal}
          onOpenChange={setShowPlaceholderModal}
          teamId={teamId}
          invitedByMemberId={invitedByMemberId}
          teamName={teamName}
          captainName={captainName}
          onCreated={(newMember) => {
            // Call the callback so parent can refresh the members list
            if (onPlaceholderCreated) {
              onPlaceholderCreated({
                id: newMember.id,
                first_name: newMember.first_name,
                last_name: newMember.last_name,
                system_player_number: newMember.system_player_number,
                bca_member_number: null,
              });
            }
            // Auto-select the newly created member
            onValueChange(newMember.id);
          }}
        />
      )}
    </div>
  );
};
