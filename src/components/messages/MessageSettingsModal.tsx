/**
 * @fileoverview Message Settings Modal
 *
 * Accordion-style settings menu for messaging features:
 * - Privacy & Safety (profanity filter, block list, reports)
 * - Notifications (future)
 * - Preferences (future)
 */

import { useState } from 'react';
import { Shield, Lock, UserX, Flag, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useProfanityFilter } from '@/hooks/useProfanityFilter';
import { useUpdateProfanityFilter } from '@/api/hooks';
import { useUser } from '@/context/useUser';
import { useMemberId } from '@/api/hooks';
import { BlockedUsersModal } from './BlockedUsersModal';
import { Modal } from '@/components/shared';

interface MessageSettingsModalProps {
  onClose: () => void;
  onUnblocked?: () => void; // Callback when a user is unblocked
}

export function MessageSettingsModal({ onClose, onUnblocked }: MessageSettingsModalProps) {
  const { user } = useUser();
  const memberId = useMemberId();
  const { shouldFilter, canToggle, isLoading } = useProfanityFilter();
  const updateMutation = useUpdateProfanityFilter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showBlockedUsersModal, setShowBlockedUsersModal] = useState(false);

  const handleToggleProfanityFilter = async () => {
    if (!user || !canToggle) return;

    const newValue = !shouldFilter;

    setError(null);
    setSuccess(false);

    try {
      await updateMutation.mutateAsync({ userId: user.id, enabled: newValue });
      setSuccess(true);

      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccess(false);
      }, 3000);
    } catch (err) {
      setError('Failed to update profanity filter. Please try again.');
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="Message Settings">
      <Modal.Body className="space-y-4">
        {success && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-md">
            <p className="text-sm text-green-700 font-medium">
              Settings saved successfully!
            </p>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Settings Content */}
          <Accordion type="single" collapsible className="w-full space-y-2">
            {/* Privacy & Safety Section */}
            <AccordionItem value="privacy" className="border rounded-lg">
              <AccordionTrigger className="px-4 hover:no-underline hover:bg-muted">
                <div className="flex items-center gap-3">
                  <Shield className="h-5 w-5 text-purple-600" />
                  <div className="text-left">
                    <div className="font-semibold">Privacy & Safety</div>
                    <div className="text-sm text-muted-foreground font-normal">
                      Content filtering, blocked users, and reports
                    </div>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 space-y-4">
                {/* Profanity Filter */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Shield className="h-4 w-4" />
                    Profanity Filter
                  </div>

                  {isLoading ? (
                    <div className="p-3 bg-muted rounded-md">
                      <p className="text-sm text-muted-foreground">Loading...</p>
                    </div>
                  ) : (
                    <div className="p-3 bg-muted rounded-md space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Label className="text-sm font-medium text-foreground">
                              Filter inappropriate language
                            </Label>
                            {!canToggle && (
                              <Lock className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Control how profanity appears in your messages
                          </p>
                        </div>

                        <Switch
                          checked={shouldFilter}
                          onCheckedChange={handleToggleProfanityFilter}
                          disabled={!canToggle || updateMutation.isPending}
                          className="ml-3"
                        />
                      </div>

                      {/* Status Badge & Explanation */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground font-medium">Status:</span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            shouldFilter
                              ? 'bg-green-100 text-green-800'
                              : 'bg-muted text-foreground'
                          }`}>
                            {shouldFilter ? 'Enabled' : 'Disabled'}
                          </span>
                        </div>

                        <div className="p-2 bg-card rounded border border-border">
                          <p className="text-xs text-foreground">
                            {shouldFilter ? (
                              <>
                                <strong className="text-green-700">Enabled:</strong> Profanity in messages you receive will be replaced with asterisks (****). Other users see messages based on their own filter settings.
                              </>
                            ) : (
                              <>
                                <strong className="text-foreground">Disabled:</strong> Messages appear unfiltered. You will see all content exactly as it was sent, including any inappropriate language.
                              </>
                            )}
                          </p>
                        </div>
                      </div>

                      {!canToggle && (
                        <div className="p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
                          <strong>Note:</strong> This filter is required for users under 18 and cannot be disabled.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="border-t pt-4 space-y-2">
                  {/* Blocked Users */}
                  <button
                    onClick={() => setShowBlockedUsersModal(true)}
                    className="w-full flex items-center justify-between p-3 hover:bg-muted rounded-md transition-colors text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <UserX className="h-4 w-4 text-muted-foreground group-hover:text-muted-foreground" />
                      <div>
                        <div className="text-sm font-medium text-foreground">Blocked Users</div>
                        <div className="text-xs text-muted-foreground">Manage blocked users list</div>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>

                  {/* My Reports */}
                  <button className="w-full flex items-center justify-between p-3 hover:bg-muted rounded-md transition-colors text-left group">
                    <div className="flex items-center gap-3">
                      <Flag className="h-4 w-4 text-muted-foreground group-hover:text-muted-foreground" />
                      <div>
                        <div className="text-sm font-medium text-foreground">My Reports</div>
                        <div className="text-xs text-muted-foreground">View reports you've submitted</div>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Notifications Section - Coming Soon */}
            <AccordionItem value="notifications" className="border rounded-lg opacity-50">
              <AccordionTrigger className="px-4 hover:no-underline cursor-not-allowed" disabled>
                <div className="flex items-center gap-3">
                  <div className="h-5 w-5 flex items-center justify-center text-muted-foreground">🔔</div>
                  <div className="text-left">
                    <div className="font-semibold">Notifications</div>
                    <div className="text-sm text-muted-foreground font-normal">
                      Coming soon
                    </div>
                  </div>
                </div>
              </AccordionTrigger>
            </AccordionItem>

            {/* Preferences Section - Coming Soon */}
            <AccordionItem value="preferences" className="border rounded-lg opacity-50">
              <AccordionTrigger className="px-4 hover:no-underline cursor-not-allowed" disabled>
                <div className="flex items-center gap-3">
                  <div className="h-5 w-5 flex items-center justify-center text-muted-foreground">⚙️</div>
                  <div className="text-left">
                    <div className="font-semibold">Preferences</div>
                    <div className="text-sm text-muted-foreground font-normal">
                      Coming soon
                    </div>
                  </div>
                </div>
              </AccordionTrigger>
            </AccordionItem>
          </Accordion>
      </Modal.Body>

      <Modal.Footer>
        <Button
          onClick={onClose}
          variant="outline"
          className="w-full"
        >
          Close
        </Button>
      </Modal.Footer>

      {/* Blocked Users Modal */}
      {showBlockedUsersModal && memberId && (
        <BlockedUsersModal
          currentUserId={memberId}
          onClose={() => setShowBlockedUsersModal(false)}
          onUnblocked={onUnblocked}
        />
      )}
    </Modal>
  );
}
