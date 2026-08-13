/**
 * AegisOne Dashboard — API Base URL Utility
 * ==========================================
 * Dynamically resolves the backend API base URL.
 * Works in local dev (localhost:8000) and Docker deployments
 * where the dashboard and backend are on the same host.
 *
 * Override via environment variable NEXT_PUBLIC_API_BASE in .env.local
 * Example: NEXT_PUBLIC_API_BASE=http://192.168.1.100:8000
 */

function resolveApiBase(): string {
  // 1. Explicit override via env var (set in Docker or .env.local)
  if (process.env.NEXT_PUBLIC_API_BASE) {
    return process.env.NEXT_PUBLIC_API_BASE.replace(/\/$/, "");
  }

  // 2. Browser-side detection: use same host as the page, port 8000
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      return "http://localhost:8000";
    }
    return `http://${host}:8000`;
  }

  // 3. Server-side rendering fallback
  return "http://localhost:8000";
}

export const API_BASE = resolveApiBase();
