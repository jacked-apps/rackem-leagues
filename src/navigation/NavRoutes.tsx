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
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { isProduction } from '@/config/environment';
import { MemberLayout } from '../components/layout/MemberLayout';
import { BracketsIndexPage } from '../brackets/BracketsIndexPage';
import { CreateBracketFlow } from '../brackets/CreateBracketFlow';
import { BracketView } from '../brackets/BracketView';
import { PublicBracketPage } from '../brackets/PublicBracketPage';
import { JoinHopperPage } from '../brackets/paid/JoinHopperPage';
import { BracketSetupPage } from '../brackets/paid/BracketSetupPage';
import { JoinQrPoster } from '../brackets/paid/JoinQrPoster';
import { Home } from '../home/Home';
import { RulesSkeleton } from '../rules/RulesSkeleton';
import { RulesErrorBoundary } from '../rules/RulesErrorBoundary';
import { Login } from '../login/Login';
import { Register } from '../login/Register';
import { ClaimPlayer } from '../login/ClaimPlayer';
import { TeamJoinPage } from '../onboarding/TeamJoinPage';
import { ForgotPassword } from '../login/ForgotPassword';
import { ResetPassword } from '../login/ResetPassword';
import { EmailConfirmation } from '../login/EmailConfirmation';
import { About } from '../about/About';
import WhatsNewPage from '../whatsNew/WhatsNewPage';
import { useShowWhatsNewAfterUpdate } from '../whatsNew/useShowWhatsNewAfterUpdate';
import { Pricing } from '../about/Pricing';
import { PrivacyPolicy } from '../about/PrivacyPolicy';
import { NewPlayerForm } from '../newPlayer/NewPlayerForm';
import { CompleteProfileForm } from '../completeProfile';
import { Profile } from '../profile/Profile';
import { MyMatch } from '../player/MyMatch';
import { MyTeams } from '../player/MyTeams';
import { PlayerStats } from '../player/PlayerStats';
import { TeamSchedule } from '../player/TeamSchedule';
import { MatchLineup } from '../player/MatchLineup';
import { ScoreMatch } from '../player/ScoreMatch';
import { SpectateLiveMatches } from '../player/SpectateLiveMatches';
import { SpectateMyLiveMatches } from '../player/SpectateMyLiveMatches';
import { BecomeLeagueOperator } from '../leagueOperator/BecomeLeagueOperator';
import { LeagueOperatorApplication } from '../leagueOperator/LeagueOperatorApplication';
import { Messages } from '../pages/Messages';
import { PlayerProfile } from '../pages/PlayerProfile';
import { AdminReports } from '../pages/AdminReports';
import { MatchDataViewer } from '../pages/MatchDataViewer';
import { Standings } from '../pages/Standings';
import { SeasonOverview } from '../pages/SeasonOverview';
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
// --- Handicap Calculator (dev/staging only) — remove this import + the route below to delete the feature ---
import { HandicapCalculator, NonProdGate } from '../handicapCalculator';

// Lazy-loaded public rules reader (keeps the cleaned rulebook data out of the main bundle).
const RulesPage = lazy(() => import('../rules/RulesPage'));
const RuleDetailPage = lazy(() => import('../rules/RuleDetailPage'));
const HouseRuleDetailPage = lazy(() => import('../rules/HouseRuleDetailPage'));

