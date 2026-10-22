import assert from 'node:assert/strict';
import test from 'node:test';
import { createAssistantClient, AssistantError } from '../src/client.ts';
import { encodePcmWav } from '../src/voice.ts';

class MemoryStorage {
  values = new Map<string, string>();
  get length() { return this.values.size; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
  clear() { this.values.clear(); }
}
const session = () => ({ id: 'session/one', capability: 'capability-secret', expiresAt: new Date(Date.now() + 3_600_000).toISOString() });
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const reply = (turnId = 'turn-1') => ({ turnId, answer: 'Setup help.', speechText: 'Setup help.', language: 'en', sources: ['overview'], actions: [], status: 'complete' });

test('requests omit account credentials/referrers and attach only assistant capability plus safe context', async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const fake = (async (url: string, init: RequestInit) => { calls.push({ url, init }); return response(calls.length === 1 ? session() : reply()); }) as typeof fetch;
  const client = createAssistantClient({ baseUrl: 'https://assistant.example/api', fetch: fake });
  await client.send({ message: '  Help with SMTP  ', language: 'en', turnId: 'turn-1', context: {
    surface: 'organization_setup', step: 'security', fieldStatus: { smtp_password: true },
    smtpPassword: 'SECRET_SENTINEL', employees: [{ email: 'SECRET_SENTINEL' }],
  } as any });
  assert.equal(calls[1].url, 'https://assistant.example/api/sessions/session%2Fone/turns');
  for (const { init } of calls) {
    assert.equal(init.credentials, 'omit'); assert.equal(init.referrerPolicy, 'no-referrer');
    assert.equal(new Headers(init.headers).has('Authorization'), false);
    assert.equal(new Headers(init.headers).has('Cookie'), false);
  }
  assert.equal(new Headers(calls[0].init.headers).has('X-Assistant-Capability'), false);
  assert.equal(new Headers(calls[1].init.headers).get('X-Assistant-Capability'), 'capability-secret');
  const body = JSON.parse(calls[1].init.body as string);
  assert.equal(body.message, 'Help with SMTP'); assert.equal(body.turnId, 'turn-1');
  assert.equal(body.languageMode, 'auto');
  assert.equal(JSON.stringify(body).includes('SECRET_SENTINEL'), false);
});

test('explicit retry IDs are preserved and an existing session is reused', async () => {
  let creates = 0; const ids: string[] = [];
  const fake = (async (_url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string);
    if (body.scope) { creates++; return response(session()); }
    ids.push(body.turnId); return response(reply(body.turnId));
  }) as typeof fetch;
  const client = createAssistantClient({ baseUrl: 'https://assistant.example', fetch: fake });
  const input = { message: 'Help', language: 'en', turnId: 'same-id', context: { surface: 'landing' } } as const;
  await client.send(input); await client.send(input);
  assert.equal(creates, 1); assert.deepEqual(ids, ['same-id', 'same-id']);
});

test('language is automatic without a selected locale and model replies carry ambiguous follow-ups', async () => {
  const bodies: any[] = [];
  const fake = (async (url: string, init: RequestInit) => {
    if (url.endsWith('/sessions')) return response(session());
    bodies.push(JSON.parse(init.body as string));
    return response({ ...reply(), answer: 'AegisOne ke features.', language: 'ur-Latn' });
  }) as typeof fetch;
  const client = createAssistantClient({ baseUrl: 'https://assistant.example', fetch: fake });
  await client.send({ message: 'AegisOne ka setup', context: { surface: 'landing' } });
  await client.send({ message: '200 employees', context: { surface: 'landing' } });
  assert.equal(bodies[0].languageMode, 'auto');
  assert.equal(bodies[1].language, 'ur-Latn');
});

test('unsafe gateway URLs and invalid messages do not cause network requests', async () => {
  let requests = 0; const fake = (async () => { requests++; return response(session()); }) as typeof fetch;
  for (const baseUrl of ['', 'http://192.168.1.2', 'https://user:pass@example.com', 'https://assistant.example?key=secret', 'https://assistant.example/#secret']) {
    const client = createAssistantClient({ baseUrl, fetch: fake });
    await assert.rejects(client.send({ message: 'Help', language: 'en', context: { surface: 'landing' } }), (error: any) => error.code === 'unconfigured');
  }
  const client = createAssistantClient({ baseUrl: 'https://assistant.example', fetch: fake });
  for (const message of ['', '   ', 'x'.repeat(2001)]) {
    await assert.rejects(client.send({ message, language: 'en', context: { surface: 'landing' } }), (error: any) => error.code === 'invalid_message');
  }
  assert.equal(requests, 0);
});

