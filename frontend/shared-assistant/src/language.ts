import { isLanguage, type Language } from './contracts.ts';

const URDU_LETTERS = /[\u0620-\u064a\u066e-\u06d3\u06fa-\u06ff]/u;
const ROMAN_WORDS = new Set('kya kia kaise kaisay kese kyun kyu mujhe mujhay humein hamen batao batayein bataiye samjhao samjhayein chahiye chahie karun karoon karein karna karta karti karte sakta sakti sakte konsa konsi kitna kitni kitne qeemat qimat kimat kahan kaun nahin nahi nhi rehnumai madad hai hain hoon hun hoga hogi hota hoti tha thi thay mera meri mere apna apni apne aap ham hum aur liye isko iska iski iske yeh woh mein pehle baad salam salaam alaikum assalam assalamu'.split(' '));
const ENGLISH_WORDS = new Set('what which who when where why how can could would should does do is are have has need want explain tell help please installation install pricing plan plans setup work works much more details about with for my our your the this that and or it in english'.split(' '));

/** Offline hint only. Cloud replies choose their language from the conversation. */
export function inferLanguage(text: string, previousLanguage: Language = 'en'): Language {
  const previous = isLanguage(previousLanguage) ? previousLanguage : 'en';
  const value = text.normalize('NFKC').toLowerCase().replace(/[\u064b-\u065f\u0670]/gu, '').trim();
  // A language name in a product question ("Does it support Urdu?") is not a request.
  const request = value.match(/\b(?:reply|respond|answer|explain|write|speak|continue|switch|translate)(?:\s+(?:to me|this|it|that|the answer|the reply))?\s+(?:in|to|using)\s+(roman\s+urdu|urdu|english)\b/u)
    || (/^(?:please\s+)?(?:explain|describe|answer|write|reply|respond)\b/u.test(value) ? value.match(/\bin\s+(roman\s+urdu|urdu|english)(?:\s+please)?[.!?\s]*$/u) : null)
    || value.match(/\b(roman\s+urdu|urdu|english)\s+(?:mein|me|mai)\s+(?:jawab|bata|batayein|samjha|samjhao|likh|likho)/u)
    || value.match(/^(?:please\s+)?(roman\s+urdu|urdu|english)(?:\s+(?:please|mein|me|mai))?[.!?\s]*$/u);
  if (request) return request[1].startsWith('roman') ? 'ur-Latn' : request[1] === 'urdu' ? 'ur' : 'en';
  if (/(?:رومن\s+اردو|اردو|انگریزی|انگلش)\s+میں\s*(?:جواب|بتا|سمجھا|لکھ|بات)|(?:جواب|بتائیں|سمجھائیں|لکھیں)\s+(?:رومن\s+اردو|اردو|انگریزی|انگلش)\s+میں/u.test(value)) {
    if (/رومن\s+اردو/u.test(value)) return 'ur-Latn';
    return /انگریزی|انگلش/u.test(value) ? 'en' : 'ur';
  }
  if (URDU_LETTERS.test(value)) return 'ur';
  const words = value.match(/[a-z]+/gu) || [];
  const roman = words.filter(word => ROMAN_WORDS.has(word)).length;
  const english = words.filter(word => ENGLISH_WORDS.has(word)).length;
  // Discriminative Urdu words still work in mixed messages containing technical English.
  if (roman > 0 && (roman >= english || /\b(?:kya|kaise|kaisay|mujhe|mujhay|batao|samjhao|chahiye|qeemat|nahin|nahi|salam|salaam|alaikum)\b/u.test(value))) return 'ur-Latn';
  if (english >= 2 || /\b(?:how|what|which|why|where|explain|english)\b/u.test(value)) return 'en';
  // Numbers, product names and acknowledgements carry no reliable language signal.
  return previous;
}
