/**
 * @fileoverview Membership dues tracking utilities
 * Handles BCA annual dues calculations and status checking
 */

/**
 * Calculates membership dues status based on last payment date
 *
 * @param membershipPaidDate - ISO date string when dues were last paid, or null/undefined
 * @returns Object with dues status information
 * @example
 * getMembershipStatus("2024-01-15") // { isPaid: true, daysUntilDue: 180, ... }
 */
export const getMembershipStatus = (membershipPaidDate: string | null | undefined) => {
  const today = new Date();

  // If no payment date recorded, dues are owed
  if (!membershipPaidDate) {
    return {
      isPaid: false,
      daysOverdue: null,
      daysUntilDue: null,
      status: 'never_paid' as const,
      statusMessage: 'Membership dues have never been paid'
    };
  }

  const paidDate = new Date(membershipPaidDate);
  const oneYearLater = new Date(paidDate);
  oneYearLater.setFullYear(paidDate.getFullYear() + 1);

  const timeDifference = oneYearLater.getTime() - today.getTime();
  const daysDifference = Math.ceil(timeDifference / (1000 * 60 * 60 * 24));

  if (daysDifference > 0) {
    // Dues are current - paid within the last year
    return {
      isPaid: true,
      daysOverdue: null,
      daysUntilDue: daysDifference,
      status: 'current' as const,
      statusMessage: `Membership dues are current (expires in ${daysDifference} days)`
    };
  } else {
    // Dues are overdue - more than a year since last payment
    const daysOverdue = Math.abs(daysDifference);
    return {
      isPaid: false,
      daysOverdue,
      daysUntilDue: null,
      status: 'overdue' as const,
      statusMessage: `Membership dues are overdue by ${daysOverdue} days`
    };
  }
};

/**
 * Formats a membership due date for display
 *
 * @param membershipPaidDate - ISO date string when dues were last paid
 * @returns Formatted string showing when dues expire
 * @example
 * formatDueDate("2024-01-15") // "Expires: January 15, 2025"
 */
export const formatDueDate = (membershipPaidDate: string | null | undefined): string => {
  if (!membershipPaidDate) {
    return 'No payment on record';
  }

  const paidDate = new Date(membershipPaidDate);
  const expiryDate = new Date(paidDate);
  expiryDate.setFullYear(paidDate.getFullYear() + 1);

  return `Expires: ${expiryDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })}`;
};

/**
 * Determines the CSS classes for displaying dues status
 *
 * @param membershipPaidDate - ISO date string when dues were last paid
 * @returns Object with CSS classes for styling dues status
 */
export const getDuesStatusStyling = (membershipPaidDate: string | null | undefined) => {
  const status = getMembershipStatus(membershipPaidDate);

  switch (status.status) {
    case 'current':
      return {
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
        textColor: 'text-green-800',
        badgeColor: 'bg-green-100 text-green-800'
      };
    case 'overdue':
      return {
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
        textColor: 'text-red-800',
        badgeColor: 'bg-red-100 text-red-800'
      };
    case 'never_paid':
      return {
        bgColor: 'bg-yellow-50',
        borderColor: 'border-yellow-200',
        textColor: 'text-yellow-800',
        badgeColor: 'bg-yellow-100 text-yellow-800'
      };
    default:
      return {
        bgColor: 'bg-muted',
        borderColor: 'border-border',
        textColor: 'text-foreground',
        badgeColor: 'bg-muted text-foreground'
      };
  }
};