test('caller cancellation and the 35-second request deadline abort fetch', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let signal: AbortSignal | undefined;
  const fake = (async (_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
    signal = init.signal as AbortSignal;
    if (signal.aborted) reject(signal.reason);
    else signal.addEventListener('abort', () => reject(signal!.reason), { once: true });
  })) as typeof fetch;
  const client = createAssistantClient({ baseUrl: 'https://assistant.example', fetch: fake });
  const timed = client.send({ message: 'Help', language: 'en', context: { surface: 'landing' } });
  t.mock.timers.tick(35_001);
  await assert.rejects(timed, (error: any) => error.name === 'TimeoutError');
  assert.equal(signal?.aborted, true);
  const controller = new AbortController();
  const cancelled = client.send({ message: 'Help', language: 'en', context: { surface: 'landing' } }, { signal: controller.signal });
  controller.abort();
  await assert.rejects(cancelled, (error: any) => error.name === 'AbortError');
});

test('rate-limit errors retain structured retry metadata without retrying automatically', async () => {
  let count = 0;
  const fake = (async () => { count++; return response({ error: { code: 'rate_limited', message: 'Please wait.', retryAfter: 60 } }, 429); }) as typeof fetch;
  const client = createAssistantClient({ baseUrl: 'https://assistant.example', fetch: fake });
  await assert.rejects(client.send({ message: 'Help', language: 'en', context: { surface: 'landing' } }), (error: any) => error instanceof AssistantError && error.code === 'rate_limited' && error.retryAfter === 60);
  assert.equal(count, 1);
});

test('successful reset deletes the remote session and clears the local capability', async () => {
  const storage = new MemoryStorage(); const calls: { url: string; init: RequestInit }[] = [];
  const fake = (async (url: string, init: RequestInit) => { calls.push({ url, init }); return response(init.method === 'DELETE' ? {} : url.endsWith('/sessions') ? session() : reply()); }) as typeof fetch;
  const client = createAssistantClient({ baseUrl: 'https://assistant.example', storage, storageKey: 'chat', fetch: fake });
  await client.send({ message: 'Help', language: 'en', context: { surface: 'landing' } });
  assert.equal(storage.getItem('chat')?.includes('capability-secret'), true);
  await client.reset();
  assert.equal(calls.at(-1)?.init.method, 'DELETE');
  assert.equal(new Headers(calls.at(-1)?.init.headers).get('X-Assistant-Capability'), 'capability-secret');
  assert.equal(storage.getItem('chat'), null);
  await client.send({ message: 'Help again', language: 'en', context: { surface: 'landing' } });
  assert.equal(calls.filter(call => call.url.endsWith('/sessions')).length, 2);
});

test('reset during bootstrap deletes the late session and never sends the abandoned turn', async () => {
  const storage = new MemoryStorage(); const calls: { url: string; method?: string }[] = [];
  let finishBootstrap!: (value: Response) => void;
  const fake = (async (url: string, init: RequestInit) => {
    calls.push({ url, method: init.method });
    if (url.endsWith('/sessions')) return new Promise<Response>(resolve => { finishBootstrap = resolve; });
    return response({});
  }) as typeof fetch;
  const client = createAssistantClient({ baseUrl: 'https://assistant.example', storage, storageKey: 'chat', fetch: fake });
  const sending = client.send({ message: 'Abandoned question', language: 'en', context: { surface: 'landing' } });
  const rejected = assert.rejects(sending, (error: any) => error.code === 'session_reset');
  const resetting = client.reset(); finishBootstrap(response(session()));
  await Promise.all([resetting, rejected]);
  assert.equal(storage.getItem('chat'), null);
  assert.deepEqual(calls.map(call => call.method), ['POST', 'DELETE']);
  assert.equal(calls.some(call => call.url.endsWith('/turns')), false);
});

test('failed remote deletion remains retryable and is never reported as successful reset', async () => {
  const storage = new MemoryStorage(); let deletionCount = 0;
  const fake = (async (url: string, init: RequestInit) => {
    if (init.method === 'DELETE') { deletionCount++; return deletionCount === 1 ? response({ error: { code: 'unavailable' } }, 503) : response({}); }
    return response(url.endsWith('/sessions') ? session() : reply());
  }) as typeof fetch;
  const client = createAssistantClient({ baseUrl: 'https://assistant.example', storage, storageKey: 'chat', fetch: fake });
  await client.send({ message: 'Help', language: 'en', context: { surface: 'landing' } });
  await assert.rejects(client.reset());
  assert.notEqual(storage.getItem('chat'), null);
  await client.reset(); assert.equal(deletionCount, 2); assert.equal(storage.getItem('chat'), null);
});

