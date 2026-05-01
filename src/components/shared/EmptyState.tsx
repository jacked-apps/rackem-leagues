/**
 * @fileoverview Empty State Component
 *
 * Consistent empty state display used across the application.
 *
 * Usage:
 * <EmptyState
 *   icon={MessageSquare}
 *   title="No messages"
 *   description="Start a conversation"
 * />
 */

import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
}

export function EmptyState({ icon: Icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
      {Icon && <Icon className="h-12 w-12 mx-auto mb-4 opacity-50" />}
      <p className="font-medium text-foreground mb-1">{title}</p>
      {description && <p className="text-sm">{description}</p>}
    </div>
  );
}
