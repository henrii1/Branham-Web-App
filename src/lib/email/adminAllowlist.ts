const ADMIN_EMAILS = ["info@branhamsermons.ai", "admin@branhamsermons.ai"];

/**
 * True if `email` (case-insensitive) is one of the two hardcoded operator
 * accounts allowed to use the bulk-email tool. Never sourced from an env
 * var or DB flag — see the design spec's Access control section.
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}
