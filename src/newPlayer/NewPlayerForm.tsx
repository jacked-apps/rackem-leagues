/**
 * @fileoverview New Player Application Form Component
 * A comprehensive form for collecting player information with validation and state management
 */
import React from 'react';
import { Button } from '@/components/ui/button';
import { LoginCard } from '../login/LoginCard';
import { US_STATES } from '../constants/states';
import { formatPhoneNumber } from '../utils/formatters';
import { usePlayerForm } from './usePlayerForm';
import { usePlayerFormSubmission } from './usePlayerFormSubmission';
import { TextField, SelectField } from './FormField';
import { nicknameInfo } from '../constants/infoContent/profileInfoContent';
import { DateField } from '@/components/forms/DateField';

// TODO: Future feature - Add country selection for international phone numbers
// This would allow proper validation of international formats

/**
 * New Player Application Form Component
 *
 * This form collects comprehensive player information including:
 * - Personal details (name, nickname, date of birth)
 * - Contact information (phone, email)
 * - Address information (street, city, state, zip)
 *
 * Features:
 * - Real-time phone number formatting
 * - Field-level validation with Zod schema
 * - Accessible form with proper labels and error messages
 * - Form submission with Enter key support
 * - State management using useReducer pattern
 */
export const NewPlayerForm: React.FC = () => {
  // Form state management - handles all field values and validation errors
  const { state, dispatch } = usePlayerForm();

  // Form submission logic - handles validation and data processing
  const { handleSubmit } = usePlayerFormSubmission({
    state,
    onError: (errors) => dispatch({ type: 'SET_ERRORS', errors }), // Set validation errors
    onSuccess: () => dispatch({ type: 'CLEAR_ERRORS' }), // Clear errors on success
    onLoading: (loading) => dispatch({ type: 'SET_LOADING', loading }), // Handle loading state
  });

  return (
    <LoginCard
      title="New Player Application"
      description="Let's start with your basic information"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <TextField
          id="firstName"
          label="First Name"
          value={state.firstName}
          onChange={(value) => dispatch({ type: 'SET_FIELD', field: 'firstName', value })}
          placeholder="Enter first name"
          error={state.errors.firstName}
          required
        />

        <TextField
          id="lastName"
          label="Last Name"
          value={state.lastName}
          onChange={(value) => dispatch({ type: 'SET_FIELD', field: 'lastName', value })}
          placeholder="Enter last name"
          error={state.errors.lastName}
          required
        />

        <TextField
          id="nickname"
          label="Nickname"
          value={state.nickname}
          onChange={(value) => dispatch({ type: 'SET_FIELD', field: 'nickname', value })}
          placeholder="Enter nickname (max 12 characters)"
          maxLength={12}
          error={state.errors.nickname}
          infoTitle={nicknameInfo.title}
          infoContent={nicknameInfo.contentWithChangeNote}
        />

        {/* Phone number field with real-time formatting */}
        <TextField
          id="phone"
          label="Phone Number"
          value={state.phone}
          onChange={(value) => {
            // Apply real-time formatting as user types (e.g., "1234567890" becomes "123-456-7890")
            const formatted = formatPhoneNumber(value);
            dispatch({ type: 'SET_FIELD', field: 'phone', value: formatted });
          }}
          placeholder="123-456-7890"
          maxLength={12} // Limit to formatted length: XXX-XXX-XXXX
          error={state.errors.phone}
          required
        />

        {/* Email is automatically pulled from auth user - no need to enter it */}

        <TextField
          id="address"
          label="Address"
          value={state.address}
          onChange={(value) => dispatch({ type: 'SET_FIELD', field: 'address', value })}
          placeholder="Enter street address"
          error={state.errors.address}
          required
        />

        <TextField
          id="city"
          label="City"
          value={state.city}
          onChange={(value) => dispatch({ type: 'SET_FIELD', field: 'city', value })}
          placeholder="Enter city"
          error={state.errors.city}
          required
        />

        <SelectField
          label="State"
          value={state.state}
          onValueChange={(value) => dispatch({ type: 'SET_FIELD', field: 'state', value })}
          placeholder="Select a state"
          options={US_STATES}
          error={state.errors.state}
          required
        />

        <TextField
          id="zipCode"
          label="Zip Code"
          value={state.zipCode}
          onChange={(value) => dispatch({ type: 'SET_FIELD', field: 'zipCode', value })}
          placeholder="Enter zip code"
          error={state.errors.zipCode}
          required
        />

        <DateField
          label="Date of Birth"
          value={state.dateOfBirth}
          onChange={(value) => dispatch({ type: 'SET_FIELD', field: 'dateOfBirth', value })}
          placeholder="Select date of birth"
          error={state.errors.dateOfBirth}
          required
        />

        {/* Show general error messages (like database errors) */}
        {state.errors.general && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{state.errors.general}</p>
          </div>
        )}

        <Button type="submit" loadingText="Submitting Application..." isLoading={state.isLoading} disabled={state.isLoading}>
          Submit Application
        </Button>
      </form>
    </LoginCard>
  );
};
