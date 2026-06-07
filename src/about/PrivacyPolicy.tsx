/**
 * @fileoverview Public Privacy Policy page.
 *
 * Lives at `/privacy` and describes what data Rack'em Leagues collects, how it's
 * used, who it's shared with, and how users can request access or deletion.
 *
 * This page must remain reachable and content-stable because OAuth providers
 * (Google, Facebook) point to it as the app's privacy policy URL during
 * verification. Facebook's app review in particular requires a live, accessible
 * privacy policy URL plus user data deletion instructions (or a deletion URL)
 * before the `email` and `public_profile` scopes can be approved.
 */
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';

const SUPPORT_EMAIL = 'support@rackemleagues.com';
const EFFECTIVE_DATE = 'June 5, 2026';

export const PrivacyPolicy: React.FC = () => {
  return (
    <div>
      <PageHeader
        backTo="/"
        backLabel="Home"
        title="Privacy Policy"
        subtitle={`Effective ${EFFECTIVE_DATE}`}
      />
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <section>
          <p className="text-foreground leading-relaxed">
            This Privacy Policy explains how Rack'em Leagues ("we", "us", or "our") collects,
            uses, and shares information when you use our website and related services
            (the "Service"). By using the Service you agree to the practices described here.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">Information We Collect</h2>
          <ul className="space-y-2 text-foreground">
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>
                <strong>Account information:</strong> when you register with email and password,
                we collect your email address and a hashed password.
              </span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>
                <strong>Social sign-in profile:</strong> when you sign in with Google or
                Facebook, the provider shares a limited profile with us — your name, email
                address, and a stable user identifier. We do not receive your social-network
                password and we do not post to your social account.
              </span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>
                <strong>League and gameplay data:</strong> teams, rosters, schedules, scores,
                handicaps, and messages you create or that are recorded for you by your league
                operator or team captain.
              </span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>
                <strong>Usage and device data:</strong> standard server and security logs
                (e.g. IP address, browser type, pages visited, timestamps) used to operate
                and secure the Service.
              </span>
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">How We Use Information</h2>
          <ul className="space-y-2 text-foreground">
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>To create and authenticate your account.</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>To run leagues — schedules, scoring, standings, statistics, payouts.</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>
                To communicate with you about your account, matches, or league
                announcements.
              </span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>
                To detect, prevent, and respond to fraud, abuse, and security issues.
              </span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>To comply with legal obligations.</span>
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">How We Share Information</h2>
          <p className="text-foreground leading-relaxed mb-3">
            We do not sell your personal information. We share it only as needed to operate
            the Service:
          </p>
          <ul className="space-y-2 text-foreground">
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>
                <strong>Inside your league:</strong> your name, team affiliations, and
                match results are visible to your league operator, team captains, and
                other members of leagues you participate in.
              </span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>
                <strong>Service providers:</strong> we use Supabase as our hosted database
                and authentication provider, and Google and Facebook as optional sign-in
                providers. These providers process data on our behalf under their own
                terms.
              </span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>
                <strong>Legal:</strong> when required by law, subpoena, or to protect the
                rights, safety, and property of Rack'em Leagues or its users.
              </span>
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">Cookies and Local Storage</h2>
          <p className="text-foreground leading-relaxed">
            We use cookies and browser storage to keep you signed in, remember preferences,
            and operate core functionality. You can clear them at any time through your
            browser, but parts of the Service may stop working.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">Your Choices and Rights</h2>
          <ul className="space-y-2 text-foreground">
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>
                <strong>Access and correction:</strong> view and update most profile
                information from your account settings.
              </span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>
                <strong>Deletion:</strong> see "Deleting Your Data" below.
              </span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>
                <strong>Unlink social sign-in:</strong> you can revoke Rack'em Leagues'
                access from your Google or Facebook account settings at any time.
              </span>
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">Deleting Your Data</h2>
          <p className="text-foreground leading-relaxed mb-3">
            To delete your account and the personal data associated with it, email{' '}
            <a
              href={`mailto:${SUPPORT_EMAIL}?subject=Account%20deletion%20request`}
              className="text-primary hover:text-primary/80 underline"
            >
              {SUPPORT_EMAIL}
            </a>{' '}
            from the email address on your account with the subject
            "Account deletion request". We will confirm receipt and complete deletion
            within 30 days. Some records may be retained when required by law or to
            preserve league history (for example, anonymized match results that other
            participants are part of).
          </p>
          <p className="text-foreground leading-relaxed">
            If you signed in with Facebook, you can also remove Rack'em Leagues from your
            Facebook account at Settings &gt; Apps and Websites. Sending the deletion
            request to {SUPPORT_EMAIL} ensures we also remove your data from our systems.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">Data Retention</h2>
          <p className="text-foreground leading-relaxed">
            We retain account and league data for as long as your account is active or
            as needed to provide the Service. After account deletion we retain only what
            is necessary to comply with legal obligations, resolve disputes, and enforce
            our agreements.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">Children</h2>
          <p className="text-foreground leading-relaxed">
            The Service is not directed to children under 13, and we do not knowingly
            collect personal information from children under 13. If you believe a child
            has provided us with personal information, contact us and we will delete it.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">Security</h2>
          <p className="text-foreground leading-relaxed">
            We use industry-standard safeguards — encrypted connections, hashed passwords,
            and access controls — to protect your information. No system is perfectly
            secure; we cannot guarantee absolute security.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">Changes to This Policy</h2>
          <p className="text-foreground leading-relaxed">
            We may update this Privacy Policy from time to time. When we make material
            changes we will update the effective date above and, where appropriate,
            notify you through the Service.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">Contact Us</h2>
          <p className="text-foreground leading-relaxed">
            Questions or requests related to your privacy can be sent to{' '}
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="text-primary hover:text-primary/80 underline"
            >
              {SUPPORT_EMAIL}
            </a>
            .
          </p>
        </section>

        <div className="pt-4 border-t">
          <Link
            to="/login"
            className="text-primary hover:text-primary/80 font-medium transition-colors"
          >
            ← Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
};
