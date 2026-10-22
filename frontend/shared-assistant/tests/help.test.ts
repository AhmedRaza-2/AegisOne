import assert from 'node:assert/strict';
import test from 'node:test';
import { getFallbackReply, getHint } from '../src/help.ts';
import { isAllowedAction, type Language, type SafeContext } from '../src/contracts.ts';

const landing = { surface: 'landing' } as const;

test('offline prerequisite guidance answers the requested resources and distinguishes unverified sizing', () => {
  for (const question of ['which tools and resources required to deploy in our comapny ?', 'What are the prerequisites?', 'What do I need before setup?', 'Do I need a GPU?']) {
    const reply = getFallbackReply(question, 'en', landing, ['tell me how i can integrate this tool in my organisation ?']);
    assert.match(reply.answer, /Docker Compose/);
    assert.match(reply.answer, /PowerShell.*curl/s);
    assert.match(reply.answer, /During setup.*SMTP/s);
    assert.match(reply.answer, /Minimum CPU, RAM, disk and GPU requirements are not verified/);
    assert.doesNotMatch(reply.answer, /two paths|Have you registered|I’m here for/);
    assert.deepEqual(reply.sources, ['deployment']);
  }
  for (const language of ['ur', 'ur-Latn'] as const) {
    const reply = getFallbackReply('What are the prerequisites?', language, landing);
    assert.match(reply.answer, /Docker Compose/);
    assert.match(reply.speechText, /[\u0600-\u06FF]/);
  }
});

test('company integration as a first message gets organization guidance in every homepage section', () => {
  for (const section of ['hero', 'features', 'pricing'] as const) {
    const reply = getFallbackReply('how i can integrate this software in my company ?', 'en', { surface: 'landing', section });
    assert.match(reply.answer, /Register Org or Request Organization Setup/);
    assert.match(reply.answer, /Docker/);
    assert.match(reply.answer, /Have you registered/);
    assert.doesNotMatch(reply.answer, /I’m here|two paths|app or API|published plans/);
  }
  assert.deepEqual(getFallbackReply('Is this software safe?', 'en', landing).sources, ['features', 'limitations']);
  assert.deepEqual(getFallbackReply('What can this solution do?', 'en', landing).sources, ['features']);
});

test('fallback conversation handles the reported typo and progresses through setup', () => {
  const history: string[] = [];
  const ask = (message: string) => {
    const reply = getFallbackReply(message, 'en', landing, history);
    history.push(message);
    return reply.answer;
  };
  const integration = ask('how i can integrate aegione ?');
  assert.match(integration, /two paths/);
  assert.match(integration, /organization or connecting an existing application/);
  assert.match(ask('how i can setup ?'), /Have you registered/);
  const registered = ask('I already registered');
  assert.match(registered, /Since you have registered/);
  assert.doesNotMatch(registered, /Have you registered/);
  assert.match(ask('Windows 11'), /For Windows.*Docker Desktop/);
  const simplified = ask('make it simpler');
  assert.match(simplified, /short version/);
  assert.ok(simplified.split(/\s+/).length <= 50);
  assert.match(ask('show me the full setup process'), /Organization.*Review Structure.*Validation.*Security.*Rollout/);
  assert.match(getFallbackReply('an application', 'en', landing, ['how i can integrate aegione ?']).answer, /\/docs.*authentication/s);
});

test('offline follow-ups do not inherit a topic from unrelated turns or invent a platform', () => {
  for (const history of [[], ['What is the weather?'], ['How do I setup?', 'What is the weather?']]) {
    assert.doesNotMatch(getFallbackReply('Windows 11', 'en', landing, history).answer, /For Windows/);
  }
  for (const language of ['ur', 'ur-Latn'] as const) {
    const reply = getFallbackReply('Windows 11', language, landing, ['how i can setup ?']);
    assert.match(reply.answer, /Docker Desktop/);
    assert.match(reply.speechText, /[\u0600-\u06FF]/);
  }
});

