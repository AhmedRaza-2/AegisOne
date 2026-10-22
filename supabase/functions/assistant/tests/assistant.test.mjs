import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiError, validateContext, validateReply, validateWav, redactMessage, fallbackReply } from '../policy.mjs';
import { buildPrompt, generateAnswer } from '../provider.mjs';
import { loadConfig, requestBuckets, reserveTokenCount } from '../quotas.mjs';
import { createHandler, sha256 } from '../handler.mjs';

const ID = 'b228dfaa-a202-4910-9263-19b9a1c15421';
const TURN = '5e37c6b6-a822-4672-a7e9-fd804f4a82cd';
const TOKEN = 'a'.repeat(43);
const env = {
  ASSISTANT_ENABLED: 'true', ASSISTANT_VOICE_ENABLED: 'true', ASSISTANT_QUOTAS_VERIFIED: 'true',
  GROQ_API_KEY: 'test-server-key', ASSISTANT_IP_HASH_SECRET: 'test-only-secret-at-least-thirty-two-characters',
  GROQ_CHAT_RPM: '30', GROQ_CHAT_RPD: '1000', GROQ_CHAT_TPM: '8000', GROQ_CHAT_TPD: '200000',
  GROQ_AUDIO_RPM: '20', GROQ_AUDIO_RPD: '100', GROQ_AUDIO_ASH: '3600', GROQ_AUDIO_ASD: '7200',
};
const getEnv = key => env[key];
function request(path, value, options = {}) {
  const headers = { 'Content-Type': 'application/json', 'X-Assistant-Capability': TOKEN, ...options.headers };
  return new Request(`https://example.test/functions/v1/assistant${path}`, { method: 'POST', headers, body: JSON.stringify(value), ...options });
}
function chatInput(overrides = {}) { return { turnId: TURN, message: 'How does setup work?', language: 'en', context: { surface: 'organization_setup', step: 'organization' }, ...overrides }; }
const validReply = { answer: 'Review the organization details, then continue using the setup controls.', speechText: 'Review the organization details.', sources: ['setup-organization'], actions: [{ type: 'open_step', target: 'organization' }] };
function fixture({ scope = 'chat', reserveStatus = 'reserved', reply = validReply, providerStatus = 200, finishReason = 'stop' } = {}) {
  const calls = []; let providerCalls = 0;
  const rpc = async (name, args) => {
    calls.push({ name, args });
    if (name === 'assistant_get_session') return { status: 'found', id: ID, scope, expiresAt: '2026-10-14T00:00:00Z', turns: [] };
    if (name === 'assistant_reserve_turn') return { status: reserveStatus, leaseId: TURN, retryAfter: 60, result: { turnId: TURN, ...reply, language: 'en', status: 'complete' } };
    if (name === 'assistant_finish_turn') return { ok: true };
    if (name === 'assistant_create_session') return { status: 'created', expiresAt: '2026-10-14T00:00:00Z' };
    return { status: 'saved' };
  };
  const fetcher = async (url, options) => {
    providerCalls++;
    if (providerStatus !== 200) return new Response('Never expose upstream-secret-or-prompt', { status: providerStatus });
    return Response.json({ choices: [{ finish_reason: finishReason, message: { content: JSON.stringify(reply), reasoning: 'private reasoning must never escape' } }], usage: { total_tokens: 123 } });
  };
  return { handler: createHandler({ getEnv, rpc, fetcher }), calls, providerCalls: () => providerCalls };
}
function wav(seconds = 1) {
  const bytes = new Uint8Array(44 + Math.floor(seconds * 16000) * 2); const view = new DataView(bytes.buffer);
  const put = (at, text) => { for (let i = 0; i < text.length; i++) bytes[at + i] = text.charCodeAt(i); };
  put(0, 'RIFF'); view.setUint32(4, bytes.length - 8, true); put(8, 'WAVE'); put(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, 16000, true); view.setUint32(28, 32000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); put(36, 'data'); view.setUint32(40, bytes.length - 44, true);
  return bytes;
}

