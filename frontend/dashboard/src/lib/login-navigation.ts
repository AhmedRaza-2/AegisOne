const LOCAL_ORIGIN = 'https://dashboard.invalid';
const SETUP_PATH = '/dashboard/admin/setup';
const SETUP_FIELDS = ['fromLanding', 'orgName', 'industry', 'adminEmail', 'adminName', 'serverHost'];

/** Preserve dashboard context while rejecting external URLs and legacy credential parameters. */
export function safeDashboardNext(raw: string | null | undefined): string | null {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || /[\\\u0000-\u0020\u007f]/.test(raw)) return null;
  try {
    const url = new URL(raw, LOCAL_ORIGIN);
    if (url.origin !== LOCAL_ORIGIN || (url.pathname !== '/dashboard' && !url.pathname.startsWith('/dashboard/'))) return null;
    if (/%(?:2f|5c)/i.test(url.pathname)) return null;
    if (url.pathname === SETUP_PATH) {
      const clean = new URLSearchParams();
      for (const key of SETUP_FIELDS) {
        const value = url.searchParams.get(key);
        if (value !== null) clean.set(key, value);
      }
      url.search = clean.toString();
    } else {
      for (const key of [...url.searchParams.keys()]) {
        if (/password|secret|token|key/i.test(key)) url.searchParams.delete(key);
      }
    }
    return url.pathname + url.search;
  } catch { return null; }
}

export function dashboardLoginDestination(role: string | undefined, next: string | null): string {
  const normalizedRole = role?.toLowerCase();
  const home = ['admin', 'super_admin', 'global_admin'].includes(normalizedRole || '')
    ? '/dashboard/admin'
    : ['manager', 'department_admin', 'office_admin'].includes(normalizedRole || '')
      ? '/dashboard/supervisor' : '/dashboard/employee';
  const safe = safeDashboardNext(next);
  const path = safe?.split('?')[0];
  return safe && (path === home || path?.startsWith(home + '/')) ? safe : home;
}

export function firstAdministratorContext(next: string | null) {
  const safe = safeDashboardNext(next);
  if (!safe) return null;
  const url = new URL(safe, LOCAL_ORIGIN);
  if (url.pathname !== SETUP_PATH || url.searchParams.get('fromLanding') !== 'true') return null;
  return {
    email: url.searchParams.get('adminEmail') || '',
    fullName: url.searchParams.get('adminName') || '',
    organization: url.searchParams.get('orgName') || '',
  };
}

/** First-admin creation is an explicit form mode, available only for the portal setup path. */
export function isFirstAdministratorMode(mode: string, next: string | null): boolean {
  return mode === 'create_first_admin' && firstAdministratorContext(next) !== null;
}
