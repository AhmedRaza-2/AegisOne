import test from 'node:test';
import assert from 'node:assert/strict';
import { answerSchema, buildPrompt, generateAnswer, transcribe } from '../provider.mjs';
import { validateReply } from '../policy.mjs';
import { classifyMessage } from '../scope.mjs';
import { createHandler } from '../handler.mjs';
import { reserveTokenCount } from '../quotas.mjs';

const context = { surface: 'landing' };
const roman = { answer: 'AegisOne ka deployment portal kholein.', speechText: 'ایجس ون کا ڈیپلائمنٹ پورٹل کھولیں۔', language: 'ur-Latn', sources: ['deployment'], actions: [] };
const env = {
  ASSISTANT_ENABLED: 'true', ASSISTANT_VOICE_ENABLED: 'true', ASSISTANT_QUOTAS_VERIFIED: 'true',
  GROQ_API_KEY: 'test-server-key', ASSISTANT_IP_HASH_SECRET: 'test-only-secret-at-least-thirty-two-characters',
  GROQ_CHAT_RPM: '30', GROQ_CHAT_RPD: '1000', GROQ_CHAT_TPM: '8000', GROQ_CHAT_TPD: '200000',
  GROQ_AUDIO_RPM: '20', GROQ_AUDIO_RPD: '100', GROQ_AUDIO_ASH: '3600', GROQ_AUDIO_ASD: '7200',
};
const ID = 'b228dfaa-a202-4910-9263-19b9a1c15421';
const TURN = '5e37c6b6-a822-4672-a7e9-fd804f4a82cd';
const TOKEN = 'a'.repeat(43);
function request(message, extra = {}) {
  return new Request(`https://example.test/assistant/sessions/${ID}/turns`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Assistant-Capability': TOKEN },
    body: JSON.stringify({ turnId: TURN, message, language: 'en', languageMode: 'auto', context, ...extra }),
  });
}
const providerResponse = reply => Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(reply) } }], usage: { total_tokens: 100 } });

test('automatic structured output lets the model resolve Roman Urdu instead of forcing the client hint', async () => {
  const prompt = buildPrompt('AegisOne ka installation', 'en', context, [], 'auto');
  assert.equal(prompt.scope, 'project');
  assert.match(prompt.messages[0].content, /Infer reply language\/script/);
  assert.doesNotMatch(prompt.messages[0].content, /answer: English\./);
  const result = await generateAnswer({ key: 'test-key', language: 'en', languageMode: 'auto', context, prompt, fetcher: async (_url, options) => {
    const body = JSON.parse(options.body);
    assert.deepEqual(body.response_format, answerSchema(prompt.sourceIds, 'en', context, 'auto'));
    assert.deepEqual(body.response_format.json_schema.schema.properties.language.enum, ['en', 'ur', 'ur-Latn']);
    assert.equal(body.response_format.json_schema.schema.properties.sources.minItems, 1, 'constrained output cannot emit the empty source list rejected by server validation');
    assert.equal(body.response_format.json_schema.schema.properties.sources.maxItems, 5);
    assert.equal(body.response_format.json_schema.schema.properties.actions.maxItems, 3);
    return providerResponse(roman);
  } });
  assert.equal(result.reply.language, 'ur-Latn');
  assert.equal(result.reply.answer, roman.answer);
});

test('automatic output still rejects invalid languages, wrong speech scripts and invented sources/actions', () => {
  for (const bad of [
    { ...roman, language: 'fr' }, { ...roman, language: undefined },
    { ...roman, speechText: 'Deployment portal kholein.' },
    { ...roman, language: 'en', answer: roman.speechText, speechText: 'Open the deployment portal.' },
    { ...roman, sources: ['invented'] },
    { ...roman, actions: [{ type: 'execute_setup', target: 'all' }] },
  ]) assert.throws(() => validateReply(bad, 'en', context, ['deployment'], 'auto'));
});

test('language preferences reach interpretation without granting unrelated history a new topic', () => {
  for (const message of ['Explain AegisOne in Urdu', 'Explain setup. Reply in Roman Urdu.', 'How does installation work? Answer in English.']) {
    assert.equal(classifyMessage(message, context), 'project', message);
  }
  for (const message of ['Reply in Urdu', 'Roman Urdu mein jawab', 'اردو میں جواب']) {
    assert.equal(classifyMessage(message, context, [{ message: 'How does AegisOne installation work?' }]), 'project', message);
    assert.equal(classifyMessage(message, context, [{ message: 'What is the capital of France?' }]), 'project', message);
    const prompt = buildPrompt(message, 'en', context, [{ message: 'What is the capital of France?' }], 'auto');
    assert.equal(prompt.messages.at(-1).content, message);
    assert.doesNotMatch(JSON.stringify(prompt.messages), /capital of France/);
    assert.match(prompt.messages[0].content, /Never answer unrelated topics/);
  }
  assert.equal(classifyMessage('Explain AegisOne. Reply in Urdu about politics.', context), 'out_of_scope');
  assert.equal(classifyMessage('Write code in Urdu for AegisOne.', context), 'out_of_scope');
});

