/**
 * @fileoverview Address Section Component
 * Handles editing of address information
 */
import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { US_STATES } from '../constants/states';
import type { Member } from '@/types';
import type { AddressFormData, EditFormState } from './types';

interface AddressSectionProps {
  member: Member;
  form: EditFormState<AddressFormData>;
  handlers: {
    startEdit: () => void;
    updateForm: (field: keyof AddressFormData, value: string) => void;
    save: () => void;
    cancel: () => void;
  };
}

/**
 * Address Section Component
 *
 * Displays and allows editing of:
 * - Street address
 * - City
 * - State (dropdown)
 * - ZIP code
 */
export const AddressSection: React.FC<AddressSectionProps> = ({
  member,
  form,
  handlers
}) => {
  if (!member) return null;

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Address Information</h3>
        {!form.isEditing && (
          <Button
            variant="outline"
            size="sm"
            onClick={handlers.startEdit}
            className="text-blue-600 border-blue-600 hover:bg-blue-50"
            loadingText="none"
          >
            Edit
          </Button>
        )}
      </div>

      {form.isEditing ? (
        // Edit Mode
        <div className="space-y-4">
          {/* Street Address */}
          <div>
            <Label htmlFor="address">Street Address</Label>
            <Input
              id="address"
              type="text"
              value={form.formData.address}
              onChange={(e) => handlers.updateForm('address', e.target.value)}
              placeholder="123 Main Street"
              className={form.errors.address ? 'border-red-500' : ''}
            />
            {form.errors.address && (
              <p className="text-red-500 text-sm mt-1">{form.errors.address}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* City */}
            <div className="md:col-span-1">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                type="text"
                value={form.formData.city}
                onChange={(e) => handlers.updateForm('city', e.target.value)}
                placeholder="Springfield"
                className={form.errors.city ? 'border-red-500' : ''}
              />
              {form.errors.city && (
                <p className="text-red-500 text-sm mt-1">{form.errors.city}</p>
              )}
            </div>

            {/* State */}
            <div>
              <Label htmlFor="state">State</Label>
              <Select
                value={form.formData.state}
                onValueChange={(value) => handlers.updateForm('state', value)}
              >
                <SelectTrigger className={form.errors.state ? 'border-red-500' : ''}>
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
              {form.errors.state && (
                <p className="text-red-500 text-sm mt-1">{form.errors.state}</p>
              )}
            </div>

            {/* ZIP Code */}
            <div>
              <Label htmlFor="zip_code">ZIP Code</Label>
              <Input
                id="zip_code"
                type="text"
                value={form.formData.zip_code}
                onChange={(e) => handlers.updateForm('zip_code', e.target.value)}
                placeholder="12345"
                className={form.errors.zip_code ? 'border-red-500' : ''}
              />
              {form.errors.zip_code && (
                <p className="text-red-500 text-sm mt-1">{form.errors.zip_code}</p>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-2 pt-4">
            <Button onClick={handlers.save} className="bg-blue-600 hover:bg-blue-700" loadingText="Saving...">
              Save Changes
            </Button>
            <Button variant="outline" onClick={handlers.cancel} loadingText="none">
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        // Display Mode
        <div className="space-y-3">
          <div>
            <span className="text-sm font-medium text-gray-500">Street Address</span>
            <p className="text-gray-900">{member.address}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <span className="text-sm font-medium text-gray-500">City</span>
              <p className="text-gray-900">{member.city}</p>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-500">State</span>
              <p className="text-gray-900">{member.state}</p>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-500">ZIP Code</span>
              <p className="text-gray-900">{member.zip_code}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
