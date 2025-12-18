/**
 * @fileoverview Venue Creation Modal
 *
 * Modal form for operators to add new venues to their organization.
 * Collects required venue information (name, address, phone, table counts).
 * Optional fields can be added later via venue editing.
 */
import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useCreateVenue, useUpdateVenue } from '@/api/hooks';
import type { VenueFormData, Venue } from '@/types/venue';
import { US_STATES } from '@/constants/states';
import { formatPhoneNumber } from '@/utils/formatters';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { logger } from '@/utils/logger';
import { VenueTableInputs } from './VenueTableInputs';
import { generateDefaultTableNumbers } from '@/constants/tables';

interface VenueCreationModalProps {
  /** Organization ID who is creating the venue */
  organizationId: string;
  /** Called when venue is successfully created or updated */
  onSuccess: (venue: Venue) => void;
  /** Called when user cancels or closes modal */
  onCancel: () => void;
  /** Existing venue data for editing (optional) */
  existingVenue?: Venue | null;
}

/**
 * VenueCreationModal Component
 *
 * Simple modal form for adding venues. Only collects required fields:
 * - Name, address, phone (essential contact info)
 * - Bar-box and regulation table counts (capacity planning)
 *
 * Optional fields (contacts, website, hours) can be added later via editing.
 */
