/**
 * @fileoverview ApplicationPreview Component
 * Shows live preview of the league operator application being filled out
 */
import React from 'react';
import type { LeagueOperatorApplication as ApplicationData } from '../../schemas/leagueOperatorSchema';
import { useUserProfile } from '@/api/hooks';
import { getVisibilityLabel } from '@/components/privacy/ContactInfoExposure';

interface ApplicationPreviewProps {
  applicationData: ApplicationData;
}

/**
 * ApplicationPreview Component
 *
 * Displays a live preview of the application form as it's being filled out
 * Shows all sections with current values or placeholder text
 */
export const ApplicationPreview: React.FC<ApplicationPreviewProps> = ({
  applicationData,
}) => {
  const { member } = useUserProfile();
  return (
    <div className="bg-white rounded-xl shadow-lg px-8 py-4">
      <h3 className="text-xl font-bold text-gray-900 mb-2">
        Application Review
      </h3>
      <p className="text-gray-600 text-sm mb-6">
        Verify the information below before creating your organization.
      </p>

      <div className="space-y-6 text-sm">
        {/* Organization Information */}
        <div className="border-b border-gray-200 pb-4">
          <h4 className="font-semibold text-gray-700 mb-2">
            Organization Information
          </h4>
          {member ||
          applicationData.leagueName ||
          applicationData.useProfileAddress !== undefined ? (
            <div className="space-y-1">
              {member && (
                <div className="flex">
                  <span className="text-gray-500 w-32">Owner: </span>
                  <span className="text-gray-900 font-medium">
                    {member.first_name} {member.last_name}
                  </span>
                </div>
              )}
              {applicationData.leagueName && (
                <div className="flex">
                  <span className="text-gray-500 w-32">Name: </span>
                  <span className="text-gray-900 font-medium">
                    {applicationData.leagueName}
                  </span>
                </div>
              )}
              {applicationData.useProfileAddress && member && (
                <>
                  <div className="flex">
                    <span className="text-gray-500 w-32">Address: </span>
                    <span className="text-gray-900 font-medium">
                      {member.address}, {member.city}, {member.state}{' '}
                      {member.zip_code}
                    </span>
                  </div>
                  <div className="flex">
                    <span className="text-gray-500 w-32"></span>
                    <span className="text-xs text-gray-400">
                      Sanctioning purposes only
                    </span>
                  </div>
                </>
              )}
              {applicationData.useProfileAddress === false && (
                <>
                  <div className="flex">
                    <span className="text-gray-500 w-32">Address: </span>
                    <span className="text-gray-900 font-medium">
                      {applicationData.organizationAddress
                        ? `${applicationData.organizationAddress}${
                            applicationData.organizationCity
                              ? `, ${applicationData.organizationCity}`
                              : ''
                          }${
                            applicationData.organizationState
                              ? `, ${applicationData.organizationState}`
                              : ''
                          }${
                            applicationData.organizationZipCode
                              ? ` ${applicationData.organizationZipCode}`
                              : ''
                          }`
                        : 'Will enter custom address'}
                    </span>
                  </div>
                  {applicationData.organizationAddress && (
                    <div className="flex">
                      <span className="text-gray-500 w-32"></span>
                      <span className="text-xs text-gray-400">
                        Sanctioning purposes only
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="text-gray-400">
              No organization information added yet
            </div>
          )}
        </div>

        {/* Contact Information */}
        <div className="border-b border-gray-200 pb-4">
          <h4 className="font-semibold text-gray-700 mb-2">
            Contact Information
          </h4>
          {applicationData.useProfileEmail !== undefined ||
          applicationData.useProfilePhone !== undefined ? (
            <div className="space-y-1">
              {applicationData.useProfileEmail !== undefined && (
                <>
                  {applicationData.useProfileEmail && member && (
                    <div className="flex">
                      <span className="text-gray-500 w-32">Email: </span>
                      <span className="text-gray-900 font-medium">
                        {member.email}
                      </span>
                    </div>
                  )}
                  {applicationData.useProfileEmail === false &&
                    applicationData.leagueEmail && (
                      <div className="flex">
                        <span className="text-gray-500 w-32">Email: </span>
                        <span className="text-gray-900 font-medium">
                          {applicationData.leagueEmail}
                        </span>
                      </div>
                    )}
                  {applicationData.useProfileEmail === false &&
                    !applicationData.leagueEmail && (
                      <div className="flex">
                        <span className="text-gray-500 w-32">Email: </span>
                        <span className="text-gray-400">
                          Custom email will be entered
                        </span>
                      </div>
                    )}
                  {applicationData.emailVisibility && (
                    <div className="flex">
                      <span className="text-gray-500 w-32">
                        Email Visibility:{' '}
                      </span>
                      <span className="text-gray-700 text-xs">
                        {getVisibilityLabel(applicationData.emailVisibility)}
                      </span>
                    </div>
                  )}
                </>
              )}
              {applicationData.useProfilePhone !== undefined && (
                <>
                  {applicationData.useProfilePhone && member && (
                    <div className="flex">
                      <span className="text-gray-500 w-32">Phone: </span>
                      <span className="text-gray-900 font-medium">
                        {member.phone || 'No phone in profile'}
                      </span>
                    </div>
                  )}
                  {applicationData.useProfilePhone === false &&
                    applicationData.leaguePhone && (
                      <div className="flex">
                        <span className="text-gray-500 w-32">Phone: </span>
                        <span className="text-gray-900 font-medium">
                          {applicationData.leaguePhone}
                        </span>
                      </div>
                    )}
                  {applicationData.useProfilePhone === false &&
                    !applicationData.leaguePhone && (
                      <div className="flex">
                        <span className="text-gray-500 w-32">Phone: </span>
                        <span className="text-gray-400">
                          Custom phone will be entered
                        </span>
                      </div>
                    )}
                  {applicationData.phoneVisibility && (
                    <div className="flex">
                      <span className="text-gray-500 w-32">
                        Phone Visibility:{' '}
                      </span>
                      <span className="text-gray-700 text-xs">
                        {getVisibilityLabel(applicationData.phoneVisibility)}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="text-gray-400">
              No contact information added yet
            </div>
          )}
        </div>

        {/* Payment Information */}
        <div>
          <h4 className="font-semibold text-gray-700 mb-2">
            Payment Information
          </h4>
          {applicationData.paymentVerified ? (
            <div className="space-y-1">
              <div className="flex">
                <span className="text-gray-500 w-32">Method: </span>
                <span className="text-gray-900 font-medium">
                  {applicationData.cardBrand?.toUpperCase()} ending in{' '}
                  {applicationData.cardLast4}
                </span>
              </div>
            </div>
          ) : (
            <div className="text-gray-400">
              No payment information added yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
