/**
 * @fileoverview Short Profile Registration Form Component
 *
 * A minimal form for collecting essential player information during registration.
 * This replaces the full NewPlayerForm as the default registration experience.
 *
 * Collects only:
 * - First Name, Last Name (identity)
 * - Nickname (optional, auto-generated if empty)
 * - City, State (for PP fuzzy matching)
 *
 * Users can complete their full profile (phone, address, DOB) later in settings.
 */
import React from 'react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { US_STATES } from '../constants/states';
import { useShortProfileForm } from './useShortProfileForm';
import { useShortProfileSubmission } from './useShortProfileSubmission';
import { TextField, SelectField } from '../newPlayer/FormField';
import { nicknameInfo } from '../constants/infoContent/profileInfoContent';

/**
 * Short Profile Registration Form Component
 *
 * Provides a streamlined registration experience by collecting only
 * essential information. The city/state fields enable PP fuzzy matching
 * for users who may already exist as placeholder players.
 *
 * Features:
 * - Minimal required fields for quick registration
 * - Auto-generated nickname if not provided
 * - City/State for PP detection
 * - Field-level validation with Zod schema
 */
export const CompleteProfileForm: React.FC = () => {
  const { state, dispatch } = useShortProfileForm();

  const { handleSubmit } = useShortProfileSubmission({
    state,
    onError: (errors) => dispatch({ type: 'SET_ERRORS', errors }),
    onSuccess: () => dispatch({ type: 'CLEAR_ERRORS' }),
    onLoading: (loading) => dispatch({ type: 'SET_LOADING', loading }),
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        backTo="/"
        backLabel="Back to Home"
        title="Complete Your Profile"
        subtitle="Just a few details to get you started"
      />

      <div className="p-4 max-w-lg mx-auto">
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <TextField
                id="firstName"
                label="First Name"
                value={state.firstName}
                onChange={(value) =>
                  dispatch({ type: 'SET_FIELD', field: 'firstName', value })
                }
                placeholder="Enter first name"
                error={state.errors.firstName}
                required
              />

              <TextField
                id="lastName"
                label="Last Name"
                value={state.lastName}
                onChange={(value) =>
                  dispatch({ type: 'SET_FIELD', field: 'lastName', value })
                }
                placeholder="Enter last name"
                error={state.errors.lastName}
                required
              />

              <TextField
                id="nickname"
                label="Nickname"
                value={state.nickname}
                onChange={(value) =>
                  dispatch({ type: 'SET_FIELD', field: 'nickname', value })
                }
                placeholder="Enter nickname (max 12 characters)"
                maxLength={12}
                error={state.errors.nickname}
                infoTitle={nicknameInfo.title}
                infoContent={nicknameInfo.contentWithChangeNote}
              />

              <TextField
                id="city"
                label="City"
                value={state.city}
                onChange={(value) =>
                  dispatch({ type: 'SET_FIELD', field: 'city', value })
                }
                placeholder="Enter your city"
                error={state.errors.city}
                required
              />

              <SelectField
                label="State"
                value={state.state}
                onValueChange={(value) =>
                  dispatch({ type: 'SET_FIELD', field: 'state', value })
                }
                placeholder="Select a state"
                options={US_STATES}
                error={state.errors.state}
                required
              />

              {/* General error messages (like database errors) */}
              {state.errors.general && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-600">{state.errors.general}</p>
                </div>
              )}

              <Button
                type="submit"
                loadingText="Creating Profile..."
                isLoading={state.isLoading}
                disabled={state.isLoading}
              >
                Complete Registration
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
