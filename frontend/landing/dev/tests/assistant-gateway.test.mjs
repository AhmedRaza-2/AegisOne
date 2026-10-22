import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createAssistantDevPlugin, createMemoryRpc, devGatewayEnabled, hasUsableKey, localRequestOrigin } from '../assistant-gateway.mjs';

const KEY = 'gsk_test_key_for_offline_tests_only_123456789';
const ID = 'e9f6a78c-c569-414f-9ddf-a476f0dffba1';
const TURN = 'ddfba39f-8684-4a17-9f43-adf4f7068f44';
const now = Date.parse('2026-10-13T12:00:00Z');
const quota = (amount = 1, limit = 1) => [{ key: 'test:tokens:minute', start: new Date(now).toISOString(), end: new Date(now + 60000).toISOString(), amount, limit }];
const create = (overrides = {}) => ({ p_id: ID, p_capability_hash: 'hashed-capability', p_scope: 'chat', p_buckets: [], ...overrides });
const reserve = (overrides = {}) => ({ p_id: ID, p_capability_hash: 'hashed-capability', p_turn_id: TURN, p_kind: 'chat', p_input_hash: 'input-hash', p_message: 'public question', p_language: 'en', p_tokens: 80, p_buckets: quota(80, 100), ...overrides });

test('local connection requires a usable server key and honors explicit disable', () => {
  assert.equal(hasUsableKey(undefined), false); assert.equal(hasUsableKey('your-groq-key'), false); assert.equal(hasUsableKey(KEY), true);
  assert.equal(devGatewayEnabled({ GROQ_API_KEY: KEY }), true);
  assert.equal(devGatewayEnabled({ GROQ_API_KEY: KEY, VITE_ASSISTANT_ENABLED: 'false' }), false);
  assert.equal(devGatewayEnabled({ GROQ_API_KEY: KEY, ASSISTANT_DEV_ENABLED: 'false' }), false);
  assert.equal(JSON.stringify(createAssistantDevPlugin({ env: { GROQ_API_KEY: KEY }, projectRoot: '.' })).includes(KEY), false);
});

test('local origin checks reject LAN callers, DNS rebinding, foreign ports and cross-site requests', () => {
  const input = { host: '127.0.0.1:3001', remoteAddress: '127.0.0.1', port: 3001 };
  assert.equal(localRequestOrigin(input), 'http://127.0.0.1:3001');
  assert.equal(localRequestOrigin({ ...input, origin: 'http://127.0.0.1:3001', fetchSite: 'same-origin' }), 'http://127.0.0.1:3001');
  assert.equal(localRequestOrigin({ host: '[::1]:3000', remoteAddress: '::1', port: 3000 }), 'http://[::1]:3000');
  for (const change of [
    { remoteAddress: '192.168.1.20' }, { host: 'attacker.example:3001' }, { host: 'user@127.0.0.1:3001' },
    { host: '127.0.0.1:3000' }, { origin: 'http://localhost:3002' }, { origin: 'null' },
    { origin: 'https://evil.example' }, { fetchSite: 'cross-site' }, { fetchSite: 'same-site' },
  ]) assert.equal(localRequestOrigin({ ...input, ...change }), null);
});

test('additional development origins require explicit canonical loopback origins and trusted connections', () => {
  const input = { host: '127.0.0.1:3000', remoteAddress: '127.0.0.1', port: 3000, allowedOrigins: 'http://localhost:3002, http://127.0.0.1:3002, http://[::1]:3002' };
  for (const origin of ['http://localhost:3002', 'http://127.0.0.1:3002', 'http://[::1]:3002']) {
    for (const fetchSite of [undefined, 'same-site', 'cross-site']) assert.equal(localRequestOrigin({ ...input, origin, fetchSite }), 'http://127.0.0.1:3000');
  }
  for (const change of [
    { remoteAddress: '192.168.1.20' }, { host: 'attacker.example:3000' }, { host: '127.0.0.1:3001' },
    { origin: 'http://localhost:3003' }, { origin: 'null' }, { origin: undefined, fetchSite: 'cross-site' },
    { origin: undefined, fetchSite: 'same-site' }, { origin: 'http://localhost:3002', fetchSite: 'unknown' },
  ]) assert.equal(localRequestOrigin({ ...input, origin: 'http://localhost:3002', fetchSite: 'cross-site', ...change }), null);
  for (const origin of ['https://attacker.example', 'http://192.168.1.20:3002', 'http://localhost:3002/', 'http://localhost:3002/path', 'http://user@localhost:3002', 'http://localhost:3002?query', 'http://localhost:3002#hash', 'http://2130706433:3002', 'ftp://localhost:3002', 'null', '*']) {
    assert.equal(localRequestOrigin({ ...input, origin, allowedOrigins: origin, fetchSite: 'cross-site' }), null, origin);
  }
  assert.equal(localRequestOrigin({ ...input, origin: 'http://localhost:3002', allowedOrigins: 'http://localhost:3002/', fetchSite: 'same-site' }), null);
});

