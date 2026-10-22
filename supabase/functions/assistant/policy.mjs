import { SOURCE_IDS } from './knowledge.mjs';

export const LANGUAGES = Object.freeze(['en', 'ur', 'ur-Latn']);
export const FIELDS = Object.freeze(['org_name', 'admin_email', 'org_industry', 'org_country', 'smtp_host', 'smtp_port', 'smtp_username', 'smtp_password', 'sender_email', 'server_address']);
export const COUNTS = Object.freeze(['departments', 'members', 'duplicateIds', 'duplicateEmails', 'unassignedMembers', 'invalidRows', 'sent', 'failed', 'managers', 'employees']);
export const STEPS = Object.freeze(['organization', 'structure', 'validation', 'security', 'rollout']);
export const ERRORS = Object.freeze(['missing_required', 'duplicate_ids', 'duplicate_emails', 'unassigned_members', 'invalid_csv', 'smtp_auth', 'smtp_network', 'smtp_tls', 'smtp_unknown', 'deployment_slow', 'deployment_timeout', 'dispatch_partial', 'dispatch_unknown']);
const CONTEXT_ENUMS = Object.freeze({
  surface: ['landing', 'deployment_portal', 'organization_setup'],
  section: ['hero', 'features', 'pricing', 'demo', 'deployment', 'privacy', 'contact', 'docs'],
  step: STEPS,
  os: ['windows', 'linux', 'macos', 'unknown'],
  readiness: ['checking', 'ready', 'slow', 'timeout', 'unknown'],
  rollout: ['idle', 'running', 'completed', 'partial_failure', 'unknown'],
});
export class ApiError extends Error {
  constructor(status, code, message, retryAfter) {
    super(message); this.status = status; this.code = code; this.retryAfter = retryAfter;
  }
}
export function object(value, allowed, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => !allowed.includes(k))) {
    throw new ApiError(400, 'invalid_input', `Invalid ${name}.`);
  }
  return value;
}
export function language(value) {
  if (!LANGUAGES.includes(value)) throw new ApiError(400, 'invalid_input', 'Invalid conversation language.');
  return value;
}
export function languageMode(value) {
  if (value === undefined) return 'fixed'; // Existing integrations keep their explicit locale.
  if (!['auto', 'fixed'].includes(value)) throw new ApiError(400, 'invalid_input', 'Invalid language mode.');
  return value;
}
export function uuid(value) {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new ApiError(400, 'invalid_input', 'Invalid request identifier.');
  }
  return value;
}
export function validateContext(value) {
  object(value, [...Object.keys(CONTEXT_ENUMS), 'fieldStatus', 'counts', 'errors'], 'page status');
  if (!CONTEXT_ENUMS.surface.includes(value.surface)) throw new ApiError(400, 'invalid_input', 'Invalid page surface.');
  const result = { surface: value.surface };
  for (const [key, options] of Object.entries(CONTEXT_ENUMS)) {
    if (key in value) {
      if (!options.includes(value[key])) throw new ApiError(400, 'invalid_input', 'Unknown page status.');
      result[key] = value[key];
    }
  }
  if ('fieldStatus' in value) {
    object(value.fieldStatus, FIELDS, 'field status'); result.fieldStatus = {};
    for (const [key, flag] of Object.entries(value.fieldStatus)) {
      if (typeof flag !== 'boolean') throw new ApiError(400, 'invalid_input', 'Field status must contain only completion flags.');
      result.fieldStatus[key] = flag;
    }
  }
  if ('counts' in value) {
    object(value.counts, COUNTS, 'counts'); result.counts = {};
    for (const [key, count] of Object.entries(value.counts)) {
      if (!Number.isInteger(count) || count < 0 || count > 1000000) throw new ApiError(400, 'invalid_input', 'Invalid status count.');
      result.counts[key] = count;
    }
  }
  if ('errors' in value) {
    if (!Array.isArray(value.errors) || value.errors.length > ERRORS.length || value.errors.some(e => !ERRORS.includes(e))) throw new ApiError(400, 'invalid_input', 'Unknown error category.');
    result.errors = [...new Set(value.errors)];
  }
  return result;
}

export function redactMessage(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 2000) throw new ApiError(400, 'invalid_input', 'Messages must contain 1–2,000 characters.');
  return value.trim()
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email removed]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[token removed]')
    .replace(/\b(?:gsk_|sk-)[A-Za-z0-9_-]{12,}\b/g, '[key removed]')
    .replace(/\b(?:password|smtpPass|smtp_password|api[_ -]?key|authorization|deployment[_ -]?token|license[_ -]?key)\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\r\n,;]+)/gi, '[credential removed]')
    .replace(/https?:\/\/[^\s]+/gi, '[URL removed]');
}

export function validateAction(value, context) {
  object(value, ['type', 'target'], 'assistant action');
  const targets = {
    highlight_field: FIELDS,
    show_validation_group: ['duplicate_ids', 'duplicate_emails', 'unassigned_members', 'invalid_csv'],
    open_step: STEPS,
    open_documentation: SOURCE_IDS,
    contact_team: ['contact'],
  };
  if (!targets[value.type]?.includes(value.target)) throw new ApiError(502, 'invalid_answer', 'The assistant returned an unsupported action.');
  if ((value.type === 'highlight_field' && context.surface === 'landing') ||
      (['show_validation_group', 'open_step'].includes(value.type) && context.surface !== 'organization_setup')) {
    throw new ApiError(502, 'invalid_answer', 'The assistant returned an action for a different page.');
  }
  return { type: value.type, target: value.target };
}

