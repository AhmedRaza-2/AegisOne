import { ApiError, object, uuid, language, languageMode, LANGUAGES, validateContext, redactMessage, validateWav, fallbackReply } from './policy.mjs';
import { loadConfig, requireEnabled, creationBuckets, requestBuckets, reserveTokenCount } from './quotas.mjs';
import { buildPrompt, generateAnswer, transcribe, answerSchema } from './provider.mjs';
import { classifyMessage, scopeReply } from './scope.mjs';
import { inferLanguage } from './language.mjs';

export const CORS = Object.freeze({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,X-Assistant-Capability',
  'Access-Control-Max-Age': '600',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
});

const encode = new TextEncoder();
export async function sha256(value) {
  const bytes = typeof value === 'string' ? encode.encode(value) : value;
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(n => n.toString(16).padStart(2, '0')).join('');
}
function capability() {
  return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function json(value, status = 200, extra = {}) {
  return new Response(JSON.stringify(value), { status, headers: { ...CORS, 'Content-Type': 'application/json', ...extra } });
}
function fail(error) {
  const err = error instanceof ApiError ? error : new ApiError(503, 'unavailable', 'AI help is temporarily unavailable. Basic help is still available.');
  return json({ error: { code: err.code, message: err.message, ...(err.retryAfter ? { retryAfter: err.retryAfter } : {}) } }, err.status, err.retryAfter ? { 'Retry-After': String(err.retryAfter) } : {});
}

async function readBytes(request, limit) {
  const length = Number(request.headers.get('content-length'));
  if (length > limit) throw new ApiError(413, 'too_large', 'The request exceeded its size limit.');
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader(); const chunks = []; let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) { await reader.cancel(); throw new ApiError(413, 'too_large', 'The request exceeded its size limit.'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const result = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return result;
}
async function readJson(request) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new ApiError(415, 'invalid_input', 'Use a JSON request.');
  const bytes = await readBytes(request, 16000);
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { throw new ApiError(400, 'invalid_input', 'Invalid JSON request.'); }
}

export function createRestRpc(config, fetcher = fetch) {
  return async (name, args) => {
    if (!config.supabaseUrl || !config.serviceKey) throw new ApiError(503, 'unavailable', 'AI help is unavailable.');
    let response;
    try {
      response = await fetcher(`${config.supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/${name}`, {
        method: 'POST', headers: { apikey: config.serviceKey, Authorization: `Bearer ${config.serviceKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(args), signal: AbortSignal.timeout(4000),
      });
      if (!response.ok) throw new Error('Database unavailable');
      return await response.json();
    } catch { throw new ApiError(503, 'unavailable', 'AI help is temporarily unavailable.'); }
  };
}

function checkResult(value) {
  switch (value.status) {
    case 'not_found': throw new ApiError(404, 'session_not_found', 'This assistant session has expired or is unavailable.');
    case 'wrong_scope': throw new ApiError(403, 'wrong_scope', 'This session cannot perform that operation.');
    case 'quota': throw new ApiError(429, 'limit_reached', 'Free AI capacity is temporarily exhausted. Basic help is still available.', value.retryAfter || 60);
    case 'pending': case 'busy': throw new ApiError(409, 'request_pending', 'A request is already running. Please wait.', value.retryAfter || 2);
    case 'conflict': throw new ApiError(409, 'turn_conflict', 'This request identifier was already used for another message.');
    case 'failed': throw new ApiError(409, value.result?.error?.code || 'interrupted', 'This request was interrupted. Send a new message to continue.');
  }
  return value;
}

export function createHandler({ getEnv = key => Deno.env.get(key), fetcher = fetch, rpc: injectedRpc, now = () => new Date(), onProviderError } = {}) {
  const config = loadConfig(getEnv);
  const rpc = injectedRpc || createRestRpc(config, fetcher);
  return async request => {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    try {
      // This API deliberately has no cookie/JWT/tenant authentication path.
      if (request.headers.has('authorization')) throw new ApiError(400, 'unsupported_auth', 'Use an assistant session capability.');
      const url = new URL(request.url);
      const path = url.pathname.replace(/^\/(?:functions\/v1\/)?assistant\/?/, '');
      const parts = path.split('/').filter(Boolean);
      if (parts[0] !== 'sessions' || parts.length > 3 || url.search) throw new ApiError(404, 'not_found', 'Unknown assistant endpoint.');
      // Gateway-managed CF header is preferred. A missing address shares a
      // conservative bucket; unknown callers never bypass global quotas.
      const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim() || 'unknown';
      const ipHash = await sha256(`${config.ipSecret}:${ip}`);

      if (parts.length === 1 && request.method === 'POST') {
        const input = object(await readJson(request), ['scope'], 'session request');
        if (!['chat', 'transcription'].includes(input.scope)) throw new ApiError(400, 'invalid_input', 'Invalid assistant scope.');
        requireEnabled(config, input.scope);
        const token = capability(); const id = crypto.randomUUID();
        const result = checkResult(await rpc('assistant_create_session', { p_id: id, p_capability_hash: await sha256(token), p_scope: input.scope, p_ip_hash: ipHash, p_buckets: creationBuckets(ipHash, now()) }));
        return json({ id, capability: token, expiresAt: result.expiresAt }, 201);
      }
      if (parts.length < 2) throw new ApiError(405, 'method_not_allowed', 'Unsupported assistant method.');
      const id = uuid(parts[1]);
      const token = request.headers.get('x-assistant-capability');
      if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw new ApiError(401, 'invalid_capability', 'An assistant session capability is required.');
      const capabilityHash = await sha256(token);
      const auth = { p_id: id, p_capability_hash: capabilityHash };
      const session = checkResult(await rpc('assistant_get_session', auth));
      if (parts.length === 2 && request.method === 'GET') return json({ id: session.id, scope: session.scope, expiresAt: session.expiresAt, turns: session.turns });
      if (parts.length === 2 && request.method === 'DELETE') {
        checkResult(await rpc('assistant_delete_session', auth)); return json({ deleted: true });
      }
      if (request.method !== 'POST' || parts.length !== 3) throw new ApiError(405, 'method_not_allowed', 'Unsupported assistant method.');

      if (parts[2] === 'feedback') {
        if (session.scope !== 'chat') throw new ApiError(403, 'wrong_scope', 'Only chat sessions accept feedback.');
        const input = object(await readJson(request), ['turnId', 'helpful'], 'feedback');
        uuid(input.turnId);
        if (typeof input.helpful !== 'boolean') throw new ApiError(400, 'invalid_input', 'Choose helpful or unhelpful.');
        checkResult(await rpc('assistant_feedback', { ...auth, p_turn_id: input.turnId, p_helpful: input.helpful }));
        return json({ saved: true });
      }

      if (parts[2] === 'turns') {
        if (session.scope !== 'chat') throw new ApiError(403, 'wrong_scope', 'This session is only for transcription.');
        requireEnabled(config, 'chat');
        const input = object(await readJson(request), ['turnId', 'message', 'language', 'languageMode', 'context'], 'chat request');
        const turnId = uuid(input.turnId); const mode = languageMode(input.languageMode);
        const hint = language(input.language ?? (mode === 'auto' ? 'en' : undefined));
        const message = redactMessage(input.message); const context = validateContext(input.context);
        const previous = (Array.isArray(session.turns) ? session.turns : []).slice().reverse().find(turn => LANGUAGES.includes(turn?.language))?.language;
        const lang = mode === 'auto' ? inferLanguage(message, previous || hint) : hint;
        // Clear exclusions stay local. Ambiguous homepage wording is interpreted
        // by the grounded model rather than rejected by a grammar whitelist.
        const scope = classifyMessage(message, context, session.turns);
        if (scope !== 'project') return json(scopeReply(scope, lang, turnId, message));
        // Hash the request itself: inferred language can change after this turn
        // completes, while an idempotent replay must retain the same input hash.
        const inputHash = await sha256(JSON.stringify({ message, language: hint, ...(mode === 'auto' ? { languageMode: mode } : {}), context }));
        const prompt = buildPrompt(message, lang, context, session.turns, mode);
        const tokens = reserveTokenCount(prompt.messages, answerSchema(prompt.sourceIds, lang, context, mode));
        const reservation = checkResult(await rpc('assistant_reserve_turn', { ...auth, p_turn_id: turnId, p_kind: 'chat', p_input_hash: inputHash, p_message: message, p_language: lang, p_tokens: tokens, p_audio_seconds: 0, p_buckets: requestBuckets(config, 'chat', id, ipHash, tokens, now()) }));
        if (reservation.status === 'cached') return json(reservation.result);
        let result; let actualTokens = null;
        try {
          const generated = await generateAnswer({ fetcher, key: config.groqKey, model: config.chatModel, prompt, language: lang, languageMode: mode, context, signal: request.signal });
          result = { turnId, ...generated.reply }; actualTokens = generated.tokens;
        } catch (error) {
          // Optional diagnostics receive only a bounded category, never upstream
          // bodies, prompts, credentials or arbitrary exception text.
          const validationReasons = {
            'The assistant answer did not finish.': 'incomplete_answer',
            'The assistant returned the wrong response language.': 'invalid_language',
            'The assistant returned an unsupported source.': 'invalid_sources',
            'The assistant answer exceeded its size limit.': 'answer_size',
            'The assistant returned unsupported rich content.': 'invalid_content',
          };
          const scriptReason = error instanceof ApiError && ['answer_language', 'speech_language'].includes(error.validationPart) && LANGUAGES.includes(error.responseLanguage) ? `${error.validationPart}_${error.responseLanguage}` : null;
          const code = scriptReason || (error instanceof ApiError ? (Object.hasOwn(validationReasons, error.message) ? validationReasons[error.message] : ['provider_limit', 'provider_unavailable', 'invalid_answer', 'invalid_input'].includes(error.code) ? error.code : 'provider_internal') : 'provider_internal');
          try { onProviderError?.(code); } catch { /* diagnostics cannot break help */ }
          result = fallbackReply(lang, turnId);
        }
        const finished = await rpc('assistant_finish_turn', { p_id: id, p_turn_id: turnId, p_lease_id: reservation.leaseId, p_result: result, p_failed: false, p_actual_tokens: actualTokens });
        if (!finished.ok) throw new ApiError(409, 'interrupted', 'The request was interrupted. Send a new message to continue.');
        return json(result);
      }

      if (parts[2] === 'transcriptions') {
        if (session.scope !== 'transcription') throw new ApiError(403, 'wrong_scope', 'Create a transcription session for voice.');
        requireEnabled(config, 'transcription');
        const contentType = request.headers.get('content-type') || '';
        if (!contentType.startsWith('multipart/form-data;')) throw new ApiError(415, 'invalid_audio', 'Upload a WAV recording.');
        const body = await readBytes(request, 965000);
        let form;
        try { form = await new Response(body, { headers: { 'Content-Type': contentType } }).formData(); }
        catch { throw new ApiError(400, 'invalid_audio', 'Invalid audio upload.'); }
        const keys = [...form.keys()];
        if (keys.some(key => !['file', 'language', 'languageMode', 'turnId'].includes(key)) || new Set(keys).size !== keys.length) throw new ApiError(400, 'invalid_audio', 'Unexpected audio fields.');
        const file = form.get('file');
        if (!(file instanceof Blob) || !['audio/wav', 'audio/wave', 'audio/x-wav'].includes(file.type)) throw new ApiError(400, 'invalid_audio', 'Use WAV audio.');
        const bytes = new Uint8Array(await file.arrayBuffer()); validateWav(bytes);
        const mode = languageMode(form.get('languageMode') ?? undefined);
        const lang = language(form.get('language')); const turnId = form.get('turnId') ? uuid(form.get('turnId')) : crypto.randomUUID();
        const inputHash = await sha256(`${mode === 'auto' ? 'auto:' : ''}${lang}:${await sha256(bytes)}`);
        const reservation = checkResult(await rpc('assistant_reserve_turn', { ...auth, p_turn_id: turnId, p_kind: 'transcription', p_input_hash: inputHash, p_message: null, p_language: lang, p_tokens: 0, p_audio_seconds: 30, p_buckets: requestBuckets(config, 'transcription', id, ipHash, 0, now()) }));
        if (reservation.status === 'cached') return json(reservation.result);
        try {
          const result = { turnId, ...await transcribe({ fetcher, key: config.groqKey, bytes, language: lang, languageMode: mode, signal: request.signal }) };
          const finished = await rpc('assistant_finish_turn', { p_id: id, p_turn_id: turnId, p_lease_id: reservation.leaseId, p_result: result, p_failed: false, p_actual_tokens: null });
          if (!finished.ok) throw new ApiError(409, 'interrupted', 'The recording was interrupted. Record again to continue.');
          return json(result);
        } catch (error) {
          await rpc('assistant_finish_turn', { p_id: id, p_turn_id: turnId, p_lease_id: reservation.leaseId, p_result: { error: { code: 'transcription_unavailable', message: 'Voice is temporarily unavailable. Please type your message.' } }, p_failed: true, p_actual_tokens: null });
          throw error;
        }
      }
      throw new ApiError(404, 'not_found', 'Unknown assistant endpoint.');
    } catch (error) { return fail(error); }
  };
}