test('expired sessions in storage are not reused; expired gateway sessions are rejected', async () => {
  const storage = new MemoryStorage(); storage.setItem('chat', JSON.stringify({ ...session(), expiresAt: '2000-01-01T00:00:00Z' }));
  let creates = 0;
  const fake = (async (url: string) => { if (url.endsWith('/sessions')) { creates++; return response({ ...session(), expiresAt: '2000-01-01T00:00:00Z' }); } return response(reply()); }) as typeof fetch;
  const client = createAssistantClient({ baseUrl: 'https://assistant.example', storage, storageKey: 'chat', fetch: fake });
  await assert.rejects(client.send({ message: 'Help', language: 'en', context: { surface: 'landing' } }), (error: any) => error.code === 'invalid_response');
  assert.equal(creates, 1);
});

test('transcription uses multipart with the assistant capability and validates limits before networking', async () => {
  const calls: RequestInit[] = [];
  const fake = (async (url: string, init: RequestInit) => { calls.push(init); return response(url.endsWith('/sessions') ? session() : { text: 'Hello' }); }) as typeof fetch;
  const client = createAssistantClient({ baseUrl: 'https://assistant.example', scope: 'transcription', fetch: fake });
  const wav = new Blob([encodePcmWav([new Float32Array(160)], 16000)], { type: 'audio/wav' });
  assert.equal(await client.transcribe(wav, 'ur'), 'Hello');
  assert.equal(new Headers(calls[1].headers).has('Content-Type'), false);
  assert.equal(new Headers(calls[1].headers).get('X-Assistant-Capability'), 'capability-secret');
  assert.equal((calls[1].body as FormData).get('language'), 'ur');
  assert.equal((calls[1].body as FormData).get('languageMode'), 'auto');
  assert.equal(((calls[1].body as FormData).get('file') as File).name, 'voice.wav');
  const count = calls.length;
  for (const blob of [
    new Blob([], { type: 'audio/wav' }), new Blob([new Uint8Array(44)], { type: 'audio/wav' }),
    new Blob([new Uint8Array(960_045)], { type: 'audio/wav' }), new Blob([new Uint8Array(100)], { type: 'audio/webm' }),
  ]) await assert.rejects(client.transcribe(blob, 'en'));
  await assert.rejects(client.transcribe(wav, 'fr' as any));
  assert.equal(calls.length, count);
});

test('inline voice has an independent transcription-only capability and reset deletes both', async () => {
  const scopes: string[] = []; const calls: { url: string; init: RequestInit }[] = [];
  const fake = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    if (url.endsWith('/sessions')) {
      const scope = JSON.parse(init.body as string).scope; scopes.push(scope);
      return response({ ...session(), id: scope, capability: `capability-${scope}` });
    }
    return response(url.endsWith('/turns') ? reply() : { text: 'Hello' });
  }) as typeof fetch;
  const client = createAssistantClient({ baseUrl: 'https://assistant.example', fetch: fake });
  await client.send({ message: 'Hello', language: 'en', context: { surface: 'landing' } });
  await client.transcribe(new Blob([encodePcmWav([new Float32Array(160)], 16000)], { type: 'audio/wav' }), 'en');
  assert.deepEqual(scopes, ['chat', 'transcription']);
  const upload = calls.find(call => call.url.endsWith('/transcriptions'))!;
  assert.equal(new Headers(upload.init.headers).get('X-Assistant-Capability'), 'capability-transcription');
  await client.reset();
  assert.deepEqual(calls.filter(call => call.init.method === 'DELETE').map(call => call.url.split('/').at(-1)), ['transcription', 'chat']);
});

function restoredSession(storageKey = 'chat') {
  const storage = new MemoryStorage();
  storage.setItem(storageKey, JSON.stringify({ ...session(), id: 'stale-session', capability: 'stale-capability' }));
  return storage;
}
const missingSession = () => response({ error: { code: 'session_not_found', message: 'This session no longer exists.' } }, 404);

