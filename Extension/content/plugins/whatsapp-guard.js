/**
 * AegisOne — Content Script Plugin: WhatsApp Web Guard
 * Replaced legacy hardcoded SCAM_PATTERNS regex. Now delegates all threat evaluation
 * directly to AegisOne's pre-trained core AI models (predict_text, predict_url).
 */

export function initWhatsappGuard() {
  // Deprecated legacy plugin initialization.
  // Main protection is handled by Extension/content/whatsapp.js and AegisOne model router.
  console.log("[AegisOne:WhatsAppGuard] Plugin active — delegating to AegisOne AI Model Router.");
}
