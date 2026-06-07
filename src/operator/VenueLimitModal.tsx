/**
 * @fileoverview Venue Limit Modal
 *
 * Modal for selecting which tables from a venue are available for a specific
 * league. Displays the venue's tables and allows operators to configure
 * which ones can be used for league play.
 */
import React from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { NumberInput } from '@/components/ui/number-input';
import { InfoButton } from '@/components/InfoButton';
import { TableSizeLabel } from '@/components/TableSizeLabel';
import { TableBadgePopover } from '@/components/operator/TableBadgePopover';
import { TABLE_SIZES } from '@/constants/tables';
import type { Venue, LeagueVenue } from '@/types/venue';
import { useVenueTableLimits } from './useVenueTableLimits';

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
  // All table-limits state, derivations, and the save mutation live in the hook.
  const {
    fillOrder,
    capacity,
    setCapacity,
    enabledSizes,
    availableTables,
    unavailableTables,
    maxCapacityForThisVenue,
    isInHouse,
    getTableCountForSize,
    toggleSize,
    toggleTable,
    handleFillOrderChange,
    moveTableUp,
    moveTableDown,
    addSingleTable,
    enableSize,
    save,
    isSaving,
    saveError,
  } = useVenueTableLimits({ venue, leagueVenue, allLeagueVenues, onSaved: onSuccess });

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
        className="bg-card rounded-xl shadow-xl max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-xl font-bold text-foreground">Table Limits</h2>
            <p className="text-sm text-muted-foreground mt-1">{venue.name}</p>
          </div>
          <button
            onClick={onCancel}
            className="text-muted-foreground hover:text-muted-foreground transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-6">
          {/* Error message */}
          {saveError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-red-800 text-sm">
                {saveError instanceof Error
                  ? saveError.message
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
                      <span className="text-xs text-muted-foreground">({tableCount})</span>
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
                <label htmlFor="fill-ascending" className="text-sm text-foreground">
                  Ascending
                </label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="fill-descending"
                  checked={fillOrder === 'descending'}
                  onCheckedChange={() => handleFillOrderChange('descending')}
                />
                <label htmlFor="fill-descending" className="text-sm text-foreground">
                  Descending
                </label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="fill-custom"
                  checked={fillOrder === 'custom'}
                  onCheckedChange={() => handleFillOrderChange('custom')}
                />
                <label htmlFor="fill-custom" className="text-sm text-foreground">
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
                    onAddSingleTable={() => addSingleTable(table)}
                    onEnableSize={() => enableSize(table.sizeKey)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-border bg-muted">
          <Button variant="outline" onClick={onCancel} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            onClick={save}
            disabled={isSaving}
            isLoading={isSaving}
            loadingText="Saving..."
          >
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
};
