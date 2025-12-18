/**
 * @fileoverview Venue Limit Modal
 *
 * Modal for selecting which tables from a venue are available for a specific
 * league. Displays the venue's tables and allows operators to configure
 * which ones can be used for league play.
 */
import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useUpdateLeagueVenue } from '@/api/hooks/useLeagueVenueMutations';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { NumberInput } from '@/components/ui/number-input';
import { InfoButton } from '@/components/InfoButton';
import { TableSizeLabel } from '@/components/TableSizeLabel';
import { TableBadgePopover } from '@/components/operator/TableBadgePopover';
import { TABLE_SIZES } from '@/constants/tables';
import type { Venue, LeagueVenue, TableSizeKey } from '@/types/venue';

interface VenueLimitModalProps {
  /** The venue being configured */
  venue: Venue;
  /** The league_venue record with current limits */
  leagueVenue: LeagueVenue;
  /** All league venues for capacity validation */
  allLeagueVenues: LeagueVenue[];
  /** Called when limits are successfully updated */
  onSuccess: (updatedLeagueVenue: LeagueVenue) => void;
  /** Called when user cancels or closes modal */
  onCancel: () => void;
}

/**
 * VenueLimitModal Component
 *
 * Displays venue tables and allows operators to select which tables
 * are available for league play.
 */
