/**
 * @fileoverview SetupGuideModal Component
 * Modal component for displaying professional league setup recommendations
 */
import React from 'react';

interface SetupGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * SetupGuideModal Component
 *
 * Displays comprehensive guide for setting up professional league contact methods
 * including email, Google Voice, and social media recommendations with difficulty
 * levels indicated by color coding.
 *
 * @param isOpen - Whether the modal is currently visible
 * @param onClose - Function to call when user wants to close the modal
 */
export const SetupGuideModal: React.FC<SetupGuideModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div
        className="bg-card rounded-lg p-6 max-w-2xl max-h-96 overflow-y-scroll"
        style={{ scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 #f1f5f9' }}
      >
        <h3 className="text-lg font-bold mb-4">
          Professional League Setup Guide
        </h3>
        <div className="space-y-4 text-sm">
          {/* Email Setup Section */}
          <div>
            <h4 className="font-semibold">
              1. Create Dedicated Email (Highly Recommended)
            </h4>
            <p>• Google, Outlook, Yahoo and more give FREE email addresses</p>
            <p>• Easy naming format: [YourLeagueName]@gmail.com</p>
            <p>• Example: "MidTownBCALeagues@gmail.com"</p>
            <p>• Keep separate from personal email</p>
            <p>• (Optional) Forward into your personal email</p>
            <p>• (Optional) Filter into separate folders</p>
            <div className="mt-2 text-green-600 font-medium">
              This is FREE and EASY - should be done at minimum
            </div>
          </div>

          {/* Google Voice Section */}
          <div>
            <h4 className="font-semibold">2. Google Voice (Recommended)</h4>
            <p>• Get a FREE professional business phone number</p>
            <p>• Works like a real business line with multiple "employees"</p>
            <p>• Ring multiple phones - share with co-operators/assistants</p>
            <p>• Professional voicemail with custom greeting</p>
            <p>• Text messaging capabilities for quick responses</p>
            <p>• Use through mobile app or web interface</p>
            <p>• Set business hours - calls go to voicemail after hours</p>
            <p>• Turn on/off anytime - full control</p>
            <p>• Appears completely separate from personal number</p>
            <div className="mt-2 text-blue-600 font-medium">
              Creates a legitimate business presence that players will trust
            </div>
          </div>

          {/* Social Media Section */}
          <div>
            <h4 className="font-semibold">
              3. Social Media Accounts (Optional)
            </h4>
            <p>• Facebook Business Page (not personal profile)</p>
            <p>• Instagram: @YourLeagueName</p>
            <p>• Twitter/X: @YourLeagueName</p>
            <div className="mt-2 text-amber-600 font-medium">
              Regular posting can grow your league and increase venue patronage
            </div>
            <div className="mt-1 text-amber-700 text-xs">
              Note: Requires ongoing effort and content creation to be effective
            </div>
            <div className="mt-1 text-muted-foreground text-xs">
              Coming soon: App integration for social media functionality
            </div>
          </div>

          {/* Simple/Small League Option */}
          <div>
            <h4 className="font-semibold">
              4. Keep It Simple (For Small Leagues)
            </h4>
            <p>• Set PUBLIC contact to in-app only</p>
            <p>• Make email public to league members</p>
            <p>• Give phone number personally to select players</p>
            <div className="mt-2 text-muted-foreground font-medium">
              Fine for smaller and single leagues
            </div>
            <div className="mt-1 text-foreground text-xs">
              Note: Only recommended if you don't plan to grow beyond a couple
              small leagues
            </div>
          </div>

          {/* Professional Benefits Section */}
          <div className="mt-4 pt-4 border-t border-border">
            <h4 className="font-semibold text-foreground mb-2">
              Why Separate Your Personal Information?
            </h4>
            <p className="text-muted-foreground leading-relaxed">
              Setting up dedicated league contact methods protects your personal
              privacy while presenting a professional, organized image to
              players. When players see dedicated business email addresses and
              phone numbers, they immediately recognize you as a serious,
              trustworthy league operator. Plus, these dedicated channels can be
              easily shared with co-operators or assistants, making it simple to
              manage your growing league operations without compromising your
              personal information.
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Close
        </button>
      </div>
    </div>
  );
};