export const VenueCreationModal: React.FC<VenueCreationModalProps> = ({
  organizationId,
  onSuccess,
  onCancel,
  existingVenue
}) => {
  const isEditing = !!existingVenue;

  const [formData, setFormData] = useState<VenueFormData>({
    name: existingVenue?.name || '',
    street_address: existingVenue?.street_address || '',
    city: existingVenue?.city || '',
    state: existingVenue?.state || '',
    zip_code: existingVenue?.zip_code || '',
    phone: existingVenue?.phone || '',
    // Derive counts from array lengths (arrays are source of truth)
    bar_box_tables: existingVenue?.bar_box_table_numbers?.length || 0,
    eight_foot_tables: existingVenue?.eight_foot_table_numbers?.length || 0,
    regulation_tables: existingVenue?.regulation_table_numbers?.length || 0
  });

  // Custom table numbers from Configure modal (optional - uses auto-numbering if not set)
  const [customTableNumbers, setCustomTableNumbers] = useState<{
    bar_box_tables: number[];
    eight_foot_tables: number[];
    regulation_tables: number[];
  } | undefined>(undefined);

  const [error, setError] = useState<string | null>(null);

  // Mutation hooks
  const createVenueMutation = useCreateVenue();
  const updateVenueMutation = useUpdateVenue();

  const saving = createVenueMutation.isPending || updateVenueMutation.isPending;

  /**
   * Update form field value
   */
  const updateField = (field: keyof VenueFormData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null); // Clear error on input change
  };

  /**
   * Validate form data
   */
  const validate = (): string | null => {
    if (!formData.name.trim()) return 'Venue name is required';
    if (!formData.street_address.trim()) return 'Street address is required';
    if (!formData.city.trim()) return 'City is required';
    if (!formData.state.trim()) return 'State is required';
    if (!formData.zip_code.trim()) return 'Zip code is required';
    if (!formData.phone.trim()) return 'Phone number is required';

    const totalTables = formData.bar_box_tables + formData.eight_foot_tables + formData.regulation_tables;
    if (totalTables === 0) {
      return 'Venue must have at least one table';
    }

    if (formData.bar_box_tables < 0 || formData.eight_foot_tables < 0 || formData.regulation_tables < 0) {
      return 'Table counts cannot be negative';
    }

    return null;
  };

  /**
   * Save venue to database (create or update)
   */
  const handleSave = async () => {
    // Validate
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);

    try {
      // Get table numbers from custom config or generate defaults
      // The array length IS the count - no separate count fields needed
      const tableNumbers = customTableNumbers ?? generateDefaultTableNumbers({
        bar_box_tables: formData.bar_box_tables,
        eight_foot_tables: formData.eight_foot_tables,
        regulation_tables: formData.regulation_tables,
      });

      if (isEditing && existingVenue) {
        // UPDATE existing venue - only pass array columns
        const venue = await updateVenueMutation.mutateAsync({
          venueId: existingVenue.id,
          name: formData.name.trim(),
          street_address: formData.street_address.trim(),
          city: formData.city.trim(),
          state: formData.state.trim().toUpperCase(),
          zip_code: formData.zip_code.trim(),
          phone: formData.phone.trim(),
          bar_box_table_numbers: tableNumbers.bar_box_tables,
          eight_foot_table_numbers: tableNumbers.eight_foot_tables,
          regulation_table_numbers: tableNumbers.regulation_tables,
        });

        onSuccess(venue);
      } else {
        // INSERT new venue - only pass array columns
        const venue = await createVenueMutation.mutateAsync({
          organizationId,
          name: formData.name.trim(),
          street_address: formData.street_address.trim(),
          city: formData.city.trim(),
          state: formData.state.trim().toUpperCase(),
          zip_code: formData.zip_code.trim(),
          phone: formData.phone.trim(),
          bar_box_table_numbers: tableNumbers.bar_box_tables,
          eight_foot_table_numbers: tableNumbers.eight_foot_tables,
          regulation_table_numbers: tableNumbers.regulation_tables,
          // Optional fields - only include if provided
          proprietor_name: formData.proprietor_name?.trim() || undefined,
          proprietor_phone: formData.proprietor_phone?.trim() || undefined,
          league_contact_name: formData.league_contact_name?.trim() || undefined,
          league_contact_phone: formData.league_contact_phone?.trim() || undefined,
          league_contact_email: formData.league_contact_email?.trim() || undefined,
          website: formData.website?.trim() || undefined,
          business_hours: formData.business_hours?.trim() || undefined,
          notes: formData.notes?.trim() || undefined,
        });

        onSuccess(venue);
      }
    } catch (err) {
      logger.error('Error saving venue', {
        error: err instanceof Error ? err.message : String(err),
        isEditing,
        organizationId
      });
      setError(err instanceof Error ? err.message : `Failed to ${isEditing ? 'update' : 'create'} venue`);
    }
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
        className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">
            {isEditing ? 'Edit Venue' : 'Add New Venue'}
          </h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-6">
          {/* Error message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          {/* Venue Name */}
          <div>
            <Label>
              Venue Name <span className="text-red-500">*</span>
            </Label>
            <Input
              type="text"
              value={formData.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="Sam's Billiards"
            />
          </div>

          {/* Address */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label>
                Street Address <span className="text-red-500">*</span>
              </Label>
              <Input
                type="text"
                value={formData.street_address}
                onChange={(e) => updateField('street_address', e.target.value)}
                placeholder="123 Main Street"
              />
            </div>

            <div>
              <Label>
                City <span className="text-red-500">*</span>
              </Label>
              <Input
                type="text"
                value={formData.city}
                onChange={(e) => updateField('city', e.target.value)}
                placeholder="Springfield"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>
                  State <span className="text-red-500">*</span>
                </Label>
                <Select value={formData.state} onValueChange={(value) => updateField('state', value)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    {US_STATES.map((state) => (
                      <SelectItem key={state} value={state}>
                        {state}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>
                  Zip Code <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="text"
                  value={formData.zip_code}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField('zip_code', e.target.value)}
                  placeholder="62701"
                />
              </div>
            </div>
          </div>

          {/* Phone */}
          <div>
            <Label>
              Phone Number <span className="text-red-500">*</span>
            </Label>
            <Input
              type="tel"
              value={formData.phone}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                const formatted = formatPhoneNumber(e.target.value);
                updateField('phone', formatted);
              }}
              placeholder="123-456-7890"
              maxLength={12}
            />
          </div>

          {/* Table Counts */}
          <VenueTableInputs
            values={{
              bar_box_tables: formData.bar_box_tables,
              eight_foot_tables: formData.eight_foot_tables,
              regulation_tables: formData.regulation_tables,
            }}
            onChange={(key, value) => updateField(key, value)}
            customTableNumbers={customTableNumbers}
            onTableNumbersChange={setCustomTableNumbers}
          />

          <p className="text-sm text-gray-600">
            Additional details (contacts, website, hours) can be added later by editing the venue.
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={saving}
            loadingText="none"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            isLoading={saving}
            loadingText={isEditing ? 'Updating...' : 'Creating...'}
          >
            {isEditing ? 'Update Venue' : 'Create Venue'}
          </Button>
        </div>
      </div>
    </div>
  );
};