test('RAM sessions enforce capabilities, scopes, expiry and map bounds', async () => {
  let time = now; const store = createMemoryRpc({ now: () => time, maxSessions: 1 });
  try {
    await store.rpc('assistant_create_session', create());
    assert.equal((await store.rpc('assistant_get_session', create({ p_capability_hash: 'wrong' }))).status, 'not_found');
    assert.equal((await store.rpc('assistant_reserve_turn', reserve({ p_kind: 'transcription' }))).status, 'wrong_scope');
    assert.equal((await store.rpc('assistant_create_session', create({ p_id: crypto.randomUUID() }))).status, 'quota');
    time += 86400001; store.cleanup(); assert.deepEqual(store.counts(), { sessions: 0, usageBuckets: 0 });
    assert.equal((await store.rpc('assistant_get_session', create())).status, 'not_found');
  } finally { store.dispose(); }
});

test('RAM leases, cached replies and token reconciliation cannot replay/refund a request twice', async () => {
  let time = now; const store = createMemoryRpc({ now: () => time });
  try {
    await store.rpc('assistant_create_session', create());
    const first = await store.rpc('assistant_reserve_turn', reserve()); assert.equal(first.status, 'reserved');
    assert.equal((await store.rpc('assistant_reserve_turn', reserve())).status, 'pending');
    assert.equal((await store.rpc('assistant_reserve_turn', reserve({ p_input_hash: 'changed' }))).status, 'conflict');
    assert.equal((await store.rpc('assistant_finish_turn', { p_id: ID, p_turn_id: TURN, p_lease_id: 'wrong', p_failed: false, p_actual_tokens: 0 })).ok, false);
    const finish = { p_id: ID, p_turn_id: TURN, p_lease_id: first.leaseId, p_failed: false, p_actual_tokens: 10, p_result: { answer: 'Real provider answer' } };
    assert.equal((await store.rpc('assistant_finish_turn', finish)).ok, true);
    assert.equal((await store.rpc('assistant_finish_turn', finish)).ok, false);
    assert.equal((await store.rpc('assistant_reserve_turn', reserve())).status, 'cached');
    const next = reserve({ p_turn_id: crypto.randomUUID() }); assert.equal((await store.rpc('assistant_reserve_turn', next)).status, 'reserved');
    time += 45001; assert.equal((await store.rpc('assistant_reserve_turn', next)).status, 'failed');
    assert.equal((await store.rpc('assistant_reserve_turn', reserve({ p_turn_id: crypto.randomUUID() }))).status, 'quota');
  } finally { store.dispose(); }
});

test('RAM quota reservation is all-or-nothing across concurrent sessions', async () => {
  const store = createMemoryRpc({ now: () => now }); const other = crypto.randomUUID();
  try {
    await store.rpc('assistant_create_session', create()); await store.rpc('assistant_create_session', create({ p_id: other }));
    const results = await Promise.all([store.rpc('assistant_reserve_turn', reserve({ p_tokens: 1, p_buckets: quota() })), store.rpc('assistant_reserve_turn', reserve({ p_id: other, p_tokens: 1, p_buckets: quota() }))]);
    assert.deepEqual(results.map(r => r.status).sort(), ['quota', 'reserved']);
  } finally { store.dispose(); }
});