test('context rejects credentials, raw records, unknown fields and non-boolean flags', () => {
  for (const context of [
    { surface: 'organization_setup', smtpPass: 'secret' },
    { surface: 'organization_setup', employees: [{ email: 'someone@example.test' }] },
    { surface: 'organization_setup', fieldStatus: { smtp_password: 'secret' } },
    { surface: 'organization_setup', counts: { invalidRows: -1 } },
    { surface: 'organization_setup', errors: ['raw server exception'] },
  ]) assert.throws(() => validateContext(context), ApiError);
  assert.deepEqual(validateContext({ surface: 'organization_setup', fieldStatus: { smtp_password: true }, counts: { invalidRows: 0 }, errors: ['smtp_auth'] }), { surface: 'organization_setup', fieldStatus: { smtp_password: true }, counts: { invalidRows: 0 }, errors: ['smtp_auth'] });
});
test('message redaction removes common pasted credentials and identifiers before persistence', () => {
  const message = redactMessage('email: person@example.com\npassword=super-secret\nkey gsk_abcdefghijklmnopqrstuvwxyz\nhttps://intranet.test/?token=secret');
  for (const secret of ['person@example.com', 'super-secret', 'gsk_', 'intranet.test']) assert.equal(message.includes(secret), false);
  assert.equal(redactMessage('What is an SMTP password?'), 'What is an SMTP password?');
});
test('reply validator rejects invented citations, mutation actions, foreign page actions and links', () => {
  const context = { surface: 'organization_setup' };
  for (const reply of [
    { ...validReply, sources: ['invented'] },
    { ...validReply, actions: [{ type: 'execute_setup', target: 'all' }] },
    { ...validReply, actions: [{ type: 'open_documentation', target: 'https://evil.test' }] },
    { ...validReply, answer: '<script>bad()</script>' },
    { ...validReply, answer: 'Visit https://evil.test' },
    { ...validReply, answer: 'word '.repeat(151) },
  ]) assert.throws(() => validateReply(reply, 'en', context, ['setup-organization']));
  assert.throws(() => validateReply(validReply, 'en', { surface: 'landing' }, ['setup-organization']));
});
test('all languages have bounded deterministic fallback', () => {
  for (const lang of ['en', 'ur', 'ur-Latn']) {
    const reply = fallbackReply(lang, TURN); assert.equal(reply.language, lang); assert.equal(reply.status, 'fallback'); assert.ok(reply.speechText);
  }
  assert.match(fallbackReply('ur-Latn', TURN).speechText, /[\u0600-\u06ff]/u);
});
test('canonical WAV duration and sample metadata are independently enforced', () => {
  assert.equal(validateWav(wav(1)), 1); assert.equal(validateWav(wav(30)), 30);
  assert.throws(() => validateWav(wav(30.01)));
  assert.throws(() => validateWav(wav(0.1)));
  const fake = wav(1); new DataView(fake.buffer).setUint32(28, 1, true); assert.throws(() => validateWav(fake));
  const trailing = new Uint8Array(wav(1).length + 4); trailing.set(wav(1)); assert.throws(() => validateWav(trailing));
});
test('free account quotas are fail-closed, use 80 percent and count separate audio dimensions', () => {
  assert.equal(loadConfig(() => undefined).available, false);
  assert.equal(loadConfig(key => key === 'GROQ_CHAT_TPM' ? undefined : getEnv(key)).available, false);
  assert.equal(loadConfig(key => key === 'ASSISTANT_CHAT_MODEL' ? 'unreviewed-model' : getEnv(key)).available, false);
  assert.equal(loadConfig(key => key === 'ASSISTANT_CHAT_MODEL' ? 'openai/gpt-oss-20b' : getEnv(key)).available, true);
  const config = loadConfig(getEnv); assert.equal(config.limits.GROQ_CHAT_TPM, 6400);
  const buckets = requestBuckets(config, 'transcription', ID, 'hashed-ip', 0, new Date('2026-10-13T12:34:56Z'));
  assert.ok(buckets.some(b => b.key.endsWith('seconds:hour') && b.amount === 30));
  assert.ok(buckets.some(b => b.key.endsWith('seconds:day') && b.amount === 30));
  assert.equal(buckets.some(b => b.key.includes('tokens')), false);
});
test('prompt carries only reviewed source IDs and bounds six history messages to 1 KB', () => {
  const history = Array.from({ length: 20 }, () => ({ message: 'x'.repeat(2000), answer: 'ی'.repeat(1800) }));
  const prompt = buildPrompt('What is the price?', 'ur', { surface: 'landing', section: 'pricing' }, history);
  assert.ok(prompt.sourceIds.includes('pricing')); assert.ok(prompt.messages.length <= 8);
  assert.ok(prompt.messages.slice(1, -1).reduce((sum, m) => sum + new TextEncoder().encode(m.content).length, 0) <= 1024);
  assert.ok(reserveTokenCount(prompt.messages) >= 1200);
  assert.equal(prompt.messages[0].content.includes('$699 annually'), true);
});
test('public CORS is capability-only; preflight never invokes the database', async () => {
  const f = fixture(); const response = await f.handler(new Request('https://example.test/functions/v1/assistant/sessions', { method: 'OPTIONS', headers: { Origin: 'http://unknown-customer.test:3002' } }));
  assert.equal(response.status, 204); assert.equal(response.headers.get('access-control-allow-origin'), '*');
  assert.equal(response.headers.has('access-control-allow-credentials'), false); assert.equal(f.calls.length, 0);
});
test('no JWT authentication path and no missing capability access', async () => {
  const f = fixture();
  const response = await f.handler(request(`/sessions/${ID}/turns`, chatInput(), { headers: { Authorization: 'Bearer tenant-jwt', 'Content-Type': 'application/json' } }));
  assert.equal(response.status, 400); assert.equal(f.calls.length, 0);
  const missing = await f.handler(new Request(`https://example.test/functions/v1/assistant/sessions/${ID}`));
  assert.equal(missing.status, 401); assert.equal(f.calls.length, 0);
});
test('session capabilities are hashed before DB calls and never returned in reads', async () => {
  const f = fixture(); const response = await f.handler(new Request(`https://example.test/functions/v1/assistant/sessions/${ID}`, { headers: { 'X-Assistant-Capability': TOKEN } }));
  assert.equal(response.status, 200); assert.equal(f.calls[0].args.p_capability_hash, await sha256(TOKEN));
  assert.equal(JSON.stringify(await response.json()).includes(TOKEN), false);
});
test('untrusted status is rejected before provider or quota reservation', async () => {
  const f = fixture(); const response = await f.handler(request(`/sessions/${ID}/turns`, chatInput({ context: { surface: 'organization_setup', password: 'secret' } })));
  assert.equal(response.status, 400); assert.equal(f.providerCalls(), 0); assert.equal(f.calls.some(c => c.name === 'assistant_reserve_turn'), false);
});
test('transcription capability cannot chat, give feedback, or read another session', async () => {
  const f = fixture({ scope: 'transcription' });
  for (const suffix of ['turns', 'feedback']) assert.equal((await f.handler(request(`/sessions/${ID}/${suffix}`, suffix === 'turns' ? chatInput() : { turnId: TURN, helpful: true }))).status, 403);
  assert.equal(f.providerCalls(), 0);
  const denied = createHandler({ getEnv, rpc: async () => ({ status: 'not_found' }), fetcher: async () => { throw new Error('must not call'); } });
  assert.equal((await denied(new Request(`https://example.test/functions/v1/assistant/sessions/${ID}`, { headers: { 'X-Assistant-Capability': TOKEN } }))).status, 404);
});
test('cached, conflicting, quota and pending requests never make a second model call', async () => {
  for (const [reserveStatus, expected] of [['cached', 200], ['conflict', 409], ['quota', 429], ['pending', 409], ['failed', 409]]) {
    const f = fixture({ reserveStatus }); const response = await f.handler(request(`/sessions/${ID}/turns`, chatInput()));
    assert.equal(response.status, expected); assert.equal(f.providerCalls(), 0);
  }
});
test('valid Groq output returns no reasoning and commits measured usage', async () => {
  const f = fixture(); const response = await f.handler(request(`/sessions/${ID}/turns`, chatInput()));
  assert.equal(response.status, 200); const body = await response.json(); assert.equal(body.status, 'complete'); assert.equal(body.turnId, TURN);
  assert.equal(JSON.stringify(body).includes('private reasoning'), false);
  assert.equal(f.calls.find(c => c.name === 'assistant_finish_turn').args.p_actual_tokens, 123);
});
test('provider failure and hallucinated tool output persist deterministic fallback with one request', async () => {
  for (const options of [{ providerStatus: 429 }, { finishReason: 'length' }, { reply: { ...validReply, actions: [{ type: 'reset_organization', target: 'all' }] } }]) {
    const f = fixture(options); const response = await f.handler(request(`/sessions/${ID}/turns`, chatInput()));
    const body = await response.json(); assert.equal(body.status, 'fallback'); assert.equal(f.providerCalls(), 1);
    assert.equal(JSON.stringify(body).includes('upstream-secret'), false); assert.equal(f.calls.at(-1).name, 'assistant_finish_turn');
  }
});
test('oversized JSON is rejected before parsing or provider calls', async () => {
  const f = fixture(); const response = await f.handler(request(`/sessions/${ID}/turns`, chatInput({ message: 'x'.repeat(20000) })));
  assert.equal(response.status, 413); assert.equal(f.providerCalls(), 0);
});
test('audio quota reservation follows WAV validation and audio is never written to RPC', async () => {
  const calls = []; let uploads = 0;
  const rpc = async (name, args) => { calls.push({ name, args }); if (name === 'assistant_get_session') return { status: 'found', scope: 'transcription', turns: [] }; if (name === 'assistant_reserve_turn') return { status: 'reserved', leaseId: TURN }; return { ok: true }; };
  const handler = createHandler({ getEnv, rpc, fetcher: async (url, options) => { uploads++; assert.ok(url.endsWith('/audio/transcriptions')); assert.equal(options.body.get('model'), 'whisper-large-v3'); return Response.json({ text: 'Hello setup guide' }); } });
  const form = new FormData(); form.append('file', new Blob([wav(1)], { type: 'audio/wav' }), 'voice.wav'); form.append('language', 'en'); form.append('turnId', TURN);
  const response = await handler(new Request(`https://example.test/functions/v1/assistant/sessions/${ID}/transcriptions`, { method: 'POST', headers: { 'X-Assistant-Capability': TOKEN }, body: form }));
  assert.equal(response.status, 200); assert.equal((await response.json()).text, 'Hello setup guide'); assert.equal(uploads, 1);
  const reservation = calls.find(c => c.name === 'assistant_reserve_turn').args; assert.equal(reservation.p_audio_seconds, 30); assert.equal(reservation.p_message, null);
  assert.equal(JSON.stringify(calls).includes('RIFF'), false);
});
test('provider request is pinned to free-account model without a retry or tool path', async () => {
  let count = 0;
  await assert.rejects(generateAnswer({ fetcher: async (url, options) => {
    count++; const body = JSON.parse(options.body); assert.equal(body.model, 'openai/gpt-oss-120b'); assert.equal(body.reasoning_effort, 'low'); assert.equal(body.max_completion_tokens, 1200); assert.equal('tools' in body, false);
    assert.equal(body.response_format.type, 'json_schema'); assert.equal(body.response_format.json_schema.strict, true); assert.equal(body.response_format.json_schema.schema.additionalProperties, false);
    return new Response('upstream details', { status: 429 });
  }, key: 'server-key', prompt: buildPrompt('Explain setup', 'en', { surface: 'landing' }), language: 'en', context: { surface: 'landing' } }), error => error.code === 'provider_limit');
  assert.equal(count, 1);
});

