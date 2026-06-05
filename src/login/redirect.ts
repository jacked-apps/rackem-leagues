/**
 * @fileoverview Post-sign-in redirect helper (open-redirect guard).
 *
 * Sign-in screens accept a `?redirect` (or router `location.state.redirect`)
 * telling them where to send the user after authenticating — e.g. back to a
 * team-join/claim they were bounced out of. An attacker could supply an
 * absolute or protocol-relative URL to bounce the user to a phishing site, so
 * we honor ONLY same-origin relative paths.
 */

/**
 * Validate a raw redirect value and return a safe same-origin relative path, or
 * null if it is missing or unsafe.
 *
 * Accepts only values that, after a single decode, are a relative path starting
 * with a single "/" — rejecting absolute URLs (`https://evil.com`),
 * protocol-relative URLs (`//evil.com`), and encoded variants
 * (`%2F%2Fevil.com`, double-encoded). The result is always navigated with
 * react-router's relative `navigate()`, so it can never leave the app origin.
 *
 * @param raw - The candidate redirect (from a query param or router state).
 * @returns A safe relative path, or null.
 */
export function getSafeRedirectPath(raw: string | null | undefined): string | null {
  if (!raw) return null;

  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null; // malformed encoding
  }

  if (!decoded.startsWith('/')) return null; // must be a relative path
  if (decoded.startsWith('//')) return null; // protocol-relative -> off-origin
  if (decoded.includes('://')) return null; // contains a scheme

  return decoded;
}
