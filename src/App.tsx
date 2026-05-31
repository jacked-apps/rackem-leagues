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
import { CaptainReupSyncer } from './hooks/useCaptainReupPrompt';

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
            {/* End-of-season re-up modal for captains. Mounted once
                near the root so it pops regardless of which page the
                captain is on. Renders nothing when the current user
                isn't a captain or has nothing pending. */}
            <CaptainReupSyncer />
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
