/**
 * @fileoverview ShareAppCard — a card with a QR code and share/copy buttons
 * for the current site URL.
 *
 * Encodes whatever the app is currently served from (window.location.origin).
 * On production that is rackemleagues.com; on staging it is
 * staging.rackemleagues.com. This is intentional — share-where-you-are means
 * operators can show a QR at the venue and it sends people to the same
 * environment they themselves are on.
 *
 * Two actions exposed:
 *   - Copy link: always copies origin to the clipboard
 *   - Share:     uses navigator.share (native share sheet on mobile),
 *                falls back to clipboard copy on desktop or unsupported
 *                browsers
 */

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, Share2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { copyText } from '@/utils/clipboard';

interface ShareAppCardProps {
  /**
   * Optional heading override. Defaults to "Share the App".
   */
  title?: string;
  /**
   * Optional description override. Defaults to a generic invite line.
   */
  description?: string;
  /**
   * Optional URL override. Defaults to window.location.origin.
   * Useful for future context-aware shares (e.g. captain invite link).
   */
  url?: string;
}


export const ShareAppCard: React.FC<ShareAppCardProps> = ({
  title = 'Share the App',
  description = 'Scan the QR code or share the link with your teammates.',
  url,
}) => {
  const shareUrl = url ?? (typeof window !== 'undefined' ? window.location.origin : '');
  const [justCopied, setJustCopied] = useState(false);

  const handleCopy = async () => {
    const ok = await copyText(shareUrl);
    if (ok) {
      setJustCopied(true);
      toast.success('Link copied to clipboard');
      setTimeout(() => setJustCopied(false), 2000);
    } else {
      toast.error('Could not copy link');
    }
  };

  const handleShare = async () => {
    // Native share sheet on mobile (iOS/Android). Falls back to copy on desktop.
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: "Rack'em Leagues",
          text: 'Check out Rack\'em Leagues — pool league management.',
          url: shareUrl,
        });
        return;
      } catch (err) {
        // User cancelled — do nothing. Any other error falls through to copy.
        if (err instanceof Error && err.name === 'AbortError') return;
      }
    }
    await handleCopy();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <div className="bg-card p-3 rounded-md border shrink-0">
          <QRCodeSVG value={shareUrl} size={160} level="M" includeMargin={false} />
        </div>
        <div className="flex flex-col gap-3 w-full">
          <div className="break-all text-sm text-muted-foreground font-mono">{shareUrl}</div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={handleCopy} className="flex-1">
              {justCopied ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy link
                </>
              )}
            </Button>
            <Button variant="default" loadingText="none" onClick={handleShare} className="flex-1">
              <Share2 className="mr-2 h-4 w-4" />
              Share
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
