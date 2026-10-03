/**
 * AegisOne — Extension authentication
 * ====================================
 * The extension identifies itself to the backend with the SAME signed token the user got when
 * they signed in to the AegisOne dashboard (handed over by the dashboard page's content-script
 * bridge). It no longer sends an email address as if that were proof of identity.
 *
 *   - Not signed in  -> requests go out without a token; scanning still works, but results are
 *                       anonymous (not attributed to anyone).
 *   - Signed in      -> `Authorization: Bearer <access token>`; on 401 the access token is
 *                       renewed once with the refresh token and the request retried.
 */
import { getApiBaseUrl } from "./constants.js";

const ACCESS = "auth_access_token";
const REFRESH = "auth_refresh_token";

export async function setTokens(access, refresh) {
  const toSet = {};
  if (access) toSet[ACCESS] = access;
  if (refresh) toSet[REFRESH] = refresh;
  if (Object.keys(toSet).length) await chrome.storage.local.set(toSet);
}

export async function clearTokens() {
  await chrome.storage.local.remove([ACCESS, REFRESH]);
}

export async function getAccessToken() {
  const s = await chrome.storage.local.get(ACCESS);
  return s[ACCESS] || null;
}

let _refreshing = null;

async function _refresh() {
  if (_refreshing) return _refreshing;
  _refreshing = (async () => {
    try {
      const s = await chrome.storage.local.get(REFRESH);
      if (!s[REFRESH]) return false;
      const base = await getApiBaseUrl();
      const res = await fetch(`${base}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: s[REFRESH] }),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) await clearTokens();
        return false;
      }
      const data = await res.json();
      await setTokens(data.access_token, data.refresh_token);
      return true;
    } catch (_) {
      return false;
    } finally {
      setTimeout(() => { _refreshing = null; }, 0);
    }
  })();
  return _refreshing;
}

/** Exchange the stored refresh token for a fresh access token right now. */
export async function refreshNow() {
  return _refresh();
}

function _expiryMs(token) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch (_) { return null; }
}

/**
 * fetch() that attaches the signed-in user's token.
 *  - The access token is renewed BEFORE it expires (a service worker has no timers, so this is
 *    checked on every call), so scans never silently lose their user.
 *  - A 401 renews once and retries.
 *  - If the credential has been revoked (account disabled / password changed / 30 days idle) the
 *    request is repeated without it, so protection keeps working anonymously instead of failing.
 *  - A server that is merely unreachable never clears the stored credential.
 */
export async function authFetch(url, opts = {}) {
  const store = await chrome.storage.local.get([ACCESS, REFRESH]);
  const hasRefresh = !!store[REFRESH];
  const exp = store[ACCESS] ? _expiryMs(store[ACCESS]) : null;
  if (hasRefresh && (!store[ACCESS] || (exp !== null && exp - Date.now() < 60_000))) {
    await _refresh();
  }

  const withToken = async () => {
    const headers = new Headers(opts.headers || {});
    const token = await getAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return { ...opts, headers };
  };

  let res = await fetch(url, await withToken());
  if (res.status === 401 && hasRefresh) {
    if (await _refresh()) res = await fetch(url, await withToken());
    else if (!(await getAccessToken())) res = await fetch(url, await withToken());   // revoked -> anonymous
  }
  return res;
}

// ── The AegisOne server itself is never scanned ─────────────────────────────────────
// The dashboard (:3002), landing (:3001/:3000) and API (:8000) live on the server's own address
// (often a bare LAN IP over http, which looks "risky" to a URL model). Scanning them only adds
// noise and inflates every user's scan counts, so they are skipped.
const OWN_PORTS = new Set(["3000", "3001", "3002", "8000"]);

export async function isAegisServerUrl(url) {
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) return false;
    const { server_url } = await chrome.storage.local.get("server_url");
    if (server_url) {
      const s = new URL(server_url);
      if (u.hostname === s.hostname && (OWN_PORTS.has(u.port) || u.port === s.port)) return true;
    }
    return false;
  } catch (_) { return false; }
}
