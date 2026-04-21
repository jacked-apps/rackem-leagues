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
import { router } from './navigation/NavRoutes';
import { UserProvider } from './context/UserProvider';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Toaster } from './components/ui/sonner';
import { PWAUpdatePrompt } from './components/PWAUpdatePrompt';
import { EnvironmentBanner } from './components/EnvironmentBanner';

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <div
        style={{ minHeight: '100vh', minWidth: '100vw' }}
        className="full-screen"
      >
        <EnvironmentBanner />
        <UserProvider>
          <RouterProvider router={router} />
        </UserProvider>
        <Toaster position="top-right" />
        <PWAUpdatePrompt />
      </div>
    </ErrorBoundary>
  );
};

export default App;
