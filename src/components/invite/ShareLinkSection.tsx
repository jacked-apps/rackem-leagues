/**
 * @fileoverview ShareLinkSection Component
 *
 * Section for sharing registration links via copy or QR code.
 * Used in InvitePlayerModal to provide alternative invite methods.
 *
 * Features:
 * - Copy link to clipboard
 * - Expandable QR code display
 * - Staging environment warning
 *
 * @example
 * <ShareLinkSection
 *   registrationLink={registrationLink}
 *   isStaging={isStaging}
 * />
 */

import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Copy, Check, QrCode, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';

interface ShareLinkSectionProps {
  /** The registration link to share */
  registrationLink: string;
  /** Whether this is a staging environment */
  isStaging?: boolean;
}

/**
 * ShareLinkSection Component
 *
 * Provides copy link and QR code functionality for sharing invite links.
 */
export const ShareLinkSection: React.FC<ShareLinkSectionProps> = ({
  registrationLink,
  isStaging = false,
}) => {
  const [copied, setCopied] = useState(false);
  const [showQrCode, setShowQrCode] = useState(false);

  /**
   * Copy registration link to clipboard
   */
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(registrationLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = registrationLink;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-4">
      {/* Share Link */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Share Registration Link</Label>
        <p className="text-xs text-muted-foreground">
          Copy the link to share via text, social media, or other messaging apps.
        </p>

        {/* Environment Warning - staging only */}
        {isStaging && (
          <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <AlertTriangle className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
            <div className="text-xs text-blue-800">
              <p className="font-medium">Staging Environment</p>
              <p>This link points to the staging site, not production.</p>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Input
            readOnly
            value={registrationLink}
            className="flex-1 text-sm bg-muted"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleCopyLink}
            className="shrink-0"
            title="Copy link"
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-600" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
        {copied && (
          <p className="text-xs text-green-600">Link copied to clipboard!</p>
        )}
      </div>

      {/* QR Code */}
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setShowQrCode(!showQrCode)}
          className="flex items-center justify-between w-full text-left"
        >
          <div className="flex items-center gap-2">
            <QrCode className="h-4 w-4 text-muted-foreground" />
            <Label className="text-sm font-medium cursor-pointer">Show QR Code</Label>
          </div>
          {showQrCode ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {showQrCode && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Have the player scan this code with their phone to register.
            </p>
            <div className="flex justify-center p-4 bg-card rounded-lg border">
              <QRCodeSVG
                value={registrationLink}
                size={180}
                level="M"
                includeMargin={true}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