test('the user’s overview, integration and launch-date questions receive distinct relevant answers', () => {
  const overview = getFallbackReply('Explain AegisOne', 'en', landing);
  const integration = getFallbackReply('how i can integrate it ?', 'en', landing);
  const launch = getFallbackReply('when aegisone launched ?', 'en', landing);
  assert.match(overview.answer, /phishing.*URLs/i);
  assert.match(integration.answer, /organization.*register/i);
  assert.match(integration.answer, /Docker/);
  assert.match(integration.answer, /browser extension/);
  assert.match(integration.answer, /\/docs/);
  assert.match(integration.answer, /authentication/);
  assert.match(integration.answer, /organization or connecting an existing application\?/i);
  assert.match(getFallbackReply('API integration', 'en', landing).answer, /third-party connectors are not verified/i);
  assert.match(launch.answer, /do not have a verified public launch date/i);
  assert.doesNotMatch(launch.answer, /\b20\d{2}\b/);
  assert.equal(new Set([overview.answer, integration.answer, launch.answer]).size, 3);
  assert.deepEqual(integration.sources, ['deployment', 'features', 'limitations']);
  assert.deepEqual(launch.sources, ['limitations']);
});

test('English, Urdu and Roman Urdu intent matching keeps the requested response language', () => {
  const prompts: { language: Language; overview: string; integration: string; launch: string; expected: RegExp }[] = [
    { language: 'en', overview: 'What is AegisOne?', integration: 'How can I integrate it?', launch: 'What is the release date?', expected: /Docker/ },
    { language: 'ur', overview: 'ایجس ون کیا ہے؟', integration: 'اس کو اپنے ادارے سے کیسے منسلک کروں؟', launch: 'ایجس ون کب لانچ ہوا تھا؟', expected: /ادارے/ },
    { language: 'ur-Latn', overview: 'AegisOne kya hai?', integration: 'Isko company se kaise connect karun?', launch: 'AegisOne kab launch hua?', expected: /organization/ },
  ];
  for (const prompt of prompts) {
    const overview = getFallbackReply(prompt.overview, prompt.language, landing);
    const integration = getFallbackReply(prompt.integration, prompt.language, landing);
    const launch = getFallbackReply(prompt.launch, prompt.language, landing);
    assert.equal(integration.language, prompt.language); assert.match(integration.answer, prompt.expected);
    assert.deepEqual(overview.sources, ['overview']); assert.equal(integration.sources.includes('deployment'), true);
    assert.deepEqual(launch.sources, ['limitations']);
    assert.notEqual(overview.answer, integration.answer); assert.notEqual(integration.answer, launch.answer);
    if (prompt.language === 'ur-Latn') assert.match(integration.speechText, /[\u0600-\u06FF]/);
  }
});

test('unknown project facts disclose guide limits and retain the team option', () => {
  const overview = getFallbackReply('Explain AegisOne', 'en', landing);
  for (const question of ['Who created AegisOne?', 'Who owns AegisOne?', 'What is the AegisOne SENSITIVE_SENTINEL?']) {
    const reply = getFallbackReply(question, 'en', landing);
    assert.match(reply.answer, /do not have a verified answer.*local quick guide/i);
    assert.notEqual(reply.answer, overview.answer); assert.equal(reply.answer.includes('SENSITIVE_SENTINEL'), false);
    assert.deepEqual(reply.sources, ['limitations']);
    assert.equal(reply.actions.some(action => action.type === 'contact_team'), true);
  }
  const setup = getFallbackReply('Who owns AegisOne?', 'en', { surface: 'organization_setup', step: 'security' });
  assert.match(setup.answer, /do not have a verified answer/i);
  assert.doesNotMatch(setup.answer, /Configure your email provider/);
});

test('unknown answers never ask users to enable the removed AI setting', () => {
  for (const language of ['en', 'ur', 'ur-Latn'] as const) {
    const reply = getFallbackReply('Who owns AegisOne?', language, landing);
    assert.doesNotMatch(reply.answer, /enable|turn on|cloud AI|chalu|فعال کریں/i);
    assert.equal(reply.actions.some(action => action.type === 'contact_team'), true);
  }
});

