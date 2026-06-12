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
import { Link } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/PageHeader';
import { ShareAppCard } from '@/components/ShareAppCard';
import { InstallAppCard } from '@/components/InstallAppCard';
import { ThemeToggle } from '@/components/ThemeToggle';
// --- Handicap Calculator entry point (dev/staging only) — remove this import + the marked block at the bottom of the page to remove the entry point ---
import { isProduction } from '@/config/environment';

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
  const { user, logout } = useUser();
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
        title="Player Settings"
        subtitle="Manage your personal information and account details"
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Success Message */}
        <SuccessMessage message={successMessage} />

        <div className="space-y-6">
          {/* Install the app — top of settings. Renders nothing when the app is
              already installed or the browser can't install. */}
          <InstallAppCard />

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
          {/* Share the app with teammates */}
          <ShareAppCard
            title="Invite teammates"
            description="Scan the QR code or share the link to get your teammates on Rack'em Leagues."
          />

          {/* Become League Operator CTA — only for regular players */}
          {member.role === 'player' && (
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold text-foreground mb-2">
                  Run Your Own League?
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Become a league operator and manage pool leagues at your local venue
                </p>
                <Link to="/become-league-operator">
                  <Button variant="outline" loadingText="none" className="w-full">
                    Learn More
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Account — appearance + sign out. Lives here (not in nav) since
              they're infrequent actions, not at-your-fingertips ones. */}
          <Card>
            <CardContent className="p-6 space-y-6">
              <div>
                <h3 className="font-semibold text-foreground mb-1">Appearance</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Choose how Rack 'Em looks on this device.
                </p>
                <ThemeToggle />
              </div>
              <div className="border-t pt-6">
                <h3 className="font-semibold text-foreground mb-1">Sign Out</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  End your session on this device.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  loadingText="none"
                  onClick={logout}
                  className="w-full sm:w-auto gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* --- Handicap Calculator entry point (dev/staging only) — remove this block + the import above to remove the entry point --- */}
          {!isProduction && (
            <div className="flex justify-center pt-2">
              <Button variant="ghost" size="sm" asChild>
                <Link to="/tools/calc" className="text-xs text-muted-foreground">
                  LMS Calc
                </Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};