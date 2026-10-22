const CONFIGURATION_MESSAGE = 'Organization registration is not configured. Please contact your site administrator.';
const UNAVAILABLE_MESSAGE = 'The registration service is unavailable. Please try again shortly. Your details have been kept.';
const RESTRICTED_MESSAGE = 'Registration is temporarily restricted. Please contact support or try again later.';
const ORGANIZATION_EXISTS_MESSAGE = 'This organization name is already registered. Please sign in or contact support.';
const EMAIL_EXISTS_MESSAGE = 'This email address is already registered. Please sign in or use a different email.';

/** Return actionable registration messages without displaying database or network diagnostics. */
export function getRegistrationErrorMessage(error: unknown): string {
  const details = error && typeof error === 'object' ? error as { message?: unknown; code?: unknown } : undefined;
  const message = typeof details?.message === 'string' ? details.message : typeof error === 'string' ? error : '';
  const code = typeof details?.code === 'string' ? details.code.toLowerCase() : '';
  const text = message.toLowerCase();

  if (code === 'registration_unconfigured' || code === 'registration_configuration' || code === 'configuration_error' ||
      text.includes('registration is not configured') || text.includes('registration service is not configured') ||
      text.includes('missing vite_supabase') || text.includes('invalid supabase configuration')) {
    return CONFIGURATION_MESSAGE;
  }
  if (code === 'registration_unavailable' || code === 'service_unavailable' ||
      text.includes('registration service is unavailable') || text.includes('failed to verify organization name') ||
      text.includes('failed to verify email address')) {
    return UNAVAILABLE_MESSAGE;
  }
  if (code === 'registration_restricted' || code === 'registration_permissions' || code === '42501' ||
      text.includes('row-level security') || /\brls\b/.test(text) || text.includes('permission denied') || text.includes('policy for table')) {
    return RESTRICTED_MESSAGE;
  }

  // Keep organization and email collisions separate, including database constraint errors.
  const duplicate = text.includes('duplicate key') || text.includes('already registered') || text.includes('already exists');
  if (text.includes('organization is already registered for this account')) {
    return 'An organization is already registered for this account. Please sign in.';
  }
  if (code === 'duplicate_organization' ||
      (duplicate && (text.includes('organization named') || text.includes('organization name') || text.includes('organizations_name')))) {
    return ORGANIZATION_EXISTS_MESSAGE;
  }
  if (code === 'duplicate_email' || code === 'user_already_exists' || text.includes('user_already_exists') || duplicate) return EMAIL_EXISTS_MESSAGE;

  const throttle = text.match(/after (\d+) seconds?/);
  if (throttle) return `Please wait ${Math.max(1, Math.min(Number(throttle[1]), 3600))} seconds before trying again.`;
  if (text.includes('could not be verified')) {
    return 'We could not finish creating your organization. If you registered this email before, use Sign in or Forgot password; otherwise please try again.';
  }
  if (text.includes('already has an aegisone login')) {
    return 'This email address already has an AegisOne login. Please sign in, or use Forgot password if you do not remember it.';
  }
  if (text.includes('email rate limit') || text.includes('rate limit') || text.includes('too many requests')) {
    return 'Too many sign-up attempts. Please wait a few minutes and try again.';
  }
  if (text.includes('invalid email') || text.includes('invalid_email')) {
    return 'The email address provided is not valid. Please check and try again.';
  }
  if (text.includes('weak password') || text.includes('password should be')) {
    return 'Your password is too weak. Please choose a stronger password (min. 8 characters, uppercase, number).';
  }
  if (text.includes('network') || text.includes('fetch') || text.includes('enotfound') || text.includes('timeout')) {
    return 'We could not reach the registration service. Please check your connection and try again. Your details have been kept.';
  }
  if (text.includes('signup disabled') || text.includes('signups not allowed')) {
    return 'New registrations are temporarily paused. Please try again later or contact support.';
  }
  return 'We could not complete registration. Please try again, or contact support if the problem continues.';
}