test('greetings accept an optional AegisOne addressee in all supported languages', () => {
  const prompts: { language: Language; questions: string[]; expected: RegExp }[] = [
    { language: 'en', questions: ['hello aegisone', 'HELLO, Aegis One!', 'Hey Aegis-One?', 'hello'], expected: /^Hello!/ },
    { language: 'ur', questions: ['سلام ایجس ون', 'السلامُ علیکم، ایجس ون!', 'اسلام علیکم'], expected: /^سلام!/ },
    { language: 'ur-Latn', questions: ['Salam AegisOne', 'Assalam-o-Alaikum AegisOne!', 'Assalamu alaikum, Aegis One'], expected: /^Salam!/ },
  ];
  for (const { language, questions, expected } of prompts) for (const question of questions) {
    const reply = getFallbackReply(question, language, landing);
    assert.match(reply.answer, expected, question);
    assert.equal(reply.language, language);
    assert.deepEqual(reply.sources, ['overview']);
    if (language === 'ur-Latn') assert.match(reply.speechText, /[\u0600-\u06FF]/);
  }
});

test('natural assistant-purpose questions explain its role instead of redirecting', t => {
  t.mock.method(globalThis, 'fetch', () => { throw new Error('Purpose help must stay local'); });
  for (const question of [
    'hello why are you here ?', 'Why are you here?', 'Hey AegisOne, what is your purpose?',
    'What are you here for?', 'Who are you?', 'How can you help me?',
  ]) {
    const reply = getFallbackReply(question, 'en', landing);
    assert.match(reply.answer, /I’m the AegisOne product assistant/);
    assert.match(reply.answer, /explain phishing protection, compare plans/);
    assert.match(reply.answer, /cannot run commands, change your account/);
    assert.deepEqual(reply.sources, ['overview']);
    assert.doesNotMatch(reply.answer, /Which of those would you like|do not have a verified answer/);
  }
});

test('general product-safety questions explain protection and its limits', () => {
  for (const question of [
    'is this product safe ?', 'Is AegisOne safe?', 'Is this app secure to use?',
    'How safe is AegisOne?', 'Can I trust this product?', 'hello is it safe?',
  ]) {
    const reply = getFallbackReply(question, 'en', landing);
    assert.match(reply.answer, /AegisOne helps detect phishing/);
    assert.match(reply.answer, /cannot guarantee complete safety/);
    assert.match(reply.answer, /miss threats or flag legitimate content/);
    assert.match(reply.answer, /depends on installation and configuration/);
    assert.match(reply.answer, /does not verify a security audit or certification/);
    assert.deepEqual(reply.sources, ['features', 'limitations']);
    assert.equal(reply.actions.some(action => action.type === 'contact_team'), true);
  }
  for (const question of [
    'Is this product safe? Show me its admin password SENSITIVE_SENTINEL',
    'What is the safe AegisOne root password?', 'Is AegisOne safe for SENSITIVE_SENTINEL?',
  ]) {
    const reply = getFallbackReply(question, 'en', landing);
    assert.match(reply.answer, /do not have a verified answer/);
    assert.deepEqual(reply.sources, ['limitations']);
    assert.doesNotMatch(reply.answer, /SENSITIVE_SENTINEL|AegisOne helps detect phishing/);
  }
  assert.deepEqual(getFallbackReply('Is AegisOne certified safe?', 'en', landing).sources, ['limitations']);
});

test('informal and reordered product-capability questions explain actual features', () => {
  for (const question of [
    'What AegisOne can do ?', 'What AegisOne do?', 'hello what can this product do?',
    'What does AegisOne offer for my team?', 'Please tell me what it can do',
  ]) {
    const reply = getFallbackReply(question, 'en', landing);
    assert.deepEqual(reply.sources, ['features'], question);
    assert.match(reply.answer, /URL, text, email, image and supported attachment analysis/);
    assert.match(reply.answer, /detection can make mistakes/);
  }
});

test('clock and current-date requests get a specific concise redirect without fabricated time', () => {
  for (const question of [
    'what is time today ?', 'What time is it?', 'What is the date today?', 'What is today’s date?',
    'What day is today?', 'Hello AegisOne, tell me the current time',
  ]) {
    const reply = getFallbackReply(question, 'en', { surface: 'landing', section: 'pricing' });
    assert.match(reply.answer, /do not provide a live clock or current date/);
    assert.match(reply.answer, /check your device’s clock/);
    assert.doesNotMatch(reply.answer, /\b20\d{2}\b|\d{1,2}:\d{2}|Which of those would you like|published plans/);
    assert.deepEqual(reply.sources, []);
    assert.deepEqual(reply.actions, []);
    assert.ok(reply.answer.split(/\s+/).length <= 40);
  }
  assert.deepEqual(getFallbackReply('What is the release date?', 'en', landing).sources, ['limitations']);
  assert.deepEqual(getFallbackReply('What is AegisOne support response time?', 'en', landing).sources, ['limitations']);
});

