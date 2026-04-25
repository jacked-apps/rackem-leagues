/**
 * @fileoverview PlayerCombobox Component
 *
 * Flexible player search combobox with configurable filters.
 * Supports multiple filter types that can be enabled/disabled per usage.
 * Filter chips allow users to switch between different player scopes.
 */
import React, { useState } from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
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
import type { PartialMember } from '@/types/member';
import { getPlayerDisplayName, isPlaceholderMember } from '@/types/member';
import { PlaceholderBadge } from '@/components/PlaceholderBadge';
import { fetchOperatorPlayers } from '@/api/queries/players';
import { useAllMembers } from '@/api/hooks';

/**
 * Filter configuration
 * Each filter can be false (hidden) or contain the data it needs
 */
export interface PlayerFilterConfig {
  /** Show all players in system */
  all?: boolean;
  /** Filter by state (pass state code like "TX") */
  state?: string | false;
  /** Filter by organization (pass orgId) */
  myOrg?: string | false;
  /** Filter active players in org (pass orgId) */
  active?: string | false;
  /** Filter by league (pass leagueId) */
  league?: string | false;
  /** Filter league operators/staff */
  staff?: boolean | false;
}

/**
 * Filter type for internal state management
 */
export type FilterType = 'all' | 'state' | 'myOrg' | 'active' | 'league' | 'staff';

interface PlayerComboboxProps {
  /** Currently selected player ID */
  value: string;
  /** Called when selection changes */
  onValueChange: (memberId: string) => void;
  /** Filter configuration - determines which filter chips appear */
  filters: PlayerFilterConfig;
  /** Which filter is active by default */
  defaultFilter: FilterType;
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
  /** Player IDs to exclude from dropdown */
  excludeIds?: string[];
}

/**
 * PlayerCombobox Component
 *
 * Searchable dropdown for selecting players with flexible filtering.
 * Filter chips appear based on the `filters` prop configuration.
 * Only one filter can be active at a time (mutually exclusive).
 *
 * @example
 * // Organization-specific player selection
 * <PlayerCombobox
 *   filters={{ myOrg: orgId, active: orgId }}
 *   defaultFilter="myOrg"
 *   value={playerId}
 *   onValueChange={setPlayerId}
 * />
 */
export const PlayerCombobox: React.FC<PlayerComboboxProps> = ({
  value,
  onValueChange,
  filters,
  defaultFilter,
  placeholder = 'Select player...',
  label,
  disabled = false,
  showClear = false,
  className = '',
  excludeIds = [],
}) => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>(defaultFilter);

  // Fetch players based on active filter
  // For myOrg filter - fetch players from organization
  const { data: orgPlayers } = useQuery({
    queryKey: ['organizationPlayers', filters.myOrg, false],
    queryFn: () => fetchOperatorPlayers(filters.myOrg as string, false),
    enabled: activeFilter === 'myOrg' && !!filters.myOrg,
  });

  // For active filter - fetch only active players from organization
  const { data: activePlayers } = useQuery({
    queryKey: ['activePlayers', filters.active, true],
    queryFn: () => fetchOperatorPlayers(filters.active as string, true),
    enabled: activeFilter === 'active' && !!filters.active,
  });

  // For all filter - fetch all members in system
  const { data: allMembers } = useAllMembers();

  // TODO: Implement other filter types (state, league, staff)

  // Select which dataset to use based on active filter
  let players: PartialMember[] = [];
  if (activeFilter === 'myOrg' && orgPlayers) {
    players = orgPlayers.data || [];
  } else if (activeFilter === 'active' && activePlayers) {
    players = activePlayers.data || [];
  } else if (activeFilter === 'all' && allMembers) {
    players = allMembers;
  }

  const selectedPlayer = players.find((player) => player.id === value);

  // Filter and sort players based on search
  const filteredPlayers = (searchQuery
    ? players.filter((player) => {
        if (excludeIds.includes(player.id) && player.id !== value) return false;
        const searchValue = getPlayerDisplayName(player).toLowerCase();
        return searchValue.includes(searchQuery.toLowerCase());
      })
    : players.filter((player) => !excludeIds.includes(player.id) || player.id === value)
  ).sort((a, b) => {
    const lastNameCompare = a.last_name.localeCompare(b.last_name);
    if (lastNameCompare !== 0) return lastNameCompare;
    return a.first_name.localeCompare(b.first_name);
  });

  // Build list of available filter chips
  const availableFilters: Array<{ type: FilterType; label: string }> = [];

  if (filters.all) {
    availableFilters.push({ type: 'all', label: 'All Players' });
  }
  if (filters.state) {
    availableFilters.push({ type: 'state', label: `${filters.state} Players` });
  }
  if (filters.myOrg) {
    availableFilters.push({ type: 'myOrg', label: 'My Organization' });
  }
  if (filters.active) {
    availableFilters.push({ type: 'active', label: 'Active Players' });
  }
  if (filters.league) {
    availableFilters.push({ type: 'league', label: 'League Players' });
  }
  if (filters.staff) {
    availableFilters.push({ type: 'staff', label: 'Staff' });
  }

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
                {selectedPlayer ? (
                  <>
                    <span className="truncate">{getPlayerDisplayName(selectedPlayer)}</span>
                    {isPlaceholderMember(selectedPlayer) && <PlaceholderBadge size="sm" />}
                  </>
                ) : placeholder}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-[400px] p-0" align="start">
            <Command shouldFilter={false}>
              {/* Filter Chips - only show if more than one filter available */}
              {availableFilters.length > 1 && (
                <div className="flex gap-1 p-2 border-b flex-wrap">
                  {availableFilters.map((filter) => (
                    <button
                      key={filter.type}
                      type="button"
                      onClick={() => setActiveFilter(filter.type)}
                      className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                        activeFilter === filter.type
                          ? 'bg-orange-500 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              )}

              <CommandInput
                placeholder="Search players..."
                className="h-9"
                value={searchQuery}
                onValueChange={setSearchQuery}
              />
              <CommandList>
                <CommandEmpty>No player found.</CommandEmpty>
                <CommandGroup>
                  {players.length === 0 ? (
                    <div className="p-2 text-sm text-gray-500">No players available</div>
                  ) : (
                    filteredPlayers.map((player) => (
                      <CommandItem
                        key={player.id}
                        value={player.id}
                        onSelect={() => {
                          onValueChange(player.id === value ? '' : player.id);
                          setSearchQuery('');
                          setOpen(false);
                        }}
                      >
                        <span className="flex items-center gap-1.5">
                          {getPlayerDisplayName(player)}
                          {isPlaceholderMember(player) && <PlaceholderBadge size="sm" />}
                        </span>
                        <Check
                          className={`ml-auto h-4 w-4 ${
                            player.id === value ? 'opacity-100' : 'opacity-0'
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