async function withGateway(run, provider = async () => Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ answer: 'AegisOne helps organizations detect phishing across URLs, emails, text, images and attachments.', speechText: 'AegisOne helps organizations detect phishing.', sources: ['overview'], actions: [] }) } }], usage: { total_tokens: 950 } }), env = {}) {
  let middleware; let calls = 0;
  const httpServer = createServer((req, res) => middleware(req, res, () => { res.statusCode = 404; res.end(); }));
  const plugin = createAssistantDevPlugin({ env: { GROQ_API_KEY: KEY, ...env }, projectRoot: fileURLToPath(new URL('../../../../', import.meta.url)), fetcher: async (url, options) => { calls++; assert.equal(options.headers.Authorization, `Bearer ${KEY}`); return provider(url, options); } });
  await plugin.configureServer({ httpServer, middlewares: { use(fn) { middleware = fn; } }, ssrLoadModule: id => import(pathToFileURL(id.slice('/@fs/'.length)).href) });
  await new Promise(resolve => httpServer.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${httpServer.address().port}`;
  try { await run(base, () => calls); }
  finally { await new Promise(resolve => httpServer.close(resolve)); }
}

test('company integration reaches AI as the first turn in fresh homepage sessions', async () => {
  await withGateway(async (base, calls) => {
    for (const section of ['hero', 'features', 'pricing']) {
      const headers = { 'Content-Type': 'application/json', Origin: base };
      const created = await fetch(`${base}/api/assistant/sessions`, { method: 'POST', headers, body: JSON.stringify({ scope: 'chat' }) });
      assert.equal(created.status, 201);
      const session = await created.json();
      const response = await fetch(`${base}/api/assistant/sessions/${session.id}/turns`, {
        method: 'POST', headers: { ...headers, 'X-Assistant-Capability': session.capability },
        body: JSON.stringify({ turnId: crypto.randomUUID(), message: 'how i can integrate this software in my company ?', language: 'en', languageMode: 'auto', context: { surface: 'landing', section } }),
      });
      assert.equal(response.status, 200);
      const reply = await response.json();
      assert.equal(reply.status, 'complete');
      assert.match(reply.answer, /Register your organization/);
      assert.doesNotMatch(reply.answer, /I’m here for AegisOne product support/);
      await fetch(`${base}/api/assistant/sessions/${session.id}`, { method: 'DELETE', headers: { ...headers, 'X-Assistant-Capability': session.capability } });
    }
    assert.equal(calls(), 3, 'every first question must reach the provider');
  }, async (_url, options) => {
    const body = JSON.parse(options.body);
    assert.equal(body.messages.filter(turn => turn.role === 'user').length, 1, 'no warm-up turn required');
    assert.match(body.messages[0].content, /Company integration means deployment/);
    assert.doesNotMatch(body.messages[0].content, /Current task: organization deployment only/);
    assert.ok(body.response_format.json_schema.schema.properties.sources.items.enum.includes('deployment'));
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({
      answer: 'Register your organization, then deploy AegisOne with Docker through the portal. Have you already registered?',
      speechText: 'Register your organization, then follow the deployment portal.', language: 'en', sources: ['deployment'], actions: [],
    }) } }], usage: { total_tokens: 80 } });
  });
});

test('portal page and setup-engine questions reach the provider with readiness and reviewed UI facts', async () => {
  const providerRequests = [];
  await withGateway(async (base, calls) => {
    const session = await (await fetch(`${base}/api/assistant/sessions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base }, body: JSON.stringify({ scope: 'chat' }),
    })).json();
    const context = { surface: 'deployment_portal', section: 'deployment', os: 'windows', readiness: 'ready', fieldStatus: { server_address: true } };
    for (const message of ['tell in this page what i have to do ?', 'what is launch setup engine how it helps mn ?']) {
      const response = await fetch(`${base}/api/assistant/sessions/${session.id}/turns`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base, 'X-Assistant-Capability': session.capability },
        body: JSON.stringify({ turnId: crypto.randomUUID(), message, context, language: 'en', languageMode: 'auto' }),
      });
      assert.equal(response.status, 200);
      const reply = await response.json();
      assert.equal(reply.status, 'complete');
      assert.match(reply.answer, /Start Setup Engine/);
      assert.doesNotMatch(reply.answer, /Please ask a question about AegisOne/);
      assert.equal(JSON.stringify(reply).includes(KEY), false);
    }
    assert.equal(calls(), 2);
    for (const request of providerRequests) {
      const system = request.messages[0].content;
      assert.match(system, /Install Docker Engine.*Run Deployment Script.*Launch Setup Engine/);
      assert.match(system, /dashboard on port 3002/);
      assert.ok(system.includes('"readiness":"ready"'));
      assert.ok(request.response_format.json_schema.schema.properties.sources.items.enum.includes('deployment'));
    }
  }, async (_url, options) => {
    providerRequests.push(JSON.parse(options.body));
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({
      answer: 'The readiness check reports ready. Choose Start Setup Engine to open the organization setup dashboard on port 3002.',
      speechText: 'Choose Start Setup Engine to open the organization setup dashboard.', language: 'en', sources: ['deployment'], actions: [],
    }) } }], usage: { total_tokens: 75 } });
  });
});

