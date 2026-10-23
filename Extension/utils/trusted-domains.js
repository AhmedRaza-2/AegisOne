/**
 * AegisOne — Trusted Domains & URL Utilities
 * ===========================================
 * Centralized list. Add domains here, never in logic files.
 */

/**
 * Extract root domain (handles ccTLDs like .edu.pk, .co.uk)
 */
export function getRootDomain(url) {
  try {
    const h = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    const parts = h.split(".");
    if (parts.length >= 3 && parts[parts.length - 2].length <= 3) {
      return parts.slice(-3).join(".");
    }
    return parts.slice(-2).join(".");
  } catch { return ""; }
}

/**
 * Returns true if the link leads to a different root domain than current page.
 */
export function isExternalLink(url) {
  try {
    const currentRoot = getRootDomain(location.href);
    const linkRoot = getRootDomain(url);
    return linkRoot !== currentRoot && linkRoot !== "";
  } catch { return false; }
}

/**
 * Returns true if URL is a browser-internal URL (chrome://, about:, etc.)
 */
export function isInternalURL(url) {
  try {
    const u = new URL(url);
    return (
      u.protocol === "chrome:" ||
      u.protocol === "chrome-extension:" ||
      u.protocol === "about:" ||
      u.protocol === "data:"
    );
  } catch { return true; }
}

/**
 * Returns true if file extension is a potentially dangerous document/executable.
 */
const DANGEROUS_EXT_RE = /\.(pdf|docx?|xlsx?|pptx?|zip|rar|7z|exe|msi|apk|dmg|iso|bat|cmd|ps1|vbs|js|jar)([?#]|$)/i;
export function isDangerousFileURL(url) {
  return DANGEROUS_EXT_RE.test(url);
}

/**
 * Compact display form of a URL for UI labels.
 */
export function shortURL(url, maxLen = 50) {
  try {
    return url.replace(/^https?:\/\//, "").slice(0, maxLen);
  } catch { return url.slice(0, maxLen); }
}

/**
 * Exact-domain matching for "known safe" hosts.
 *
 * Never use hostname.includes("google.") / includes("microsoft.com") for this: an attacker's
 * "microsoft.com.login-verify.xyz" or "google.evil.com" contains those strings and would be
 * treated as the real site, switching protections OFF on the phishing page. A host is only safe
 * when it IS the domain or a subdomain of it ("login.microsoft.com"), and search engines only
 * match their real country domains.
 */
const _SAFE_EXACT = [
  "youtube.com", "facebook.com", "instagram.com", "twitter.com", "x.com",
  "linkedin.com", "github.com", "microsoft.com", "apple.com", "amazon.com",
  "reddit.com", "wikipedia.org", "gmail.com", "googleusercontent.com", "gstatic.com",
];
const _SEARCH_RE = /(^|\.)(google|bing|yahoo|baidu|duckduckgo)\.(com|co\.(uk|in|jp|nz|za|id|kr)|com\.(pk|au|br|sg|tr|mx|ar|eg|sa)|de|fr|it|es|nl|ca|jp|in|ru|cn|pk|ae)$/;

export function isSearchEngineHost(host) {
  return _SEARCH_RE.test(String(host || "").toLowerCase());
}

export function isKnownSafeHost(host) {
  const h = String(host || "").toLowerCase().replace(/\.$/, "");
  if (!h) return false;
  if (isSearchEngineHost(h)) return true;
  return _SAFE_EXACT.some(d => h === d || h.endsWith("." + d));
}
