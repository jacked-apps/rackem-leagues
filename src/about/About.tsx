/**
 * @fileoverview About page (public, linked from the Home page's About Us card).
 *
 * Written for a visitor deciding whether to sign up. Each section is a list of
 * features: a bold title you can skim, then one or two plain sentences you can
 * read or skip (Ed, 2026-11-16). Describe only what is live today; planned
 * work goes under "What's Next". Avoid absolute words ("always", "never").
 */
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';

/** A section heading over a stack of features. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-semibold">{title}</h2>
      {/* Own wrapper so the first Feature is a first child (no divider on top). */}
      <div className="space-y-4">{children}</div>
    </section>
  );
}

/**
 * One feature: a skimmable title on its own line, the explanation under it in
 * quieter text, and a divider between features (size + weight + rule, so the
 * split doesn't depend on color).
 */
function Feature({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t pt-4 first:border-t-0 first:pt-0">
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-muted-foreground leading-relaxed">{children}</p>
    </div>
  );
}

const linkClass = 'text-primary hover:text-primary/80 font-medium transition-colors';

export const About: React.FC = () => {
  return (
    <div>
      <PageHeader backTo="/" backLabel="Home" title="Rack'em Leagues" subtitle="Your league, your way." />
      <div className="max-w-2xl mx-auto p-6 space-y-10">
        <p className="text-foreground leading-relaxed">
          Rack'em Leagues gives independent pool league operators professional-grade tools to run their leagues,
          and gives their players one place to score, follow standings and keep in touch.
        </p>

        <Section title="For Players">
          <Feature title="Your league in one place">
            Quick sign-up connects you to your team, schedule, stats and standings.
          </Feature>
          <Feature title="Detailed stats">
            Tracks break-and-runs, golden breaks and more. Filter your games to see how you do against a
            specific player or handicap range, at a venue or table, or in one game type.
          </Feature>
          <Feature title="Built-in messaging">
            Direct messages and group chats, plus team and captains' chats created for you and kept in step with
            your roster. Push notifications with quiet hours keep you posted without the constant buzz.
          </Feature>
          <Feature title="Rules at your fingertips">
            Search the official <Link to="/rules" className={linkClass}>BCA / CSI rules</Link>, plus the house
            rules your league operator adds.
          </Feature>
          <Feature title="Everyone scores">
            Players from both teams score at the same time, and the other team confirms each game. No more
            keeping two separate scoresheets and checking them line by line when the totals don't match: if a
            game is recorded differently, that exact game is flagged right away, so you know where the error is.
          </Feature>
          <Feature title="Live scoreboards">
            Scoreboards update the moment a game is scored. Follow every live match in your league and see how
            your rivals are doing.
          </Feature>
        </Section>

        <Section title="For League Operators">
          <Feature title="Fast, easy league setup">
            A step-by-step wizard gets a league set up in under 10 minutes, starting from proven preset league
            types. Customizing takes a little longer, and your choices are saved for the next league you create.
          </Feature>
          <Feature title="Smart scheduling">
            US holidays and the BCA and APA championships are flagged automatically so you can move match dates
            around them, and you can add your own weeks off.
          </Feature>
          <Feature title="Delegate what you want">
            Let captains build and update their own rosters and team names, or keep that control yourself. Teams
            can play a match early or make it up later, and work it out between themselves.
          </Feature>
          <Feature title="Scoring control">
            Enter whole matches yourself or make corrections later. Every game keeps its full record, including
            every player who entered a score and any conflicts along the way, so you can decide what changes are
            warranted with the facts in front of you.
          </Feature>
          <Feature title="Automation and customization">
            Decide how your season ends and set up playoffs your way. Start the next season in a few clicks, with
            captains telling you whether their team is coming back. Track yearly dues, work out prize payouts with
            the built-in calculator, and add your own house and league rules.
          </Feature>
          <Feature title="CSI / Fargo sanctioning">
            We aren't directly connected to CSI or FargoRate, but we make getting officially sanctioned as easy as
            we can. Each match can be viewed or printed laid out for fast manual entry, and you can track which
            ones you've already entered.
          </Feature>
          <p>
            <Link to="/become-league-operator" className={linkClass}>
              Become a League Operator →
            </Link>
          </p>
        </Section>

        <Section title="For Tournaments">
          <Feature title="Brackets in minutes">
            Single or double elimination for a bar night or side event: add names and tap winners.
          </Feature>
          <Feature title="Share it live">
            A read-only link lets anyone follow the bracket. Free to use, with no league required.
          </Feature>
        </Section>

        <Section title="What's Next">
          <Feature title="Customizable systems (coming soon)">
            Tailor handicaps, scoring and point distribution in detail, or build your own.
          </Feature>
          <Feature title="Tournament extras">
            Optional add-ons for tournament directors: schedule a tournament ahead of time for early registration,
            players sign up with a QR code, entry-fee tracking, players score their own matches, handicapped races,
            automatic table calls, and phone alerts when you're up.
          </Feature>
          <Feature title="AI assistants">
            A rules assistant that gives a first ruling on any situation, and a league operator assistant that
            handles league tasks through plain conversation.
          </Feature>
        </Section>

        <Section title="Pricing">
          <Feature title="Free to get started">
            No upfront costs to become a league operator, and a 4-week grace period lets you collect league dues
            before your first payment. We work to keep our costs low so they don't eat into your prize pool.
          </Feature>
          <p>
            <Link to="/pricing" className={linkClass}>
              See pricing →
            </Link>
          </p>
        </Section>

        <Section title="Our Philosophy">
          <p className="text-foreground leading-relaxed">
            We want to grow the pool community by making leagues easy to run and easy to play in. Pool is a great
            sport, and more people should be playing it.
          </p>
          <p className="text-foreground leading-relaxed">
            Rack'em Leagues is built by a longtime league player and operator, so it starts from what players and
            league operators actually need. Our aim is to take as much of the burden and time out of running a
            successful league as we can, so more of it goes to what matters: growing the sport and connecting the
            community.
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
