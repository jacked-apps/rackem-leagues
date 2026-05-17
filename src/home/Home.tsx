/**
 * @fileoverview Public Home Page
 *
 * Landing page for Rack'em Leagues. Shows public content that anyone can browse,
 * whether logged in or not. This is a discovery page for the app.
 *
 * Public features (coming soon):
 * - Browse leagues/organizations
 * - View live scoreboards
 * - Check standings
 * - Find a league near you
 */
import { Link } from 'react-router-dom';
import { useUser } from '../context/useUser';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/PageHeader';
import { Building2, Trophy, Radio, MapPin, BookOpen, LayoutDashboard, ArrowRight } from 'lucide-react';
import { ShareAppCard } from '@/components/ShareAppCard';
import { toast } from 'sonner';

/**
 * Feature card for the public home page
 * Shows a clickable card with icon, title, and description
 * Currently shows "Coming Soon" toast on click
 */
interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

function FeatureCard({ icon, title, description }: FeatureCardProps) {
  const handleClick = () => {
    toast.info('Coming Soon', {
      description: `${title} will be available in a future update.`,
    });
  };

  return (
    <Card
      className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all"
      onClick={handleClick}
    >
      <CardHeader className="flex flex-row items-center gap-4">
        <div className="p-2 bg-primary/10 rounded-lg text-primary">{icon}</div>
        <div>
          <CardTitle className="text-lg">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
      </CardHeader>
    </Card>
  );
}

export const Home: React.FC = () => {
  const { loading: authLoading, isLoggedIn } = useUser();

  // Show loading while checking auth status
  if (authLoading) {
    return (
      <div>
        <PageHeader
          backTo="/about"
          backLabel="About Us"
          title="Rack'em Leagues"
        />
        <div className="max-w-2xl mx-auto p-6">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // Public home page - available to everyone (logged in or not).
  // The header's built-in identity slot handles auth UI (avatar → /profile
  // when logged in, "Sign in" button when logged out), so this page no
  // longer needs to thread auth buttons through rightContent.
  return (
    <div>
      <PageHeader
        backTo="/about"
        backLabel="About Us"
        title="Rack'em Leagues"
        subtitle="Pool league management made simple"
      />

      <div className="max-w-4xl mx-auto p-6 space-y-8">
        {/* Dashboard CTA — only shown when the user is signed in.
            Previously the only route to /dashboard from the home page
            was via the hamburger menu, which is too hidden for what
            is effectively the primary landing destination for every
            logged-in user. Full-width primary button sits above the
            public Explore cards so it's the first thing logged-in
            users see; signed-out users see the Explore cards alone
            (which makes sense for the public-discovery framing of
            the home page). */}
        {isLoggedIn && (
          <Link to="/dashboard" className="block">
            <Button
              size="lg"
              loadingText="none"
              className="w-full h-14 text-base font-semibold flex items-center justify-center gap-3"
            >
              <LayoutDashboard className="h-5 w-5" />
              Go to My Dashboard
              <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
        )}

        {/* Feature cards */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-center text-muted-foreground">
            Explore
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FeatureCard
              icon={<Building2 className="h-6 w-6" />}
              title="Browse Leagues"
              description="View leagues and organizations in your area"
            />

            <FeatureCard
              icon={<Radio className="h-6 w-6" />}
              title="Live Scoreboards"
              description="Watch matches in progress in real-time"
            />

            <FeatureCard
              icon={<Trophy className="h-6 w-6" />}
              title="Standings"
              description="Check current season standings and stats"
            />

            <FeatureCard
              icon={<MapPin className="h-6 w-6" />}
              title="Find a League"
              description="Search for leagues near you to join"
            />

            <Link to="/rules" className="md:col-span-2">
              <Card className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all">
                <CardHeader className="flex flex-row items-center gap-4">
                  <div className="p-2 bg-primary/10 rounded-lg text-primary">
                    <BookOpen className="h-6 w-6" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Official Rules</CardTitle>
                    <CardDescription>
                      Browse the BCA / CSI rulebook. Search any rule to settle a dispute.
                    </CardDescription>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          </div>
        </div>

        {/* Share the app */}
        <ShareAppCard
          description="Scan the QR code or share the link so your teammates can join Rack'em Leagues."
        />

        {/* Brief description */}
        <div className="text-center text-muted-foreground space-y-2 pt-4 border-t">
          <p>
            Rack'em Leagues helps pool league operators manage their leagues,
            track scores, and keep players connected.
          </p>
          <p className="text-sm">
            Players can view schedules, score matches, and keep up with their stats and standings all in one place.
          </p>
        </div>
      </div>
    </div>
  );
};