test('a stored session rejected before provider processing is recreated once with the same turn ID and body', async () => {
  const storage = restoredSession(); const calls: { url: string; init: RequestInit }[] = [];
  const fake = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    if (url.includes('/stale-session/turns')) return missingSession();
    if (url.endsWith('/sessions')) return response({ ...session(), id: 'replacement', capability: 'replacement-capability' });
    return response(reply(JSON.parse(init.body as string).turnId));
  }) as typeof fetch;
  const client = createAssistantClient({ baseUrl: 'https://assistant.example', storage, storageKey: 'chat', fetch: fake });
  const result = await client.send({ message: 'Explain AegisOne', language: 'en', context: { surface: 'landing' } });
  assert.deepEqual(calls.map(call => call.url.split('/').at(-1)), ['turns', 'sessions', 'turns']);
  assert.equal(calls[0].init.body, calls[2].init.body);
  assert.equal(JSON.parse(calls[0].init.body as string).turnId, result.turnId);
  assert.equal(new Headers(calls[0].init.headers).get('X-Assistant-Capability'), 'stale-capability');
  assert.equal(new Headers(calls[2].init.headers).get('X-Assistant-Capability'), 'replacement-capability');
  assert.equal(JSON.parse(storage.getItem('chat')!).id, 'replacement');
});

test('a second explicit session rejection stops recovery and clears the replacement capability', async () => {
  const storage = restoredSession(); let creates = 0; let turns = 0;
  const fake = (async (url: string) => {
    if (url.endsWith('/sessions')) { creates++; return response({ ...session(), id: 'replacement' }); }
    turns++; return missingSession();
  }) as typeof fetch;
  const client = createAssistantClient({ baseUrl: 'https://assistant.example', storage, storageKey: 'chat', fetch: fake });
  await assert.rejects(client.send({ message: 'Help', language: 'en', context: { surface: 'landing' } }), (error: any) => error.code === 'session_not_found');
  assert.equal(creates, 1); assert.equal(turns, 2); assert.equal(storage.getItem('chat'), null);
});

test('network, provider, rate-limit and unrelated HTTP failures are never replayed automatically', async () => {
  const outcomes = [
    () => { throw new TypeError('Network connection lost'); },
    () => response({ error: { code: 'provider_unavailable' } }, 503),
    () => response({ error: { code: 'rate_limited' } }, 429),
    () => response({ error: { code: 'not_found' } }, 404),
    () => response({ error: { code: 'session_not_found' } }, 502),
  ];
  for (const outcome of outcomes) {
    const storage = restoredSession(); let calls = 0;
    const fake = (async () => { calls++; return outcome(); }) as typeof fetch;
    const client = createAssistantClient({ baseUrl: 'https://assistant.example', storage, storageKey: 'chat', fetch: fake });
    await assert.rejects(client.send({ message: 'Help', language: 'en', context: { surface: 'landing' } }));
    assert.equal(calls, 1); assert.notEqual(storage.getItem('chat'), null);
  }
});

test('caller abort before or during a missing-session response prevents recreation', async () => {
  const storage = restoredSession(); const controller = new AbortController(); let calls = 0;
  const fake = (async () => { calls++; controller.abort(); return missingSession(); }) as typeof fetch;
  const client = createAssistantClient({ baseUrl: 'https://assistant.example', storage, storageKey: 'chat', fetch: fake });
  await assert.rejects(client.send({ message: 'Help', language: 'en', context: { surface: 'landing' } }, { signal: controller.signal }), (error: any) => error.name === 'AbortError');
  assert.equal(calls, 1);
  await assert.rejects(client.send({ message: 'Help', language: 'en', context: { surface: 'landing' } }, { signal: controller.signal }), (error: any) => error.name === 'AbortError');
  assert.equal(calls, 1);
});

test('abort during session recreation prevents the recovered turn from being sent', async () => {
  const storage = restoredSession(); const controller = new AbortController(); const calls: string[] = [];
  const fake = (async (url: string) => {
    calls.push(url);
    if (url.endsWith('/sessions')) { controller.abort(); return response({ ...session(), id: 'replacement' }); }
    return missingSession();
  }) as typeof fetch;
  const client = createAssistantClient({ baseUrl: 'https://assistant.example', storage, storageKey: 'chat', fetch: fake });
  await assert.rejects(client.send({ message: 'Help', language: 'en', context: { surface: 'landing' } }, { signal: controller.signal }), (error: any) => error.name === 'AbortError');
  assert.equal(calls.filter(url => url.endsWith('/turns')).length, 1);
  assert.equal(calls.filter(url => url.endsWith('/sessions')).length, 1);
});