test('gateway infers fallback language from the message despite a stale English hint', async () => {
  const calls = [];
  const rpc = async (name, args) => {
    calls.push({ name, args });
    if (name === 'assistant_get_session') return { status: 'found', scope: 'chat', turns: [] };
    if (name === 'assistant_reserve_turn') return { status: 'reserved', leaseId: TURN };
    return { ok: true };
  };
  const handler = createHandler({ getEnv: key => env[key], rpc, fetcher: async () => { throw new Error('offline'); } });
  const response = await handler(request('Installation kaise hoti hai?'));
  assert.equal(response.status, 200);
  const reply = await response.json();
  assert.equal(reply.language, 'ur-Latn');
  assert.equal(reply.status, 'fallback');
  assert.equal(calls.find(call => call.name === 'assistant_reserve_turn').args.p_language, 'ur-Latn');
});

test('automatic replay hashes stay stable when model language changes the conversation', async () => {
  const hashes = []; let cached; let providerCalls = 0;
  const rpc = async (name, args) => {
    if (name === 'assistant_get_session') return { status: 'found', scope: 'chat', turns: [{ message: 'Which plan fits my team?', language: cached ? 'en' : 'ur' }] };
    if (name === 'assistant_reserve_turn') {
      hashes.push(args.p_input_hash);
      return cached ? { status: 'cached', result: cached } : { status: 'reserved', leaseId: TURN };
    }
    if (name === 'assistant_finish_turn') { cached = args.p_result; return { ok: true }; }
  };
  const handler = createHandler({ getEnv: key => env[key], rpc, fetcher: async () => {
    providerCalls++;
    return providerResponse({ answer: 'Growth Defense supports this team size.', speechText: 'Consider Growth Defense.', language: 'en', sources: ['pricing'], actions: [] });
  } });
  assert.equal((await handler(request('200 employees'))).status, 200);
  const replay = await handler(request('200 employees'));
  assert.equal(replay.status, 200);
  assert.equal((await replay.json()).language, 'en');
  assert.equal(hashes.length, 2);
  assert.equal(hashes[0], hashes[1]);
  assert.equal(providerCalls, 1);
});

test('automatic voice transcription leaves the provider free to detect spoken language', async () => {
  const result = await transcribe({ key: 'test-key', bytes: new Uint8Array(44), language: 'en', languageMode: 'auto', fetcher: async (_url, options) => {
    assert.equal(options.body.has('language'), false);
    return Response.json({ text: 'ایجس ون کیسے انسٹال کریں؟' });
  } });
  assert.equal(result.language, 'ur');
});

test('automatic language instructions fit the conservative free-tier request budget', () => {
  const prompt = buildPrompt('How can I integrate AegisOne?', 'en', context, [], 'auto');
  const reserved = reserveTokenCount(prompt.messages, answerSchema(prompt.sourceIds, 'en', context, 'auto'));
  assert.ok(reserved <= 6400, `reserved ${reserved} tokens exceeds the configured free-tier minute budget`);
});

test('reported integration conversation fits the budget as progress and platform accumulate', () => {
  const history = [];
  for (const message of ['how i can integrate aegione ?', 'how i can setup ?', 'I already registered', 'Windows 11', 'make it simpler']) {
    const prompt = buildPrompt(message, 'en', context, history, 'auto');
    assert.equal(prompt.scope, 'project');
    const reserved = reserveTokenCount(prompt.messages, answerSchema(prompt.sourceIds, 'en', context, 'auto'));
    assert.ok(reserved <= 6400, `${message}: ${reserved} exceeds the configured minute budget`);
    history.push({ message });
  }
});

test('portal screenshot questions fit the request budget with current status and a prior user turn', () => {
  const portal = { surface: 'deployment_portal', section: 'deployment', os: 'windows', readiness: 'ready', fieldStatus: { server_address: true } };
  const questions = ['tell in this page what i have to do ?', 'what is launch setup engine how it helps mn ?'];
  for (const message of questions) {
    const prompt = buildPrompt(message, 'en', portal, [{ message: questions[0] }], 'auto');
    assert.equal(prompt.scope, 'project');
    const reserved = reserveTokenCount(prompt.messages, answerSchema(prompt.sourceIds, 'en', portal, 'auto'));
    assert.ok(reserved <= 6400, `portal reserved ${reserved} tokens exceeds the request budget`);
  }
});
