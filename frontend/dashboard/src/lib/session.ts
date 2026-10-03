/**
 * AegisOne Dashboard — session handling
 *
 * Goal: once someone has signed in, they stay signed in. They only see the login page when they
 * sign out themselves, change their password, are disabled, or have not used AegisOne for 30 days.
 *
 *  - Every request to the AegisOne API automatically carries the access token.
 *  - The access token (1 hour) is renewed quietly BEFORE it expires, whenever the tab becomes
 *    active again, and on reconnect - so nothing ever fails because of a stale token.
 *  - If a request still gets a 401, it is renewed once and the request retried.
 *  - A server that is restarting or unreachable NEVER signs anyone out; GET requests are retried
 *    for a few seconds while it comes back. Only an explicit rejection of the refresh token
 *    (revoked / disabled account / 30 days idle) ends the session.
 */
import { API_BASE } from "./api";

const ACCESS_KEY = "aegis_access_token";
const REFRESH_KEY = "aegis_refresh_token";
const RENEW_BEFORE_MS = 5 * 60 * 1000;     // renew when less than 5 minutes remain

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

function tokenExpiryMs(token: string | null): number | null {
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch { return null; }
}

type RefreshResult = "ok" | "rejected" | "unreachable";

let installed = false;
let refreshing: Promise<RefreshResult> | null = null;
let nativeFetchRef: typeof fetch | null = null;

function expireSession() {
  window.dispatchEvent(new CustomEvent("aegis-session-expired"));
}

async function refreshAccessToken(): Promise<RefreshResult> {
  if (refreshing) return refreshing;
  const nativeFetch = nativeFetchRef!;
  refreshing = (async (): Promise<RefreshResult> => {
    try {
      const refresh = localStorage.getItem(REFRESH_KEY);
      if (!refresh) return "rejected";
      const res = await nativeFetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refresh }),
      });
      if (res.status === 401 || res.status === 403) return "rejected";
      if (!res.ok) return "unreachable";          // 5xx / proxy error while the server restarts
      const data = await res.json();
      storeTokens(data.access_token, data.refresh_token);
      return "ok";
    } catch {
      return "unreachable";                        // network down / server not up yet
    } finally {
      setTimeout(() => { refreshing = null; }, 0);
    }
  })();
  return refreshing;
}

/** Renew now if the access token is missing, expired or about to expire. */
async function ensureFresh(): Promise<void> {
  const access = localStorage.getItem(ACCESS_KEY);
  const refresh = localStorage.getItem(REFRESH_KEY);
  if (!refresh) return;                             // nothing to renew with (very old session)
  const exp = tokenExpiryMs(access);
  if (exp !== null && exp - Date.now() > RENEW_BEFORE_MS) return;
  const r = await refreshAccessToken();
  if (r === "rejected") expireSession();
}

function urlOf(input: RequestInfo | URL): string {
  return typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
}

const isApiUrl = (input: RequestInfo | URL) => urlOf(input).startsWith(API_BASE);
const isAuthEndpoint = (input: RequestInfo | URL) =>
  /\/auth\/(login|register|refresh|forgot-password|verify-reset-otp|reset-password|send-admin-credentials)/.test(urlOf(input));

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export function installAuthFetch() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const nativeFetch = window.fetch.bind(window);
  nativeFetchRef = nativeFetch;

  /** fetch that rides out a restarting server: idempotent requests are retried for a few seconds. */
  const resilient = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const method = (init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
    const retryable = method === "GET" || method === "HEAD";
    const delays = retryable ? [700, 1500, 3000] : [];
    for (let attempt = 0; ; attempt++) {
      try {
        return await nativeFetch(input, init);
      } catch (err) {
        if (attempt >= delays.length) throw err;
        await sleep(delays[attempt]);
      }
    }
  };

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    if (!isApiUrl(input)) return nativeFetch(input, init);
    if (isAuthEndpoint(input)) return resilient(input, init);

    await ensureFresh();

    const withToken = (): RequestInit => {
      const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
      const token = localStorage.getItem(ACCESS_KEY);
      if (token) headers.set("Authorization", `Bearer ${token}`);
      return { ...init, headers };
    };

    let res = await resilient(input, withToken());
    if (res.status === 401 && localStorage.getItem(ACCESS_KEY)) {
      const r = localStorage.getItem(REFRESH_KEY) ? await refreshAccessToken() : "rejected";
      if (r === "ok") {
        res = await resilient(input, withToken());
      } else if (r === "rejected") {
        expireSession();                            // definitively rejected: sign out cleanly
      }
      // "unreachable": leave the session alone, the caller just sees the failed response
    }
    return res;
  };

  // Keep the token fresh in the background and the moment the user comes back.
  const tick = () => { void ensureFresh(); };
  setInterval(tick, 60 * 1000);
  window.addEventListener("focus", tick);
  window.addEventListener("online", tick);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") tick(); });
  tick();
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
