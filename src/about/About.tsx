/**
 * @fileoverview About page (public, linked from the Home page's About Us card).
 *
 * Written for a visitor deciding whether to sign up: a few short sections of
 * prose (for players, for league operators, tournaments, what's next) instead
 * of one long feature list, which made the page a chore to read (Ed,
 * 2026-11-16). Describe only what is live today; planned work goes under
 * "What's Next". Avoid absolute words ("always", "never").
 */
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';

/** One heading and its paragraphs. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-2xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}

/** A paragraph with a bold lead-in, so a skimmer can still find each topic. */
function Topic({ lead, children }: { lead: string; children: React.ReactNode }) {
  return (
    <p className="text-foreground leading-relaxed">
      <strong>{lead}</strong> {children}
    </p>
  );
}

const linkClass = 'text-primary hover:text-primary/80 font-medium transition-colors';

export const About: React.FC = () => {
  return (
    <div>
      <PageHeader backTo="/" backLabel="Home" title="Rack'em Leagues" subtitle="Your league, your way." />
      <div className="max-w-2xl mx-auto p-6 space-y-8">
        <Section title="What We Do">
          <p className="text-foreground leading-relaxed">
            Rack'em Leagues gives independent pool league operators professional-grade tools to run their
            leagues, and gives their players one place to score matches, follow standings and keep in touch.
            Whether you own a bar, run a pool hall or are a seasoned player ready to start your own league, the
            app handles the busywork so you can focus on your pool community.
          </p>
        </Section>

        <Section title="For Players">
          <Topic lead="Joining takes minutes.">
            Your captain shares one link, you sign up, and you land on the team once the captain approves you.
            My Teams then shows your schedule, roster and venue.
          </Topic>
          <Topic lead="Match night, scored together.">
            Both teams score on their phones at the same time. Handicaps are worked out for you, and standings
            and stats update as each game is entered. Each game records who scored it and who confirmed it, so
            a disagreement can be settled from the record instead of from memory. Teammates and fans signed in
            to the app can follow the match live.
          </Topic>
          <Topic lead="Staying in touch.">
            Team chats and a captains' chat are set up for you and stay in step with the rosters, alongside
            private messages and league announcements. Push notifications reach your phone even when the app is
            closed, with quiet hours and per-chat settings so a lively team chat doesn't keep your phone buzzing.
            Each player can turn a profanity filter on or off for themselves.
          </Topic>
          <Topic lead="Stats, rules and more.">
            Season standings, top shooters, team stats, and a Feats of Excellence board for break-and-runs,
            golden breaks and other standout shots. The official BCA / CSI{' '}
            <Link to="/rules" className={linkClass}>rulebook</Link> is built in and searchable, and{' '}
            <Link to="/learn" className={linkClass}>Learn</Link> explains handicaps, formats and the words we use.
          </Topic>
        </Section>

        <Section title="For League Operators">
          <Topic lead="Set up your way.">
            A step-by-step wizard sets up 8-Ball, 9-Ball and 10-Ball leagues. Choose your team size and players
            per team, then pair them with the handicap and scoring systems that fit how your league plays. There
            are two time-tested handicap systems, each adjustable; contact us about adding your own. Schedules are
            built around US holidays and the BCA and APA championships, using community-verified dates, and both
            in-house and traveling leagues work across multiple venues with adjustable table assignments.
          </Topic>
          <Topic lead="Run the season.">
            Your dashboard holds every league, season, team and player in one place. You decide how much to hand
            off: captains can update their own roster, home venue and team name if you allow it. A match played
            on paper can be entered by you, and a finished match can be reopened and corrected, using the same
            handicaps and scoring as the live flow. Playoffs are set up at the organization or league level and
            run through to a champion. When a season ends, the next one launches from it in a few clicks, with
            rosters and settings carried forward and captains re-upping their own teams.
          </Topic>
          <Topic lead="The business side.">
            Track annual dues across your roster, and work out prize payouts with a calculator while you stay in
            control of fees, expenses and how the pot is split. House rules sit on top of the official rulesets,
            picked from a common list or written yourself, so &ldquo;scratch on the 8 is a loss&rdquo; is written
            down instead of argued about. For CSI / FargoRate leagues, print each match laid out the way LMS
            wants it and tick off the ones you've already entered.
          </Topic>
          <p>
            <Link to="/become-league-operator" className={linkClass}>
              Become a League Operator →
            </Link>
          </p>
        </Section>

        <Section title="Tournaments">
          <p className="text-foreground leading-relaxed">
            Run a single or double elimination bracket for a bar night or side event: add names, tap winners, and
            share a live read-only link so anyone can follow along. Free to use, with no league required.
          </p>
        </Section>

        <Section title="What's Next">
          <Topic lead="Coming soon:">
            fully customizable systems, so you can tailor handicaps, scoring and point distribution in detail, or
            build your own to your exact specifications.
          </Topic>
          <Topic lead="Further out:">
            BCA CSI sanctioning, with league results feeding players' Fargo ratings and Fargo-rated handicap
            leagues; an AI rules assistant that gives a first ruling on any situation from the official rulesets;
            and an AI league operator assistant that handles league tasks through plain conversation.
          </Topic>
        </Section>

        <Section title="Pricing">
          <p className="text-foreground leading-relaxed">
            <strong>Free to get started.</strong> No upfront costs to become a league operator. We charge $1 per
            team per week (regular season only) plus a $10 setup fee per season. With a 4-week grace period, you
            can use your collected league dues to pay for the entire season before week 5. Playoffs are free.
          </p>
          <p>
            <Link to="/pricing" className={linkClass}>
              View detailed pricing breakdown with examples →
            </Link>
          </p>
        </Section>

        <Section title="Our Philosophy">
          <p className="text-foreground leading-relaxed">
            Personally built by a league operator with over 15 years of experience, this platform is the set of
            tools you'll wish you had when you first became a league operator. No extensive certifications or
            intrusive approval processes; just professional-grade software that turns casual league players into
            professional operators running smooth, well-organized leagues.
          </p>
          <p className="text-foreground leading-relaxed">
            We believe in empowering local operators to build thriving pool communities with minimal
            administrative burden, so more time goes to what matters: growing the sport and connecting players.
          </p>
        </Section>

        <div className="pt-4 border-t">
          <Link to="/login" className={linkClass}>
            Get Started →
          </Link>
        </div>
      </div>
    </div>
  );
};
