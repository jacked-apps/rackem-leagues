/**
 * @fileoverview League Operator Application Info Button Content
 * Centralized info content for operator application steps
 */

/**
 * Organization Name Info
 * Used in: Operator application organization name step
 */
export const organizationNameInfo = {
  title: 'Organization vs Individual Leagues',
  content: (
    <div className="space-y-2">
      <p>
        <strong>Organization Name:</strong> "Ed's BCA Leagues"
      </p>
      <p>
        <strong>Individual Leagues:</strong>
      </p>
      <ul className="ml-4 space-y-1">
        <li>• Tuesday Night 8-Ball West Side</li>
        <li>• Wednesday Night 9-Ball East Side</li>
        <li>• Friday Mixed Tournament League</li>
      </ul>
      <p className="mt-3 text-xs text-info">
        You'll create the specific leagues later. This is just your
        organization name.
      </p>
    </div>
  ),
};

/**
 * Address Privacy Info
 * Used in: Operator application address selection step
 */
export const addressPrivacyInfo = {
  title: 'Address Privacy',
  content: (
    <div className="space-y-2 text-sm">
      <p>
        This address will be used for official league correspondence and may
        be visible to players in your leagues.
      </p>
      <p>
        <strong>Profile Address:</strong> Uses your existing member address
      </p>
      <p>
        <strong>New Address:</strong> Enter a different business address for
        your organization
      </p>
    </div>
  ),
};

/**
 * Email Contact Info
 * Used in: Operator application email selection step
 */
export const emailContactInfo = {
  title: 'Email Contact Method',
  content: (
    <div className="space-y-2 text-sm">
      <p>
        This email will be used for league-related communication and may
        be visible to players in your leagues.
      </p>
      <p>
        <strong>Profile Email:</strong> Uses your existing member email
      </p>
      <p>
        <strong>New Email:</strong> Enter a dedicated league email address
      </p>
      <p className="mt-3 text-xs text-info">
        Consider using a dedicated league email for better organization
        and privacy protection.
      </p>
    </div>
  ),
};

/**
 * Phone Contact Info
 * Used in: Operator application phone selection step
 */
export const phoneContactInfo = {
  title: 'Phone Contact Method',
  content: (
    <div className="space-y-2 text-sm">
      <p>
        This phone number will be used for league-related communication and may
        be visible to players in your leagues.
      </p>
      <p>
        <strong>Profile Phone:</strong> Uses your existing member phone number
      </p>
      <p>
        <strong>New Phone:</strong> Enter a dedicated league phone number
      </p>
      <p className="mt-3 text-xs text-info">
        Consider using a dedicated league phone for better organization
        and privacy protection.
      </p>
    </div>
  ),
};

/**
 * Payment Info Explanation
 * Used in: Operator application payment information step
 */
export const paymentInfoInfo = {
  title: 'Why We Need Payment Info',
  content: (
    <div className="space-y-2 text-sm">
      <p>
        Payment information is required to prevent spam and ensure serious
        league operators join the platform.
      </p>
      <p>
        <strong>Security:</strong> We use Stripe's secure tokenization - your card
        number is never stored on our servers.
      </p>
      <p>
        <strong>No Immediate Charges:</strong> We only verify the card is valid.
        Billing begins when you create your first league.
      </p>
    </div>
  ),
};
