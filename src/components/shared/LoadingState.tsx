/**
 * @fileoverview Loading State Component
 *
 * Consistent loading indicator used across the application.
 *
 * Usage:
 * <LoadingState />
 * <LoadingState message="Loading conversations..." />
 */

import { Loader2 } from 'lucide-react';

interface LoadingStateProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function LoadingState({ message = 'Loading...', size = 'md' }: LoadingStateProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  };

  return (
    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
      <Loader2 className={`${sizeClasses[size]} animate-spin mb-2`} />
      <p className="text-sm">{message}</p>
    </div>
  );
}
