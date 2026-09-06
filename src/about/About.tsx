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
              <span><strong>Flexible Formats:</strong> Build your league your way—choose your team size and the number of players per team, then pair it with the handicap system and scoring system that fit how your league actually plays</span>
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
              <span><strong>In-App Messaging:</strong> Team chats and a captains' chat are created automatically and stay in sync with your rosters—plus private direct messaging, league and season announcements, and an optional profanity filter each player turns on or off for themselves</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span><strong>Educational Resources:</strong> Detailed guides explaining handicap systems and format differences, plus the official BCA / CSI rulebook built right in—search any rule to settle a dispute</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span><strong>Player Onboarding:</strong> A simple, streamlined join flow—share one link and new players sign up and land on their team in minutes, with captain approval keeping rosters accurate</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span><strong>Scorecard Dispute Resolution:</strong> Player-verified scoring with full accountability—track who scored and verified each game for easy dispute resolution</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span><strong>Playoffs:</strong> Configure and run your postseason—playoff settings at the organization or league level, bracket setup, and management through to a champion</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span><strong>Live Spectating:</strong> Players and fans follow matches in real time, with scoreboards that update as each game is scored</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span><strong>Leaderboards &amp; Achievements:</strong> Season standings, top shooters, and team stats, plus a Feats of Excellence board celebrating break-and-runs, golden breaks, and other standout shots</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span><strong>Season Roll-Forward &amp; Captain Re-Up:</strong> Launch a new season from a previous one in a few clicks—rosters and settings carry forward, and captains can re-up their own teams</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span><strong>Push Notifications:</strong> Get a message on your phone even when the app is closed, with controls that respect your evening—quiet hours, a per-conversation-type default, and a per-chat setting. Busy group chats notify once and then hold off for a set stretch, so a lively team chat doesn&apos;t become a buzzing phone</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span><strong>Tournament Brackets:</strong> Run a single or double elimination bracket for a bar night or side event—add names, tap winners, and share a live read-only link so anyone can follow along. Free to use, no league required</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span><strong>House Rules:</strong> Add your own rules on top of the official rulesets—pick from a common list or write your own, at the organization or league level, so &ldquo;scratch on the 8 is a loss&rdquo; is written down instead of argued about</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span><strong>League Finances:</strong> Track annual dues across your roster at a glance, and work out prize distribution with a payout calculator—you stay in control of fees, expenses, and how the pot is split</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span><strong>Operator Scoring &amp; Corrections:</strong> Enter a match that was played on paper, and reopen and correct a finished match when something was recorded wrong—with the same handicaps and scoring the live flow uses</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span><strong>CSI / FargoRate Results Sheet:</strong> Print a match laid out the way LMS wants it, and tick off which matches you&apos;ve already entered—so a few weeks&apos; backlog doesn&apos;t turn into guesswork about where you left off</span>
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">Coming Soon</h2>
          <ul className="space-y-2 text-foreground">
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span><strong>Fully Customizable Systems:</strong> Tailor handicaps, scoring, and point distribution down to the detail—choose from time-tested systems or build your own to your exact specifications</span>
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
            <Link to="/pricing" className="text-primary hover:text-primary/80 font-medium transition-colors">
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
          <Link to="/login" className="text-primary hover:text-primary/80 font-medium transition-colors">
            Get Started →
          </Link>
        </div>
      </div>
    </div>
  );
};
