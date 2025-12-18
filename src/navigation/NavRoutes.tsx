/**
 * @fileoverview Route definitions for the application
 *
 * Uses createBrowserRouter (data router) to enable features like useBlocker
 * for unsaved changes warnings. Routes are organized by access level:
 * - Public routes (no auth required)
 * - Dev routes (only in development mode)
 * - Auth routes (require login)
 * - Member routes (require login + approved application)
 * - Operator routes (require league_operator role)
 * - Developer routes (require developer role)
 */

import { lazy, Suspense } from 'react';
import { createBrowserRouter, Outlet } from 'react-router-dom';
import { Home } from '../home/Home';
import { Login } from '../login/Login';
import { Register } from '../login/Register';
import { ClaimPlayer } from '../login/ClaimPlayer';
import { ForgotPassword } from '../login/ForgotPassword';
import { ResetPassword } from '../login/ResetPassword';
import { EmailConfirmation } from '../login/EmailConfirmation';
import { About } from '../about/About';
import { Pricing } from '../about/Pricing';
import { NewPlayerForm } from '../newPlayer/NewPlayerForm';
import { CompleteProfileForm } from '../completeProfile';
import { Dashboard } from '../dashboard/Dashboard';
import { Profile } from '../profile/Profile';
import { MyTeams } from '../player/MyTeams';
import { TeamSchedule } from '../player/TeamSchedule';
import { MatchLineup } from '../player/MatchLineup';
import { ScoreMatch } from '../player/ScoreMatch';
import { BecomeLeagueOperator } from '../leagueOperator/BecomeLeagueOperator';
import { LeagueOperatorApplication } from '../leagueOperator/LeagueOperatorApplication';
import { Messages } from '../pages/Messages';
import { PlayerProfile } from '../pages/PlayerProfile';
import { AdminReports } from '../pages/AdminReports';
import { MatchDataViewer } from '../pages/MatchDataViewer';
import { Standings } from '../pages/Standings';
import { TopShooters } from '../pages/TopShooters';
import { TeamStats } from '../pages/TeamStats';
import { FeatsOfExcellence } from '../pages/FeatsOfExcellence';
import { FiveManFormatDetails } from '../info/FiveManFormatDetails';
import { EightManFormatDetails } from '../info/EightManFormatDetails';
import { FormatComparison } from '../info/FormatComparison';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { LoadingSpinner } from '../components/LoadingSpinner';
import HandicapLookupTest from '../pages/HandicapLookupTest';
import { DevOnly } from '../dev/DevOnly';
import RLSTestPage from '../dev/RLSTestPage';

// Lazy-loaded operator pages (only loaded when operator accesses them)
const OperatorWelcome = lazy(() => import('../operator/OperatorWelcome'));
const OperatorDashboard = lazy(() => import('../operator/OperatorDashboard'));
const OrganizationSettings = lazy(() => import('../operator/OrganizationSettings'));
const ReportsManagement = lazy(() => import('../operator/ReportsManagement'));
const PlayerManagement = lazy(() => import('../operator/PlayerManagement'));
const LeagueCreationWizard = lazy(() => import('../operator/LeagueCreationWizard'));
const LeagueRules = lazy(() => import('../operator/LeagueRules'));
const LeagueDetail = lazy(() => import('../operator/LeagueDetail'));
const LeagueSettings = lazy(() => import('../operator/LeagueSettings'));
const SeasonCreationWizard = lazy(() => import('../operator/SeasonCreationWizard'));
const SeasonScheduleManager = lazy(() => import('../operator/SeasonScheduleManager'));
const VenueManagement = lazy(() => import('../operator/VenueManagement'));
const TeamManagement = lazy(() => import('../operator/TeamManagement'));
const ScheduleSetupPage = lazy(() => import('../operator/ScheduleSetupPage'));
const SeasonSchedulePage = lazy(() => import('../operator/SeasonSchedulePage'));
const PlayoffSetup = lazy(() => import('../operator/PlayoffSetup'));
const OrganizationPlayoffSettings = lazy(() => import('../operator/OrganizationPlayoffSettings'));
const LeaguePlayoffSettings = lazy(() => import('../operator/LeaguePlayoffSettings'));
const PlayoffsSetupWizard = lazy(() => import('../operator/PlayoffsSetupWizard'));

/**
 * Helper to wrap element with ProtectedRoute for auth-only routes
 */
function withAuth(element: React.ReactNode) {
  return (
    <ProtectedRoute requireAuth={true}>
      {element}
    </ProtectedRoute>
  );
}

/**
 * Helper to wrap element with ProtectedRoute for member routes
 */
function withMember(element: React.ReactNode) {
  return (
    <ProtectedRoute requireAuth={true} requireApprovedApplication={true}>
      {element}
    </ProtectedRoute>
  );
}

/**
 * Helper to wrap lazy operator components with Suspense + ProtectedRoute
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function withOperator(Component: React.LazyExoticComponent<React.ComponentType<any>>) {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <ProtectedRoute requireAuth={true} requiredRole="league_operator">
        <Component />
      </ProtectedRoute>
    </Suspense>
  );
}

/**
 * Helper to wrap element with ProtectedRoute for developer routes
 */
