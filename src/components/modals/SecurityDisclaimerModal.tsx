/**
 * @fileoverview SecurityDisclaimerModal Component
 * Modal component for displaying security disclaimer about public contact information
 */
import React from 'react';

interface SecurityDisclaimerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * SecurityDisclaimerModal Component
 *
 * Displays legal disclaimer about contact information being made public
 * and potential consequences. Includes liability protection language.
 *
 * @param isOpen - Whether the modal is currently visible
 * @param onClose - Function to call when user wants to close the modal
 */
export const SecurityDisclaimerModal: React.FC<
  SecurityDisclaimerModalProps
> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-card rounded-lg p-6 max-w-2xl max-h-96 overflow-y-auto">
        <h3 className="text-lg font-bold mb-4">Security Disclaimer</h3>
        <div className="space-y-3 text-sm">
          <p>
            <strong>Public Information Warning:</strong> Any contact information
            you choose to provide as a League Operator will be made publicly
            available to players searching for leagues through our platform.
          </p>

          <p>
            <strong>Your Responsibility:</strong> You acknowledge and accept
            full responsibility for any consequences that may result from
            publishing your contact information publicly, including but not
            limited to unwanted communications, solicitation, harassment, or
            other issues.
          </p>

          <p>
            <strong>Platform Liability:</strong> Our platform serves only as a
            conduit for information you choose to make public. We accept no
            responsibility or liability for any problems, damages, or
            consequences arising from your decision to publish contact
            information.
          </p>

          <p>
            <strong>Recommendation:</strong> We strongly advise using
            recommended business contact methods rather than personal
            information to minimize risk.
          </p>

          <p>
            <strong>Your Choice:</strong> Publication of contact information is
            entirely voluntary and at your own risk.
          </p>
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
