/**
 * @fileoverview Error Fallback UI Component
 *
 * Displays a user-friendly error message when the app crashes.
 * Provides options to retry or navigate home.
 */
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';

interface ErrorFallbackProps {
  /** The error that was caught */
  error: Error | null;
  /** Callback to reset the error boundary and retry */
  onReset: () => void;
}

/**
 * ErrorFallback Component
 *
 * Shows a friendly error page with:
 * - Error icon and message
 * - Technical details (in development only)
 * - Retry button to attempt recovery
 * - Home button to navigate away
 */
export const ErrorFallback: React.FC<ErrorFallbackProps> = ({ error, onReset }) => {
  const isDev = import.meta.env.DEV;

  const handleGoHome = () => {
    window.location.href = '/';
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-muted flex items-center justify-center p-4">
      <Card className="max-w-lg w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-xl text-foreground">
            Something went wrong
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-muted-foreground">
            We're sorry, but something unexpected happened. Please try refreshing
            the page or return to the home page.
          </p>

          {/* Show error details in development */}
          {isDev && error && (
            <div className="mt-4 p-3 bg-muted rounded-lg overflow-auto">
              <p className="text-sm font-mono text-destructive break-all">
                {error.message}
              </p>
              {error.stack && (
                <pre className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap">
                  {error.stack}
                </pre>
              )}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onReset}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleRefresh}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Page
            </Button>
            <Button
              className="flex-1"
              onClick={handleGoHome}
              loadingText="none"
            >
              <Home className="h-4 w-4 mr-2" />
              Go Home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ErrorFallback;