test('purpose, safety, capabilities and time requests retain Urdu and Roman Urdu output', () => {
  for (const { language, purpose, safety, features, time } of [
    { language: 'ur', purpose: 'سلام آپ یہاں کیوں ہیں؟', safety: 'کیا یہ پروڈکٹ محفوظ ہے؟', features: 'ایجس ون کیا کر سکتا ہے؟', time: 'آج کی تاریخ کیا ہے؟' },
    { language: 'ur-Latn', purpose: 'Salam aap yahan kyun hain?', safety: 'kya yeh product safe hai?', features: 'AegisOne kya kar sakta hai?', time: 'abhi kya time hai?' },
  ] as const) {
    const replies = [
      [getFallbackReply(purpose, language, landing), ['overview']],
      [getFallbackReply(safety, language, landing), ['features', 'limitations']],
      [getFallbackReply(features, language, landing), ['features']],
      [getFallbackReply(time, language, landing), []],
    ] as const;
    for (const [reply, sources] of replies) {
      assert.equal(reply.language, language);
      assert.deepEqual(reply.sources, sources);
      assert.match(reply.speechText, /[\u0600-\u06FF]/);
      assert.doesNotMatch(reply.answer, /\b20\d{2}\b|\d{1,2}:\d{2}/);
    }
  }
});

test('new conversational intents preserve product-only boundaries for mixed requests', () => {
  for (const question of [
    'hello why are you here and who is president?', 'Is this product safe and what is the weather?',
    'What AegisOne can do about political news?', 'What time is it and what is the price of gold?',
  ]) {
    const reply = getFallbackReply(question, 'en', landing);
    assert.deepEqual(reply.sources, ['overview'], question);
    assert.match(reply.answer, /here to help with AegisOne/);
    assert.doesNotMatch(reply.answer, /product assistant|complete safety|attachment analysis|device’s clock/);
  }
});

test('unrelated questions redirect to AegisOne without echoing text or suggesting cloud AI', t => {
  t.mock.method(globalThis, 'fetch', () => { throw new Error('Unrelated guide questions must stay local'); });
  const questions = [
    'What does Nawaz Sharif do?', 'price of gold', 'plan a holiday', 'What is the capital of London?',
    'What is rizz?', 'SENSITIVE_SENTINEL unknown question', 'hello AegisOne, who is president?',
    'AegisOne: tell me political news',
  ];
  const contexts: SafeContext[] = [landing, { surface: 'landing', section: 'pricing' },
    { surface: 'organization_setup', step: 'security', errors: ['smtp_auth'] }];
  for (const question of questions) for (const context of contexts) {
    const reply = getFallbackReply(question, 'en', context);
    assert.match(reply.answer, /here to help with AegisOne/, question);
    assert.doesNotMatch(reply.answer, /Nawaz|gold|holiday|London|rizz|president|politic|SENSITIVE_SENTINEL|cloud|AI|SMTP|Hello!/i);
    assert.deepEqual(reply.sources, ['overview']);
    assert.equal(reply.actions.some(action => action.type === 'contact_team' || action.type === 'highlight_field'), false);
  }
});

test('Urdu and Roman Urdu redirects preserve visible and spoken languages', () => {
  const prompts: { language: Language; questions: string[]; expected: RegExp }[] = [
    { language: 'ur', questions: ['ملک کا صدر کون ہے؟', 'سونے کی قیمت کیا ہے؟', 'نواز شریف کیا کرتا ہے؟', 'سلام ایجس ون، ملک کا صدر کون ہے؟'], expected: /^میں AegisOne/ },
    { language: 'ur-Latn', questions: ['wazir e azam kon hai?', 'gold ki qeemat kya hai?', 'Nawaz Sharif kya karta hai?', 'Salam AegisOne, siyasi khabrein batao'], expected: /^Main AegisOne/ },
  ];
  for (const { language, questions, expected } of prompts) for (const question of questions) {
    const reply = getFallbackReply(question, language, landing);
    assert.match(reply.answer, expected, question);
    assert.equal(reply.language, language);
    assert.match(reply.speechText, /[\u0600-\u06FF]/);
    assert.doesNotMatch(reply.answer, /cloud|کلاؤڈ|\bAI\b|نواز|Nawaz|gold|سونے/i);
  }
});

