/**
 * @fileoverview Save Chart Modal
 *
 * Modal dialog for saving a custom threshold chart to the database.
 * Collects the chart name (required) and description (optional) before saving.
 *
 * This modal explains to operators:
 * - The name helps them identify their chart
 * - The description helps developers understand custom requirements
 * - Custom charts requiring code changes may be shared with other operators
 */

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Save } from 'lucide-react';

/**
 * Data returned when the user confirms the save
 */
export interface SaveChartData {
  name: string;
  description: string | null;
}

interface SaveChartModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Callback when modal is closed (cancel or backdrop click) */
  onOpenChange: (open: boolean) => void;
  /** Callback when user confirms save with name/description */
  onSave: (data: SaveChartData) => void;
  /** Whether save is in progress */
  isSaving?: boolean;
  /** Default name to pre-fill (e.g., existing chart name) */
  defaultName?: string;
  /** Default description to pre-fill */
  defaultDescription?: string;
  /** Chart type for display (e.g., "Points", "Percentage", "Race") */
  chartTypeLabel?: string;
}

/**
 * Modal for collecting chart name and description before saving
 *
 * Displays when operator clicks "Save Chart" to create or update a custom chart.
 */
export function SaveChartModal({
  open,
  onOpenChange,
  onSave,
  isSaving = false,
  defaultName = '',
  defaultDescription = '',
  chartTypeLabel = 'Threshold',
}: SaveChartModalProps) {
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState(defaultDescription);
  const [nameError, setNameError] = useState<string | null>(null);

  // Reset form when modal opens with new defaults
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setName(defaultName);
      setDescription(defaultDescription);
      setNameError(null);
    }
    onOpenChange(isOpen);
  };

  const handleSave = () => {
    // Validate name
    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError('Chart name is required');
      return;
    }
    if (trimmedName.length < 3) {
      setNameError('Name must be at least 3 characters');
      return;
    }

    setNameError(null);
    onSave({
      name: trimmedName,
      description: description.trim() || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Save {chartTypeLabel} Chart</DialogTitle>
          <DialogDescription className="text-sm text-gray-600">
            Give your chart a name so you can identify it later.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Chart Name */}
          <div className="space-y-2">
            <Label htmlFor="chartName" className="text-sm font-medium">
              Chart Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="chartName"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) setNameError(null);
              }}
              placeholder="e.g., Tuesday Night 5v5 Chart"
              className={nameError ? 'border-red-500' : ''}
              autoFocus
            />
            {nameError && (
              <p className="text-sm text-red-500">{nameError}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="chartDescription" className="text-sm font-medium">
              Description <span className="text-gray-400">(optional)</span>
            </Label>
            <Textarea
              id="chartDescription"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe how this chart works or why it's different..."
              rows={3}
              className="resize-none"
            />
            <p className="text-xs text-gray-500">
              If this chart requires special code support, your description helps us understand your needs.
              Custom integrations may be made available to other operators with similar requirements.
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="default"
            onClick={handleSave}
            disabled={!name.trim()}
            className="w-full sm:w-auto"
            loadingText="Saving..."
            isLoading={isSaving}
          >
            <Save className="h-4 w-4 mr-1" />
            Save Chart
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
