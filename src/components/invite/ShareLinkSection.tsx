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
  /**
   * Optional ready-to-send invite message (already including the link). When
   * provided, a primary "Copy invite message" button is shown so the sharer can
   * paste a friendly, self-explanatory text — not a naked URL — straight into a
   * text/email. The bare-link copy + QR (which key on `registrationLink`) stay
   * as a secondary "just the link" affordance. When omitted, this component
   * behaves exactly as before (link-only).
   */
  shareMessage?: string;
}

/**
 * Copy a string to the clipboard with a document.execCommand fallback for
 * browsers without the async clipboard API. Returns nothing — callers manage
 * their own "copied" UI state.
 */
const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Fallback for browsers that don't support the clipboard API
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
  }
};

/**
 * ShareLinkSection Component
 *
 * Provides copy link and QR code functionality for sharing invite links.
 */
export const ShareLinkSection: React.FC<ShareLinkSectionProps> = ({
  registrationLink,
  isStaging = false,
  shareMessage,
}) => {
  const [copied, setCopied] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);
  const [showQrCode, setShowQrCode] = useState(false);

  /**
   * Copy the bare registration link to clipboard.
   */
  const handleCopyLink = async () => {
    await copyToClipboard(registrationLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  /**
   * Copy the full ready-to-send invite message (blurb + link) to clipboard.
   */
  const handleCopyMessage = async () => {
    if (!shareMessage) return;
    await copyToClipboard(shareMessage);
    setCopiedMessage(true);
    setTimeout(() => setCopiedMessage(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Ready-to-send invite message — only when a shareMessage is supplied.
          This is the primary action for the captain flow: one tap copies a
          friendly, self-explanatory text the player can act on. */}
      {shareMessage && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Invite message</Label>
          <p className="text-xs text-muted-foreground">
            Copy a ready-to-send message (with the link) and paste it into a text
            or email to your players.
          </p>
          <div className="rounded-md border bg-muted p-3 text-xs whitespace-pre-wrap text-muted-foreground">
            {shareMessage}
          </div>
          <Button
            type="button"
            variant="default"
            loadingText="none"
            onClick={handleCopyMessage}
            className="w-full gap-2"
          >
            {copiedMessage ? (
              <>
                <Check className="h-4 w-4" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy invite message
              </>
            )}
          </Button>
        </div>
      )}

      {/* Share Link */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">
          {shareMessage ? 'Or just the link' : 'Share Registration Link'}
        </Label>
        <p className="text-xs text-muted-foreground">
          Copy the link to share via text, social media, or other messaging apps.
        </p>

        {/* Environment Warning - staging only */}
        {isStaging && (
          <div className="flex items-start gap-2 p-3 bg-info/10 border border-info/40 rounded-lg">
            <AlertTriangle className="h-4 w-4 text-info mt-0.5 shrink-0" />
            <div className="text-xs text-info">
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
              <Check className="h-4 w-4 text-success" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
        {copied && (
          <p className="text-xs text-success">Link copied to clipboard!</p>
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
