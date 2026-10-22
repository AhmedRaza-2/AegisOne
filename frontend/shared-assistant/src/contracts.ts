export type Language = 'en' | 'ur' | 'ur-Latn';
export type AssistantSurface = 'landing' | 'deployment_portal' | 'organization_setup';
export const STEPS = ['organization', 'structure', 'validation', 'security', 'rollout'] as const;
export const SECTIONS = ['hero', 'features', 'pricing', 'demo', 'deployment', 'privacy', 'contact', 'docs'] as const;
export const FIELDS = ['org_name', 'admin_email', 'org_industry', 'org_country', 'smtp_host', 'smtp_port', 'smtp_username', 'smtp_password', 'sender_email', 'server_address'] as const;
export const COUNTS = ['departments', 'members', 'duplicateIds', 'duplicateEmails', 'unassignedMembers', 'invalidRows', 'sent', 'failed', 'managers', 'employees'] as const;
export const ERRORS = ['missing_required', 'duplicate_ids', 'duplicate_emails', 'unassigned_members', 'invalid_csv', 'smtp_auth', 'smtp_network', 'smtp_tls', 'smtp_unknown', 'deployment_slow', 'deployment_timeout', 'dispatch_partial', 'dispatch_unknown'] as const;
export const SOURCE_IDS = ['overview', 'features', 'pricing', 'deployment', 'setup-organization', 'setup-structure', 'setup-validation', 'setup-security', 'setup-rollout', 'privacy', 'limitations', 'contact'] as const;
export interface SafeContext {
  surface: AssistantSurface;
  section?: typeof SECTIONS[number];
  step?: typeof STEPS[number];
  os?: 'windows' | 'linux' | 'macos' | 'unknown';
  readiness?: 'checking' | 'ready' | 'slow' | 'timeout' | 'unknown';
  rollout?: 'idle' | 'running' | 'completed' | 'partial_failure' | 'unknown';
  fieldStatus?: Partial<Record<typeof FIELDS[number], boolean>>;
  counts?: Partial<Record<typeof COUNTS[number], number>>;
  errors?: typeof ERRORS[number][];
}
export interface AssistantAction {
  type: 'highlight_field' | 'show_validation_group' | 'open_step' | 'open_documentation' | 'contact_team';
  target: string;
}
export interface AssistantReply {
  turnId: string;
  answer: string;
  speechText: string;
  language: Language;
  sources: string[];
  actions: AssistantAction[];
  status: 'complete' | 'fallback';
}
export const LANGUAGE_LABELS: Record<Language, string> = { en: 'English', ur: 'اردو', 'ur-Latn': 'Roman Urdu' };
export function isLanguage(value: unknown): value is Language {
  return value === 'en' || value === 'ur' || value === 'ur-Latn';
}
function member<T extends string>(value: unknown, list: readonly T[]): value is T {
  return typeof value === 'string' && list.includes(value as T);
}
/** Construct a fresh object. Never serialize form state, the DOM, URLs or auth objects. */
export function sanitizeContext(input: unknown): SafeContext {
  const value = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const out: SafeContext = { surface: member(value.surface, ['landing', 'deployment_portal', 'organization_setup']) ? value.surface : 'landing' };
  if (member(value.section, SECTIONS)) out.section = value.section;
  if (member(value.step, STEPS)) out.step = value.step;
  if (member(value.os, ['windows', 'linux', 'macos', 'unknown'])) out.os = value.os;
  if (member(value.readiness, ['checking', 'ready', 'slow', 'timeout', 'unknown'])) out.readiness = value.readiness;
  if (member(value.rollout, ['idle', 'running', 'completed', 'partial_failure', 'unknown'])) out.rollout = value.rollout;
  const flags = value.fieldStatus;
  if (flags && typeof flags === 'object') {
    out.fieldStatus = {};
    for (const key of FIELDS) if (typeof (flags as Record<string, unknown>)[key] === 'boolean') out.fieldStatus[key] = (flags as Record<string, boolean>)[key];
  }
  const counts = value.counts;
  if (counts && typeof counts === 'object') {
    out.counts = {};
    for (const key of COUNTS) {
      const n = (counts as Record<string, unknown>)[key];
      if (typeof n === 'number' && Number.isSafeInteger(n) && n >= 0 && n <= 1_000_000) out.counts[key] = n;
    }
  }
  if (Array.isArray(value.errors)) out.errors = [...new Set(value.errors.filter((e): e is typeof ERRORS[number] => member(e, ERRORS)))].slice(0, ERRORS.length);
  return out;
}
export function isAllowedAction(action: unknown, context?: SafeContext): action is AssistantAction {
  if (!action || typeof action !== 'object') return false;
  const { type, target } = action as AssistantAction;
  if (typeof target !== 'string') return false;
  switch (type) {
    case 'highlight_field': return member(target, FIELDS) && (context?.surface === 'deployment_portal' || context?.surface === 'organization_setup');
    case 'show_validation_group': return ['duplicate_ids', 'duplicate_emails', 'unassigned_members', 'invalid_csv'].includes(target) && context?.surface === 'organization_setup';
    case 'open_step': return member(target, STEPS) && context?.surface === 'organization_setup';
    case 'open_documentation': return member(target, SOURCE_IDS);
    case 'contact_team': return target === 'contact';
    default: return false;
  }
}
export function validateReply(value: unknown, context: SafeContext): AssistantReply {
  if (!value || typeof value !== 'object') throw new Error('Invalid assistant response');
  const reply = value as AssistantReply;
  if (typeof reply.turnId !== 'string' || !isLanguage(reply.language) || typeof reply.answer !== 'string' || !reply.answer.trim() || reply.answer.length > 12000 || typeof reply.speechText !== 'string' || reply.speechText.length > 6000 || !Array.isArray(reply.sources) || !Array.isArray(reply.actions) || !['complete', 'fallback'].includes(reply.status)) throw new Error('Invalid assistant response');
  return { turnId: reply.turnId, answer: reply.answer, speechText: reply.speechText, language: reply.language, status: reply.status, sources: [...new Set(reply.sources.filter(id => member(id, SOURCE_IDS)))], actions: reply.actions.filter(a => isAllowedAction(a, context)).map(a => ({ type: a.type, target: a.target })).slice(0, 4) };
}
export function newId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
  const s = [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}
