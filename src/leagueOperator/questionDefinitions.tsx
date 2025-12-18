/**
 * @fileoverview Question Definitions for League Operator Application
 * Configuration objects for all survey questions in the application flow
 */
import React from 'react';
import type { LeagueOperatorApplication } from '../schemas/leagueOperatorSchema';
import type { ApplicationAction } from './types';
import type { Member } from '@/types';
import {
  leagueNameSchema,
  leagueEmailSchema,
  leaguePhoneSchema,
} from '../schemas/leagueOperatorSchema';
import { ContactInfoExposure } from '@/components/privacy/ContactInfoExposure';
import {
  organizationNameInfo,
  addressPrivacyInfo,
  emailContactInfo,
  phoneContactInfo,
  paymentInfoInfo,
} from '@/constants/infoContent/operatorApplicationInfoContent';
import {
  formatLeagueName,
  formatZipCode,
  formatPhoneNumber,
} from '../utils/formatters';
import { US_STATES } from '../constants/states';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PaymentCardForm } from '@/components/PaymentCardForm';
import { logger } from '@/utils/logger';

/**
 * Question configuration interface
 */
interface QuestionConfig {
  id: string;
  type?: 'input' | 'choice';
  title: string;
  subtitle?: string;
  placeholder?: string;
  formatter?: (value: string) => string;
  validator?: (value: string) => { isValid: boolean; error?: string };
  getValue: () => any;
  setValue: (value: any) => void;
  infoTitle?: string;
  infoContent?: React.ReactNode;
  choices?: Array<{
    value: string;
    label: string;
    variant?: 'default' | 'outline' | 'secondary';
  }>;
  content?: React.ReactNode;
  additionalContent?: React.ReactNode;
}

/**
 * Generate question definitions for the league operator application
 *
 * @param state - Current application state
 * @param dispatch - State dispatch function
 * @param member - User profile data
 * @param customAddress - Custom address state
 * @param setCustomAddress - Custom address setter
 * @param customCity - Custom city state
 * @param setCustomCity - Custom city setter
 * @param customState - Custom state value
 * @param setCustomState - Custom state setter
 * @param customZip - Custom zip state
 * @param setCustomZip - Custom zip setter
 * @param setShowSecurityDisclaimer - Security disclaimer modal setter
 * @param setShowSetupGuide - Setup guide modal setter
 */
