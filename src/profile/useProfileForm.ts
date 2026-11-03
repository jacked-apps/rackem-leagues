/**
 * @fileoverview Profile Form Management Hook
 * Custom hook for managing profile edit forms with validation and state
 */
import { useState } from 'react';
import type { z } from 'zod';
import { useUserProfile } from '@/api/hooks';
import { useUpdateMemberProfile } from '@/api/hooks/useMemberMutations';
import { personalInfoSchema, contactInfoSchema, addressSchema } from './validationSchemas';
import { capitalizeWords, formatPhoneNumber } from '../utils/formatters';
import { logger } from '@/utils/logger';
import type { Member } from '@/types/member';
import type { UpdateMemberProfileParams } from '@/api/mutations/members';
import type {
  AddressFormData,
  PersonalFormData,
  ContactFormData,
  EditFormState,
  SuccessMessage
} from './types';

/**
 * Custom hook for managing profile form state and operations
 *
 * Centralizes all form management logic including:
 * - Edit mode states for each form section
 * - Form validation and submission
 * - Success message handling
 * - Error state management
 */
export const useProfileForm = () => {
  const { member } = useUserProfile();
  const updateProfileMutation = useUpdateMemberProfile();

  // Success message state
  const [successMessage, setSuccessMessage] = useState<SuccessMessage>({
    visible: false,
    type: '',
    changes: []
  });

  // Address form state
  const [addressForm, setAddressForm] = useState<EditFormState<AddressFormData>>({
    isEditing: false,
    formData: {
      address: '',
      city: '',
      state: '',
      zip_code: ''
    },
    errors: {}
  });

  // Personal info form state
  const [personalForm, setPersonalForm] = useState<EditFormState<PersonalFormData>>({
    isEditing: false,
    formData: {
      first_name: '',
      last_name: '',
      nickname: '',
      date_of_birth: ''
    },
    errors: {}
  });

  // Contact info form state
  const [contactForm, setContactForm] = useState<EditFormState<ContactFormData>>({
    isEditing: false,
    formData: {
      email: '',
      phone: ''
    },
    errors: {}
  });

  /**
   * Show success message with auto-hide after 5 seconds
   */
  const showSuccessMessage = (type: string, changes: string[]) => {
    setSuccessMessage({ visible: true, type, changes });

    setTimeout(() => {
      setSuccessMessage({ visible: false, type: '', changes: [] });
    }, 5000);
  };

  /**
   * Generic form validation and processing function
   * Reduces code duplication across different form types
   */
  const processFormSubmission = <T, D, U extends UpdateMemberProfileParams['updates']>(
    schema: z.ZodType<D>,
    formData: T,
    currentMemberData: Member,
    formatFn: (data: D) => U,
    changeDetectionFn: (formatted: U, current: Member) => string[]
  ) => {
    // Validate form data
    const validation = schema.safeParse(formData);

    if (!validation.success) {
      const errors: Record<string, string> = {};
      validation.error.issues.forEach((error) => {
        if (error.path[0]) {
          errors[error.path[0] as string] = error.message;
        }
      });
      return { success: false as const, errors };
    }

    // Apply formatting
    const formattedData = formatFn(validation.data);

    // Detect changes
    const changes = changeDetectionFn(formattedData, currentMemberData);

    return { success: true as const, changes, formattedData };
  };

  /**
   * Address form handlers
   */
  const addressHandlers = {
    startEdit: () => {
      if (member) {
        setAddressForm(prev => ({
          ...prev,
          isEditing: true,
          formData: {
            address: member.address ?? '',
            city: member.city,
            state: member.state,
            zip_code: member.zip_code ?? ''
          },
          errors: {}
        }));
      }
    },

    updateForm: (field: keyof AddressFormData, value: string) => {
      setAddressForm(prev => ({
        ...prev,
        formData: { ...prev.formData, [field]: value },
        errors: { ...prev.errors, [field]: '' } // Clear field error on change
      }));
    },

    save: async () => {
      if (!member) return;

      const result = processFormSubmission(
        addressSchema,
        addressForm.formData,
        member,
        (data) => ({
          address: capitalizeWords(data.address),
          city: capitalizeWords(data.city),
          state: data.state.toUpperCase(),
          zip_code: data.zip_code
        }),
        (formatted, current) => {
          const changes: string[] = [];
          if (formatted.address !== current.address) changes.push(`Address: "${current.address}" → "${formatted.address}"`);
          if (formatted.city !== current.city) changes.push(`City: "${current.city}" → "${formatted.city}"`);
          if (formatted.state !== current.state) changes.push(`State: "${current.state}" → "${formatted.state}"`);
          if (formatted.zip_code !== current.zip_code) changes.push(`Zip Code: "${current.zip_code}" → "${formatted.zip_code}"`);
          return changes;
        }
      );

      if (!result.success) {
        setAddressForm(prev => ({ ...prev, errors: result.errors || {} }));
        return;
      }

      // Save to database
      try {
        await updateProfileMutation.mutateAsync({
          memberId: member.id,
          updates: result.formattedData
        });

        // Success - exit edit mode and show message
        setAddressForm(prev => ({ ...prev, isEditing: false, errors: {} }));
        showSuccessMessage('Address Information', result.changes || []);
      } catch (error) {
        logger.error('Failed to update address', { error: (error as Error).message || String(error) });
        setAddressForm(prev => ({
          ...prev,
          errors: { _general: (error as Error).message || 'Failed to update address' }
        }));
      }
    },

    cancel: () => {
      setAddressForm(prev => ({ ...prev, isEditing: false, errors: {} }));
    }
  };

  /**
   * Personal info form handlers
   */
  const personalHandlers = {
    startEdit: () => {
      if (member) {
        setPersonalForm(prev => ({
          ...prev,
          isEditing: true,
          formData: {
            first_name: member.first_name,
            last_name: member.last_name,
            nickname: member.nickname || '',
            date_of_birth: member.date_of_birth ?? ''
          },
          errors: {}
        }));
      }
    },

    updateForm: (field: keyof PersonalFormData, value: string) => {
      setPersonalForm(prev => ({
        ...prev,
        formData: { ...prev.formData, [field]: value },
        errors: { ...prev.errors, [field]: '' }
      }));
    },

    save: async () => {
      if (!member) return;

      const result = processFormSubmission(
        personalInfoSchema,
        personalForm.formData,
        member,
        (data) => ({
          first_name: capitalizeWords(data.first_name),
          last_name: capitalizeWords(data.last_name),
          nickname: data.nickname?.trim() || null,
          date_of_birth: data.date_of_birth
        }),
        (formatted, current) => {
          const changes: string[] = [];
          if (formatted.first_name !== current.first_name) changes.push(`First Name: "${current.first_name}" → "${formatted.first_name}"`);
          if (formatted.last_name !== current.last_name) changes.push(`Last Name: "${current.last_name}" → "${formatted.last_name}"`);
          if (formatted.nickname !== current.nickname) changes.push(`Nickname: "${current.nickname || 'None'}" → "${formatted.nickname || 'None'}"`);
          if (formatted.date_of_birth !== current.date_of_birth) changes.push(`Date of Birth: "${current.date_of_birth}" → "${formatted.date_of_birth}"`);
          return changes;
        }
      );

      if (!result.success) {
        setPersonalForm(prev => ({ ...prev, errors: result.errors || {} }));
        return;
      }

      // Save to database
      try {
        await updateProfileMutation.mutateAsync({
          memberId: member.id,
          updates: result.formattedData
        });

        setPersonalForm(prev => ({ ...prev, isEditing: false, errors: {} }));
        showSuccessMessage('Personal Information', result.changes || []);
      } catch (error) {
        logger.error('Failed to update personal info', { error: (error as Error).message || String(error) });
        setPersonalForm(prev => ({
          ...prev,
          errors: { _general: (error as Error).message || 'Failed to update personal information' }
        }));
      }
    },

    cancel: () => {
      setPersonalForm(prev => ({ ...prev, isEditing: false, errors: {} }));
    }
  };

  /**
   * Contact info form handlers
   */
  const contactHandlers = {
    startEdit: () => {
      if (member) {
        setContactForm(prev => ({
          ...prev,
          isEditing: true,
          formData: {
            email: member.email ?? '',
            phone: member.phone ?? ''
          },
          errors: {}
        }));
      }
    },

    updateForm: (field: keyof ContactFormData, value: string) => {
      setContactForm(prev => ({
        ...prev,
        formData: { ...prev.formData, [field]: value },
        errors: { ...prev.errors, [field]: '' }
      }));
    },

    save: async () => {
      if (!member) return;

      const result = processFormSubmission(
        contactInfoSchema,
        contactForm.formData,
        member,
        (data) => ({
          email: data.email.toLowerCase(),
          phone: formatPhoneNumber(data.phone)
        }),
        (formatted, current) => {
          const changes: string[] = [];
          if (formatted.email !== current.email) changes.push(`Email: "${current.email}" → "${formatted.email}"`);
          if (formatted.phone !== current.phone) changes.push(`Phone: "${current.phone}" → "${formatted.phone}"`);
          return changes;
        }
      );

      if (!result.success) {
        setContactForm(prev => ({ ...prev, errors: result.errors || {} }));
        return;
      }

      // Save to database
      try {
        await updateProfileMutation.mutateAsync({
          memberId: member.id,
          updates: result.formattedData
        });

        setContactForm(prev => ({ ...prev, isEditing: false, errors: {} }));
        showSuccessMessage('Contact Information', result.changes || []);
      } catch (error) {
        logger.error('Failed to update contact info', { error: (error as Error).message || String(error) });
        setContactForm(prev => ({
          ...prev,
          errors: { _general: (error as Error).message || 'Failed to update contact information' }
        }));
      }
    },

    cancel: () => {
      setContactForm(prev => ({ ...prev, isEditing: false, errors: {} }));
    }
  };

  return {
    // Form states
    addressForm,
    personalForm,
    contactForm,
    successMessage,

    // Form handlers
    addressHandlers,
    personalHandlers,
    contactHandlers,
  };
};