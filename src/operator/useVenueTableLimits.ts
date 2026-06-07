/**
 * @fileoverview useVenueTableLimits
 *
 * The table-limits state machine behind `VenueLimitModal`: which table sizes
 * are enabled, which individual tables are blocked, the fill order (asc / desc /
 * custom drag order), and the venue capacity — plus the derived available /
 * unavailable table lists, the max-capacity calc, and the save mutation.
 *
 * Extracted from `VenueLimitModal` so the component is just the modal chrome
 * around this logic. Behavior-preserving: same state init, same derivations,
 * same save payload.
 */

import { useState } from 'react';
import { useUpdateLeagueVenue } from '@/api/hooks/useLeagueVenueMutations';
import { TABLE_SIZES } from '@/constants/tables';
import type { Venue, LeagueVenue, TableSizeKey } from '@/types/venue';

/** Order in which teams are assigned tables each night. */
export type FillOrder = 'ascending' | 'descending' | 'custom';

/** A single venue table with its size info, as the lists render it. */
export interface VenueTable {
  number: number;
  sizeKey: TableSizeKey;
  label: string;
}

interface UseVenueTableLimitsParams {
  venue: Venue;
  leagueVenue: LeagueVenue;
  allLeagueVenues: LeagueVenue[];
  /** Called with the updated record after a successful save. */
  onSaved: (updatedLeagueVenue: LeagueVenue) => void;
}

export function useVenueTableLimits({
  venue,
  leagueVenue,
  allLeagueVenues,
  onSaved,
}: UseVenueTableLimitsParams) {
  // Use TanStack mutation for saving
  const updateLeagueVenueMutation = useUpdateLeagueVenue();

  // Table fill order: ascending, descending, or custom
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
  const getAllVenueTables = (): VenueTable[] => {
    const tables: VenueTable[] = [];

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
  const sortAvailableTables = (): VenueTable[] => {
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
   * From the "unavailable" list: enable a table's size but block every OTHER
   * table of that size, leaving just this one available.
   */
  const addSingleTable = (table: VenueTable) => {
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
  };

  /**
   * Re-enable a whole size category (removes all its tables from blocked).
   */
  const enableSize = (sizeKey: TableSizeKey) => {
    if (!enabledSizes[sizeKey]) {
      toggleSize(sizeKey);
    }
  };

  /**
   * Save updated limits using TanStack mutation
   */
  const save = () => {
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
          onSaved(updatedLeagueVenue);
        },
      }
    );
  };

  return {
    // state + setters the UI binds to
    fillOrder,
    capacity,
    setCapacity,
    enabledSizes,
    // derived lists + values
    availableTables,
    unavailableTables,
    maxCapacityForThisVenue,
    isInHouse,
    getTableCountForSize,
    // handlers
    toggleSize,
    toggleTable,
    handleFillOrderChange,
    moveTableUp,
    moveTableDown,
    addSingleTable,
    enableSize,
    // save
    save,
    isSaving: updateLeagueVenueMutation.isPending,
    saveError: updateLeagueVenueMutation.error,
  };
}