test('an old rejection after reset cannot recreate or erase a newer conversation', async () => {
  const storage = restoredSession(); const calls: { url: string; method?: string }[] = [];
  let finishOldTurn!: (value: Response) => void; let started!: () => void;
  const oldStarted = new Promise<void>(resolve => { started = resolve; });
  const fake = (async (url: string, init: RequestInit) => {
    calls.push({ url, method: init.method });
    if (url.includes('/stale-session/turns')) { started(); return new Promise<Response>(resolve => { finishOldTurn = resolve; }); }
    if (init.method === 'DELETE') return response({});
    if (url.endsWith('/sessions')) return response({ ...session(), id: 'new-conversation', capability: 'new-capability' });
    return response(reply(JSON.parse(init.body as string).turnId));
  }) as typeof fetch;
  const client = createAssistantClient({ baseUrl: 'https://assistant.example', storage, storageKey: 'chat', fetch: fake });
  const oldSending = client.send({ message: 'Old question', language: 'en', context: { surface: 'landing' } });
  const oldRejected = assert.rejects(oldSending, (error: any) => error.code === 'session_reset');
  await oldStarted; await client.reset();
  await client.send({ message: 'New question', language: 'en', context: { surface: 'landing' } });
  finishOldTurn(missingSession()); await oldRejected;
  assert.equal(JSON.parse(storage.getItem('chat')!).id, 'new-conversation');
  assert.equal(calls.filter(call => call.url.endsWith('/sessions')).length, 1);
  assert.equal(calls.filter(call => call.url.includes('/stale-session/turns')).length, 1);
});

test('reset during recovery bootstrap deletes the late replacement and suppresses replay', async () => {
  const storage = restoredSession(); const calls: { url: string; method?: string }[] = [];
  let finishBootstrap!: (value: Response) => void; let started!: () => void;
  const recoveryStarted = new Promise<void>(resolve => { started = resolve; });
  const fake = (async (url: string, init: RequestInit) => {
    calls.push({ url, method: init.method });
    if (url.endsWith('/sessions')) { started(); return new Promise<Response>(resolve => { finishBootstrap = resolve; }); }
    if (init.method === 'DELETE') return response({});
    return missingSession();
  }) as typeof fetch;
  const client = createAssistantClient({ baseUrl: 'https://assistant.example', storage, storageKey: 'chat', fetch: fake });
  const sending = client.send({ message: 'Abandoned recovered question', language: 'en', context: { surface: 'landing' } });
  const rejected = assert.rejects(sending, (error: any) => error.code === 'session_reset');
  await recoveryStarted; const resetting = client.reset();
  finishBootstrap(response({ ...session(), id: 'late-replacement' }));
  await Promise.all([resetting, rejected]);
  assert.equal(storage.getItem('chat'), null);
  assert.equal(calls.filter(call => call.url.endsWith('/turns')).length, 1);
  assert.equal(calls.some(call => call.method === 'DELETE' && call.url.endsWith('/late-replacement')), true);
});

test('transcription recovers once using the same audio and transcription turn ID', async () => {
  const storage = restoredSession('voice'); const forms: FormData[] = []; let creates = 0;
  const fake = (async (url: string, init: RequestInit) => {
    if (url.endsWith('/sessions')) { creates++; assert.equal(JSON.parse(init.body as string).scope, 'transcription'); return response({ ...session(), id: 'replacement' }); }
    forms.push(init.body as FormData);
    return url.includes('/stale-session/') ? missingSession() : response({ text: 'Salam' });
  }) as typeof fetch;
  const client = createAssistantClient({ baseUrl: 'https://assistant.example', scope: 'transcription', storage, storageKey: 'voice', fetch: fake });
  const audio = new Blob([encodePcmWav([new Float32Array(160)], 16000)], { type: 'audio/wav' });
  assert.equal(await client.transcribe(audio, 'ur'), 'Salam');
  assert.equal(creates, 1); assert.equal(forms.length, 2);
  assert.equal(forms[0].get('turnId'), forms[1].get('turnId'));
  assert.equal(forms[0].get('file'), forms[1].get('file'));
});

test('feedback for an absent or rejected old session never creates a replacement', async () => {
  const storage = restoredSession(); let calls = 0;
  const fake = (async (url: string) => { calls++; assert.equal(url.endsWith('/feedback'), true); return missingSession(); }) as typeof fetch;
  const client = createAssistantClient({ baseUrl: 'https://assistant.example', storage, storageKey: 'chat', fetch: fake });
  await assert.rejects(client.feedback('old-turn', true));
  assert.equal(storage.getItem('chat'), null);
  await assert.rejects(client.feedback('old-turn', true)); assert.equal(calls, 1);
});