test('narrower guide matching retains product features, plans and integration help', () => {
  for (const question of ['How does it work?', 'What does AegisOne do?', 'What do you offer?']) {
    assert.deepEqual(getFallbackReply(question, 'en', landing).sources, ['features'], question);
  }
  for (const question of ['Which plan fits my team?', 'Starter plan', 'plan', 'Meri team ke liye konsa plan theek hai?']) {
    assert.deepEqual(getFallbackReply(question, 'en', landing).sources, ['pricing'], question);
  }
  assert.equal(getFallbackReply('How can I integrate it?', 'en', landing).sources.includes('deployment'), true);
});

test('broad setup questions give a concise first action and one progress question', () => {
  const questions = [
    'for setup what i should i do and where i shoul start first ?',
    'Where do I begin?', 'how do i get started', 'what is the first step?',
    'What should I do first?', 'wher i shoul strt frist?', 'setp',
    'Help me set this up', 'I am new here',
    'I need help setting up', 'I am trying to set this up', 'Can you guide me step by step?',
    'What should I do after registration?',
  ];
  for (const question of questions) {
    const reply = getFallbackReply(question, 'en', landing);
    assert.match(reply.answer, /Register Org or Request Organization Setup/, question);
    assert.match(reply.answer, /Confirm your account.*approval/, question);
    assert.match(reply.answer, /deployment portal.*Docker/, question);
    assert.match(reply.answer, /connect employee browser extensions/, question);
    assert.match(reply.answer, /Have you registered your organization yet\?/);
    assert.ok(reply.answer.split(/\s+/).length <= 65, 'Start with short guidance rather than the full checklist');
    assert.doesNotMatch(reply.answer, /here to help with AegisOne|do not have a verified answer|enable cloud AI/, question);
    assert.deepEqual(reply.sources, ['deployment', 'setup-organization']);
    for (const action of reply.actions) assert.equal(isAllowedAction(action, landing), true);
  }
});

test('Urdu and Roman Urdu getting-started requests give localized setup steps and speech', () => {
  const prompts: { language: Language; questions: string[]; expected: RegExp }[] = [
    { language: 'ur', questions: ['سیٹ اپ کہاں سے شروع کروں؟', 'پہلا قدم کیا ہے؟', 'کہاں سے شروع کروں؟'], expected: /^AegisOne ویب سائٹ/ },
    { language: 'ur-Latn', questions: ['setup kahan se shuru karun?', 'shuru kahan se krun?', 'pehla step kya hai?'], expected: /^AegisOne website/ },
  ];
  for (const { language, questions, expected } of prompts) for (const question of questions) {
    const reply = getFallbackReply(question, language, landing);
    assert.match(reply.answer, expected, question);
    assert.match(reply.answer, /Register Org.*Request Organization Setup/);
    assert.match(reply.answer, /Docker/);
    assert.ok(reply.answer.split(/\s+/).length <= 80);
    assert.match(reply.speechText, /[\u0600-\u06FF]/);
    assert.equal(reply.language, language);
    assert.deepEqual(reply.sources, ['deployment', 'setup-organization']);
  }
});

test('setup help follows the active step unless the user asks for the whole process', () => {
  const context = { surface: 'organization_setup', step: 'security', errors: ['smtp_auth'] } as const;
  for (const question of ['for setup what i should i do and where i shoul start first ?', 'Where do I begin?', 'help with setup']) {
    const reply = getFallbackReply(question, 'en', context);
    assert.deepEqual(reply.sources, ['setup-security'], question);
    assert.match(reply.answer, /authentication problem/);
    assert.match(reply.answer, /Configure your email provider/);
    assert.doesNotMatch(reply.answer, /^Start on the AegisOne website/);
  }
  const validation = getFallbackReply('Where do I begin?', 'en', {
    surface: 'organization_setup', step: 'structure', errors: ['duplicate_ids'], counts: { duplicateIds: 2 },
  });
  assert.deepEqual(validation.sources, ['setup-validation']);
  assert.match(validation.answer, /2 members with duplicate IDs/);
  for (const question of ['Show me the full setup process', 'Explain all setup steps', 'How do I start from the beginning?', 'shuru se setup samjhao', 'شروع سے پورا سیٹ اپ سمجھائیں']) {
    const reply = getFallbackReply(question, 'en', context);
    assert.deepEqual(reply.sources, ['deployment', 'setup-organization'], question);
    assert.match(reply.answer, /^Start on the AegisOne website/);
    assert.doesNotMatch(reply.answer, /authentication problem/);
  }
  const portal = getFallbackReply('Where do I begin?', 'en', { surface: 'deployment_portal', readiness: 'slow' });
  assert.deepEqual(portal.sources, ['deployment']);
  assert.match(portal.answer, /has not confirmed a ready service/);
});