test('configured reviewed 20b model is used while unknown models remain disabled', async () => {
  const calls = [];
  const f = fixture();
  const handler = createHandler({
    getEnv: key => key === 'ASSISTANT_CHAT_MODEL' ? 'openai/gpt-oss-20b' : getEnv(key),
    rpc: async (name, args) => { calls.push({ name, args }); if (name === 'assistant_get_session') return { status: 'found', scope: 'chat', turns: [] }; if (name === 'assistant_reserve_turn') return { status: 'reserved', leaseId: TURN }; return { ok: true }; },
    fetcher: async (url, options) => { assert.equal(JSON.parse(options.body).model, 'openai/gpt-oss-20b'); return Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(validReply) } }] }); },
  });
  assert.equal((await handler(request(`/sessions/${ID}/turns`, chatInput()))).status, 200);
  assert.ok(calls.find(c => c.name === 'assistant_reserve_turn').args.p_buckets.some(b => b.key.includes('gpt-oss-20b')));
  const disabled = createHandler({ getEnv: key => key === 'ASSISTANT_CHAT_MODEL' ? 'unreviewed-model' : getEnv(key), rpc: async () => { throw new Error('must not create'); }, fetcher: async () => { throw new Error('must not call'); } });
  assert.equal((await disabled(request('/sessions', { scope: 'chat' }))).status, 503);
});