// Lazy-loaded operator pages (only loaded when operator accesses them)
const OperatorWelcome = lazy(() => import('../operator/OperatorWelcome'));
const OperatorDashboard = lazy(() => import('../operator/OperatorDashboard'));
const NewSeasonFromPreviousPage = lazy(() => import('../operator/NewSeasonFromPreviousPage'));
const CaptainReupPage = lazy(() => import('../pages/CaptainReupPage'));
const OrganizationSettings = lazy(() => import('../operator/OrganizationSettings'));
const ReportsManagement = lazy(() => import('../operator/ReportsManagement'));
const PlayerManagement = lazy(() => import('../operator/PlayerManagement'));
const LeagueWizardV2Page = lazy(() => import('../wizards/league-v2/LeagueWizardV2Page'));
const LeagueRules = lazy(() => import('../operator/LeagueRules'));
const LeagueDetail = lazy(() => import('../operator/LeagueDetail'));
const LeagueFinancesPage = lazy(() => import('../operator/LeagueFinancesPage'));
const LeagueDuesPage = lazy(() => import('../operator/LeagueDuesPage'));
const AllocatorRoomPage = lazy(
  () => import('../operator/scoring-workshop/per-game-allocator/AllocatorRoomPage'),
);
const TriggerRoomPage = lazy(
  () => import('../operator/scoring-workshop/trigger/TriggerRoomPage'),
);
const WorkshopHomePage = lazy(
  () => import('../operator/scoring-workshop/WorkshopHomePage'),
);
const LeagueSettings = lazy(() => import('../operator/LeagueSettings'));
const SeasonCreationWizard = lazy(() => import('../operator/SeasonCreationWizard'));
const SeasonScheduleManager = lazy(() => import('../operator/SeasonScheduleManager'));
const VenueManagement = lazy(() => import('../operator/VenueManagement'));
const TeamManagement = lazy(() => import('../operator/TeamManagement'));
const SetupTeamsPage = lazy(() => import('../operator/SetupTeamsPage'));
const ScheduleSetupPage = lazy(() => import('../operator/ScheduleSetupPage'));
const SeasonSchedulePage = lazy(() => import('../operator/SeasonSchedulePage'));
const LmsResultsSheet = lazy(() => import('../operator/LmsResultsSheet'));
const PlayoffSetup = lazy(() => import('../operator/PlayoffSetup'));
const OrganizationPlayoffSettings = lazy(() => import('../operator/OrganizationPlayoffSettings'));
const LeaguePlayoffSettings = lazy(() => import('../operator/LeaguePlayoffSettings'));
const PlayoffsSetupWizard = lazy(() => import('../operator/PlayoffsSetupWizard'));
const Learn = lazy(() => import('../pages/Learn'));
const ManualScoringMatchPicker = lazy(() => import('../operator/ManualScoringMatchPicker'));
const ManualScoringPage = lazy(() => import('../operator/ManualScoringPage'));

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
  // If the user ticked "Take me to What's New" before applying an update, this
  // is where that lands after the reload — inside the router, so it can
  // navigate. See src/whatsNew/useShowWhatsNewAfterUpdate.ts
  useShowWhatsNewAfterUpdate();
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
      // What's New — public, so someone deciding whether to sign up can see a
      // record of steady work. One component serves both: bare shows the
      // newest, /:version shows that one.
      { path: 'whats-new', element: <WhatsNewPage /> },
      { path: 'whats-new/:version', element: <WhatsNewPage /> },
      { path: 'pricing', element: <Pricing /> },
      { path: 'privacy', element: <PrivacyPolicy /> },
      { path: 'login', element: <Login /> },
      { path: 'register', element: <Register /> },
      { path: 'claim-player', element: <ClaimPlayer /> },
      { path: 'join/:token', element: <TeamJoinPage /> },
      // Public, read-only bracket share (names only via the get_bracket_share
      // RPC) — the anon boundary is the RPC itself, not the route.
      { path: 'brackets/share/:shareToken', element: <PublicBracketPage /> },
      // Self-add join (paid): a scanned QR / opened link. Public route — auth is
      // handled inside (a cold scanner is prompted to sign in first).
      { path: 'brackets/join/:joinToken', element: <JoinHopperPage /> },
      { path: 'forgot-password', element: <ForgotPassword /> },
      { path: 'reset-password', element: <ResetPassword /> },
      { path: 'confirm', element: <EmailConfirmation /> },
      { path: '5-man-format-details', element: <FiveManFormatDetails /> },
      { path: '8-man-format-details', element: <EightManFormatDetails /> },
      { path: 'format-comparison', element: <FormatComparison /> },
      { path: 'test/handicap-lookup', element: <HandicapLookupTest /> },

      // === Development-only Routes ===
      { path: 'dev/rls-tests', element: <DevOnly><RLSTestPage /></DevOnly> },
      // --- Handicap Calculator (dev/staging only) — remove this line + the import above to delete the feature ---
      { path: 'tools/calc', element: <NonProdGate>{withMember(<HandicapCalculator />)}</NonProdGate> },

      // === Auth Routes (require login) ===
      { path: 'complete-profile', element: withAuth(<CompleteProfileForm />) },
      { path: 'new-player', element: withAuth(<NewPlayerForm />) },
      { path: 'become-league-operator', element: withAuth(<BecomeLeagueOperator />) },
      { path: 'league-operator-application', element: withAuth(<LeagueOperatorApplication />) },

      // === Authenticated Routes (wrapped in MemberLayout for shared nav) ===
      {
        element: <MemberLayout />,
        children: [
          // --- Member Routes (require login + approved application) ---
          { path: 'dashboard', element: <Navigate to="/my-teams" replace /> },
          { path: 'profile', element: withMember(<Profile />) },
          { path: 'messages', element: withMember(<Messages />) },
          // Deep-linkable single conversation — a tapped push notification opens
          // /messages/:conversationId and lands on that thread even on a cold
          // load (push feature Unit 3). Same page; it reads the param.
          { path: 'messages/:conversationId', element: withMember(<Messages />) },
          { path: 'player/:playerId', element: withMember(<PlayerProfile />) },
          { path: 'my-teams', element: withMember(<MyTeams />) },
          { path: 'reup', element: withMember(<CaptainReupPage />) },
          { path: 'my-match', element: withMember(<MyMatch />) },
          { path: 'stats', element: withMember(<PlayerStats />) },
          // --- Tournament bracket tool (Free Tier v1). Live in every
          // environment; the nav entries in AppDrawer/AppSidebar are the doors.
          { path: 'brackets', element: withMember(<BracketsIndexPage />) },
          { path: 'brackets/new', element: withMember(<CreateBracketFlow />) },
          // Paid setup screen — a "Real players & sign-up" tournament sits here
          // in `setup` while its hopper fills, then starts from this page.
          { path: 'brackets/:bracketId/setup', element: withMember(<BracketSetupPage />) },
          // Printable / big-screen join QR sign (organizer only).
          { path: 'brackets/:bracketId/qr', element: withMember(<JoinQrPoster />) },
          { path: 'brackets/:bracketId', element: withMember(<BracketView />) },
          // Rules pages — public (no auth wrapper) but rendered inside
          // MemberLayout so logged-in users keep their sidebar/tab bar.
          // AppSidebar and BottomTabBar both auth-gate their nav content,
          // so public visitors see a minimal chrome (brand + theme toggle).
          {
            path: 'rules',
            element: (
              <RulesErrorBoundary>
                <Suspense fallback={<RulesSkeleton />}>
                  <RulesPage />
                </Suspense>
              </RulesErrorBoundary>
            ),
          },
          {
            path: 'rules/:game/:ruleId',
            element: (
              <RulesErrorBoundary>
                <Suspense fallback={<RulesSkeleton />}>
                  <RuleDetailPage />
                </Suspense>
              </RulesErrorBoundary>
            ),
          },
          {
            path: 'rules/house/:scope/:scopeId/:ruleId',
            element: (
              <RulesErrorBoundary>
                <Suspense fallback={<RulesSkeleton />}>
                  <HouseRuleDetailPage />
                </Suspense>
              </RulesErrorBoundary>
            ),
          },
          { path: 'team/:teamId/schedule', element: withMember(<TeamSchedule />) },
          { path: 'match/:matchId/lineup', element: withMember(<MatchLineup />) },
          { path: 'match/:matchId/score', element: withMember(<ScoreMatch />) },
          { path: 'league/:leagueId/live', element: withMember(<SpectateLiveMatches />) },
          { path: 'live', element: withMember(<SpectateMyLiveMatches />) },
          // Stats & Standings pages (accessible to all members)
          { path: 'league/:leagueId/season/:seasonId/overview', element: withMember(<SeasonOverview />) },
          { path: 'league/:leagueId/season/:seasonId/standings', element: withMember(<Standings />) },
          { path: 'league/:leagueId/season/:seasonId/top-shooters', element: withMember(<TopShooters />) },
          { path: 'league/:leagueId/season/:seasonId/team-stats', element: withMember(<TeamStats />) },
          { path: 'league/:leagueId/season/:seasonId/feats', element: withMember(<FeatsOfExcellence />) },
          { path: 'league/:leagueId/season/:seasonId/match-data', element: withMember(<MatchDataViewer />) },

          // --- Learn hub — any signed-in user (operators AND players share
          //     this destination; deep links from glossary popovers land here) ---
          { path: 'learn', element: withAuth(<Suspense fallback={<LoadingSpinner />}><Learn /></Suspense>) },

          // --- Operator Routes (require league_operator role) ---
          { path: 'operator-welcome', element: withOperator(OperatorWelcome) },
          { path: 'operator-dashboard/:orgId', element: withOperator(OperatorDashboard) },
          { path: 'operator-reports/:orgId', element: withOperator(ReportsManagement) },
          { path: 'manage-players/:orgId', element: withOperator(PlayerManagement) },
          { path: 'create-league/:orgId', element: withOperator(LeagueWizardV2Page) },
          { path: 'operator-settings/:orgId', element: withOperator(OrganizationSettings) },
          { path: 'operator-settings/:orgId/playoffs', element: withOperator(OrganizationPlayoffSettings) },
          { path: 'league-rules/:orgId', element: withOperator(LeagueRules) },
          { path: 'league/:leagueId', element: withOperator(LeagueDetail) },
          { path: 'league/:leagueId/finances', element: withOperator(LeagueFinancesPage) },
          { path: 'league/:leagueId/dues', element: withOperator(LeagueDuesPage) },
          // Scoring Workshop — in active development; gated off in production
          // (route + dashboard card) until it's ready. Dev/staging only.
          ...(!isProduction
            ? [
                { path: 'operator/scoring-workshop', element: withOperator(WorkshopHomePage) },
                { path: 'operator/scoring-workshop/per-game-allocator', element: withOperator(AllocatorRoomPage) },
                { path: 'operator/scoring-workshop/trigger', element: withOperator(TriggerRoomPage) },
              ]
            : []),
          { path: 'league/:leagueId/settings', element: withOperator(LeagueSettings) },
          { path: 'league/:leagueId/create-season', element: withOperator(SeasonCreationWizard) },
          { path: 'operator/start-next-season/:leagueId', element: withOperator(NewSeasonFromPreviousPage) },
          { path: 'league/:leagueId/season/:seasonId/manage-schedule', element: withOperator(SeasonScheduleManager) },
          { path: 'league/:leagueId/manage-teams', element: withOperator(TeamManagement) },
          { path: 'league/:leagueId/season/:seasonId/setup-teams', element: withOperator(SetupTeamsPage) },
          { path: 'league/:leagueId/season/:seasonId/playoffs-setup', element: withOperator(PlayoffsSetupWizard) },
          { path: 'league/:leagueId/season/:seasonId/schedule-setup', element: withOperator(ScheduleSetupPage) },
          { path: 'league/:leagueId/season/:seasonId/matchups', element: withOperator(SeasonSchedulePage) },
          { path: 'league/:leagueId/season/:seasonId/playoffs', element: withOperator(PlayoffSetup) },
          { path: 'operator/league/:leagueId/playoffs/:orgId', element: withOperator(LeaguePlayoffSettings) },
          { path: 'venues/:orgId', element: withOperator(VenueManagement) },

          // --- LO Manual Scoring (LIVE in production as of 2026-06-21) ---
          // Un-gated together as one block: the picker links to match-review and
          // the lms-sheet (printer icon), so all four must be live or the
          // ungated buttons would 404 — the half-gated trap this replaced.
          { path: 'league/:leagueId/manual-scoring', element: withOperator(ManualScoringMatchPicker) },
          { path: 'league/:leagueId/manual-scoring/:matchId', element: withOperator(ManualScoringPage) },
          // v2 review/correct: same host page, dispatches on match status.
          { path: 'league/:leagueId/match-review/:matchId', element: withOperator(ManualScoringPage) },
          // Printable LMS results sheet (CSI / FargoRate hand-entry helper).
          { path: 'league/:leagueId/match/:matchId/lms-sheet', element: withOperator(LmsResultsSheet) },

          // --- Developer Routes (require developer role) ---
          { path: 'admin-reports', element: withDeveloper(<AdminReports />) },
        ],
      },
    ],
  },
]);
