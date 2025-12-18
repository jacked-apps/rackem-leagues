/**
 * @fileoverview Personal Information Section Component
 * Handles editing of personal details (name, nickname, date of birth)
 */
import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InfoButton } from '@/components/InfoButton';
import { nicknameInfo } from '../constants/infoContent/profileInfoContent';
import type { Member } from '@/types';
import type { PersonalFormData, EditFormState } from './types';

interface PersonalInfoSectionProps {
  member: Member;
  form: EditFormState<PersonalFormData>;
  handlers: {
    startEdit: () => void;
    updateForm: (field: keyof PersonalFormData, value: string) => void;
    save: () => void;
    cancel: () => void;
  };
}

/**
 * Personal Information Section Component
 *
 * Displays and allows editing of:
 * - First name
 * - Last name
 * - Nickname (optional)
 * - Date of birth
 */
export const PersonalInfoSection: React.FC<PersonalInfoSectionProps> = ({
  member,
  form,
  handlers
}) => {
  if (!member) return null;

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Personal Information</h3>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* First Name */}
            <div>
              <Label htmlFor="first_name">First Name</Label>
              <Input
                id="first_name"
                type="text"
                value={form.formData.first_name}
                onChange={(e) => handlers.updateForm('first_name', e.target.value)}
                className={form.errors.first_name ? 'border-red-500' : ''}
              />
              {form.errors.first_name && (
                <p className="text-red-500 text-sm mt-1">{form.errors.first_name}</p>
              )}
            </div>

            {/* Last Name */}
            <div>
              <Label htmlFor="last_name">Last Name</Label>
              <Input
                id="last_name"
                type="text"
                value={form.formData.last_name}
                onChange={(e) => handlers.updateForm('last_name', e.target.value)}
                className={form.errors.last_name ? 'border-red-500' : ''}
              />
              {form.errors.last_name && (
                <p className="text-red-500 text-sm mt-1">{form.errors.last_name}</p>
              )}
            </div>
          </div>

          {/* Nickname */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Label htmlFor="nickname">Nickname</Label>
              <InfoButton title={nicknameInfo.title}>
                {nicknameInfo.content}
              </InfoButton>
            </div>
            <Input
              id="nickname"
              type="text"
              value={form.formData.nickname}
              onChange={(e) => handlers.updateForm('nickname', e.target.value)}
              placeholder="Enter nickname (max 12 characters)"
              maxLength={12}
              className={form.errors.nickname ? 'border-red-500' : ''}
            />
            {form.errors.nickname && (
              <p className="text-red-500 text-sm mt-1">{form.errors.nickname}</p>
            )}
          </div>

          {/* Date of Birth */}
          <div>
            <Label htmlFor="date_of_birth">Date of Birth</Label>
            <Input
              id="date_of_birth"
              type="date"
              value={form.formData.date_of_birth}
              onChange={(e) => handlers.updateForm('date_of_birth', e.target.value)}
              className={form.errors.date_of_birth ? 'border-red-500' : ''}
            />
            {form.errors.date_of_birth && (
              <p className="text-red-500 text-sm mt-1">{form.errors.date_of_birth}</p>
            )}
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <span className="text-sm font-medium text-gray-500">First Name</span>
              <p className="text-gray-900">{member.first_name}</p>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-500">Last Name</span>
              <p className="text-gray-900">{member.last_name}</p>
            </div>
          </div>
          <div>
            <span className="text-sm font-medium text-gray-500">Nickname</span>
            <p className="text-gray-900">{member.nickname || 'None'}</p>
          </div>
          <div>
            <span className="text-sm font-medium text-gray-500">Date of Birth</span>
            <p className="text-gray-900">{member.date_of_birth}</p>
          </div>
        </div>
      )}
    </div>
  );
};
