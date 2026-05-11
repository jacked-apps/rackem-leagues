import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';

export const About: React.FC = () => {
  return (
    <div>
      <PageHeader
        backTo="/"
        backLabel="Home"
        title="Rack'em Leagues"
        subtitle="Your league, your way."
      />
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <section>
          <h2 className="text-2xl font-semibold mb-3">What We Do</h2>
          <p className="text-foreground leading-relaxed">
            Rackem Leagues Network empowers independent pool league operators with professional-grade management tools.
            Whether you're a bar owner, pool hall operator, or experienced player looking to start your own league,
            our platform handles the complexity so you can focus on growing your pool community.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">Current Features</h2>
          <ul className="space-y-2 text-foreground">
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span><strong>League Operator Dashboard:</strong> Centralized control for all league operations and settings</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span><strong>League Creation Wizard:</strong> Complete step-by-step setup for 8-Ball, 9-Ball, and 10-Ball leagues with everything you need to run professionally</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span><strong>Flexible Formats:</strong> 5-man and 8-man team formats with comprehensive, adjustable handicap systems tailored to your league</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span><strong>Smart Scheduling:</strong> Automated conflict detection around US holidays, BCA and APA championships with community-verified tournament dates</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span><strong>Season Management:</strong> Create and manage multiple seasons with complete team and match tracking</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span><strong>Team Registration:</strong> Optionally allow team captains to update their own roster, home venue, and team name—you control the level of delegation</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span><strong>Match Tracking:</strong> Automatic handicap calculations, live collaborative scoring, and instant standings and statistical updates</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span><strong>Venue Management:</strong> Support for in-house and traveling leagues with multi-venue coordination and adjustable table assignments</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span><strong>Advanced Handicaps:</strong> Choose from 2 time-tested handicap systems, each adjustable and customizable—contact us to discuss adding your own time-tested system</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span><strong>Member Management:</strong> Complete profile system with status indicators and player information tracking</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span><strong>In-App Messaging:</strong> Private direct messaging, group messaging with announcements, and optional profanity filtering—enforce league-wide or let players choose</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span><strong>Educational Resources:</strong> Detailed guides explaining handicap systems and format differences—official BCA rulebook integration coming soon</span>
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">Coming Soon</h2>
          <ul className="space-y-2 text-foreground">
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span><strong>House Rules Management:</strong> Add custom house rules to official rulesets—choose from our list or create your own (scratch on 8 is a loss, magic rack usage, golden break only counts in specific pockets, etc.)</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span><strong>Team Invite System:</strong> Streamlined player recruitment and team formation</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span><strong>Payout Calculator:</strong> Assists in determining prize pool income and distribution—you control payouts, fees, expenses, and all financial settings</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span><strong>Scorecard Dispute Resolution:</strong> Player-verified scoring with full accountability—track who scored and verified each game for easy dispute resolution</span>
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">Future Vision</h2>
          <ul className="space-y-2 text-foreground">
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span><strong>BCA CSI Sanctioning & Integration:</strong> League results contributing to Fargo ratings for players, Fargo rating handicap leagues, and official BCA sanctioning options</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span><strong>AI-Integrated Rules Assistant:</strong> Describe any situation and receive instant rule interpretations based on official rulesets—providing guidance for initial rulings</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span><strong>AI League Operator Assistant:</strong> Manage your league using plain speech—create new leagues, update settings, modify schedules, and handle league operations through natural conversation</span>
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">Pricing</h2>
          <p className="text-foreground leading-relaxed mb-3">
            <strong>Free to get started.</strong> No upfront costs to become a league operator. We charge $1 per team per week
            (regular season only) plus a $10 setup fee per season. With a 4-week grace period, you can use your collected league
            dues to pay for the entire season before week 5. Playoffs are free.
          </p>
          <p className="mb-4">
            <Link to="/pricing" className="text-blue-600 hover:text-blue-800 font-medium">
              View detailed pricing breakdown with examples →
            </Link>
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">Our Philosophy</h2>
          <p className="text-foreground leading-relaxed mb-3">
            Personally built by a league operator with over 15 years of experience, this platform represents the tools you'll wish you had
            when first becoming a league operator. No extensive certifications or intrusive approval processes; just professional-grade software
            that transforms casual league players into professional operators running smooth, well-organized leagues.
          </p>
          <p className="text-foreground leading-relaxed">
            We believe in empowering local operators to build thriving pool communities with minimal administrative burden,
            so more time can be spent on what matters: growing the sport and connecting players.
          </p>
        </section>

        <div className="pt-4 border-t">
          <Link to="/login" className="text-blue-600 hover:text-blue-800 font-medium">
            Get Started →
          </Link>
        </div>
      </div>
    </div>
  );
};
