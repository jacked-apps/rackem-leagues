/**
 * @fileoverview Contact Information Section Component
 * Handles editing of contact details (email and phone)
 */
import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatPhoneNumber } from '../utils/formatters';
import type { Member } from '@/types';
import type { ContactFormData, EditFormState } from './types';

interface ContactInfoSectionProps {
  member: Member;
  form: EditFormState<ContactFormData>;
  handlers: {
    startEdit: () => void;
    updateForm: (field: keyof ContactFormData, value: string) => void;
    save: () => void;
    cancel: () => void;
  };
}

/**
 * Contact Information Section Component
 *
 * Displays and allows editing of:
 * - Email address
 * - Phone number (with automatic formatting)
 */
export const ContactInfoSection: React.FC<ContactInfoSectionProps> = ({
  member,
  form,
  handlers
}) => {
  if (!member) return null;

  // Handle phone number formatting during input
  const handlePhoneChange = (value: string) => {
    const formatted = formatPhoneNumber(value);
    handlers.updateForm('phone', formatted);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Contact Information</h3>
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
          {/* Email */}
          <div>
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              value={form.formData.email}
              onChange={(e) => handlers.updateForm('email', e.target.value)}
              placeholder="your.email@example.com"
              className={form.errors.email ? 'border-red-500' : ''}
            />
            {form.errors.email && (
              <p className="text-red-500 text-sm mt-1">{form.errors.email}</p>
            )}
          </div>

          {/* Phone */}
          <div>
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              value={form.formData.phone}
              onChange={(e) => handlePhoneChange(e.target.value)}
              placeholder="(555) 123-4567"
              className={form.errors.phone ? 'border-red-500' : ''}
            />
            {form.errors.phone && (
              <p className="text-red-500 text-sm mt-1">{form.errors.phone}</p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              Phone number will be formatted automatically as you type
            </p>
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
            <span className="text-sm font-medium text-gray-500">Email Address</span>
            <p className="text-gray-900">{member.email}</p>
          </div>
          <div>
            <span className="text-sm font-medium text-gray-500">Phone Number</span>
            <p className="text-gray-900">{member.phone}</p>
          </div>
        </div>
      )}
    </div>
  );
};
