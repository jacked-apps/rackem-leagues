/**
 * @fileoverview Venue Table Inputs Component
 *
 * Reusable component for inputting table counts by size (7ft, 8ft, 9ft).
 * Displays auto-generated table numbers based on entry order.
 * Used in VenueCreationModal for both create and edit flows.
 */
import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { VenueTableSummaryCard } from './VenueTableSummaryCard';
import { TableConfigureModal } from './TableConfigureModal';
import { TableSizeLabel } from '@/components/TableSizeLabel';
import { TABLE_SIZES } from '@/constants/tables';
import type { TableSizeKey, TableNumbers } from '@/types/venue';

interface VenueTableInputsProps {
  /** Current table counts */
  values: {
    bar_box_tables: number;
    eight_foot_tables: number;
    regulation_tables: number;
  };
  /** Called when any table count changes */
  onChange: (key: TableSizeKey, value: number) => void;
  /** Custom table numbers (if configured) */
  customTableNumbers?: TableNumbers;
  /** Called when custom table numbers are set via configure modal */
  onTableNumbersChange?: (numbers: TableNumbers) => void;
}

/**
 * VenueTableInputs Component
 *
 * Renders table count inputs with:
 * - Compact number input
 * - Label with info button
 * - Auto-generated table number badges
 */
export const VenueTableInputs: React.FC<VenueTableInputsProps> = ({
  values,
  onChange,
  customTableNumbers,
  onTableNumbersChange,
}) => {
  // Track the order in which fields were filled (for auto-numbering)
  const [entryOrder, setEntryOrder] = useState<TableSizeKey[]>([]);
  // Modal visibility state
  const [showConfigureModal, setShowConfigureModal] = useState(false);

  // Update entry order when values change
  useEffect(() => {
    const newOrder: TableSizeKey[] = [];

    // Check each size - if it has a value and isn't in order yet, add it
    TABLE_SIZES.forEach(({ key }) => {
      if (values[key] > 0 && !entryOrder.includes(key)) {
        newOrder.push(key);
      }
    });

    // Keep existing order for sizes that still have values
    const existingWithValues = entryOrder.filter(key => values[key] > 0);

    if (newOrder.length > 0) {
      setEntryOrder([...existingWithValues, ...newOrder]);
    } else if (existingWithValues.length !== entryOrder.length) {
      // Remove sizes that no longer have values
      setEntryOrder(existingWithValues);
    }
  }, [values, entryOrder]);

  /**
   * Generate table numbers for a given size
   * Uses custom numbers if available, otherwise auto-generates based on entry order
   */
  const getTableNumbers = (key: TableSizeKey): number[] => {
    const count = values[key];
    if (count === 0) return [];

    // Use custom numbers if they exist and match the count
    if (customTableNumbers && customTableNumbers[key].length === count) {
      return customTableNumbers[key];
    }

    // Auto-generate: Find starting number based on entry order
    let startNum = 1;
    for (const orderedKey of entryOrder) {
      if (orderedKey === key) break;
      startNum += values[orderedKey];
    }

    return Array.from({ length: count }, (_, i) => startNum + i);
  };

  // Build table sizes data for summary card
  const tableSizesData = TABLE_SIZES.map(({ key, label }) => ({
    label,
    count: values[key],
    numbers: getTableNumbers(key),
  }));

  // Build table numbers object for configure modal
  const tableNumbersForModal = {
    bar_box_tables: getTableNumbers('bar_box_tables'),
    eight_foot_tables: getTableNumbers('eight_foot_tables'),
    regulation_tables: getTableNumbers('regulation_tables'),
  };

  /**
   * Handle save from configure modal
   * Updates table counts and custom numbers based on reconfigured values
   */
  const handleConfigureSave = (
    newValues: {
      bar_box_tables: number;
      eight_foot_tables: number;
      regulation_tables: number;
    },
    newTableNumbers: TableNumbers
  ) => {
    // Update each size's count
    onChange('bar_box_tables', newValues.bar_box_tables);
    onChange('eight_foot_tables', newValues.eight_foot_tables);
    onChange('regulation_tables', newValues.regulation_tables);

    // Save custom table numbers if callback provided
    if (onTableNumbersChange) {
      onTableNumbersChange(newTableNumbers);
    }

    setShowConfigureModal(false);
  };

  return (
    <div className="space-y-4">
      {/* Two-column layout: inputs on left, info card on right */}
      <div className="flex flex-wrap gap-6">
        {/* Left column: Table size inputs */}
        <div className="space-y-3">
          {TABLE_SIZES.map(({ key }) => (
            <div key={key} className="flex items-center gap-3">
              {/* Number input */}
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                className="w-16 text-center"
                value={values[key] === 0 ? '' : values[key]}
                placeholder="0"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  const val = e.target.value.replace(/\D/g, '');
                  onChange(key, val === '' ? 0 : parseInt(val, 10));
                }}
              />

              {/* Clickable label with popover info */}
              <TableSizeLabel sizeKey={key} />
            </div>
          ))}
        </div>

        {/* Right column: Info card */}
        <div className="bg-warning/10 border border-warning/40 rounded-lg p-2 w-[160px] self-start">
          <p className="text-xs font-semibold text-warning mb-1">Table Setup</p>
          <p className="text-xs text-foreground">
            This should match ALL pool tables (and their numbers) in this venue entirely. You will choose which tables are used at the league level.
          </p>
        </div>
      </div>

      {/* Summary card with table numbers */}
      <VenueTableSummaryCard
        tableSizes={tableSizesData}
        onConfigure={() => setShowConfigureModal(true)}
      />

      {/* Configure modal */}
      {showConfigureModal && (
        <TableConfigureModal
          values={values}
          tableNumbers={tableNumbersForModal}
          onSave={handleConfigureSave}
          onCancel={() => setShowConfigureModal(false)}
        />
      )}
    </div>
  );
};
