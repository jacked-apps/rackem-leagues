/**
 * @fileoverview Venue Table Summary Card
 *
 * Displays a summary of venue tables including:
 * - Total table count
 * - Table numbers with size labels
 * - Capacity information
 * - Configure button to reorder/resize tables
 */
import React from 'react';
import { Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TableSizeDisplay {
  label: string;
  count: number;
  numbers: number[];
}

interface VenueTableSummaryCardProps {
  /** Table sizes with their counts and generated numbers */
  tableSizes: TableSizeDisplay[];
  /** Called when user wants to configure tables */
  onConfigure?: () => void;
}

/**
 * Represents a single table with its number and size label
 */
interface TableWithSize {
  number: number;
  sizeLabel: string;
}

/**
 * VenueTableSummaryCard Component
 *
 * Shows a summary card with total tables and table numbers with size labels.
 */
export const VenueTableSummaryCard: React.FC<VenueTableSummaryCardProps> = ({
  tableSizes,
  onConfigure,
}) => {
  const totalTables = tableSizes.reduce((sum, size) => sum + size.count, 0);

  // Build a flat list of all tables with their sizes, sorted by table number
  const allTables: TableWithSize[] = tableSizes
    .flatMap((size) =>
      size.numbers.map((num) => ({
        number: num,
        sizeLabel: size.label,
      }))
    )
    .sort((a, b) => a.number - b.number);

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
      {/* Header with total and configure button */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-blue-800">
          <strong>Total Tables:</strong> {totalTables}
        </p>
        {totalTables > 0 && onConfigure && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onConfigure}
            className="h-7 px-2 text-blue-700 hover:text-blue-900 hover:bg-blue-100"
          >
            <Settings2 className="h-4 w-4 mr-1" />
            Configure
          </Button>
        )}
      </div>

      {/* Table numbers with size labels */}
      {allTables.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {allTables.map((table, index) => (
            <div key={`${table.sizeLabel}-${table.number}-${index}`} className="flex flex-col items-center">
              <span className="inline-flex items-center justify-center w-8 h-8 text-sm font-medium bg-card text-blue-700 rounded border border-blue-300">
                {table.number}
              </span>
              <span className="text-[10px] text-blue-600 mt-0.5">
                {table.sizeLabel}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Capacity */}
      {totalTables > 0 && (
        <p className="text-xs text-blue-600 pt-2 border-t border-blue-200">
          Capacity: {totalTables} travel teams / {totalTables * 2} in-house teams
        </p>
      )}
    </div>
  );
};
