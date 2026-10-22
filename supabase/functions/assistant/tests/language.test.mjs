import test from 'node:test';
import assert from 'node:assert/strict';
import { answerSchema, buildPrompt, generateAnswer } from '../provider.mjs';
import { validateReply } from '../policy.mjs';

const context = { surface: 'landing' };
const base = { answer: 'Use the deployment portal to install AegisOne.', speechText: 'Use the deployment portal.', sources: ['deployment'], actions: [] };

test('English playback rejects Urdu text rather than sending it to an English voice', () => {
  assert.equal(validateReply(base, 'en', context, ['deployment']).language, 'en');
  assert.throws(() => validateReply({ ...base, speechText: 'ڈیپلائمنٹ پورٹل کھولیں۔' }, 'en', context, ['deployment']), error => error.code === 'invalid_answer');
});

test('Urdu and Roman Urdu require Urdu-script playback while preserving visible language', () => {
  const speechText = 'ڈیپلائمنٹ پورٹل کھولیں۔';
  assert.equal(validateReply({ ...base, answer: 'ڈیپلائمنٹ پورٹل کھولیں۔', speechText }, 'ur', context, ['deployment']).language, 'ur');
  assert.equal(validateReply({ ...base, answer: 'Deployment portal kholein.', speechText }, 'ur-Latn', context, ['deployment']).answer, 'Deployment portal kholein.');
  for (const language of ['ur', 'ur-Latn']) {
    assert.throws(() => validateReply({ ...base, answer: language === 'ur' ? speechText : 'Portal kholein.' }, language, context, ['deployment']), error => error.code === 'invalid_answer');
  }
  assert.throws(() => validateReply({ ...base, answer: speechText, speechText }, 'ur-Latn', context, ['deployment']));
});

test('each structured request describes only the current spoken language', async () => {
  for (const language of ['en', 'ur', 'ur-Latn']) {
    const schema = answerSchema(['deployment'], language).json_schema.schema;
    assert.match(schema.properties.speechText.description, language === 'en' ? /English only/ : /Urdu written in Urdu script/);
    const prompt = buildPrompt('How do I install it?', language, context);
    const reply = { ...base, answer: language === 'ur' ? 'ڈیپلائمنٹ پورٹل کھولیں۔' : language === 'ur-Latn' ? 'Deployment portal kholein.' : base.answer, speechText: language === 'en' ? base.speechText : 'ڈیپلائمنٹ پورٹل کھولیں۔' };
    const result = await generateAnswer({ key: 'test-key', language, context, prompt, fetcher: async (_url, options) => {
      const sent = JSON.parse(options.body);
      assert.deepEqual(sent.response_format, answerSchema(prompt.sourceIds, language, context));
      return Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(reply) } }], usage: { total_tokens: 100 } });
    } });
    assert.equal(result.reply.language, language);
  }
});

test('a short team-size follow-up retains the reviewed plan facts', () => {
  const prompt = buildPrompt('200 employees', 'en', context, [{ message: 'Which plan fits my team?', answer: 'How many employees do you have?' }]);
  assert.ok(prompt.sourceIds.includes('pricing'));
  assert.match(prompt.messages[0].content, /Growth Defense/);
});

test('a new launch-date question keeps reviewed unknowns without anchoring deployment history', () => {
  const prompt = buildPrompt('when aegisone launched ?', 'en', context, [{ message: 'how i can integrate it ?', answer: 'Use the portal and Docker.' }]);
  assert.ok(prompt.sourceIds.includes('limitations'));
  assert.match(prompt.messages[0].content, /No verified public launch date/);
  assert.match(prompt.messages[0].content, /Version numbers and repository activity do not establish a launch date/);
  assert.doesNotMatch(prompt.messages[0].content, /API integration: installed FastAPI|Current task: organization deployment only/);
});