export const VenueLimitModal: React.FC<VenueLimitModalProps> = ({
  venue,
  leagueVenue,
  allLeagueVenues,
  onSuccess,
  onCancel
}) => {
  // Use TanStack mutation for saving
  const updateLeagueVenueMutation = useUpdateLeagueVenue();

  // Table fill order: ascending, descending, or custom
  type FillOrder = 'ascending' | 'descending' | 'custom';
  const [fillOrder, setFillOrder] = useState<FillOrder>('ascending');

  // Track custom order for tables (used when fillOrder === 'custom')
  // Initialized with the existing order from leagueVenue, or empty if none
  const [customOrder, setCustomOrder] = useState<number[]>(() => {
    if (leagueVenue.available_table_numbers && leagueVenue.available_table_numbers.length > 0) {
      return [...leagueVenue.available_table_numbers];
    }
    return [];
  });

  // Capacity: max number of home teams allowed at this venue
  // Defaults to available_table_numbers length, can be manually lowered
  const [capacity, setCapacity] = useState<number>(() => {
    // Use existing capacity if set, otherwise default to number of available tables
    return leagueVenue.capacity ?? leagueVenue.available_table_numbers?.length ?? 0;
  });

  /**
   * Calculate total tables across all league venues
   * Each table can support 2 teams max (both teams play at same table)
   */
  const getTotalTablesAcrossAllVenues = (): number => {
    return allLeagueVenues.reduce((sum, lv) => {
      return sum + (lv.available_table_numbers?.length ?? 0);
    }, 0);
  };

  /**
   * Calculate current total capacity across all OTHER venues (excluding this one)
   */
  const getOtherVenuesCapacity = (): number => {
    return allLeagueVenues
      .filter(lv => lv.id !== leagueVenue.id)
      .reduce((sum, lv) => sum + (lv.capacity ?? lv.available_table_numbers?.length ?? 0), 0);
  };

  const totalTables = getTotalTablesAcrossAllVenues();
  const isInHouse = allLeagueVenues.length === 1;

  /**
   * Get all table numbers from the venue grouped by size
   */
  const getAllVenueTableNumbers = () => {
    const barBox = venue.bar_box_table_numbers ?? [];
    const eightFoot = venue.eight_foot_table_numbers ?? [];
    const regulation = venue.regulation_table_numbers ?? [];
    return { barBox, eightFoot, regulation, all: [...barBox, ...eightFoot, ...regulation] };
  };

  const venueTableNumbers = getAllVenueTableNumbers();

  /**
   * Get the count of tables for a given size key
   * Maps TableSizeKey to the corresponding array's length
   */
  const getTableCountForSize = (key: TableSizeKey): number => {
    switch (key) {
      case 'bar_box_tables':
        return venueTableNumbers.barBox.length;
      case 'eight_foot_tables':
        return venueTableNumbers.eightFoot.length;
      case 'regulation_tables':
        return venueTableNumbers.regulation.length;
      default:
        return 0;
    }
  };

  // Track which table sizes are enabled
  const [enabledSizes, setEnabledSizes] = useState<Record<TableSizeKey, boolean>>(() => {
    // If we have existing available_table_numbers, initialize based on what's selected
    if (leagueVenue.available_table_numbers && leagueVenue.available_table_numbers.length > 0) {
      const available = new Set(leagueVenue.available_table_numbers);
      return {
        bar_box_tables: venueTableNumbers.barBox.some(n => available.has(n)),
        eight_foot_tables: venueTableNumbers.eightFoot.some(n => available.has(n)),
        regulation_tables: venueTableNumbers.regulation.some(n => available.has(n)),
      };
    }
    // Otherwise, default to enabling all sizes that have tables
    // Use array lengths as source of truth for table counts
    return {
      bar_box_tables: venueTableNumbers.barBox.length > 0,
      eight_foot_tables: venueTableNumbers.eightFoot.length > 0,
      regulation_tables: venueTableNumbers.regulation.length > 0,
    };
  });

  // Track individually blocked table numbers (tables that are unchecked)
  const [blockedTables, setBlockedTables] = useState<Set<number>>(() => {
    // If we have existing available_table_numbers, compute blocked tables
    if (leagueVenue.available_table_numbers && leagueVenue.available_table_numbers.length > 0) {
      const available = new Set(leagueVenue.available_table_numbers);
      // Blocked tables are those NOT in the available list
      return new Set(venueTableNumbers.all.filter(n => !available.has(n)));
    }
    // Otherwise, no tables are blocked initially
    return new Set();
  });

  /**
   * Toggle a table size on/off
   * When toggling off, add all tables of that size to blocked
   * When toggling on, remove all tables of that size from blocked
   */
  const toggleSize = (key: TableSizeKey) => {
    const tableNumbers = (venue[`${key.replace('tables', 'table_numbers')}` as keyof Venue] as number[]) ?? [];

    setEnabledSizes(prev => {
      const newEnabled = !prev[key];

      // Update blocked tables based on the new state
      setBlockedTables(prevBlocked => {
        const newBlocked = new Set(prevBlocked);
        if (newEnabled) {
          // Re-enable: remove these tables from blocked
          tableNumbers.forEach(num => newBlocked.delete(num));
        } else {
          // Disable: add these tables to blocked
          tableNumbers.forEach(num => newBlocked.add(num));
        }
        return newBlocked;
      });

      return {
        ...prev,
        [key]: newEnabled,
      };
    });
  };

  /**
   * Toggle an individual table's availability
   */
  const toggleTable = (tableNumber: number) => {
    setBlockedTables(prev => {
      const newBlocked = new Set(prev);
      if (newBlocked.has(tableNumber)) {
        newBlocked.delete(tableNumber);
      } else {
        newBlocked.add(tableNumber);
      }
      return newBlocked;
    });
  };

  /**
   * Get all venue tables as a flat list with their size info
   */
  const getAllVenueTables = () => {
    const tables: { number: number; sizeKey: TableSizeKey; label: string }[] = [];

    TABLE_SIZES.forEach(({ key, label }) => {
      const numbers = (venue[`${key.replace('tables', 'table_numbers')}` as keyof Venue] as number[]) ?? [];
      numbers.forEach(num => {
        tables.push({ number: num, sizeKey: key, label });
      });
    });

    return tables.sort((a, b) => a.number - b.number);
  };

  const allTables = getAllVenueTables();

  // Filter to get available and unavailable tables
  const availableTablesUnsorted = allTables.filter(t => enabledSizes[t.sizeKey] && !blockedTables.has(t.number));
  const unavailableTables = allTables.filter(t => !enabledSizes[t.sizeKey] || blockedTables.has(t.number));

  // Compute max capacity for this venue (derived value, no useEffect needed)
  // In-house (1 venue): 2 teams per table + 1 for optional bye team
  // Traveling (multiple venues): league-wide pool, 2 teams per table total
  const maxCapacityForThisVenue = isInHouse
    ? (availableTablesUnsorted.length * 2) + 1  // In-house: 2 per table + 1 bye
    : (totalTables * 2) - getOtherVenuesCapacity();  // Traveling: league-wide pool

  // Clamp capacity to valid range (used for saving, not for display)
  const clampedCapacity = Math.min(capacity, maxCapacityForThisVenue);

  /**
   * Handle fill order change
   * When switching to 'custom', preserve the current display order
   */
  const handleFillOrderChange = (newOrder: FillOrder) => {
    if (newOrder === 'custom') {
      // When switching to custom, capture the current sorted order
      const currentOrder = fillOrder === 'ascending'
        ? [...availableTablesUnsorted].sort((a, b) => a.number - b.number).map(t => t.number)
        : fillOrder === 'descending'
          ? [...availableTablesUnsorted].sort((a, b) => b.number - a.number).map(t => t.number)
          : customOrder;
      setCustomOrder(currentOrder);
    }
    setFillOrder(newOrder);
  };

  /**
   * Move a table up in the custom order
   */
  const moveTableUp = (tableNumber: number) => {
    setCustomOrder(prev => {
      const index = prev.indexOf(tableNumber);
      if (index <= 0) return prev; // Already at top or not found
      const newOrder = [...prev];
      // Swap with previous element
      [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
      return newOrder;
    });
  };

  /**
   * Move a table down in the custom order
   */
  const moveTableDown = (tableNumber: number) => {
    setCustomOrder(prev => {
      const index = prev.indexOf(tableNumber);
      if (index === -1 || index >= prev.length - 1) return prev; // At bottom or not found
      const newOrder = [...prev];
      // Swap with next element
      [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
      return newOrder;
    });
  };

  /**
   * Sort available tables based on the selected fill order
   */
  const sortAvailableTables = () => {
    if (fillOrder === 'ascending') {
      return [...availableTablesUnsorted].sort((a, b) => a.number - b.number);
    } else if (fillOrder === 'descending') {
      return [...availableTablesUnsorted].sort((a, b) => b.number - a.number);
    } else {
      // Custom order: sort by position in customOrder array
      return [...availableTablesUnsorted].sort((a, b) => {
        const indexA = customOrder.indexOf(a.number);
        const indexB = customOrder.indexOf(b.number);
        // If not in custom order, put at the end (sorted ascending)
        if (indexA === -1 && indexB === -1) return a.number - b.number;
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
      });
    }
  };

  const availableTables = sortAvailableTables();

  /**
   * Save updated limits using TanStack mutation
   */
  const handleSave = () => {
    // Build the array of available table numbers (order matters for custom fill order)
    const availableTableNumbers = availableTables.map(t => t.number);

    updateLeagueVenueMutation.mutate(
      {
        leagueVenueId: leagueVenue.id,
        availableTableNumbers,
        capacity: clampedCapacity,
      },
      {
        onSuccess: (updatedLeagueVenue) => {
          onSuccess(updatedLeagueVenue);
        },
      }
    );
  };

  /**
   * Handle escape key to close modal
   */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onCancel}
      onKeyDown={handleKeyDown}
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Table Limits</h2>
            <p className="text-sm text-gray-600 mt-1">{venue.name}</p>
          </div>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-6">
          {/* Error message */}
          {updateLeagueVenueMutation.error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-red-800 text-sm">
                {updateLeagueVenueMutation.error instanceof Error
                  ? updateLeagueVenueMutation.error.message
                  : 'Failed to update limits'}
              </p>
            </div>
          )}

          {/* Table Size Selection */}
          <div className="space-y-3">
            {/* Info header */}
            <InfoButton title="Table Sizes Used" label="Table Sizes Used">
              Choose which table sizes this league will use at this venue, or use all sizes available.
            </InfoButton>

            {/* Checkboxes */}
            <div className="flex w-full justify-between">
              {TABLE_SIZES.map(({ key }) => {
                const tableCount = getTableCountForSize(key);
                const hasTablesOfSize = tableCount > 0;
                return (
                  <div key={key} className="flex items-center gap-2">
                    <Checkbox
                      id={`size-${key}`}
                      checked={enabledSizes[key]}
                      onCheckedChange={() => toggleSize(key)}
                      disabled={!hasTablesOfSize}
                    />
                    <label
                      htmlFor={`size-${key}`}
                      className={!hasTablesOfSize ? 'opacity-50' : ''}
                    >
                      <TableSizeLabel sizeKey={key} />
                    </label>
                    {hasTablesOfSize && (
                      <span className="text-xs text-gray-500">({tableCount})</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Table Fill Order */}
          <div className="space-y-3">
            <InfoButton title="Table Fill Order" label="Table Fill Order">
              Decide the order in which teams will be assigned their tables. Each night the tables will be assigned in this order.
            </InfoButton>

            {/* Fill order options (radio-style checkboxes) */}
            <div className="flex w-full justify-between">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="fill-ascending"
                  checked={fillOrder === 'ascending'}
                  onCheckedChange={() => handleFillOrderChange('ascending')}
                />
                <label htmlFor="fill-ascending" className="text-sm text-gray-700">
                  Ascending
                </label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="fill-descending"
                  checked={fillOrder === 'descending'}
                  onCheckedChange={() => handleFillOrderChange('descending')}
                />
                <label htmlFor="fill-descending" className="text-sm text-gray-700">
                  Descending
                </label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="fill-custom"
                  checked={fillOrder === 'custom'}
                  onCheckedChange={() => handleFillOrderChange('custom')}
                />
                <label htmlFor="fill-custom" className="text-sm text-gray-700">
                  Custom
                </label>
              </div>
            </div>
          </div>

          {/* Available Tables - clickable to remove */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-blue-800">
                <strong>Available Tables:</strong> {availableTables.length}
              </p>
            </div>

            {availableTables.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {availableTables.map((table, index) => (
                  <TableBadgePopover
                    key={`available-${table.number}`}
                    tableNumber={table.number}
                    sizeLabel={table.label}
                    isAvailable={true}
                    onToggle={() => toggleTable(table.number)}
                    isCustomOrder={fillOrder === 'custom'}
                    isFirst={index === 0}
                    isLast={index === availableTables.length - 1}
                    onMoveUp={() => moveTableUp(table.number)}
                    onMoveDown={() => moveTableDown(table.number)}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-blue-600 italic">No tables selected</p>
            )}

            {availableTables.length > 0 && (
              <div className="pt-2 border-t border-blue-200 space-y-2">
                <div className="flex items-center gap-2">
                  <label htmlFor="capacity" className="text-xs text-blue-700 font-medium whitespace-nowrap">
                    Max Home Teams:
                  </label>
                  <NumberInput
                    id="capacity"
                    value={capacity}
                    onChange={setCapacity}
                    min={1}
                    max={maxCapacityForThisVenue}
                    className="w-16 h-7 text-sm"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <p className="text-xs text-blue-600">
                    {isInHouse
                      ? `In-house max: ${maxCapacityForThisVenue} (${availableTables.length} tables × 2 + 1 bye)`
                      : `Traveling max: ${maxCapacityForThisVenue} (includes all venues)`
                    }
                  </p>
                  <InfoButton title="Max Capacity Warning" size="sm">
                    <p>
                      Setting capacity higher than the number of tables is not recommended.
                      When all tables are occupied, home teams may be assigned to play at away venues instead.
                    </p>
                  </InfoButton>
                </div>
                {capacity > availableTables.length && (
                  <div className="bg-orange-50 border border-orange-200 rounded p-2 mt-2">
                    <p className="text-xs text-orange-700">
                      <strong>Warning:</strong> Capacity exceeds this venue's tables ({capacity} teams &gt; {availableTables.length} tables).
                      If all tables are occupied during scheduling, home matches may be assigned to a different venue with availability.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Unavailable Tables - clickable to restore */}
          {unavailableTables.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
              <p className="text-sm text-red-800">
                <strong>Unavailable Tables:</strong> {unavailableTables.length}
              </p>

              <div className="flex flex-wrap gap-2">
                {unavailableTables.map((table) => (
                  <TableBadgePopover
                    key={`unavailable-${table.number}`}
                    tableNumber={table.number}
                    sizeLabel={table.label}
                    isAvailable={false}
                    isSizeDisabled={!enabledSizes[table.sizeKey]}
                    onToggle={() => toggleTable(table.number)}
                    onAddSingleTable={() => {
                      // Enable the size category but block all OTHER tables of that size
                      const allTableNumbersOfSize = (venue[`${table.sizeKey.replace('tables', 'table_numbers')}` as keyof Venue] as number[]) ?? [];

                      // Enable the size
                      setEnabledSizes(prev => ({
                        ...prev,
                        [table.sizeKey]: true,
                      }));

                      // Block all tables of this size EXCEPT the one being added
                      setBlockedTables(prev => {
                        const newBlocked = new Set(prev);
                        allTableNumbersOfSize.forEach(num => {
                          if (num === table.number) {
                            // Remove this table from blocked (make it available)
                            newBlocked.delete(num);
                          } else {
                            // Add other tables of this size to blocked
                            newBlocked.add(num);
                          }
                        });
                        return newBlocked;
                      });
                    }}
                    onEnableSize={() => {
                      // Re-enable the size category (this removes all tables of that size from blocked)
                      if (!enabledSizes[table.sizeKey]) {
                        toggleSize(table.sizeKey);
                      }
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <Button variant="outline" onClick={onCancel} disabled={updateLeagueVenueMutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={updateLeagueVenueMutation.isPending}
            isLoading={updateLeagueVenueMutation.isPending}
            loadingText="Saving..."
          >
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
};