test('deployment portal page questions explain the ordered actions without calling a provider', t => {
  t.mock.method(globalThis, 'fetch', () => { throw new Error('Page help must stay local'); });
  const context = { surface: 'deployment_portal', readiness: 'ready', os: 'windows', command: 'SENSITIVE_SENTINEL' } as const;
  for (const question of [
    'tell in this page what i have to do ?', 'What should I do on this page?',
    'What do I need to do on this screen?', 'Explain this page', 'Help me understand the current screen',
    'What to do here?',
  ]) {
    const reply = getFallbackReply(question, 'en', context);
    assert.deepEqual(reply.sources, ['deployment'], question);
    assert.match(reply.answer, /readiness check reports ready/i, question);
    assert.match(reply.answer, /1\. Install and start Docker on your server/);
    assert.match(reply.answer, /2\..*Windows or Linux.*deployment command.*on that server/);
    assert.match(reply.answer, /3\..*server’s IP or domain.*localhost.*Once ready, click Start Setup Engine/);
    assert.match(reply.answer, /port 3002/);
    assert.match(reply.answer, /4\..*Organization.*Review Structure.*Validation.*Security.*SMTP.*Rollout/);
    assert.doesNotMatch(reply.answer, /SENSITIVE_SENTINEL|here to help with AegisOne|Cloud assistance sends/);
    for (const action of reply.actions) assert.equal(isAllowedAction(action, context), true);
  }
});

test('Setup Engine questions explain its purpose and respect uncertain deployment readiness', () => {
  const questions = [
    'what is launch setup engine how it helps mn ?', 'What does Start Setup Engine do?',
    'How does the setup engine help me?',
  ];
  for (const readiness of ['ready', 'slow', 'timeout', 'unknown'] as const) for (const question of questions) {
    const reply = getFallbackReply(question, 'en', { surface: 'deployment_portal', readiness });
    assert.deepEqual(reply.sources, ['deployment'], question);
    assert.match(reply.answer, /Setup Engine is your organization’s setup dashboard/);
    assert.match(reply.answer, /hosted on your server on port 3002/);
    assert.match(reply.answer, /you control setup, and the assistant does not run it for you/);
    assert.match(reply.answer, /Once ready, click Start Setup Engine/);
    if (readiness === 'slow' || readiness === 'timeout') {
      assert.match(reply.answer, /has not confirmed a ready service/);
      assert.doesNotMatch(reply.answer, /readiness check reports ready/);
    } else if (readiness === 'unknown') {
      assert.match(reply.answer, /unknown result is not proof of success or failure/);
      assert.doesNotMatch(reply.answer, /readiness check reports ready/);
    } else assert.match(reply.answer, /readiness check reports ready/);
  }
});

test('localized page and Setup Engine questions retain language and current setup blockers', () => {
  for (const [language, questions] of [
    ['ur', ['اس صفحے پر کیا کرنا ہے؟', 'یہ اسکرین سمجھائیں', 'سیٹ اپ انجن کیا ہے؟']],
    ['ur-Latn', ['is page par kya karna hai?', 'yeh screen samjhao', 'setup engine kya hai aur kaise madad karta hai?']],
  ] as const) for (const question of questions) {
    const reply = getFallbackReply(question, language, { surface: 'deployment_portal', readiness: 'unknown' });
    assert.deepEqual(reply.sources, ['deployment'], question);
    assert.equal(reply.language, language);
    assert.match(reply.answer, /Docker/);
    assert.match(reply.answer, /3002/);
    assert.match(reply.answer, /Organization.*Review Structure.*Validation.*Security.*Rollout/);
    assert.match(reply.speechText, /[\u0600-\u06FF]/);
  }
  const currentStep = getFallbackReply('What should I do on this page?', 'en', {
    surface: 'organization_setup', step: 'security', errors: ['smtp_auth'],
  });
  assert.deepEqual(currentStep.sources, ['setup-security']);
  assert.match(currentStep.answer, /authentication problem/);
  assert.match(currentStep.answer, /Configure your email provider/);
});

