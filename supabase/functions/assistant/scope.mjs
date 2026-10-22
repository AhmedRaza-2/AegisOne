// Server-side routing only. Page status identifies exact current-step requests;
// it never grants scope to arbitrary text. Assistant answers grant no topic scope.
const BRAND = /aegis[\s-]*one(?:['’]s)?|ایجس[\s-]*ون|ایگیس[\s-]*ون/giu;
const TOPIC = /\b(?:features?|capabilit\w*|limitations?|guarantees?|accurac\w*|phishing|detect\w*|scans?|scanning|urls?|emails?|smtp|csv|tls|ssl|privacy|retention|encrypt\w*|complian\w*|residency|plans?|pricing|prices?|costs?|billing|subscriptions?|licenses?|licences?|starter|growth|enterprise|deploy\w*|install\w*|setup|configur\w*|docker|integrat\w*|connect\w*|api|webhooks?|saml|sso|oauth|rollout|validation|duplicates?|departments?|dashboards?|browsers?|extension|model\w*|learning|training|threat\w*|incidents?|reports?|documentation|contact|onboarding|passwords?|tokens?|organization|organisation|server|ports?|regist\w*|approval|found\w*|launch\w*|release\w*|creator|xai|sign in|log in|login|qeemat|qimat|kimat|salana|mahana|kharcha|idara|idare|tanzeem|mehfooz|hifazat|jor\w*)\b|(?:فشنگ|شناخت|سکین|اسکین|رازداری|نجی|ڈیٹا|قیمت|منصوب|پلان|تعیناتی|تنصیب|انسٹال|انضمام|انٹیگری|کنیکٹ|منسلک|سیٹ\s*اپ|ایس\s*ایم\s*ٹی\s*پی|سی\s*ایس\s*وی|سرور|ادار|کمپنی|شعب|ملازمین|ڈیشبورڈ|ماڈل|تربیت|پاس\s*ورڈ|خصوصیات|صلاحیت|حدود|ضمانت|درستگی|بانی|قائم|لانچ|ریلیز|رابطہ|دستاویزات)/iu;
const PRICING = /\b(?:plans?|pricing|prices?|costs?|bill\w*|subscriptions?|employees?|staff|seats?|starter|growth|enterprise|qeemat|qimat|kimat|salana|mahana|kharcha)\b|قیمت|منصوب|پلان|ملازمین|سالانہ|ماہانہ/iu;
const OVERRIDE = /\b(?:act|behave|serve)\s+(?:as|like)\b|\b(?:pretend|roleplay|jailbreak)\b|\b(?:ignore|disregard|override|bypass|forget)\b[^.!?\n]{0,100}\b(?:instructions?|rules?|prompts?|polic\w*|scope|restrictions?|previous|above|earlier|system|everything|all)\b|\b(?:system|developer|hidden)\s+(?:prompts?|messages?|instructions?)\b|\b(?:you are|become|switch to)\b[^.!?\n]{0,60}\b(?:general|unrestricted|assistant|teacher|comedian)\b|\b(?:answer|discuss|talk|help)\b[^.!?\n]{0,60}\b(?:anything|everything|any topic|off.topic|outside.*scope)\b|(?:نظر\s*انداز|بھول\s*جاؤ|ہدایات\s*بدل|کردار\s*ادا)|\b(?:hidayat|instructions|rules)\b.{0,30}\b(?:bhool|badal|ignore)\b/iu;
const CODE_REQUEST = /\b(?:write|generate|create|implement|build|develop|program)\b[^.!?\n]{0,100}\b(?:code|script|function|program|website|app|sql|python|javascript|typescript|html|css)\b|\b(?:code|script|program|python|javascript|sql)\b.{0,50}\b(?:likh|likho|likhna|banao|banayein|banado)\b|(?:کوڈ|اسکرپٹ|پروگرام).{0,50}(?:لکھ|بناؤ|بنائیں)/iu;
const TEAM_SIZE = /^(?:(?:we have|i have|for|about|around|hamare|hamaray|mere|hamari|ہمارے|میرے) )?\d{1,7}(?: (?:employees|members|users|people|staff|seats|log|afrad|mulazim|mulazmeen|mulazimeen|ملازم|ملازمین|افراد|لوگ))?$/u;
const BILLING_PERIOD = /^(?:(?:and|what about|how about|aur|اور) )?(?:yearly|annual|annually|monthly|per year|per month|salana|mahana|سالانہ|ماہانہ)(?: (?:pricing|price|cost|plan|qeemat|قیمت))?$/u;

// Obvious unrelated requests can be handled locally. Vocabulary is deliberately
// open: unfamiliar technical terms and misspellings are not grounds to reject
// a product question. The advisor interprets intent using reviewed facts.
const OUTSIDE_SUBJECT = /\b(?:weather|politic\w*|president|prime minister|capital (?:of|city)|cricket|football|galax\w*|recipe|biryani|jokes?|quantum physics|stock trading|bitcoin|slang|nawaz sharif|asim munir|mausam|siyasat|rizz|skibidi|gyat)\b|\b(?:current|local) (?:time|date)\b|\b(?:time|date) (?:today|now)\b|\bwhat time\b|\b(?:learn\w*|teach\w*) (?:python|javascript|programming)\b|سیاست|موسم|دارالحکومت|وزیر اعظم|سیاسی خبریں/iu;

// Support questions often omit the product name or split the topic over several
// clauses. Recognize procedural language without granting scope to new subjects.
const GUIDANCE_WORDS = new Set(`
a an the this that it its here there your yours our we us i me my you
what which when where why how is are was were be been being am do does did
can could would should will may might must have has had get got getting need want
tell explain describe show help about for with without to from in on at by of as
and or but also then than if so because please not no yes only all any some more
still just already now next first last new before after through each other
use uses using take taking thing things technical nontechnical
give giving simple terms information info details small large follow following
full whole entire overview scratch over
start starts started starting begin begins beginning beginner beginners proceed
step steps order process walkthrough walk guide guidance instructions checklist
prerequisite prerequisites requirement requirements basic basics ready preparation
prepare prepared preparing finish finished finishing done complete completed
stuck confused lost unsure trying tried try understand know simple simpler words
again exactly really totally actually setting up product
page pages screen screens portal current check checking click clicks clicking press pressing button buttons
kya kia ka ki ke ko se mein main mai par pe aur ya kaise kaisay kese kahan
mujhe mujhay ham hum humein aap ap mera meri mere apna apni apne hai hain ho yeh ye is iss
kar karein karen karna karni karne karun karoon karo kr krna chahiye chahie
pehle pahle pehla pehli shuru shuroo shroo shuruat shuruaat agla agli aglay qadam kahan krun
batao batayein bataiye samjhao samjhayein madad rehnumai liye lie lye ab phir
یہ اس میں سے پر اور یا کیا کیسے کہاں مجھے ہمیں آپ ہم ہے ہیں ہو کریں کرنا کروں
پہلے پہلا پہلی شروع شروعات ابتدا اگلا اگلی قدم مرحلہ مراحل بتائیں سمجھائیں
مدد رہنمائی چاہیے لیے اب پھر ترتیب تیاری ضروری ضرورت
صفحہ اسکرین سکرین پورٹل
`.trim().split(/\s+/u));
const SUPPORT_TYPOS = Object.freeze({
  shoul: 'should', shoud: 'should', shud: 'should', wher: 'where', whre: 'where',
  frist: 'first', frst: 'first', strt: 'start', begining: 'beginning', beggining: 'beginning',
  setp: 'setup', setuo: 'setup', setpu: 'setup', instalation: 'installation', installtion: 'installation',
  configration: 'configuration', configuraton: 'configuration', plz: 'please', pls: 'please',
  u: 'you', im: 'i am', dont: 'do not', idk: 'i do not know', prereq: 'prerequisites',
  mn: 'mein', abt: 'about', wht: 'what', wat: 'what', hw: 'how', thsi: 'this',
  paeg: 'page', scren: 'screen', buton: 'button',
  capabilites: 'capabilities', capabilitys: 'capabilities', feautres: 'features', featurs: 'features',
  safty: 'safety', securty: 'security', trustwothy: 'trustworthy', assitant: 'assistant',
  aegione: 'aegisone', aegison: 'aegisone', aegis: 'aegisone', ageisone: 'aegisone', aegisne: 'aegisone', aegisonne: 'aegisone',
  integrte: 'integrate', intergrate: 'integrate', intergration: 'integration', intregrate: 'integrate',
  conect: 'connect', connet: 'connect', instll: 'install', instaling: 'installing',
  organisation: 'organization', organisations: 'organizations', comapny: 'company', compnay: 'company',
});

export function normalizeQuestion(message) {
  return String(message ?? '').normalize('NFKC').toLowerCase()
    .replace(/[\u064b-\u065f\u0670\u200c\u200d]/gu, '')
    .replace(/[يى]/gu, 'ی').replace(/ك/gu, 'ک')
    .replace(/[\u0660-\u0669\u06f0-\u06f9]/gu, digit => String(digit.charCodeAt(0) % 16))
    .replace(/[’']/gu, "'").replace(/\bwhat's\b/gu, 'what is').replace(/\bhow's\b/gu, 'how is')
    .replace(/\bcan't\b/gu, 'cannot').replace(/\bdon't\b/gu, 'do not').replace(/\bit's\b/gu, 'it is')
    .replace(/\bi'm\b/gu, 'i am')
    .replace(/\byou're\b/gu, 'you are').replace(/\bisn't\b/gu, 'is not').replace(/\baren't\b/gu, 'are not')
    .replace(/\bdoesn't\b/gu, 'does not').replace(/\bwon't\b/gu, 'will not').replace(/\bshouldn't\b/gu, 'should not')
    .replace(/\b(product|company|organization|team|user)'s\b/gu, '$1')
    .replace(/\baegis[\s-]+one\b/gu, 'aegisone')
    // Visitors refer to the product without knowing its name. Resolve these
    // references for intent recognition, including in an empty session.
    .replace(/\b(this|that|the|your) (?:(?:security|phishing(?: protection)?) )?(?:software|solution|application|platform|system|tool|service|app)\b/gu, '$1 product')
    .replace(/\b[a-z]+\b/gu, word => Object.hasOwn(SUPPORT_TYPOS, word) ? SUPPORT_TYPOS[word] : word)
    .replace(/\s+/gu, ' ').trim();
}
export function isPrerequisitesQuestion(message) {
  const q = normalizeQuestion(message);
  if (/\b(?:smtp|csv|password|api authentication)\b/u.test(q) && !/\b(?:deploy\w*|install\w*|server|hardware)\b/u.test(q)) return false;
  return /\b(?:prerequisites?|requirements?|resources?|hardware|ram|cpu|gpu|memory|disk|bandwidth|specifications?|specs|laptop|vm|virtual machine)\b|\b(?:tools?|software|equipment|machine|accounts?)\b.*\b(?:need|required|prepare)\b|\b(?:need|require|prepare)\b.*\b(?:tools?|equipment|machine|accounts?|before (?:setup|installation))\b|کیا.*(?:ضروری|ضرورت|درکار)|\b(?:kya|konse|kaunse)\b.*\b(?:chahiye|darkar|zaroori)\b/u.test(q);
}

const normalized = normalizeQuestion;
function withoutBrand(text) { return text.replace(BRAND, ' product '); }
function plain(text) { return text.replace(/[^\p{L}\p{N}'-]+/gu, ' ').replace(/\s+/gu, ' ').trim(); }
function greeting(text) {
  const words = plain(withoutBrand(text)).replace(/\bproduct\b/gu, '').replace(/\s+/gu, ' ').trim();
  return /^(?:(?:hi|hello|hey|hey there|hello there|good morning|good afternoon|good evening|salam|salaam|assalam[ -]?o?[ -]?alaikum|assalamu alaikum|as[ -]?salam[ -]?alaikum|aoa|السلام علیکم|اسلام علیکم|سلام|ہیلو|ہیلو جی)(?:\s+(?:there|ji|jee|جی))?)$/u.test(words);
}

// Permit a named connector as the target of a bounded integration question, not
// as a free subject introduced by a brand name. Every other clause is checked.
function connectorQuestion(clause) {
  const match = clause.match(/^(?:(?:does|can|could|will|would)\s+(?:product|it|this product)\s+(?:support|integrate with|connect to|connect with|work with)|(?:is|are)\s+(?:there|product)\s+(?:an?\s+)?(?:integration|connector)\s+(?:with|for))\s+([\p{L}\p{N}][\p{L}\p{N} .'-]{0,70})$/u);
  if (!match) return false;
  const target = match[1].split(/\s+/u);
  return target.length <= 5 && !target.some(word => /^(?:who|what|when|where|why|how|tell|explain|discuss|write|ignore|act|pretend|also|please)$/u.test(word));
}
function ownershipQuestion(text) {
  // Ownership is an unknown product fact, not permission for a general query
  // about other companies or people. Require the explicit product reference.
  return /^(?:who owns (?:this |your |the )?product|who is (?:the )?owner of (?:this |your |the )?product|who is (?:this |your |the )?product owner|what is (?:the )?ownership of (?:this |your |the )?product|product (?:ka|ke) (?:malik|maalik) (?:kaun|kon) (?:hai|hain)|product کا مالک کون (?:ہے|ہیں))$/u.test(text);
}
function currentStepRequest(text, context) {
  if (!['landing', 'deployment_portal', 'organization_setup'].includes(context?.surface)) return false;
  if (OVERRIDE.test(text) || CODE_REQUEST.test(text)) return false;
  // Exact UI guide/hint requests work in a fresh session. Adding another topic
  // cannot inherit this exception merely because a setup page is open.
  const value = plain(text);
  if (/^(?:explain this step(?: and what i should check next)?|what should i check next|help with this step|یہ مرحلہ سمجھائیں(?: اور بتائیں کہ آگے کیا چیک کروں)?|(?:yeh|ye) step (?:samjhayein|samjhayen|samjhao)(?: aur batayein ab kya check karoon)?)$/u.test(value)) return true;
  // A bounded procedural question may point at the current UI without naming
  // AegisOne. Every word still has to describe guidance, not a new subject.
  const tokens = value.match(/[\p{L}\p{N}]+/gu) || [];
  return tokens.length > 0 && tokens.every(token => GUIDANCE_WORDS.has(token))
    && /\b(?:page|screen|portal|(?:this|current|the) step)\b|(?:صفحہ|اسکرین|سکرین)/u.test(value)
    && /\b(?:what|how|why|tell|explain|describe|show|help|guide|guidance|instructions|checklist|walkthrough|stuck|confused|lost|unsure|next|kya|kaise|batao|batayein|samjhao|samjhayein)\b|(?:کیا|کیسے|بتائیں|سمجھائیں|مدد|رہنمائی)/u.test(value);
}
function languageRequest(text) {
  // Only a bounded presentation preference, never a new subject or command.
  return /^(?:(?:please )?(?:reply|respond|answer|explain|write|speak|continue|switch)(?: (?:this|it|that|to me))? (?:in|to|using) )?(?:english|urdu|roman urdu)(?: please)?$/u.test(plain(text))
    || /^(?:english|urdu|roman urdu) (?:mein|me|mai)(?: (?:jawab|batao|batayein|samjhao|likhein|likho))?$/u.test(plain(text))
    || /^(?:رومن اردو|اردو|انگریزی|انگلش) میں(?: (?:جواب|بتائیں|سمجھائیں|لکھیں|بات کریں))?$/u.test(plain(text));
}
function guidanceClause(clause) {
  const text = plain(clause);
  const tokens = text.match(/[\p{L}\p{N}]+/gu) || [];
  if (!tokens.length || tokens.some(token => !GUIDANCE_WORDS.has(token))) return false;
  if (/\b(?:page|screen|portal)\b|(?:صفحہ|اسکرین|سکرین)/u.test(text)) return false;
  return /\b(?:start|starts|started|starting|begin|begins|beginning|proceed|first|next|before|prerequisites?|requirements?|checklist|walkthrough|step[ -]by[ -]step|walk me through|what to do|should i do|need to do|have to do|stuck|confused|lost|unsure|shuru|shuroo|shroo|shuruat|shuruaat|pehle|pahle|agla|qadam)\b|(?:شروع|شروعات|ابتدا|پہلے|اگلا|قدم)/u.test(text);
}
function relatedExplanationClause(clause) {
  return /^(?:(?:how|why) (?:(?:does|do|can|could|will|would) )?(?:it|this|that|this button|the button|this engine|the engine) (?:work|works|help|helps|benefit|benefits)(?: (?:me|us|mein|my organization|our organization))?|what (?:does|will|can) (?:it|this|that|this button|the button|this engine|the engine) do|(?:safe|secure|reliable|trustworthy|useful|helpful|effective)(?: (?:enough )?to use| for (?:my|our) (?:company|organization|team))?)$/u.test(plain(clause));
}
function productSupportQuestion(text, context = {}) {
  // Accept ordinary support grammar without requiring a particular word order.
  // Match the subject and question, allowing open-ended technical descriptions.
  const value = text.replace(/\b(?:please|really|actually|basically|exactly|honestly|currently|generally|overall|simply|just|even|kindly|very)\b/gu, ' ')
    .replace(/\s+/gu, ' ').trim()
    .replace(/^(?:(?:can|could|would|will) you )?(?:tell|show|explain|describe)(?: me)? (?:about )?/u, '');
  const impliedProduct = ['landing', 'deployment_portal', 'organization_setup'].includes(context?.surface) ? '|this|that|it|they' : '';
  const product = `(?:product|you${impliedProduct}|(?:this|that|the|your|our|these|those) (?:products?|projects?|platforms?|tools?|apps?|services?|systems?|assistants?))`;
  const data = '(?:(?:(?:my|our|user|organization|company) )?data)';
  const action = '(?:do|does|work|works|offer|offers|provide|provides|help|helps|assist|assists|support|supports|protect|protects|secure|secures|detect|detects|stop|stops|block|blocks|prevent|prevents|handle|keep|keeps|store|stores|share|shares|sell|sells)';
  const quality = '(?:safe|secure|protected|trusted|trustworthy|reliable|useful|helpful|effective|private|good|credible|legitimate|a scam|worth using)';
  const tail = '(?: .*)?';
  // A second question without punctuation still needs its own scope check.
  const extraQuestion = /\b(?:what (?:is|are|time)|who (?:is|are)|tell me about)\b/u;
  const patterns = [
    // The predicate can contain a new technical term; let the grounded advisor
    // interpret it instead of requiring a predefined list of verbs/adjectives.
    `(?:can|could|will|would|does|do|is|are|should|has|have) ${product} (?!(?:button|engine|page|screen)\\b).+`,
    `(?:what|how|why|when|where) (?:can|could|will|would|does|do|is|are|should) ${product} (?!(?:button|engine|page|screen)\\b).+`,
    `(?:how (?:can|do|should)|can|could|should) (?:i|we) .+ (?:product|this product${impliedProduct})(?: .*)?`,
    `(?:what|how) (?:(?:can|could|will|would|does|do|should) ${product}|${product} (?:can|could|will|would|does|do)) (?:not )?${action}${tail}`,
    `what ${product} (?:does|offers|provides|detects|protects)${tail}`,
    `(?:can|could|will|would|does|do|should) (?:not )?${product} (?:not )?${action}${tail}`,
    `(?:is|are) (?:not )?(?:${product}|${data}) (?:not )?${quality}${tail}`,
    `${product} (?:is|are) (?:not )?${quality}${tail}`,
    `how ${quality} (?:is|are) (?:${product}|${data})${tail}`,
    `how ${quality} (?:${product}|${data}) (?:is|are)${tail}`,
    `(?:why|how) (?:can|could|will|would|should|do) (?:not )?(?:i|we) (?:not )?(?:use|choose|trust|rely on|benefit from) ${product}${tail}`,
    `(?:can|could|should|may) (?:i|we) (?:not )?(?:trust|rely on|use) ${product}${tail}`,
    `why (?:use|choose|trust) ${product}${tail}`,
    `what (?:is|are) ${product} (?:for|useful for|good for|meant for|designed for)`,
    `what (?:is|are) (?:your|its|this (?:product|assistant)) (?:purpose|role|job|benefits?|advantages?|usefulness)`,
    `what (?:is|are) (?:the )?(?:benefits?|advantages?|purpose|usefulness|safety|security|reliability) (?:of|for) (?:using )?${product}`,
    `(?:what (?:is|are) )?${product} (?:security|safety|privacy|reliability|benefits?|advantages?|purpose)`,
    `what (?:happens to|do you do with|does product do with) ${data}`,
    `(?:how|where) (?:is|are) ${data} (?:protected|secured|stored|used)`,
    `where does ${data} go`,
    '(?:why (?:are you|you are|is this assistant) here|what are you here for|who are you)',
    '(?:what are you supposed to do|why (?:are you|is this assistant) on this (?:page|site|website))',
  ];
  return patterns.some(pattern => {
    const match = value.match(new RegExp(`^(?:${pattern})$`, 'u'));
    if (!match) return false;
    // Exclude a later question marker, while allowing the one at the beginning.
    return !extraQuestion.test(value.replace(/^(?:what (?:is|are)|who (?:is|are))\b/u, ''));
  });
}
function projectClause(clause, context = {}) {
  const text = plain(clause).replace(/ (?:in|using) (?:english|urdu|roman urdu)(?: please)?$/u, '');
  if (!text) return false;
  if (connectorQuestion(text)) return true;
  if (ownershipQuestion(text)) return true;
  // Technical names and ordinary descriptions are open-ended. A bounded
  // product-support request can reach the advisor without a word-by-word
  // vocabulary match; the advisor still answers only from reviewed facts.
  if (flexibleSupportRequest(text)) return true;
  if (productSupportQuestion(text, context)) return true;
  if (isPrerequisitesQuestion(text) || /\bbackups?\b/u.test(text)) return true;
  if (TOPIC.test(text) || /\bset(?:ting)? (?:it |this |that |product )?up\b/u.test(text)) return true;
  if (/^how many (?:employees|members|users|people|staff|seats) (?:can|could|may) (?:use|access) (?:it|this|product)$/u.test(text)) return true;
  if (/^how does it work$/u.test(text)) return true;
  // Brand references need an actual product question; a bare name grants nothing.
  return /^(?:(?:hi|hello|hey) )?(?:(?:what|which) (?:is|are) (?:this |the |your )?product|(?:tell|explain|describe|show)(?: me)? (?:about )?(?:this |the |your )?product|(?:what|how) (?:can|does|do) (?:product|you) (?:do|work|help)|(?:product )?(?:kya|kia) (?:hai|karta hai)|(?:یہ |product )?کیا (?:ہے|کرتا ہے))$/u.test(text);
}
function flexibleSupportRequest(text) {
  if (/\b(?:weather|politic\w*|president|prime minister|capital of|cricket|football|galax\w*|recipe|joke|story|quantum|stock trading|bitcoin|slang)\b/u.test(text)) return false;
  if (/\b(?:who is|who are|what is|what are|tell me about|ignore|pretend|discuss)\b/u.test(text.replace(/^(?:what is|what are|tell me about)\b/u, ''))) return false;
  const subject = '(?:product|it|this|that|(?:this|that|the|your) product)';
  const operation = '(?:integrat\\w*|connect|hook up|plug|install|deploy|configure|set up|roll out|start using|use|troubleshoot)';
  return new RegExp(`^(?:(?:please )?(?:how (?:can |do |should |would )?(?:i|we)(?: can|do|should)?|(?:can|could) you (?:help (?:me|us)|show (?:me|us) how to)|(?:i|we) (?:want|need|would like|am trying|are trying) to) |please )?${operation} ${subject}(?: (?:with|to|into|on|for|in|at|across|throughout|using) [\\p{L}\\p{N} '-]{1,90})?$`, 'u').test(text)
    || /^(?:my|our|the) product (?:installation|deployment|integration|connection|login|setup) (?:is |keeps |has |will |does )?[\p{L}\p{N} '-]{1,100}$/u.test(text);
}
function directProject(text, context = {}) {
  if (!text || text.length > 2000 || OVERRIDE.test(text) || CODE_REQUEST.test(text) || OUTSIDE_SUBJECT.test(text) || /```|[{}<>=]|\d\s*[+*/]\s*\d/u.test(text)) return false;
  if (TEAM_SIZE.test(plain(text)) || BILLING_PERIOD.test(plain(text))) return false;
  const replaced = withoutBrand(text).replace(/^(?:hi|hello|hey|salam|salaam|السلام علیکم|سلام)[,.!،\s]+(?:product[,.!،\s]+)?/u, '');
  // Separate independent questions, not noun lists such as "tools and resources".
  const clauses = replaced.split(/[.!?;\n؟؛۔]+|\s+(?:and|also|plus|but|then|aur|اور|پھر)\s+(?=(?:who|what|where|when|why|how|tell|explain|describe|write|ignore)\b)/u).map(value => value.trim()).filter(Boolean);
  const grounded = clause => projectClause(clause, context) || guidanceClause(clause) || currentStepRequest(clause, context);
  return clauses.length > 0 && clauses.some(grounded) && clauses.every(clause => grounded(clause)
    || relatedExplanationClause(clause)
    || greeting(clause)
    || /^(?:please|thanks|thank you)$/u.test(plain(clause))
    || languageRequest(clause)
    || (clauses.some(other => PRICING.test(other) && projectClause(other, context))
      && /^(?:compare )?(?:monthly|yearly|annual|annually|per month|per year)$/u.test(plain(clause))));
}
function followup(text, previous) {
  if (!previous) return false;
  if (languageRequest(text) || relatedExplanationClause(text)) return true;
  const value = plain(text);
  if (/^(?:please )?(?:make (?:it|that|this) (?:shorter|simpler|clearer)|(?:explain|say) (?:it|that|this) (?:simply|in simple (?:words|terms))|(?:shorter|simpler|step by step)(?: please)?|i (?:do not|still do not) understand|that (?:did not|does not) help)$/u.test(value)) return true;
  if (previous.setup && /^(?:(?:i am|we are|i use|we use|using|on|for|with|what about|how about) )?(?:using )?(?:windows(?: 10| 11| server)?|linux|ubuntu|macos|mac|docker|(?:my|our|an?|the) (?:app|application|api|company|organization|server)|api(?: integration)?|browser extension)(?: please)?$/u.test(value)) return true;
  if (previous.setup && /^(?:(?:i|we) (?:have |am |are )?)?(?:already )?(?:registered|installed docker|have docker|finished registration|completed registration)(?: now what| what next)?$/u.test(value)) return true;
  if (/^(?:yes|no|okay|ok|sure|please|continue|go on|explain more|tell me more|more details|what next|what is next|next step|what should i do next|how does that work|why|haan|han|ji|jee|theek|mazeed batao|mazeed samjhao|aur batao|agla qadam|ab kya|phir kya|ہاں|نہیں|جی|ٹھیک|مزید بتائیں|مزید سمجھائیں|اگلا مرحلہ|اب کیا|پھر کیا)$/u.test(value)) return true;
  if (!previous.pricing) return false;
  return TEAM_SIZE.test(value) || BILLING_PERIOD.test(value)
    || /^(?:how much|kitna|kitni qeemat|کتنی قیمت)$/u.test(value);
}

export function classifyMessage(message, context = {}, history = []) {
  if (typeof message !== 'string' || !message.trim() || message.length > 2000) return 'out_of_scope';
  const text = normalized(message);
  if (greeting(text)) return 'greeting';
  if (OVERRIDE.test(text) || CODE_REQUEST.test(text) || OUTSIDE_SUBJECT.test(text)) return 'out_of_scope';
  // Homepage visitors do not need to pass an English/Urdu grammar or topic
  // whitelist. Uncertain wording belongs to the grounded model, which can
  // interpret it or ask a useful clarification. Only clear exclusions above
  // are local; absence of a recognized keyword is never a rejection here.
  if (context.surface === 'landing') return 'project';
  if (directProject(text, context) || currentStepRequest(text, context)) return 'project';
  let previous = null;
  for (const turn of (Array.isArray(history) ? history : []).slice(-4)) {
    const past = normalized(typeof turn?.message === 'string' ? turn.message : '');
    if (directProject(past, context) || currentStepRequest(past, context)) previous = { pricing: PRICING.test(past), setup: /\b(?:integrat\w*|connect\w*|setup|set up|deploy\w*|install\w*|register\w*|docker|api)\b/u.test(past) };
    else if (!followup(past, previous)) previous = null;
  }
  return followup(text, previous) ? 'project' : 'out_of_scope';
}

const TEXTS = Object.freeze({
  en: {
    greeting: 'Hello! I’m AegisOne’s product assistant. I can explain its phishing protection, help compare plans, or guide you through getting started.',
    out_of_scope: 'I’m here for AegisOne product support. I can help with protection, pricing, installation, or troubleshooting.',
    clock: 'For the current local time or date, check your device’s clock. This chat focuses on AegisOne product support.',
  },
  ur: {
    greeting: 'السلام علیکم! میں AegisOne کا پروڈکٹ معاون ہوں۔ فشنگ سے حفاظت سمجھنے، پلان کا موازنہ کرنے یا استعمال شروع کرنے میں مدد کر سکتا ہوں۔',
    out_of_scope: 'یہاں میں AegisOne کے بارے میں مدد کرتا ہوں۔ آپ حفاظت، قیمت، انسٹالیشن یا کسی خرابی کے بارے میں پوچھ سکتے ہیں۔',
    clock: 'موجودہ مقامی وقت یا تاریخ کے لیے اپنے آلے کی گھڑی دیکھیں۔ اس گفتگو میں AegisOne کے بارے میں رہنمائی ملتی ہے۔',
  },
  'ur-Latn': {
    greeting: 'Salam! Main AegisOne ka product assistant hoon. Phishing protection samajhne, plans compare karne ya istemal shuru karne mein madad kar sakta hoon.',
    out_of_scope: 'Yahan main AegisOne ke bare mein madad karta hoon. Protection, pricing, installation ya kisi masle ke bare mein pooch sakte hain.',
    clock: 'Maujooda local waqt ya tareekh ke liye apne device ki ghari dekhein. Is chat mein AegisOne ke bare mein rehnumai milti hai.',
  },
});

const CLOCK_REQUEST = /^(?:(?:please )?(?:what (?:is )?(?:the )?(?:current )?(?:local )?(?:time|date|day)(?: (?:is it|today|now|right now))*|what time is it(?: (?:today|now|right now))?|tell me (?:the )?(?:current )?(?:time|date)|(?:aaj|abhi) (?:ka )?(?:time|waqt|tareekh) (?:kya hai|batao)|(?:آج|ابھی) (?:کا )?(?:وقت|تاریخ) (?:کیا ہے|بتائیں)))$/u;

export function scopeReply(kind, lang, turnId, message = '') {
  const language = Object.hasOwn(TEXTS, lang) ? lang : 'en';
  const key = kind === 'greeting' ? 'greeting' : CLOCK_REQUEST.test(plain(normalized(message))) ? 'clock' : 'out_of_scope';
  return {
    turnId, answer: TEXTS[language][key], speechText: TEXTS[language === 'ur-Latn' ? 'ur' : language][key], language,
    sources: key === 'clock' ? [] : ['overview'],
    actions: key === 'clock' ? [] : [{ type: 'open_documentation', target: 'overview' }], status: 'complete',
  };
}
