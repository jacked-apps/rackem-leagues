/**
 * @fileoverview Error boundary wrapping the lazy-loaded rules routes.
 *
 * Catches import-time errors from `useRulebook` (e.g., corrupted cleaned
 * data) and any downstream render errors from children, and replaces them
 * with a minimal branded fallback plus a reload action. Without this, a
 * rulebook-load failure would hit React's default error overlay, which is
 * the worst possible UX for a player trying to settle a dispute.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';

type Props = { children: ReactNode };
type State = { hasError: boolean };

export class RulesErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Keep this visible in the browser console for diagnosing. No remote
    // reporting — this project does not have an error-tracking service yet.
    console.error('RulesErrorBoundary caught:', error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-auto max-w-lg p-6 text-center">
          <h1 className="text-xl font-semibold">We couldn't load the rulebook.</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Check your connection and reload the page. If the problem persists, it may be a
            build issue — let us know.
          </p>
          <Button
            className="mt-4"
            variant="default"
            loadingText="none"
            onClick={this.handleReload}
          >
            Reload
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