test('current-page and Setup Engine wording cannot turn mixed unrelated questions into setup help', () => {
  for (const question of [
    'Tell me on this page who is president?', 'Explain this screen and give me political news',
    'What does Start Setup Engine do and what is the weather?',
    'On this page what should I do to plan a holiday?',
  ]) {
    const reply = getFallbackReply(question, 'en', { surface: 'deployment_portal', readiness: 'ready' });
    assert.deepEqual(reply.sources, ['overview'], question);
    assert.match(reply.answer, /here to help with AegisOne/);
    assert.doesNotMatch(reply.answer, /Docker|port 3002|readiness check|Start Setup Engine/);
  }
});

test('next-step help uses only explicit missing-field flags and safe highlight actions', () => {
  const context = { surface: 'organization_setup', step: 'organization', fieldStatus: { org_name: false, org_industry: true, admin_email: true }, password: 'SENSITIVE_SENTINEL' } as const;
  const reply = getFallbackReply('What should I check next?', 'en', context);
  assert.match(reply.answer, /Still required or invalid: organization name/);
  assert.equal(reply.answer.includes('SENSITIVE_SENTINEL'), false);
  assert.equal(reply.actions.some(action => action.type === 'highlight_field' && action.target === 'org_name'), true);
  for (const action of reply.actions) assert.equal(isAllowedAction(action, context), true);
});

test('validation guidance explains aggregate issues and opens the affected local group', () => {
  const reply = getFallbackReply('Explain this step and what I should check next.', 'en', {
    surface: 'organization_setup', step: 'validation', counts: { duplicateIds: 2, unassignedMembers: 1 }, errors: ['duplicate_ids', 'unassigned_members'],
  });
  assert.match(reply.answer, /2 members with duplicate IDs/); assert.match(reply.answer, /1 members without a department/);
  assert.match(reply.answer, /Counts can overlap/);
  assert.equal(reply.actions.some(action => action.type === 'show_validation_group' && action.target === 'duplicate_ids'), true);
  const csv = getFallbackReply('Help with this step', 'en', { surface: 'organization_setup', step: 'structure', errors: ['invalid_csv'], counts: { invalidRows: 0 } });
  assert.match(csv.answer, /last CSV import could not be read/);
  assert.equal(csv.actions.some(action => action.target === 'invalid_csv'), true);
});

test('SMTP, rollout and deployment guidance distinguishes errors and uncertain status', () => {
  const smtp = getFallbackReply('Explain this step', 'en', { surface: 'organization_setup', step: 'security', errors: ['smtp_tls'], fieldStatus: { smtp_password: false } });
  assert.match(smtp.answer, /TLS problem/); assert.match(smtp.answer, /do not disable TLS/);
  assert.equal(smtp.actions.some(action => action.type === 'highlight_field' && action.target === 'smtp_password'), true);
  const rollout = getFallbackReply('What should I do next?', 'en', { surface: 'organization_setup', step: 'rollout', rollout: 'unknown', errors: ['dispatch_unknown'] });
  assert.match(rollout.answer, /could not be confirmed/); assert.match(rollout.answer, /Accounts may already exist/);
  assert.doesNotMatch(rollout.answer, /delivered successfully/);
  const deployment = getFallbackReply('Explain this step', 'en', { surface: 'deployment_portal', readiness: 'unknown', os: 'macos' });
  assert.match(deployment.answer, /unknown result is not proof of success or failure/);
  assert.match(deployment.answer, /macOS-specific guidance/);
});

test('offline guide and proactive hint retrieval never call the network', t => {
  t.mock.method(globalThis, 'fetch', () => { throw new Error('Network must not be called by local retrieval'); });
  const reply = getFallbackReply('How does it work?', 'en', landing);
  assert.deepEqual(reply.sources, ['features']);
  assert.equal(reply.status, 'fallback');
  assert.notEqual(getHint({ surface: 'organization_setup', step: 'rollout', errors: ['dispatch_unknown'] }, 'en'), null);
});