test('landing conversation answers purpose, safety and capabilities while clock questions stay local', async () => {
  const requests = [];
  await withGateway(async (base, calls) => {
    const session = await (await fetch(`${base}/api/assistant/sessions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base }, body: JSON.stringify({ scope: 'chat' }),
    })).json();
    const answers = [];
    for (const message of ['hello why are you here ?', 'what is time today ?', 'is this product safe ?', 'What AegisOne can do ?']) {
      const response = await fetch(`${base}/api/assistant/sessions/${session.id}/turns`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base, 'X-Assistant-Capability': session.capability },
        body: JSON.stringify({ turnId: crypto.randomUUID(), message, context: { surface: 'landing', section: 'hero' }, language: 'en', languageMode: 'auto' }),
      });
      assert.equal(response.status, 200);
      const reply = await response.json();
      assert.equal(reply.status, 'complete');
      assert.doesNotMatch(reply.answer, /Please ask a question about AegisOne/);
      if (/time today/.test(message)) {
        assert.match(reply.answer, /device.*clock/);
        assert.deepEqual(reply.sources, []);
        assert.deepEqual(reply.actions, []);
      }
      answers.push(reply.answer);
    }
    assert.equal(new Set(answers).size, 4);
    assert.equal(calls(), 3, 'only the three product-support questions should call the provider');
    assert.equal(requests.length, 3);
  }, async (_url, options) => {
    const body = JSON.parse(options.body); requests.push(body);
    const question = body.messages.at(-1).content;
    const answer = /why are you here/.test(question)
      ? 'I am the AegisOne product assistant. I explain the product, compare plans and help you get started.'
      : /safe/.test(question)
        ? 'AegisOne helps reduce phishing risk. Detection can make mistakes, and I cannot verify the security of your deployment.'
        : 'AegisOne analyzes links, text, email, images and attachments, with a browser extension and role-based dashboards.';
    if (/safe|can do/.test(question)) assert.ok(body.response_format.json_schema.schema.properties.sources.items.enum.includes('features'));
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ answer, speechText: answer, language: 'en', sources: [/safe|can do/.test(question) ? 'features' : 'overview'], actions: [] }) } }], usage: { total_tokens: 80 } });
  });
});

test('opt-in dashboard origin supports browser preflight and organization setup chat without exposing keys', async () => {
  const origin = 'http://localhost:3002';
  await withGateway(async (base, calls) => {
    const headers = { Origin: origin, 'Sec-Fetch-Site': 'cross-site' };
    const preflight = await fetch(`${base}/api/assistant/sessions`, { method: 'OPTIONS', headers: { ...headers, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type,x-assistant-capability' } });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('access-control-allow-origin'), origin);
    assert.match(preflight.headers.get('access-control-allow-methods'), /POST/);
    assert.match(preflight.headers.get('access-control-allow-headers'), /X-Assistant-Capability/i);
    assert.equal(preflight.headers.get('vary'), 'Origin');
    assert.equal(calls(), 0);
    const sessionResponse = await fetch(`${base}/api/assistant/sessions`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ scope: 'chat' }) });
    assert.equal(sessionResponse.status, 201);
    assert.equal(sessionResponse.headers.get('access-control-allow-origin'), origin);
    const session = await sessionResponse.json();
    const response = await fetch(`${base}/api/assistant/sessions/${session.id}/turns`, {
      method: 'POST', headers: { ...headers, 'Content-Type': 'application/json', 'X-Assistant-Capability': session.capability },
      body: JSON.stringify({ turnId: TURN, message: 'for setup what i should i do and where i shoul start first ?', language: 'en', languageMode: 'auto', context: { surface: 'organization_setup', step: 'organization', fieldStatus: { org_name: false } } }),
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('access-control-allow-origin'), origin);
    const reply = await response.json();
    assert.equal(reply.status, 'complete');
    assert.equal(JSON.stringify({ session, reply }).includes(KEY), false);
    assert.equal(calls(), 1);
    for (const deniedOrigin of ['http://localhost:3003', 'https://attacker.example', 'null']) {
      const denied = await fetch(`${base}/api/assistant/sessions`, { method: 'OPTIONS', headers: { ...headers, Origin: deniedOrigin } });
      assert.equal(denied.status, 403);
      assert.equal(denied.headers.has('access-control-allow-origin'), false);
    }
    const missingOrigin = await fetch(`${base}/api/assistant/sessions`, { method: 'OPTIONS', headers: { 'Sec-Fetch-Site': 'cross-site' } });
    assert.equal(missingOrigin.status, 403);
    assert.equal(calls(), 1);
  }, async () => Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ answer: 'Start with organization details, then continue to structure, validation, security and rollout.', speechText: 'Start with organization details.', language: 'en', sources: ['setup-organization'], actions: [{ type: 'open_step', target: 'organization' }] }) } }], usage: { total_tokens: 950 } }), { ASSISTANT_DEV_ALLOWED_ORIGINS: origin });
});

for (const step of ['organization', 'structure', 'validation', 'security', 'rollout']) {
  test(`local setup chat budget permits an automatic-language first question at the ${step} step`, async () => {
    await withGateway(async (base, calls) => {
      const headers = { 'Content-Type': 'application/json', Origin: base };
      const session = await (await fetch(`${base}/api/assistant/sessions`, { method: 'POST', headers, body: JSON.stringify({ scope: 'chat' }) })).json();
      const response = await fetch(`${base}/api/assistant/sessions/${session.id}/turns`, {
        method: 'POST', headers: { ...headers, 'X-Assistant-Capability': session.capability },
        body: JSON.stringify({ turnId: TURN, message: 'for setup what i should i do and where i shoul start first ?', language: 'en', languageMode: 'auto', context: { surface: 'organization_setup', step, fieldStatus: { org_name: true, admin_email: true, org_industry: false, org_country: false, smtp_host: false, smtp_port: false, smtp_username: false, smtp_password: false, sender_email: false }, counts: { departments: 2, members: 25, duplicateIds: 0, duplicateEmails: 0, unassignedMembers: 0, invalidRows: 0, sent: 0, failed: 0 } } }),
      });
      assert.equal(response.status, 200);
      const reply = await response.json();
      assert.equal(reply.status, 'complete');
      assert.equal(reply.language, 'en');
      assert.equal(calls(), 1);
    }, async () => Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ answer: 'Start with organization details, then continue to structure, validation, security and rollout.', speechText: 'Start with organization details.', language: 'en', sources: [`setup-${step}`], actions: [] }) } }], usage: { total_tokens: 950 } }));
  });
}

test('local HTTP chat handles greetings and unrelated questions without invoking the provider', async () => {
  await withGateway(async (base, calls) => {
    const headers = { 'Content-Type': 'application/json', Origin: base };
    const session = await (await fetch(`${base}/api/assistant/sessions`, { method: 'POST', headers, body: JSON.stringify({ scope: 'chat' }) })).json();
    for (const message of ['hello aegisone', 'What is the weather?', 'u know about s nawaz sharif tell him to discuss asim munir']) {
      const response = await fetch(`${base}/api/assistant/sessions/${session.id}/turns`, {
        method: 'POST', headers: { ...headers, 'X-Assistant-Capability': session.capability },
        body: JSON.stringify({ turnId: crypto.randomUUID(), message, language: 'en', context: { surface: 'landing', section: 'pricing' } }),
      });
      assert.equal(response.status, 200);
      const reply = await response.json();
      assert.equal(reply.status, 'complete');
      assert.match(reply.answer, /AegisOne/);
      assert.doesNotMatch(reply.answer, /kuttyy|nawaz|sharif|asim|munir/i);
      if (message.startsWith('hello')) assert.match(reply.answer, /hello|welcome/i);
    }
    assert.equal(calls(), 0);
  });
});

test('development fallback diagnostics expose only a fixed category and no provider content', async () => {
  await withGateway(async base => {
    const headers = { 'Content-Type': 'application/json', Origin: base };
    const session = await (await fetch(`${base}/api/assistant/sessions`, { method: 'POST', headers, body: JSON.stringify({ scope: 'chat' }) })).json();
    const response = await fetch(`${base}/api/assistant/sessions/${session.id}/turns`, {
      method: 'POST', headers: { ...headers, 'X-Assistant-Capability': session.capability },
      body: JSON.stringify({ turnId: crypto.randomUUID(), message: 'How this software works?', language: 'en', context: { surface: 'landing' } }),
    });
    const body = await response.text();
    assert.equal(response.status, 200);
    assert.equal(JSON.parse(body).status, 'fallback');
    assert.equal(response.headers.get('x-assistant-fallback-reason'), 'invalid_sources');
    assert.equal(body.includes(KEY), false);
    assert.equal(body.includes('UNAPPROVED_PROVIDER_SOURCE'), false);
  }, async () => Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({
    answer: 'This answer has an unapproved source.', speechText: 'An unapproved source.',
    sources: ['UNAPPROVED_PROVIDER_SOURCE'], actions: [],
  }) } }], usage: { total_tokens: 90 } }));
});

test('actual local HTTP bridge returns real-model-shaped answers, caches turns and never exposes keys', async () => {
  await withGateway(async (base, calls) => {
    const sessionResponse = await fetch(`${base}/api/assistant/sessions`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base }, body: JSON.stringify({ scope: 'chat' }) });
    assert.equal(sessionResponse.status, 201); const session = await sessionResponse.json();
    assert.equal(JSON.stringify(session).includes(KEY), false);
    const input = { turnId: TURN, message: 'What does AegisOne do?', language: 'en', context: { surface: 'landing', section: 'hero' } };
    const send = () => fetch(`${base}/api/assistant/sessions/${session.id}/turns`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Assistant-Capability': session.capability, Origin: base }, body: JSON.stringify(input) });
    const reply = await (await send()).json(); assert.equal(reply.status, 'complete'); assert.match(reply.answer, /phishing/); assert.equal(JSON.stringify(reply).includes(KEY), false);
    assert.deepEqual(await (await send()).json(), reply); assert.equal(calls(), 1);
    const noCap = await fetch(`${base}/api/assistant/sessions/${session.id}`); assert.equal(noCap.status, 401);
    const hostile = await fetch(`${base}/api/assistant/sessions`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://attacker.example' }, body: JSON.stringify({ scope: 'chat' }) });
    assert.equal(hostile.status, 403); assert.equal(hostile.headers.has('access-control-allow-origin'), false); assert.equal(calls(), 1);
    const deleted = await fetch(`${base}/api/assistant/sessions/${session.id}`, { method: 'DELETE', headers: { 'X-Assistant-Capability': session.capability, Origin: base } }); assert.equal(deleted.status, 200);
  });
});

test('client cancellation propagates to the server-only provider request', async () => {
  let entered; const started = new Promise(resolve => { entered = resolve; }); let aborted;
  const cancelled = new Promise(resolve => { aborted = resolve; });
  await withGateway(async (base, calls) => {
    const session = await (await fetch(`${base}/api/assistant/sessions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scope: 'chat' }) })).json();
    const controller = new AbortController();
    const pending = fetch(`${base}/api/assistant/sessions/${session.id}/turns`, { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json', 'X-Assistant-Capability': session.capability }, body: JSON.stringify({ turnId: TURN, message: 'Explain the product', language: 'en', context: { surface: 'landing' } }) });
    await started; controller.abort(); await assert.rejects(pending); await cancelled; assert.equal(calls(), 1);
  }, async (url, options) => { entered(); return new Promise((resolve, reject) => { options.signal.addEventListener('abort', () => { aborted(); reject(new DOMException('Cancelled', 'AbortError')); }, { once: true }); }); });
});
