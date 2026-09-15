/**
 * @fileoverview MemberSearchCombobox Component
 *
 * Server-side search combobox for selecting members.
 * Scales to large datasets by searching on the server instead of loading all members.
 * Includes filter chips for All/My Org/State/Staff.
 *
 * The chips are configurable because they are LEAGUE concepts. "My Org",
 * "State" and "Staff" only mean something to a caller inside an organization —
 * a tournament organizer is just a player with no org, so showing them three
 * buttons that can't help is worse than showing none. Callers pass `filters` to
 * say which apply to them.
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
  /**
   * DOM id for the trigger, so an external <label htmlFor> actually associates
   * with it. Without one a caller's own label is decorative — it reads as a
   * label but doesn't focus or announce the control.
   */
  id?: string;
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
  /**
   * Which filter chips to offer, in order. Defaults to all four. Pass a single
   * filter to hide the row entirely — one chip is not a choice.
   */
  filters?: MemberSearchFilter[];
  /**
   * Only offer members with a real account.
   *
   * Placeholder players belong to a league's team structure. A caller outside
   * it — a tournament, which has no org and no teams — shouldn't be handing them
   * out, and skipping them also avoids a full team_players read per keystroke.
   */
  registeredOnly?: boolean;
}

/**
 * MemberSearchCombobox Component
 *
 * Server-side searchable dropdown for selecting members.
 * Includes filter chips to search: All, My Org, State, or Staff.
 * Only loads top 50 matches - scales to large datasets.
 */
export const MemberSearchCombobox: React.FC<MemberSearchComboboxProps> = ({
  id,
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
  filters = ['my_org', 'state', 'staff', 'all'],
  registeredOnly = false,
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
    open, // Only search when dropdown is open
    registeredOnly
  );

  // Filter out excluded IDs (completely remove them from results)
  const filteredMembers = searchResults.filter(
    (member) => !excludeIds.includes(member.id)
  );

  // Find selected member (look in search results, or use cached member)
  const selectedMemberFromResults = searchResults.find((member) => member.id === value);
  const selectedMember = selectedMemberFromResults || cachedSelectedMember;

  const FILTER_LABELS: Record<MemberSearchFilter, string> = {
    my_org: 'My Org',
    state: 'State',
    staff: 'Staff',
    all: 'All',
  };
  const filterButtons = filters.map((id) => ({ id, label: FILTER_LABELS[id] }));

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
              id={id}
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
              {/* Filter chips — hidden when there is only one, since a lone
                  chip offers no choice and just takes a row. */}
              {filterButtons.length > 1 && (
              <div className="flex gap-1 p-2 border-b">
                {filterButtons.map((filter) => (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() => setActiveFilter(filter.id)}
                    className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                      activeFilter === filter.id
                        ? 'bg-orange-500 text-white'
                        : 'bg-muted text-foreground hover:bg-accent'
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
              )}

              <CommandInput
                placeholder="Search by name or player #..."
                className="h-9"
                value={searchQuery}
                onValueChange={setSearchQuery}
              />
              <CommandList>
                {isLoading ? (
                  <div className="p-4 text-sm text-muted-foreground text-center">Searching...</div>
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
            className="flex h-10 items-center justify-center px-3 rounded-md border border-input bg-background hover:bg-muted transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            title="Clear selection"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>
    </div>
  );
};
