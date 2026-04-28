/**
 * @fileoverview MemberSearchCombobox Component
 *
 * Server-side search combobox for selecting members.
 * Scales to large datasets by searching on the server instead of loading all members.
 * Includes filter chips for All/My Org/State/Staff.
 */
import React, { useState } from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';
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
import { useMemberSearch, type MemberSearchFilter } from '@/api/hooks';
import type { PartialMember } from '@/types/member';
import { getPlayerDisplayName, isPlaceholderMember } from '@/types/member';
import { PlaceholderBadge } from '@/components/PlaceholderBadge';

interface MemberSearchComboboxProps {
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
  /** Member IDs to exclude from dropdown */
  excludeIds?: string[];
  /** Current user's organization ID (for 'my_org' filter) */
  organizationId?: string | null;
  /** Current user's state (for 'state' filter) */
  userState?: string | null;
  /** Default filter to show */
  defaultFilter?: MemberSearchFilter;
}

/**
 * MemberSearchCombobox Component
 *
 * Server-side searchable dropdown for selecting members.
 * Includes filter chips to search: All, My Org, State, or Staff.
 * Only loads top 50 matches - scales to large datasets.
 */
export const MemberSearchCombobox: React.FC<MemberSearchComboboxProps> = ({
  value,
  onValueChange,
  placeholder = 'Select member...',
  label,
  disabled = false,
  showClear = false,
  className = '',
  excludeIds = [],
  organizationId = null,
  userState = null,
  defaultFilter = 'state',
}) => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<MemberSearchFilter>(defaultFilter);
  const [cachedSelectedMember, setCachedSelectedMember] = useState<PartialMember | null>(null);

  // Server-side search
  const { data: searchResults = [], isLoading } = useMemberSearch(
    searchQuery,
    activeFilter,
    organizationId,
    userState,
    open // Only search when dropdown is open
  );

  // Filter out excluded IDs (completely remove them from results)
  const filteredMembers = searchResults.filter(
    (member) => !excludeIds.includes(member.id)
  );

  // Find selected member (look in search results, or use cached member)
  const selectedMemberFromResults = searchResults.find((member) => member.id === value);
  const selectedMember = selectedMemberFromResults || cachedSelectedMember;

  const filterButtons: Array<{ id: MemberSearchFilter; label: string }> = [
    { id: 'my_org', label: 'My Org' },
    { id: 'state', label: 'State' },
    { id: 'staff', label: 'Staff' },
    { id: 'all', label: 'All' },
  ];

  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
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
                {selectedMember ? (
                  <>
                    <span className="truncate">{getPlayerDisplayName(selectedMember)}</span>
                    {isPlaceholderMember(selectedMember) && <PlaceholderBadge size="sm" />}
                  </>
                ) : placeholder}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-[400px] p-0" align="start">
            <Command shouldFilter={false}>
              {/* Filter Chips */}
              <div className="flex gap-1 p-2 border-b">
                {filterButtons.map((filter) => (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() => setActiveFilter(filter.id)}
                    className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                      activeFilter === filter.id
                        ? 'bg-orange-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>

              <CommandInput
                placeholder="Search by name or player #..."
                className="h-9"
                value={searchQuery}
                onValueChange={setSearchQuery}
              />
              <CommandList>
                {isLoading ? (
                  <div className="p-4 text-sm text-gray-500 text-center">Searching...</div>
                ) : (
                  <>
                    <CommandEmpty>
                      {searchQuery.trim()
                        ? 'No members found.'
                        : 'Start typing to search...'}
                    </CommandEmpty>
                    <CommandGroup>
                      {filteredMembers.map((member) => {
                        const displayName = getPlayerDisplayName(member);
                        return (
                          <CommandItem
                            key={member.id}
                            value={displayName}
                            onSelect={() => {
                              // Cache the selected member before closing dropdown
                              setCachedSelectedMember(member);
                              onValueChange(member.id === value ? '' : member.id);
                              setSearchQuery('');
                              setOpen(false);
                            }}
                          >
                            <span className="flex items-center gap-1.5">
                              {displayName}
                              {isPlaceholderMember(member) && <PlaceholderBadge size="sm" />}
                            </span>
                            <Check
                              className={`ml-auto h-4 w-4 ${
                                member.id === value ? 'opacity-100' : 'opacity-0'
                              }`}
                            />
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {showClear && value && (
          <button
            type="button"
            onClick={() => onValueChange('')}
            disabled={disabled}
            className="flex h-10 items-center justify-center px-3 rounded-md border border-input bg-background hover:bg-gray-100 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            title="Clear selection"
          >
            <X className="h-4 w-4 text-gray-600" />
          </button>
        )}
      </div>
    </div>
  );
};
