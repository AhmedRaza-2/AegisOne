export interface SupabasePublicEnv {
  VITE_SUPABASE_URL?: unknown;
  VITE_SUPABASE_ANON_KEY?: unknown;
}

export interface SupabaseConfiguration {
  url: string;
  anonKey: string;
  configured: boolean;
  problem: 'missing' | 'placeholder' | 'invalid_url' | 'invalid_key' | null;
}

export type RegistrationServiceErrorCode = 'registration_unconfigured' | 'registration_unavailable' | 'registration_restricted';

export class RegistrationServiceError extends Error {
  readonly code: RegistrationServiceErrorCode;

  constructor(code: RegistrationServiceErrorCode, cause?: unknown) {
    const messages = {
      registration_unconfigured: 'Organization registration is not configured on this website. Please contact the site administrator.',
      registration_unavailable: 'The registration service is temporarily unavailable. Please try again later.',
      registration_restricted: 'Registration is temporarily restricted. Please contact the site administrator.',
    };
    super(messages[code], cause === undefined ? undefined : { cause });
    this.name = 'RegistrationServiceError';
    this.code = code;
  }
}

/** Browser configuration may contain only a public key for the selected project. */
function isPublicProjectKey(key: string, url: URL): boolean {
  if (/^sb_secret_/i.test(key)) return false;
  if (key.startsWith('sb_publishable_')) return /^sb_publishable_[A-Za-z0-9_-]+$/.test(key);

  // Opaque keys remain supported for local/custom gateways. Legacy Supabase
  // JWTs carry a role and project reference that can catch unsafe configuration.
  if (!key.includes('.') && !key.startsWith('eyJ')) return true;
  const parts = key.split('.');
  if (parts.length !== 3 || parts.some(part => !/^[A-Za-z0-9_-]+$/.test(part))) return false;
  try {
    const decode = (part: string): Record<string, unknown> => {
      const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
      const decoded = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')));
      if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) throw new Error('Invalid JWT');
      return decoded;
    };
    const header = decode(parts[0]);
    const claims = decode(parts[1]);
    if (typeof header.alg !== 'string' || header.alg.toLowerCase() === 'none' || claims.role !== 'anon') return false;
    if (claims.ref !== undefined && typeof claims.ref !== 'string') return false;
    const projectRef = url.hostname.match(/^([a-z0-9-]+)\.supabase\.co$/)?.[1];
    return !projectRef || claims.ref === undefined || claims.ref === projectRef;
  } catch {
    return false;
  }
}

/** Keep the public website usable even when its optional registration connection is missing. */
export function resolveSupabaseConfiguration(env: SupabasePublicEnv): SupabaseConfiguration {
  const url = typeof env.VITE_SUPABASE_URL === 'string' ? env.VITE_SUPABASE_URL.trim() : '';
  const anonKey = typeof env.VITE_SUPABASE_ANON_KEY === 'string' ? env.VITE_SUPABASE_ANON_KEY.trim() : '';
  let problem: SupabaseConfiguration['problem'] = null;
  if (!url || !anonKey) problem = 'missing';
  else if (/your-project(?:-id)?|<project|placeholder/i.test(url) || /^(?:your[-_]|placeholder|change[-_]?me)/i.test(anonKey)) problem = 'placeholder';
  else {
    try {
      const parsed = new URL(url);
      const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
      if ((parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && loopback)) || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') problem = 'invalid_url';
      else if (!isPublicProjectKey(anonKey, parsed)) problem = 'invalid_key';
    } catch { problem = 'invalid_url'; }
  }
  if (problem) {
    // createClient needs a valid URL/key at import time. No retired project or
    // real credential is used as a fallback; registration is guarded below.
    return { url: 'https://unconfigured.invalid', anonKey: 'unconfigured-public-key', configured: false, problem };
  }
  return { url: url.replace(/\/$/, ''), anonKey, configured: true, problem: null };
}

export function requireSupabaseConfiguration(configuration: SupabaseConfiguration): void {
  if (!configuration.configured) throw new RegistrationServiceError('registration_unconfigured');
}

/** A failed availability request is an infrastructure failure, not an invalid organization name. */
export function registrationLookupError(error: { code?: string; message?: string }, status?: number): RegistrationServiceError {
  const restricted = status === 401 || status === 403 || error.code === '42501' || error.code === 'PGRST301';
  return new RegistrationServiceError(restricted ? 'registration_restricted' : 'registration_unavailable', error);
}
