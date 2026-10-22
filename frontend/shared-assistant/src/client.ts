import { isLanguage, newId, sanitizeContext, validateReply, type AssistantReply, type Language, type SafeContext } from './contracts.ts';
import { inferLanguage } from './language.ts';
export class AssistantError extends Error {
  code: string; retryAfter?: number; httpStatus?: number;
  constructor(code: string, message: string, retryAfter?: number, httpStatus?: number) { super(message); this.name = 'AssistantError'; this.code = code; this.retryAfter = retryAfter; this.httpStatus = httpStatus; }
}
export interface AssistantClient {
  send(input: { message: string; language?: Language; context: SafeContext; turnId?: string }, options?: { signal?: AbortSignal }): Promise<AssistantReply>;
  transcribe(blob: Blob, language: Language, options?: { signal?: AbortSignal }): Promise<string>;
  feedback(turnId: string, helpful: boolean): Promise<void>;
  reset(): Promise<void>;
}
interface Session { id: string; capability: string; expiresAt: string }
export function createAssistantClient(options: { baseUrl: string; scope?: 'chat' | 'transcription'; storage?: Storage; storageKey?: string; fetch?: typeof fetch }): AssistantClient {
  const scope = options.scope || 'chat';
  const storageKey = options.storageKey || `aegis-assistant-v1-${scope}`;
  const doFetch = options.fetch || globalThis.fetch;
  let session: Session | undefined;
  let creating: Promise<Session> | undefined;
  let revision = 0;
  let lastLanguage: Language = 'en';
  let transcriptionClient: AssistantClient | undefined;
  let endpoint = '';
  try {
    const url = new URL(options.baseUrl);
    if (url.username || url.password || url.search || url.hash || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))) throw new Error();
    endpoint = url.href.replace(/\/$/, '');
  } catch { /* local FAQ remains available when the gateway is unconfigured */ }
  function save(s?: Session) { session = s; try { if (s) options.storage?.setItem(storageKey, JSON.stringify(s)); else options.storage?.removeItem(storageKey); } catch { /* private browsing */ } }
  try {
    const saved = options.storage?.getItem(storageKey);
    if (saved) { const s = JSON.parse(saved); if (typeof s.id === 'string' && typeof s.capability === 'string' && typeof s.expiresAt === 'string' && Date.parse(s.expiresAt) > Date.now()) session = s; }
  } catch { /* corrupt or unavailable browser storage */ }
  async function request(path: string, init: RequestInit = {}, capability?: string): Promise<any> {
    if (!endpoint) throw new AssistantError('unconfigured', 'Cloud assistant is unavailable. You can still use the local help guide.');
    const controller = new AbortController();
    const abort = () => controller.abort(init.signal?.reason);
    if (init.signal?.aborted) abort(); else init.signal?.addEventListener('abort', abort, { once: true });
    const timeout = setTimeout(() => controller.abort(new DOMException('Assistant timed out', 'TimeoutError')), 35_000);
    try {
      const headers = new Headers(init.headers);
      if (capability) headers.set('X-Assistant-Capability', capability);
      if (typeof init.body === 'string') headers.set('Content-Type', 'application/json');
      const response = await doFetch(`${endpoint}${path}`, { ...init, headers, credentials: 'omit', referrerPolicy: 'no-referrer', signal: controller.signal });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new AssistantError(body.error?.code || `http_${response.status}`, body.error?.message || 'The assistant is temporarily unavailable.', body.error?.retryAfter, response.status);
      return body;
    } finally { clearTimeout(timeout); init.signal?.removeEventListener('abort', abort); }
  }
  async function ensureSession(signal?: AbortSignal): Promise<Session> {
    if (session && Date.parse(session.expiresAt) > Date.now()) return session;
    const started = revision;
    if (!creating) creating = request('/sessions', { method: 'POST', body: JSON.stringify({ scope }), signal }).then(async s => {
      if (typeof s.id !== 'string' || typeof s.capability !== 'string' || typeof s.expiresAt !== 'string' || !Number.isFinite(Date.parse(s.expiresAt)) || Date.parse(s.expiresAt) <= Date.now()) throw new AssistantError('invalid_response', 'Invalid assistant session.');
      if (started !== revision) {
        // Do not resurrect a capability after the user has reset during bootstrap.
        save(s);
        await request(`/sessions/${encodeURIComponent(s.id)}`, { method: 'DELETE' }, s.capability);
        save();
        throw new AssistantError('session_reset', 'The conversation was reset.');
      }
      save(s); return s;
    }).finally(() => { creating = undefined; });
    return creating;
  }
  const isMissingSession = (error: unknown) => error instanceof AssistantError && error.httpStatus === 404 && error.code === 'session_not_found';
  /** Only an explicit pre-provider rejection is safe to replay automatically. */
  async function sessionRequest(signal: AbortSignal | undefined, perform: (active: Session) => Promise<any>): Promise<any> {
    const started = revision;
    function checkActive() {
      if (signal?.aborted) throw signal.reason || new DOMException('Assistant cancelled', 'AbortError');
      if (started !== revision) throw new AssistantError('session_reset', 'The conversation was reset.');
    }
    for (let attempt = 0; attempt < 2; attempt++) {
      checkActive();
      const active = await ensureSession(signal);
      checkActive();
      try {
        const result = await perform(active);
        checkActive();
        return result;
      } catch (error) {
        if (!isMissingSession(error)) throw error;
        checkActive();
        // Another request may already have replaced this session. Never erase its capability.
        if (session === active) save();
        if (attempt === 1) throw error;
      }
    }
  }
  if (scope === 'chat') transcriptionClient = createAssistantClient({ ...options, scope: 'transcription', storageKey: `${storageKey}-voice` });
  return {
    async send(input, requestOptions = {}) {
      if ((input.language !== undefined && !isLanguage(input.language)) || !input.message.trim() || input.message.length > 2000) throw new AssistantError('invalid_message', 'Please send a message of 1–2,000 characters.');
      const context = sanitizeContext(input.context);
      const body = JSON.stringify({ message: input.message.trim(), language: inferLanguage(input.message, input.language ?? lastLanguage), languageMode: 'auto', turnId: input.turnId || newId(), context });
      const value = await sessionRequest(requestOptions.signal, active => request(`/sessions/${encodeURIComponent(active.id)}/turns`, { method: 'POST', body, signal: requestOptions.signal }, active.capability));
      const reply = validateReply(value, context);
      lastLanguage = reply.language;
      return reply;
    },
    async transcribe(blob, language, requestOptions = {}) {
      if (!isLanguage(language) || blob.type !== 'audio/wav' || blob.size <= 44 || blob.size > 960044) throw new AssistantError('invalid_audio', 'Record a short audio message, up to 30 seconds.');
      if (scope === 'chat') {
        transcriptionClient ||= createAssistantClient({ ...options, scope: 'transcription', storageKey: `${storageKey}-voice` });
        return transcriptionClient.transcribe(blob, language, requestOptions);
      }
      const form = new FormData();
      const extension = blob.type.includes('mp4') ? 'mp4' : blob.type.includes('ogg') ? 'ogg' : blob.type.includes('wav') ? 'wav' : 'webm';
      form.append('file', blob, `voice.${extension}`); form.append('language', language); form.append('languageMode', 'auto'); form.append('turnId', newId());
      const value = await sessionRequest(requestOptions.signal, active => request(`/sessions/${encodeURIComponent(active.id)}/transcriptions`, { method: 'POST', body: form, signal: requestOptions.signal }, active.capability));
      if (typeof value.text !== 'string' || value.text.length > 2000) throw new AssistantError('invalid_response', 'The recording could not be transcribed. Please try typing.');
      return value.text;
    },
    async feedback(turnId, helpful) {
      const active = session; const started = revision;
      if (!active || Date.parse(active.expiresAt) <= Date.now()) throw new AssistantError('session_not_found', 'Feedback is unavailable for this conversation.', undefined, 404);
      try { await request(`/sessions/${encodeURIComponent(active.id)}/feedback`, { method: 'POST', body: JSON.stringify({ turnId, helpful }) }, active.capability); }
      catch (error) { if (isMissingSession(error) && session === active && revision === started) save(); throw error; }
    },
    async reset() {
      revision++;
      if (transcriptionClient) await transcriptionClient.reset();
      if (creating) await creating.catch(() => {});
      if (session) {
        try { await request(`/sessions/${encodeURIComponent(session.id)}`, { method: 'DELETE' }, session.capability); }
        catch (error) { if (!(error instanceof AssistantError) || error.code !== 'session_not_found') throw error; }
      }
      save();
      lastLanguage = 'en';
    },
  };
}
