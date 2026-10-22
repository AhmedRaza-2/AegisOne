import test from 'node:test';
import assert from 'node:assert/strict';
import { inferLanguage } from '../src/language.ts';
import type { Language } from '../src/contracts.ts';
// Both runtimes ship independently; keep their offline hints identical.
// @ts-expect-error Server module is plain JavaScript.
import { inferLanguage as inferServerLanguage } from '../../../supabase/functions/assistant/language.mjs';

const examples: [string, Language, Language][] = [
  ['How does installation work?', 'ur', 'en'],
  ['What are the pricing plans?', 'ur-Latn', 'en'],
  ['Does AegisOne support Urdu?', 'en', 'en'],
  ['Main features', 'en', 'en'],
  ['کون سا پلان میری ٹیم کے لیے بہتر ہے؟', 'en', 'ur'],
  ['AegisOne kya hai?', 'en', 'ur-Latn'],
  ['Installation kaise hoti hai?', 'en', 'ur-Latn'],
  ['Meri team ke liye konsa plan theek hai?', 'en', 'ur-Latn'],
  ['Mujhe SMTP configuration samjhao please', 'en', 'ur-Latn'],
  ['Salam AegisOne', 'en', 'ur-Latn'],
  ['Please reply in English', 'ur', 'en'],
  ['Please explain AegisOne in Urdu.', 'en', 'ur'],
  ['Answer in Roman Urdu please', 'ur', 'ur-Latn'],
  ['Urdu mein jawab batao', 'en', 'ur'],
  ['English please', 'ur-Latn', 'en'],
  ['اردو میں جواب دیں', 'en', 'ur'],
  ['رومن اردو میں بتائیں', 'en', 'ur-Latn'],
  ['انگریزی میں جواب دیں', 'ur', 'en'],
  ['200 employees', 'ur', 'ur'],
  ['Okay', 'ur-Latn', 'ur-Latn'],
  ['SMTP', 'ur', 'ur'],
  ['👍', 'ur-Latn', 'ur-Latn'],
  ['', 'en', 'en'],
];

test('automatic offline language hints recognize script, Roman Urdu, language requests and ambiguous follow-ups', () => {
  for (const [text, previous, expected] of examples) assert.equal(inferLanguage(text, previous), expected, text);
  assert.equal(inferLanguage('200 employees'), 'en');
});

test('browser and deployed gateway language hints have the same behavior', () => {
  for (const [text, previous] of examples) assert.equal(inferLanguage(text, previous), inferServerLanguage(text, previous), text);
});