function withDeveloper(element: React.ReactNode) {
  return (
    <ProtectedRoute requireAuth={true} requiredRole="developer">
      {element}
    </ProtectedRoute>
  );
}

/**
 * Root layout component that just renders child routes
 * This is needed for createBrowserRouter to work with our provider structure
 */
export function RootLayout() {
  return <Outlet />;
}

/**
 * Router configuration using createBrowserRouter (data router)
 * This enables features like useBlocker for unsaved changes warnings
 */
export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      // === Public Routes ===
      { index: true, element: <Home /> },
      { path: 'about', element: <About /> },
      { path: 'pricing', element: <Pricing /> },
      { path: 'login', element: <Login /> },
      { path: 'register', element: <Register /> },
      { path: 'claim-player', element: <ClaimPlayer /> },
      { path: 'forgot-password', element: <ForgotPassword /> },
      { path: 'reset-password', element: <ResetPassword /> },
      { path: 'confirm', element: <EmailConfirmation /> },
      { path: '5-man-format-details', element: <FiveManFormatDetails /> },
      { path: '8-man-format-details', element: <EightManFormatDetails /> },
      { path: 'format-comparison', element: <FormatComparison /> },
      { path: 'test/handicap-lookup', element: <HandicapLookupTest /> },

      // === Development-only Routes ===
      { path: 'dev/rls-tests', element: <DevOnly><RLSTestPage /></DevOnly> },

      // === Auth Routes (require login) ===
      { path: 'complete-profile', element: withAuth(<CompleteProfileForm />) },
      { path: 'new-player', element: withAuth(<NewPlayerForm />) },
      { path: 'become-league-operator', element: withAuth(<BecomeLeagueOperator />) },
      { path: 'league-operator-application', element: withAuth(<LeagueOperatorApplication />) },

      // === Member Routes (require login + approved application) ===
      { path: 'dashboard', element: withMember(<Dashboard />) },
      { path: 'profile', element: withMember(<Profile />) },
      { path: 'messages', element: withMember(<Messages />) },
      { path: 'player/:playerId', element: withMember(<PlayerProfile />) },
      { path: 'my-teams', element: withMember(<MyTeams />) },
      { path: 'team/:teamId/schedule', element: withMember(<TeamSchedule />) },
      { path: 'match/:matchId/lineup', element: withMember(<MatchLineup />) },
      { path: 'match/:matchId/score', element: withMember(<ScoreMatch />) },
      // Stats & Standings pages (accessible to all members)
      { path: 'league/:leagueId/season/:seasonId/standings', element: withMember(<Standings />) },
      { path: 'league/:leagueId/season/:seasonId/top-shooters', element: withMember(<TopShooters />) },
      { path: 'league/:leagueId/season/:seasonId/team-stats', element: withMember(<TeamStats />) },
      { path: 'league/:leagueId/season/:seasonId/feats', element: withMember(<FeatsOfExcellence />) },
      { path: 'league/:leagueId/season/:seasonId/match-data', element: withMember(<MatchDataViewer />) },

      // === Operator Routes (require league_operator role) ===
      { path: 'operator-welcome', element: withOperator(OperatorWelcome) },
      { path: 'operator-dashboard/:orgId', element: withOperator(OperatorDashboard) },
      { path: 'operator-reports/:orgId', element: withOperator(ReportsManagement) },
      { path: 'manage-players/:orgId', element: withOperator(PlayerManagement) },
      { path: 'create-league/:orgId', element: withOperator(LeagueCreationWizard) },
      { path: 'operator-settings/:orgId', element: withOperator(OrganizationSettings) },
      { path: 'operator-settings/:orgId/playoffs', element: withOperator(OrganizationPlayoffSettings) },
      { path: 'league-rules/:orgId', element: withOperator(LeagueRules) },
      { path: 'league/:leagueId', element: withOperator(LeagueDetail) },
      { path: 'league/:leagueId/settings', element: withOperator(LeagueSettings) },
      { path: 'league/:leagueId/create-season', element: withOperator(SeasonCreationWizard) },
      { path: 'league/:leagueId/season/:seasonId/manage-schedule', element: withOperator(SeasonScheduleManager) },
      { path: 'league/:leagueId/manage-teams', element: withOperator(TeamManagement) },
      { path: 'league/:leagueId/season/:seasonId/playoffs-setup', element: withOperator(PlayoffsSetupWizard) },
      { path: 'league/:leagueId/season/:seasonId/schedule-setup', element: withOperator(ScheduleSetupPage) },
      { path: 'league/:leagueId/season/:seasonId/schedule', element: withOperator(SeasonSchedulePage) },
      { path: 'league/:leagueId/season/:seasonId/playoffs', element: withOperator(PlayoffSetup) },
      { path: 'operator/league/:leagueId/playoffs/:orgId', element: withOperator(LeaguePlayoffSettings) },
      { path: 'venues/:orgId', element: withOperator(VenueManagement) },

      // === Developer Routes (require developer role) ===
      { path: 'admin-reports', element: withDeveloper(<AdminReports />) },
    ],
  },
]);