export const getQuestionDefinitions = (
  state: LeagueOperatorApplication,
  dispatch: React.Dispatch<ApplicationAction>,
  member: Member | null,
  customAddress: string,
  setCustomAddress: (value: string) => void,
  customCity: string,
  setCustomCity: (value: string) => void,
  customState: string,
  setCustomState: (value: string) => void,
  customZip: string,
  setCustomZip: (value: string) => void,
  setShowSecurityDisclaimer: (show: boolean) => void,
  setShowSetupGuide: (show: boolean) => void
): QuestionConfig[] => [
  // Question 1: Organization Name
  {
    id: 'leagueName',
    title: 'What would you like to name your organization?',
    subtitle:
      'Your organization will hold all of the different leagues you want to run. Think of it as your league operator business name.',
    placeholder:
      "e.g., Ed's BCA Leagues, Downtown Pool Organization, Murphy's League System",
    formatter: formatLeagueName,
    validator: (value: string) => {
      try {
        leagueNameSchema.parse(value);
        return { isValid: true };
      } catch (error: unknown) {
        const zodError = error as { errors?: Array<{ message: string }> };
        return {
          isValid: false,
          error: zodError.errors?.[0]?.message || 'Invalid input',
        };
      }
    },
    getValue: () => state.leagueName,
    setValue: (value: string) =>
      dispatch({ type: 'SET_LEAGUE_NAME', payload: value }),
    infoTitle: organizationNameInfo.title,
    infoContent: organizationNameInfo.content,
  },

  // Question 2: Profile Address Choice
  {
    id: 'useProfileAddress',
    type: 'choice',
    title: 'Organization Address',
    subtitle: `Use this address for ${
      state.leagueName || 'your organization'
    }?`,
    content:
      state.useProfileAddress !== false && member ? (
        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="font-semibold text-gray-700 mb-2">
            Profile Address:
          </h4>
          <p className="text-gray-900">
            {member.address}
            <br />
            {member.city}, {member.state} {member.zip_code}
          </p>
        </div>
      ) : state.useProfileAddress !== false ? (
        <div className="bg-gray-50 p-4 rounded-lg">
          <p className="text-gray-600">Loading your profile address...</p>
        </div>
      ) : (
        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="font-semibold text-gray-700 mb-4">
            Enter Organization Address:
          </h4>
          <div className="space-y-4">
            <div>
              <Label htmlFor="org-address">Street Address</Label>
              <Input
                id="org-address"
                value={customAddress}
                onChange={(e) => {
                  setCustomAddress(e.target.value);
                  dispatch({
                    type: 'SET_ORGANIZATION_ADDRESS',
                    payload: e.target.value,
                  });
                }}
                placeholder="123 Main Street"
              />
            </div>
            <div>
              <Label htmlFor="org-city">City</Label>
              <Input
                id="org-city"
                value={customCity}
                onChange={(e) => {
                  setCustomCity(e.target.value);
                  dispatch({
                    type: 'SET_ORGANIZATION_CITY',
                    payload: e.target.value,
                  });
                }}
                placeholder="Springfield"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="org-state">State</Label>
                <Select
                  value={customState}
                  onValueChange={(value) => {
                    setCustomState(value);
                    dispatch({
                      type: 'SET_ORGANIZATION_STATE',
                      payload: value,
                    });
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    {US_STATES.map((stateCode) => (
                      <SelectItem key={stateCode} value={stateCode}>
                        {stateCode}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="org-zip">ZIP Code</Label>
                <Input
                  id="org-zip"
                  value={customZip}
                  onChange={(e) => {
                    const formatted = formatZipCode(e.target.value);
                    setCustomZip(formatted);
                    dispatch({
                      type: 'SET_ORGANIZATION_ZIP_CODE',
                      payload: formatted,
                    });
                  }}
                  placeholder="12345"
                />
              </div>
            </div>
          </div>
        </div>
      ),
    choices: [
      {
        value: 'yes',
        label: 'Use Profile Address',
        variant: 'default',
      },
      {
        value: 'no',
        label: 'Enter New Address',
        variant: 'outline',
      },
    ],
    getValue: () => state.useProfileAddress?.toString() || '',
    setValue: (value: string) => {
      const boolValue = value === 'yes';
      dispatch({ type: 'SET_USE_PROFILE_ADDRESS', payload: boolValue });
    },
    infoTitle: addressPrivacyInfo.title,
    infoContent: addressPrivacyInfo.content,
  },

  // Question 3: Contact Disclaimer
  {
    id: 'contactDisclaimer',
    type: 'choice',
    title: 'Contact Information Setup',
    subtitle:
      'How do you want players to contact you about joining your leagues?',
    content: (
      <div className="space-y-4 text-sm">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h4 className="font-semibold text-amber-800 mb-2">
            ⚠️ Security Warning
          </h4>
          <p className="text-amber-700 mb-3">
            Any contact information you provide as a League Operator will be made publicly available
            to players searching for leagues. This information will be visible
            on your league listings.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setShowSecurityDisclaimer(true)}
              className="text-xs bg-amber-100 hover:bg-amber-200 text-amber-800 px-3 py-1 rounded-md transition-colors"
            >
              Security Disclaimer
            </button>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-800 mb-2">
            💡 Professional Setup Recommendations
          </h4>
          <p className="text-blue-700 mb-3">
            Please read these insider tips that successful league operators use to build thriving, professional leagues and protect their privacy.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setShowSetupGuide(true)}
              className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-800 px-3 py-1 rounded-md transition-colors"
            >
              Setup Guide
            </button>
          </div>
        </div>

        {/* Agreement Checkbox */}
        <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={state.contactDisclaimerAcknowledged || false}
              onChange={(e) =>
                dispatch({
                  type: 'SET_CONTACT_DISCLAIMER_ACKNOWLEDGED',
                  payload: e.target.checked,
                })
              }
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
            />
            <span className="text-sm font-medium text-gray-900">
              I agree to the terms and acknowledge that my League Operator contact information may be made public
            </span>
          </label>
        </div>
      </div>
    ),
    choices: [],
    getValue: () =>
      state.contactDisclaimerAcknowledged ? 'agreed' : '',
    setValue: () => {
      // Handled by checkbox onChange
    },
  },

  // Question 4: League Email
  {
    id: 'leagueEmail',
    type: 'choice',
    title: 'League Contact Email',
    subtitle: `What email should players use to contact ${
      state.leagueName || 'your league'
    }?`,
    content: (
      <div className="space-y-6">
        {/* Email Display */}
        <div className="bg-gray-50 p-4 rounded-lg">
          {state.useProfileEmail !== false && member ? (
            <div>
              <h4 className="font-semibold text-gray-700 mb-2">
                Your Profile Email:
              </h4>
              <p className="text-gray-900 mb-4">
                {member.email}
              </p>
            </div>
          ) : state.useProfileEmail !== false ? (
            <div>
              <p className="text-gray-600 mb-4">Loading your profile email...</p>
            </div>
          ) : (
            <div>
              <h4 className="font-semibold text-gray-700 mb-4">
                Enter League Email:
              </h4>
              <div className="space-y-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    League Email Address
                  </label>
                  <input
                    type="email"
                    value={state.leagueEmail}
                    onChange={(e) => {
                      const value = e.target.value;
                      dispatch({
                        type: 'SET_LEAGUE_EMAIL',
                        payload: value,
                      });
                    }}
                    onBlur={(e) => {
                      // Validate email when user leaves the field
                      const value = e.target.value;
                      if (value) {
                        try {
                          leagueEmailSchema.parse(value);
                          e.target.setCustomValidity('');
                        } catch (error) {
                          e.target.setCustomValidity('Please enter a valid email address');
                        }
                      } else {
                        e.target.setCustomValidity('');
                      }
                    }}
                    placeholder="leaguename@gmail.com"
                    className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      state.leagueEmail && (() => {
                        try {
                          leagueEmailSchema.parse(state.leagueEmail);
                          return 'border-gray-300';
                        } catch {
                          return 'border-red-300 bg-red-50';
                        }
                      })()
                    }`}
                    required
                  />
                  {state.leagueEmail && (() => {
                    try {
                      leagueEmailSchema.parse(state.leagueEmail);
                      return null;
                    } catch (error) {
                      return (
                        <p className="mt-1 text-sm text-red-600">
                          Please enter a valid email address
                        </p>
                      );
                    }
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* Email Choice Buttons - Now inside the content area */}
          <div className="flex gap-3 pt-2 border-t">
            <button
              onClick={() => dispatch({ type: 'SET_USE_PROFILE_EMAIL', payload: true })}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                state.useProfileEmail === true
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              Use Profile Email
            </button>
            <button
              onClick={() => dispatch({ type: 'SET_USE_PROFILE_EMAIL', payload: false })}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                state.useProfileEmail === false
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              Enter New Email
            </button>
          </div>
        </div>

        {/* Email Visibility Settings - Show only if email is selected/entered */}
        {(state.useProfileEmail === true || (state.useProfileEmail === false && state.leagueEmail)) && (
          <div className="border-t pt-6">
            <ContactInfoExposure
              contactType="email"
              userRole="league_operator"
              selectedLevel={state.emailVisibility}
              onLevelChange={(level) => {
                dispatch({ type: 'SET_EMAIL_VISIBILITY', payload: level });
              }}
              title="Who can see your league email?"
              helpText="Choose who can access your email address for league-related communication."
            />
          </div>
        )}
      </div>
    ),
    choices: [],
    getValue: () => state.useProfileEmail?.toString() || '',
    setValue: (value: string) => {
      const boolValue = value === 'profile';
      dispatch({ type: 'SET_USE_PROFILE_EMAIL', payload: boolValue });
    },
    infoTitle: emailContactInfo.title,
    infoContent: emailContactInfo.content,
  },

  // Question 5: League Phone Number
  {
    id: 'leaguePhone',
    type: 'choice',
    title: 'League Contact Phone Number',
    subtitle: `What phone number should players use to contact ${
      state.leagueName || 'your league'
    }?`,
    content: (
      <div className="space-y-6">
        {/* Phone Display */}
        <div className="bg-gray-50 p-4 rounded-lg">
          {state.useProfilePhone !== false && member ? (
            <div>
              <h4 className="font-semibold text-gray-700 mb-2">
                Your Profile Phone:
              </h4>
              <p className="text-gray-900 mb-4">
                {member.phone || 'No phone number in profile'}
              </p>
            </div>
          ) : state.useProfilePhone !== false ? (
            <div>
              <p className="text-gray-600 mb-4">Loading your profile phone...</p>
            </div>
          ) : (
            <div>
              <h4 className="font-semibold text-gray-700 mb-4">
                Enter League Phone:
              </h4>
              <div className="space-y-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    League Phone Number
                  </label>
                  <input
                    type="tel"
                    value={state.leaguePhone}
                    onChange={(e) => {
                      const formatted = formatPhoneNumber(e.target.value);
                      dispatch({
                        type: 'SET_LEAGUE_PHONE',
                        payload: formatted,
                      });
                    }}
                    onBlur={(e) => {
                      // Validate phone when user leaves the field
                      const value = e.target.value;
                      if (value) {
                        try {
                          leaguePhoneSchema.parse(value);
                          e.target.setCustomValidity('');
                        } catch (error) {
                          e.target.setCustomValidity('Please enter a valid phone number');
                        }
                      } else {
                        e.target.setCustomValidity('');
                      }
                    }}
                    placeholder="(555) 123-4567"
                    className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      state.leaguePhone && (() => {
                        try {
                          leaguePhoneSchema.parse(state.leaguePhone);
                          return 'border-gray-300';
                        } catch {
                          return 'border-red-300 bg-red-50';
                        }
                      })()
                    }`}
                    required
                  />
                  {state.leaguePhone && (() => {
                    try {
                      leaguePhoneSchema.parse(state.leaguePhone);
                      return null;
                    } catch (error) {
                      return (
                        <p className="mt-1 text-sm text-red-600">
                          Please enter a valid phone number
                        </p>
                      );
                    }
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* Phone Choice Buttons - Inside the content area */}
          <div className="flex gap-3 pt-2 border-t">
            <button
              onClick={() => dispatch({ type: 'SET_USE_PROFILE_PHONE', payload: true })}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                state.useProfilePhone === true
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              Use Profile Phone
            </button>
            <button
              onClick={() => dispatch({ type: 'SET_USE_PROFILE_PHONE', payload: false })}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                state.useProfilePhone === false
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              Enter New Phone
            </button>
          </div>
        </div>

        {/* Phone Visibility Settings - Show only if phone is selected/entered */}
        {(state.useProfilePhone === true || (state.useProfilePhone === false && state.leaguePhone)) && (
          <div className="border-t pt-6">
            <ContactInfoExposure
              contactType="phone"
              userRole="league_operator"
              selectedLevel={state.phoneVisibility}
              onLevelChange={(level) => {
                dispatch({ type: 'SET_PHONE_VISIBILITY', payload: level });
              }}
              title="Who can see your league phone number?"
              helpText="Choose who can access your phone number for league-related communication."
            />
          </div>
        )}
      </div>
    ),
    choices: [],
    getValue: () => state.useProfilePhone?.toString() || '',
    setValue: (value: string) => {
      const boolValue = value === 'profile';
      dispatch({ type: 'SET_USE_PROFILE_PHONE', payload: boolValue });
    },
    infoTitle: phoneContactInfo.title,
    infoContent: phoneContactInfo.content,
  },

  // Question 6: Payment Information
  {
    id: 'paymentInfo',
    type: 'choice',
    title: 'Payment Information',
    subtitle: `Set up billing for ${state.leagueName || 'your league operation'}`,
    content: (
      <div className="space-y-6">
        {/* Reusable Payment Card Form */}
        <PaymentCardForm
          onVerificationSuccess={(cardData) => {
            dispatch({
              type: 'SET_PAYMENT_INFO',
              payload: cardData
            });
          }}
          onVerificationError={(error) => {
            logger.error('Payment verification failed', {
              error: error
            });
          }}
          showSuccess={state.paymentVerified}
          cardData={state.paymentVerified && state.paymentToken && state.cardLast4 && state.cardBrand && state.billingZip ? {
            paymentToken: state.paymentToken,
            cardLast4: state.cardLast4,
            cardBrand: state.cardBrand,
            expiryMonth: state.expiryMonth || 0,
            expiryYear: state.expiryYear || 0,
            billingZip: state.billingZip,
            paymentVerified: state.paymentVerified
          } : undefined}
        />
      </div>
    ),
    choices: [],
    getValue: () => state.paymentVerified ? 'verified' : '',
    setValue: () => {
      // Payment verification handled by the verify button
    },
    infoTitle: paymentInfoInfo.title,
    infoContent: paymentInfoInfo.content,
  },
];