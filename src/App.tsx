/**
 * @fileoverview Main application entry point
 *
 * Sets up the app with:
 * - React Query for data fetching
 * - React Router (data router) for navigation
 * - User context for authentication state
 * - Error boundary for graceful error handling
 * - Toast notifications
 * - PWA update prompts
 */

import { RouterProvider } from 'react-router-dom';
import { ThemeProvider } from 'next-themes';
import { router } from './navigation/NavRoutes';
import { UserProvider } from './context/UserProvider';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Toaster } from './components/ui/sonner';
import { PWAUpdatePrompt } from './components/PWAUpdatePrompt';
import { EnvironmentBanner } from './components/EnvironmentBanner';
import { DocumentTitleUnreadSyncer } from './hooks/useDocumentTitleUnread';

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        storageKey="rackem-theme"
      >
        <div
          style={{ minHeight: '100vh', minWidth: '100vw' }}
          className="full-screen"
        >
          <EnvironmentBanner />
          <UserProvider>
            {/* Syncs document.title with the unread-message count
                ("(3) Rack 'em Leagues") so users notice new messages
                from another tab. Inside UserProvider so the hook can
                resolve the current member; outside the router so it
                doesn't remount on navigation. */}
            <DocumentTitleUnreadSyncer />
            <RouterProvider router={router} />
          </UserProvider>
          <Toaster position="top-right" />
          <PWAUpdatePrompt />
        </div>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

export default App;
