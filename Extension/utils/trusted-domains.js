/**
 * AegisOne — Trusted Domains & URL Utilities
 * ===========================================
 * Centralized list. Add domains here, never in logic files.
 */

export const TRUSTED_TLDS = new Set([
  ".edu", ".edu.pk", ".edu.au", ".edu.cn", ".edu.in",
  ".gov", ".gov.pk", ".gov.uk", ".gov.au", ".gov.in",
  ".ac.pk", ".ac.uk", ".ac.in",
  ".mil",
]);

export const TRUSTED_DOMAINS = new Set([
  // Search
  "google.com", "google.com.pk", "googleapis.com", "gstatic.com",
  "bing.com", "duckduckgo.com",
  // Microsoft
  "microsoft.com", "office.com", "live.com", "outlook.com",
  "microsoftonline.com", "windows.com", "azure.com",
  // Apple
  "apple.com", "icloud.com",
  // Amazon / AWS
  "amazon.com", "aws.amazon.com", "amazonaws.com",
  // Social
  "facebook.com", "instagram.com", "twitter.com", "x.com",
  "linkedin.com", "reddit.com", "pinterest.com", "tiktok.com",
  // Video
  "youtube.com", "youtu.be", "twitch.tv", "vimeo.com",
  // Dev
  "github.com", "gitlab.com", "stackoverflow.com", "npmjs.com",
  "cloudflare.com", "akamai.com", "fastly.com",
  // Finance
  "paypal.com", "stripe.com", "visa.com", "mastercard.com",
  // Entertainment
  "netflix.com", "spotify.com", "hulu.com",
  // News / Media
  "bbc.com", "cnn.com", "nytimes.com", "reuters.com",
  "dawn.com", "geo.tv", "arynews.tv",
  // Knowledge
  "wikipedia.org", "archive.org",
  // CDNs
  "cdnjs.cloudflare.com", "jsdelivr.net", "unpkg.com",
  "fontawesome.com",
  // E-commerce
  "shopify.com", "myshopify.com", "shopifycdn.com",
  "ebay.com", "aliexpress.com",
  // Local
  "localhost", "127.0.0.1",
]);

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
 * Returns true if this URL should never be scanned (trusted domain or TLD).
 */
export function isTrusted(url) {
  try {
    const h = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    const root = getRootDomain(url);
    // Check explicit domain list
    if (TRUSTED_DOMAINS.has(root) || TRUSTED_DOMAINS.has(h)) return true;
    // Check trusted TLDs (.edu, .gov, .ac.uk, etc.)
    for (const tld of TRUSTED_TLDS) {
      if (h.endsWith(tld)) return true;
    }
    return false;
  } catch { return false; }
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
      u.protocol === "data:" ||
      u.hostname === "localhost" ||
      u.hostname === "127.0.0.1" ||
      u.hostname.endsWith(".local")
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
