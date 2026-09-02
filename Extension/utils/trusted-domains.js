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
