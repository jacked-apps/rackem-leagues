/**
 * @fileoverview Table Configure Modal
 *
 * Modal for reordering and renumbering tables at a venue.
 * Allows drag-and-drop reordering or manual number/size changes.
 * Supports skip numbers for custom numbering sequences.
 */
import React, { useState, useEffect } from 'react';
import { X, ArrowUp, ArrowDown, Plus, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TABLE_SIZES, getTableSizeLabel } from '@/constants/tables';

/**
 * Table configuration entry
 */
interface TableConfig {
  id: string; // Unique ID for React keys
  number: number;
  size: 'bar_box_tables' | 'eight_foot_tables' | 'regulation_tables';
  sizeLabel: string;
}

interface TableConfigureModalProps {
  /** Current table counts by size */
  values: {
    bar_box_tables: number;
    eight_foot_tables: number;
    regulation_tables: number;
  };
  /** Current table numbers by size (in entry order) */
  tableNumbers: {
    bar_box_tables: number[];
    eight_foot_tables: number[];
    regulation_tables: number[];
  };
  /** Called when configuration is saved */
  onSave: (
    newValues: {
      bar_box_tables: number;
      eight_foot_tables: number;
      regulation_tables: number;
    },
    newTableNumbers: {
      bar_box_tables: number[];
      eight_foot_tables: number[];
      regulation_tables: number[];
    }
  ) => void;
  /** Called when user cancels */
  onCancel: () => void;
}

/** Size options derived from TABLE_SIZES constant */
const SIZE_OPTIONS = TABLE_SIZES.map(({ key, label }) => ({ value: key, label }));

/**
 * TableConfigureModal Component
 *
 * Allows users to reorder tables and change their sizes.
 */