test('inline voice uses a separate transcription capability alongside its existing chat session', async () => {
  const sessions = new Map(); const providerRoutes = [];
  const rpc = async (name, args) => {
    if (name === 'assistant_create_session') { sessions.set(args.p_id, { hash: args.p_capability_hash, scope: args.p_scope }); return { status: 'created', expiresAt: '2030-01-01T00:00:00Z' }; }
    if (name === 'assistant_get_session') { const s = sessions.get(args.p_id); return !s || s.hash !== args.p_capability_hash ? { status: 'not_found' } : { status: 'found', id: args.p_id, scope: s.scope, turns: [], expiresAt: '2030-01-01T00:00:00Z' }; }
    if (name === 'assistant_reserve_turn') return { status: 'reserved', leaseId: TURN };
    if (name === 'assistant_finish_turn') return { ok: true };
    throw new Error('Unexpected RPC');
  };
  const handler = createHandler({ getEnv, rpc, fetcher: async url => {
    providerRoutes.push(url);
    return url.endsWith('/audio/transcriptions') ? Response.json({ text: 'Help me configure SMTP' }) : Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(validReply) } }] });
  } });
  const chat = await (await handler(request('/sessions', { scope: 'chat' }))).json();
  const audio = await (await handler(request('/sessions', { scope: 'transcription' }))).json();
  assert.notEqual(chat.id, audio.id); assert.notEqual(chat.capability, audio.capability);
  const form = () => { const value = new FormData(); value.append('file', new Blob([wav(1)], { type: 'audio/wav' }), 'voice.wav'); value.append('language', 'en'); value.append('turnId', TURN); return value; };
  const upload = (session, body) => new Request(`https://example.test/functions/v1/assistant/sessions/${session.id}/transcriptions`, { method: 'POST', headers: { 'X-Assistant-Capability': session.capability }, body });
  assert.equal((await handler(upload(chat, form()))).status, 403);
  const transcript = await (await handler(upload(audio, form()))).json(); assert.equal(transcript.text, 'Help me configure SMTP');
  const response = await handler(new Request(`https://example.test/functions/v1/assistant/sessions/${chat.id}/turns`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Assistant-Capability': chat.capability }, body: JSON.stringify(chatInput({ message: transcript.text })) }));
  assert.equal(response.status, 200); assert.equal((await response.json()).status, 'complete');
  assert.deepEqual(providerRoutes.map(url => url.split('/').at(-1)), ['transcriptions', 'completions']);
});
