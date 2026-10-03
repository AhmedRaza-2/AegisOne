/**
 * AegisOne Dashboard — session handling
 *
 * Every request to the AegisOne API carries the signed-in user's access token. Components
 * no longer have to remember to attach it: this patches window.fetch once so that
 *   1. requests to the API automatically get `Authorization: Bearer <access token>`;
 *   2. a 401 triggers ONE silent refresh with the refresh token and a retry;
 *   3. if the refresh also fails the session is cleared and the app is told to sign out.
 *
 * The identity of a caller is therefore always a signed token, never an email address that
 * the page merely claims.
 */
import { API_BASE } from "./api";

const ACCESS_KEY = "aegis_access_token";
const REFRESH_KEY = "aegis_refresh_token";

export function storeTokens(access?: string | null, refresh?: string | null) {
  try {
    if (access) localStorage.setItem(ACCESS_KEY, access);
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
  } catch { /* storage unavailable */ }
}

export function clearTokens() {
  try {
    ["aegis_access_token", "aegis_token", "aegis_refresh_token", "user"].forEach(k => localStorage.removeItem(k));
    // Legacy: older builds also copied the token into a script-readable cookie.
    document.cookie = "aegis_access_token=; Max-Age=0; path=/;";
  } catch { /* ignore */ }
}

let installed = false;
let refreshing: Promise<boolean> | null = null;

async function refreshAccessToken(nativeFetch: typeof fetch): Promise<boolean> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    try {
      const refresh = localStorage.getItem(REFRESH_KEY);
      if (!refresh) return false;
      const res = await nativeFetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refresh }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      storeTokens(data.access_token, data.refresh_token);
      return true;
    } catch {
      return false;
    } finally {
      setTimeout(() => { refreshing = null; }, 0);
    }
  })();
  return refreshing;
}

function isApiUrl(input: RequestInfo | URL): boolean {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
  return url.startsWith(API_BASE);
}

function isAuthEndpoint(input: RequestInfo | URL): boolean {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
  return /\/auth\/(login|register|refresh|forgot-password|verify-reset-otp|reset-password|send-admin-credentials)/.test(url);
}

export function installAuthFetch() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const nativeFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    if (!isApiUrl(input) || isAuthEndpoint(input)) return nativeFetch(input, init);

    const withToken = (): RequestInit => {
      const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
      const token = localStorage.getItem(ACCESS_KEY);
      if (token) headers.set("Authorization", `Bearer ${token}`);
      return { ...init, headers };
    };

    let res = await nativeFetch(input, withToken());
    if (res.status === 401 && localStorage.getItem(REFRESH_KEY)) {
      if (await refreshAccessToken(nativeFetch)) {
        res = await nativeFetch(input, withToken());
      }
    }
    if (res.status === 401 && localStorage.getItem(ACCESS_KEY)) {
      // Signed in as far as this browser knows, but the server no longer accepts it.
      window.dispatchEvent(new CustomEvent("aegis-session-expired"));
    }
    return res;
  };
}

/** FastAPI errors are either {detail: "text"} or {detail: [{msg: "..."}]} (validation). */
export function apiErrorMessage(body: any, fallback = "Something went wrong. Please try again."): string {
  const d = body?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d) && d.length) {
    const m = String(d[0]?.msg || "").replace(/^Value error, /, "");
    if (m) return m;
  }
  return fallback;
}