export const TableConfigureModal: React.FC<TableConfigureModalProps> = ({
  values,
  tableNumbers,
  onSave,
  onCancel,
}) => {
  // Build initial table list from current configuration
  const buildInitialTables = (): TableConfig[] => {
    const tables: TableConfig[] = [];

    // Add tables from each size with their current numbers
    (['bar_box_tables', 'eight_foot_tables', 'regulation_tables'] as const).forEach(size => {
      tableNumbers[size].forEach(num => {
        tables.push({
          id: `${size}-${num}`,
          number: num,
          size,
          sizeLabel: getTableSizeLabel(size),
        });
      });
    });

    // Sort by table number
    return tables.sort((a, b) => a.number - b.number);
  };

  const [tables, setTables] = useState<TableConfig[]>(buildInitialTables);

  // Skip numbers - these numbers will be skipped in auto-numbering
  const [skipNumbers, setSkipNumbers] = useState<number[]>([]);
  // Input for adding new skip number
  const [skipInput, setSkipInput] = useState<string>('');

  // Re-initialize when props change
  useEffect(() => {
    const initial = buildInitialTables();
    setTables(initial);
    setSkipNumbers([]);
  }, [values, tableNumbers]);

  /**
   * Move a table up in the order
   */
  const moveUp = (index: number) => {
    if (index === 0) return;
    const newTables = [...tables];
    // Swap positions
    [newTables[index - 1], newTables[index]] = [newTables[index], newTables[index - 1]];
    // Renumber based on new positions
    renumberTables(newTables);
  };

  /**
   * Move a table down in the order
   */
  const moveDown = (index: number) => {
    if (index === tables.length - 1) return;
    const newTables = [...tables];
    // Swap positions
    [newTables[index], newTables[index + 1]] = [newTables[index + 1], newTables[index]];
    // Renumber based on new positions
    renumberTables(newTables);
  };

  /**
   * Change a table's size
   */
  const changeSize = (index: number, newSize: 'bar_box_tables' | 'eight_foot_tables' | 'regulation_tables') => {
    const newTables = [...tables];
    newTables[index] = {
      ...newTables[index],
      size: newSize,
      sizeLabel: getTableSizeLabel(newSize),
    };
    setTables(newTables);
  };

  /**
   * Generate sequential numbers while skipping specified numbers
   * @param count - How many numbers to generate
   * @param skips - Numbers to skip
   * @returns Array of sequential numbers excluding skips
   */
  const generateNumbersWithSkips = (count: number, skips: number[]): number[] => {
    const skipSet = new Set(skips);
    const result: number[] = [];
    let current = 1;

    while (result.length < count) {
      if (!skipSet.has(current)) {
        result.push(current);
      }
      current++;
    }

    return result;
  };

  /**
   * Renumber all tables based on their current order, skipping specified numbers
   */
  const renumberTables = (tablesToRenumber: TableConfig[], skips?: number[]) => {
    const skipsToUse = skips ?? skipNumbers;
    const numbers = generateNumbersWithSkips(tablesToRenumber.length, skipsToUse);
    const renumbered = tablesToRenumber.map((table, index) => ({
      ...table,
      number: numbers[index],
    }));
    setTables(renumbered);
  };

  /**
   * Change an individual table's number and re-sort the list
   */
  const changeNumber = (index: number, newNumber: number) => {
    const newTables = [...tables];
    newTables[index] = {
      ...newTables[index],
      number: newNumber,
    };
    // Re-sort by number ascending
    newTables.sort((a, b) => a.number - b.number);
    setTables(newTables);
  };

  /**
   * Select all text when input receives focus
   * Uses setTimeout to avoid browser quirks with immediate selection
   */
  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    const target = e.target;
    // Use requestAnimationFrame to select after the focus event completes
    requestAnimationFrame(() => {
      target.select();
    });
  };

  /**
   * Find duplicate table numbers
   * Returns a Set of numbers that appear more than once
   */
  const getDuplicateNumbers = (): Set<number> => {
    const counts = new Map<number, number>();
    tables.forEach(t => {
      counts.set(t.number, (counts.get(t.number) || 0) + 1);
    });
    const duplicates = new Set<number>();
    counts.forEach((count, num) => {
      if (count > 1) duplicates.add(num);
    });
    return duplicates;
  };

  const duplicateNumbers = getDuplicateNumbers();
  const hasDuplicates = duplicateNumbers.size > 0;

  /**
   * Add a number to the skip list and renumber tables
   */
  const addSkipNumber = (num: number) => {
    if (num < 1 || skipNumbers.includes(num)) return;
    const newSkips = [...skipNumbers, num].sort((a, b) => a - b);
    setSkipNumbers(newSkips);
    renumberTables([...tables], newSkips);
  };

  /**
   * Remove a number from the skip list and renumber tables
   */
  const removeSkipNumber = (num: number) => {
    const newSkips = skipNumbers.filter(n => n !== num);
    setSkipNumbers(newSkips);
    renumberTables([...tables], newSkips);
  };

  /**
   * Add skip number from input field
   */
  const handleAddSkipFromInput = () => {
    const num = parseInt(skipInput, 10);
    if (!isNaN(num) && num >= 1) {
      addSkipNumber(num);
      setSkipInput('');
    }
  };

  /**
   * Handle grip click - add this table's number to skip list
   */
  const handleGripClick = (tableNumber: number) => {
    addSkipNumber(tableNumber);
  };

  /**
   * Save the configuration
   */
  const handleSave = () => {
    // Count tables by size
    const newValues = {
      bar_box_tables: tables.filter(t => t.size === 'bar_box_tables').length,
      eight_foot_tables: tables.filter(t => t.size === 'eight_foot_tables').length,
      regulation_tables: tables.filter(t => t.size === 'regulation_tables').length,
    };

    // Build table numbers by size (sorted by number within each size)
    const newTableNumbers = {
      bar_box_tables: tables
        .filter(t => t.size === 'bar_box_tables')
        .map(t => t.number)
        .sort((a, b) => a - b),
      eight_foot_tables: tables
        .filter(t => t.size === 'eight_foot_tables')
        .map(t => t.number)
        .sort((a, b) => a - b),
      regulation_tables: tables
        .filter(t => t.size === 'regulation_tables')
        .map(t => t.number)
        .sort((a, b) => a - b),
    };

    onSave(newValues, newTableNumbers);
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
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4"
      onClick={onCancel}
      onKeyDown={handleKeyDown}
    >
      <div
        className="bg-card rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="text-lg font-semibold text-foreground">
            Configure Tables
          </h3>
          <button
            onClick={onCancel}
            className="text-muted-foreground hover:text-muted-foreground transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Skip numbers control */}
        <div className="px-4 py-3 bg-muted border-b border-border">
          <div className="flex items-center gap-3">
            <Label htmlFor="skip-number" className="text-sm text-foreground whitespace-nowrap">
              Skip numbers:
            </Label>
            <Input
              id="skip-number"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              className="w-16 text-center"
              value={skipInput}
              placeholder="#"
              onFocus={handleInputFocus}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                const val = e.target.value.replace(/\D/g, '');
                setSkipInput(val);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddSkipFromInput();
                }
              }}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddSkipFromInput}
              disabled={!skipInput || parseInt(skipInput, 10) < 1}
            >
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>
          {/* Skip list chips */}
          {skipNumbers.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {skipNumbers.map((num) => (
                <button
                  key={num}
                  onClick={() => removeSkipNumber(num)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-warning/10 text-warning rounded-full text-sm hover:bg-warning/20 transition-colors"
                  title="Click to remove"
                >
                  {num}
                  <X className="h-3 w-3" />
                </button>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            Add numbers to skip in the sequence. Click the grip icon on any table to add its number to the skip list.
          </p>
        </div>

        {/* Table list */}
        <div className="flex-1 overflow-y-auto p-4">
          {tables.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-4">
              No tables to configure. Add table counts first.
            </p>
          ) : (
            <div className="space-y-2">
              {tables.map((table, index) => (
                <div
                  key={table.id}
                  className="flex items-center gap-3 p-2 bg-muted rounded-lg border border-border"
                >
                  {/* Skip button - click to add this number to skip list */}
                  <button
                    onClick={() => handleGripClick(table.number)}
                    className="p-1 -m-1 rounded hover:bg-warning/10 transition-colors"
                    title={`Skip table #${table.number}`}
                  >
                    <SkipForward className="h-4 w-4 text-muted-foreground hover:text-warning" />
                  </button>

                  {/* Editable table number */}
                  <Input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className={`w-14 text-center font-bold ${
                      duplicateNumbers.has(table.number)
                        ? 'text-destructive bg-destructive/10 border-destructive/40'
                        : 'text-info bg-info/10 border-info/40'
                    }`}
                    value={table.number}
                    onFocus={handleInputFocus}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      const val = e.target.value.replace(/\D/g, '');
                      if (val !== '') {
                        changeNumber(index, parseInt(val, 10));
                      }
                    }}
                  />

                  {/* Size selector */}
                  <Select
                    value={table.size}
                    onValueChange={(value) => changeSize(index, value as typeof table.size)}
                  >
                    <SelectTrigger className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SIZE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Move buttons */}
                  <div className="flex gap-1 ml-auto">
                    <button
                      onClick={() => moveUp(index)}
                      disabled={index === 0}
                      className="p-1 rounded hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move up"
                    >
                      <ArrowUp className="h-4 w-4 text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => moveDown(index)}
                      disabled={index === tables.length - 1}
                      className="p-1 rounded hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move down"
                    >
                      <ArrowDown className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-4 border-t border-border bg-muted rounded-b-xl">
          {hasDuplicates ? (
            <p className="text-sm text-destructive">
              Duplicate table numbers must be resolved before saving.
            </p>
          ) : (
            <div />
          )}
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button loadingText="none" onClick={handleSave} disabled={hasDuplicates}>
              Save Configuration
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