export function validateReply(value, lang, context, sourceIds, mode = 'fixed') {
  object(value, ['answer', 'speechText', 'sources', 'actions', ...(mode === 'auto' ? ['language'] : [])], 'assistant answer');
  if (mode === 'auto') {
    if (!LANGUAGES.includes(value.language)) throw new ApiError(502, 'invalid_answer', 'The assistant returned an unsupported language.');
    lang = value.language;
  }
  if (typeof value.answer !== 'string' || !value.answer.trim() || value.answer.length > 1800 || value.answer.trim().split(/\s+/u).length > 150 ||
      typeof value.speechText !== 'string' || !value.speechText.trim() || value.speechText.length > 1200) {
    throw new ApiError(502, 'invalid_answer', 'The assistant answer exceeded its size limit.');
  }
  if (!Array.isArray(value.sources) || value.sources.length < 1 || value.sources.length > 5 || value.sources.some(id => !sourceIds.includes(id))) {
    throw new ApiError(502, 'invalid_answer', 'The assistant returned an unsupported source.');
  }
  if (!Array.isArray(value.actions) || value.actions.length > 3) throw new ApiError(502, 'invalid_answer', 'Invalid assistant actions.');
  const urduLetters = /[\u0620-\u064a\u066e-\u06d3\u06fa-\u06ff]/u;
  const wrongAnswerLanguage = (lang === 'en' && urduLetters.test(value.answer)) ||
      (lang === 'ur' && !urduLetters.test(value.answer)) ||
      (lang === 'ur-Latn' && urduLetters.test(value.answer));
  const wrongSpeechLanguage = (lang === 'en' && urduLetters.test(value.speechText)) ||
      (lang !== 'en' && !urduLetters.test(value.speechText));
  if (wrongAnswerLanguage || wrongSpeechLanguage) {
    const error = new ApiError(502, 'invalid_answer', 'The assistant returned the wrong response language.');
    error.validationPart = wrongAnswerLanguage ? 'answer_language' : 'speech_language';
    error.responseLanguage = lang;
    throw error;
  }
  // Link destinations are always generated locally from source/action IDs.
  if (/https?:\/\/|javascript:|data:|<\/?[a-z][^>]*>/i.test(value.answer + value.speechText)) throw new ApiError(502, 'invalid_answer', 'The assistant returned unsupported rich content.');
  return { answer: value.answer.trim(), speechText: value.speechText.trim(), language: lang, sources: [...new Set(value.sources)], actions: value.actions.map(a => validateAction(a, context)), status: 'complete' };
}

export function fallbackReply(lang, turnId) {
  const texts = {
    en: 'AI guidance is temporarily unavailable. You can continue using the setup controls and basic help. Do not share passwords or tokens. Contact the team if you need more help.',
    ur: 'اے آئی رہنمائی فی الحال دستیاب نہیں ہے۔ آپ سیٹ اپ کے موجودہ بٹن اور بنیادی مدد استعمال کر سکتے ہیں۔ پاس ورڈ یا ٹوکن شیئر نہ کریں۔ مزید مدد کے لیے ٹیم سے رابطہ کریں۔',
    'ur-Latn': 'AI rehnumai filhal dastiyab nahin. Aap setup ke mojooda controls aur bunyadi madad istemal kar sakte hain. Password ya token share na karein. Mazeed madad ke liye team se rabta karein.',
  };
  const text = texts[lang];
  return { turnId, answer: text, speechText: lang === 'ur-Latn' ? texts.ur : text, language: lang, sources: ['limitations', 'contact'], actions: [{ type: 'contact_team', target: 'contact' }], status: 'fallback' };
}

// A canonical PCM WAV makes duration independently enforceable on the server.
// Trusting WebM metadata or a client-supplied duration would bypass audio quotas.
export function validateWav(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 44 || bytes.length > 960044) throw new ApiError(400, 'invalid_audio', 'Use a recording of at most 30 seconds.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const text = (start, len) => String.fromCharCode(...bytes.subarray(start, start + len));
  if (text(0, 4) !== 'RIFF' || text(8, 4) !== 'WAVE' || text(12, 4) !== 'fmt ' || view.getUint32(16, true) !== 16 ||
      view.getUint16(20, true) !== 1 || view.getUint16(22, true) !== 1 || view.getUint32(24, true) !== 16000 ||
      view.getUint32(28, true) !== 32000 || view.getUint16(32, true) !== 2 || view.getUint16(34, true) !== 16 ||
      text(36, 4) !== 'data' || view.getUint32(40, true) !== bytes.length - 44 || view.getUint32(4, true) !== bytes.length - 8 || (bytes.length - 44) % 2 !== 0) {
    throw new ApiError(400, 'invalid_audio', 'Use mono 16 kHz PCM WAV audio.');
  }
  const seconds = (bytes.length - 44) / 32000;
  if (seconds < 0.25 || seconds > 30) throw new ApiError(400, 'invalid_audio', 'Record between a quarter-second and 30 seconds.');
  return seconds;
}
