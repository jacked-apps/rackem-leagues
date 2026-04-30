/**
 * @fileoverview Member Profile Page Component - Refactored
 *
 * This component has been heavily refactored to be clean and maintainable.
 * All complex form logic has been extracted into:
 * - useProfileForm hook (state management)
 * - Section components (PersonalInfoSection, ContactInfoSection, AddressSection)
 * - Validation schemas (validationSchemas.ts)
 * - Type definitions (types.ts)
 *
 * STRUCTURE:
 * 1. Authentication check
 * 2. Success message display
 * 3. Account details (read-only info)
 * 4. Membership status (read-only with color coding)
 * 5. Editable sections (personal, contact, address)
 */
import React from 'react';
import { useUser } from '../context/useUser';
import { useUserProfile } from '@/api/hooks';
import { LoginCard } from '../login/LoginCard';
import { getMembershipStatus, formatDueDate, getDuesStatusStyling } from '../utils/membershipUtils';
import { useProfileForm } from './useProfileForm';
import { SuccessMessage } from './SuccessMessage';
import { PersonalInfoSection } from './PersonalInfoSection';
import { ContactInfoSection } from './ContactInfoSection';
import { AddressSection } from './AddressSection';
import { PrivacySettingsSection } from './PrivacySettingsSection';
import { PageHeader } from '@/components/PageHeader';

/**
 * Member Profile Page Component
 *
 * Displays comprehensive member information with editing capabilities:
 * - Personal information (name, nickname, contact details)
 * - Address information
 * - Account details and BCA member number
 * - Membership dues status with visual indicators
 *
 * Features:
 * - Color-coded dues status (green=paid, red=overdue, yellow=never paid)
 * - Section-based editing with validation
 * - Real-time success feedback
 * - Comprehensive member data display
 */
export const Profile: React.FC = () => {
  const { user } = useUser();
  const { member, loading } = useUserProfile();

  // Get all form state and handlers from custom hook
  const {
    addressForm,
    personalForm,
    contactForm,
    successMessage,
    addressHandlers,
    personalHandlers,
    contactHandlers,
  } = useProfileForm();

  // Show login form if user is not authenticated
  if (!user) {
    return (
      <LoginCard title="Member Profile">
        Please log in to view your profile.
      </LoginCard>
    );
  }

  // Show loading state while fetching member data
  if (loading) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <div className="text-muted-foreground">Loading your profile...</div>
      </div>
    );
  }

  // Show error if member data is not available
  if (!member) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground mb-4">Profile Not Found</h2>
          <p className="text-muted-foreground">
            We couldn't find your member profile. Please contact support if this error persists.
          </p>
        </div>
      </div>
    );
  }

  // Get membership status and styling for dues display
  const membershipStatus = getMembershipStatus(member.membership_paid_date);
  const duesStatusStyling = getDuesStatusStyling(membershipStatus.status);

  return (
    <div className="min-h-screen bg-muted">
      <PageHeader
        backTo="/dashboard"
        backLabel="Dashboard"
        title="Player Settings"
        subtitle="Manage your personal information and account details"
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Success Message */}
        <SuccessMessage message={successMessage} />

        <div className="space-y-6">
          {/* Editable Sections */}
          <PersonalInfoSection
            member={member}
            form={personalForm}
            handlers={personalHandlers}
          />

          <ContactInfoSection
            member={member}
            form={contactForm}
            handlers={contactHandlers}
          />

          <AddressSection
            member={member}
            form={addressForm}
            handlers={addressHandlers}
          />

          {/* Privacy Settings Section */}
          <PrivacySettingsSection />

          {/* BCA Membership Status Section (Read-Only) */}
          <div className="bg-card rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">BCA Membership Status</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <span className="text-sm font-medium text-muted-foreground">BCA Member Number</span>
                <p className="text-foreground font-mono">
                  {member.bca_member_number || 'Not assigned'}
                </p>
              </div>
              <div>
                <span className="text-sm font-medium text-muted-foreground">Dues Status</span>
                <div className="flex items-center mt-1">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${duesStatusStyling.badgeColor}`}
                  >
                    {membershipStatus.status}
                  </span>
                </div>
              </div>
              <div>
                <span className="text-sm font-medium text-muted-foreground">Dues Paid Through</span>
                <p className={`text-sm ${duesStatusStyling.textColor}`}>
                  {formatDueDate(member.membership_paid_date)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};