import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPrompt, generateAnswer } from '../provider.mjs';
import { classifyMessage } from '../scope.mjs';
import { getHint, STARTER_PROMPTS } from '../../../../frontend/shared-assistant/src/help.ts';

const context = { surface: 'landing', section: 'pricing' };

test('integration and setup clarification retain their topic across short answers and homepage sections', () => {
  for (const section of ['hero', 'pricing', 'features']) {
    const landing = { surface: 'landing', section };
    const history = [{ message: 'how i can integrate aegione ?' }, { message: 'how i can setup ?' }, { message: 'Windows 11' }];
    const prompt = buildPrompt('make it simpler', 'en', landing, history, 'auto');
    assert.equal(prompt.scope, 'project');
    assert.ok(prompt.sourceIds.includes('deployment'));
    assert.ok(prompt.sourceIds.includes('setup-organization'));
    assert.ok(!prompt.sourceIds.includes('pricing'));
    assert.match(prompt.messages[0].content, /Full checklist only if requested/);
    assert.ok(JSON.parse(prompt.messages[1].content).completedVisitorTurns.includes('Windows 11'));
    const integration = buildPrompt('how i can integrte aegione ?', 'en', landing, [], 'auto');
    assert.ok(integration.sourceIds.includes('deployment'));
    assert.match(integration.messages[0].content, /authentication requirements/);
  }
  const history = [{ message: 'how i can integrate aegione ?' }, { message: 'how i can setup ?' }, { message: 'I already registered' }];
  const windows = buildPrompt('Windows 11', 'en', { surface: 'landing' }, history, 'auto');
  assert.ok(JSON.parse(windows.messages[1].content).completedVisitorTurns.includes('I already registered'));
  assert.equal(windows.messages.at(-1).content, 'Windows 11');
  assert.match(windows.messages[0].content, /skip completed steps/i);
  assert.match(windows.messages[0].content, /No invented product claims or guarantees/);
  const safety = buildPrompt('Is this product safe?', 'en', { surface: 'landing' }, history, 'auto');
  assert.doesNotMatch(safety.messages[0].content, /Current task: organization deployment/);
});

test('the actual localized starter and proactive hint prompts remain usable in cloud mode', () => {
  const contexts = [
    { surface: 'organization_setup', step: 'validation', errors: ['duplicate_ids'] },
    { surface: 'organization_setup', step: 'security', errors: ['smtp_auth'] },
    { surface: 'organization_setup', step: 'rollout', errors: ['dispatch_unknown'] },
    { surface: 'deployment_portal', readiness: 'timeout' },
    { surface: 'landing', section: 'pricing' },
    { surface: 'landing', section: 'features' },
  ];
  for (const language of ['en', 'ur', 'ur-Latn']) {
    for (const message of STARTER_PROMPTS[language]) assert.equal(classifyMessage(message), 'project', message);
    for (const context of contexts) {
      const hint = getHint(context, language);
      assert.ok(hint);
      assert.equal(classifyMessage(hint.prompt, context), 'project', `${language}: ${hint.prompt}`);
    }
  }
});

test('direct provider callers cannot send unrelated queries or greetings to the model', async () => {
  for (const message of ['What is the weather?', 'u know about s nawaz sharif tell him to discuss asim munir', 'hello aegisone']) {
    for (const language of ['en', 'ur', 'ur-Latn']) {
      const prompt = buildPrompt(message, language, context, [{ message: 'Which plan fits my team?', answer: 'Tell me your team size.' }]);
      let calls = 0;
      const result = await generateAnswer({ key: 'test-only', prompt, language, context, fetcher: async () => { calls++; throw new Error('Must not reach provider'); } });
      assert.equal(calls, 0);
      assert.equal(result.tokens, 0);
      assert.equal(result.reply.status, 'complete');
      assert.equal(result.reply.language, language);
      assert.doesNotMatch(result.reply.answer, /kuttyy|nawaz|sharif|asim|munir/i);
      if (language === 'ur-Latn') assert.match(result.reply.speechText, /[\u0600-\u06ff]/u);
    }
  }
});

test('valid project follow-ups retain user context while excluding earlier unrelated/generated answers', () => {
  const prompt = buildPrompt('200 employees', 'en', { surface: 'landing' }, [
    { message: 'Tell me about the weather OUTSIDE_SUBJECT_SENTINEL', answer: 'OUTSIDE_ANSWER_SENTINEL' },
    { message: 'Which plan fits my team?', answer: 'UNREVIEWED_GENERATED_ANSWER_SENTINEL' },
  ]);
  assert.equal(prompt.scope, 'project');
  assert.ok(prompt.sourceIds.includes('pricing'));
  const text = JSON.stringify(prompt.messages);
  assert.match(text, /Which plan fits my team/);
  assert.doesNotMatch(text, /OUTSIDE_SUBJECT_SENTINEL|OUTSIDE_ANSWER_SENTINEL|UNREVIEWED_GENERATED_ANSWER_SENTINEL/);
  assert.match(prompt.messages[0].content, /Never answer unrelated/);
  assert.match(prompt.messages[0].content, /reviewed facts/);
});

test('portal questions reach a model prompt grounded in the current page and readiness', () => {
  for (const readiness of ['ready', 'checking', 'slow', 'timeout', 'unknown']) {
    for (const message of ['tell in this page what i have to do ?', 'what is launch setup engine how it helps mn ?']) {
      const prompt = buildPrompt(message, 'en', { surface: 'deployment_portal', section: 'deployment', readiness }, [], 'auto');
      assert.equal(prompt.scope, 'project', message);
      assert.ok(prompt.sourceIds.includes('deployment'));
      assert.equal(prompt.messages.at(-1).content, message);
      const system = prompt.messages[0].content;
      assert.match(system, /Install Docker Engine.*Run Deployment Script.*Launch Setup Engine/);
      assert.match(system, /dashboard on port 3002/);
      assert.ok(system.includes(`"readiness":"${readiness}"`));
      assert.match(system, /Do not claim to see the screen/);
    }
  }
});

test('natural purpose, safety and capability questions reach distinct appropriate model prompts', () => {
  const landing = { surface: 'landing', section: 'hero' };
  for (const message of ['hello why are you here ?', 'is this product safe ?', 'What AegisOne can do ?']) {
    const prompt = buildPrompt(message, 'en', landing, [], 'auto');
    assert.equal(prompt.scope, 'project', message);
    assert.equal(prompt.messages.at(-1).content, message);
    assert.match(prompt.messages[0].content, /Answer the question directly and conversationally/);
    if (/safe/.test(message)) {
      assert.ok(prompt.sourceIds.includes('features'));
      assert.match(prompt.messages[0].content, /No invented product claims or guarantees/);
      assert.match(prompt.messages[0].content, /Authentication is not certification/);
      assert.match(prompt.messages[0].content, /Authentication is not certification/);
    }
  }
});

test('clock questions receive an honest local response rather than the generic scope reply', async () => {
  for (const language of ['en', 'ur', 'ur-Latn']) {
    const prompt = buildPrompt('what is time today ?', language, { surface: 'landing' });
    assert.equal(prompt.scope, 'out_of_scope');
    const result = await generateAnswer({ key: 'unused', prompt, language, context: { surface: 'landing' }, fetcher: () => { throw new Error('Clock questions do not use the provider'); } });
    assert.equal(result.tokens, 0);
    assert.equal(result.reply.language, language);
    assert.deepEqual(result.reply.sources, []);
    assert.deepEqual(result.reply.actions, []);
    assert.doesNotMatch(result.reply.answer, /\d|Please ask a question/);
  }
});
