import test from 'node:test';
import assert from 'node:assert/strict';
import { selectKnowledge, SOURCES, SOURCE_IDS } from '../knowledge.mjs';

test('landing product context stays available without a matched topic phrase', () => {
  for (const message of ['how we can do work with aegisone ?', 'what tools it can work ?', 'what Aegisone mean ?', 'after registring what should i do ?']) {
    const sources = selectKnowledge({ surface: 'landing' }, message);
    const ids = sources.map(source => source.id);
    for (const id of ['overview', 'features', 'deployment', 'privacy', 'limitations']) assert.ok(ids.includes(id), `${message}: ${id}`);
    assert.match(sources.find(source => source.id === 'overview').content, /etymology.*undocumented/);
    assert.match(sources.find(source => source.id === 'deployment').content, /Docker.*deployment command.*readiness.*Start Setup Engine.*(?:wizard|five steps)/);
  }
});

test('Docker follow-ups retrieve the download location and the next portal action', () => {
  const facts = selectKnowledge({ surface: 'landing' }, 'where is docker ?').find(source => source.id === 'deployment').content;
  assert.match(facts, /separate app to install/);
  assert.match(facts, /step 1 Install Docker Engine.*Download Docker/);
  assert.match(facts, /Docker Desktop.*includes Engine, CLI and Compose/);
  assert.match(facts, /Linux.*Docker Engine and Compose plugin/);
  assert.match(facts, /Start.*engine.*step 2 Run Deployment Script/);
  assert.doesNotMatch(facts, /First,? register|five organization-setup steps/);
});

test('authentication questions distinguish account controls from certification', () => {
  for (const question of ['is this product authenticated ?', 'is this product athenticated ?', 'Is this genuine or independently audited?']) {
    const facts = selectKnowledge({ surface: 'landing' }, question).find(source => source.id === 'features').content;
    assert.match(facts, /signed access tokens, bcrypt password hashing and role-based access/);
    assert.match(facts, /Some extension scans can work anonymously/);
    assert.match(facts, /no such certification or audit is verified/);
    assert.doesNotMatch(facts, /pull.*Docker|register.*portal/);
  }
});

test('SMTP authentication errors keep mail troubleshooting separate from product certification', () => {
  const sources = selectKnowledge({ surface: 'landing' }, 'Our SMTP account authentication fails. How do I fix the password?');
  assert.match(sources.find(source => source.id === 'setup-security').content, /Auth error: verify username\/app-password requirements/);
  assert.doesNotMatch(sources.find(source => source.id === 'features').content, /If authenticated means certified/);
  assert.match(sources.find(source => source.id === 'privacy').content, /Never send secrets/);
});

test('requirements questions retrieve tools and inputs without invented hardware minimums', () => {
  for (const question of ['which tools and resources required to deploy in our comapny ?', 'What are the prerequisites?', 'What do I need before setup?', 'Do I need a GPU?', 'What accounts and equipment should we prepare?']) {
    const sources = selectKnowledge({ surface: 'landing' }, question);
    const facts = sources.find(source => source.id === 'deployment')?.content;
    assert.ok(facts, question);
    assert.match(facts, /Docker Desktop\/Engine with Docker Compose/);
    assert.match(facts, /PowerShell.*shell\/curl.*internet/);
    assert.match(facts, /Later in setup:.*employee.*SMTP/);
    assert.match(facts, /No verified minimum CPU, RAM, disk, GPU requirement/);
    assert.doesNotMatch(facts, /\b\d+\s*(?:GB|GB RAM|cores|CPUs)\b/i);
    assert.ok(!sources.some(source => source.id === 'setup-organization'));
  }
});

test('English, Urdu and Roman Urdu integration questions retrieve deployment facts and connector limits', () => {
  for (const message of ['how i can integrate it ?', 'Can I connect it to my application API?', 'اس کو اپنے ادارے سے کیسے منسلک کروں؟', 'Isko company se kaise connect karun?', 'AegisOne ko system se kaise jorna hai?']) {
    const selected = selectKnowledge({ surface: 'landing' }, message);
    const ids = selected.map(source => source.id);
    assert.equal(ids.includes('deployment'), true, message);
    assert.equal(ids.includes('features'), true, message);
    assert.equal(ids.includes('contact'), true, message);
    const deployment = selected.find(source => source.id === 'deployment').content;
    assert.match(deployment, /register.*Docker.*readiness.*Start Setup Engine.*five organization-setup steps/i);
    assert.match(deployment, /\/docs/); assert.match(deployment, /authentication requirements/);
    assert.match(deployment, /connectors unverified; never claim available/);
    for (const id of ids) assert.equal(SOURCE_IDS.includes(id), true);
  }
});

test('release-history queries always include an explicit unknown launch-date constraint', () => {
  for (const message of ['when aegisone launched ?', 'ایجس ون کب لانچ ہوا؟', 'AegisOne kab launch hua?']) {
    const limitations = selectKnowledge({ surface: 'landing' }, message).find(source => source.id === 'limitations');
    assert.match(limitations.content, /No verified public launch date/);
    assert.match(limitations.content, /Version numbers and repository activity do not establish a launch date/);
    assert.doesNotMatch(limitations.content, /launched in \d{4}/);
  }
});

test('Urdu installation requests retrieve deployment without requiring an active portal context', () => {
  const selected = selectKnowledge({ surface: 'landing' }, 'اپنے سرور پر کیسے انسٹال کروں؟');
  assert.equal(selected.some(source => source.id === 'deployment'), true);
  assert.match(SOURCES['setup-structure'], /six columns: Employee ID, First Name, Last Name, Email, Department Code, Role/);
});

test('natural setup and where-to-start questions retrieve the ordered onboarding path', () => {
  const messages = [
    'for setup what i should i do and where i shoul start first ?',
    'Where do I begin?', 'how do i get started', 'what is the first step?',
    'What should I do first?', 'wher i shoul strt frist?', 'setp',
    'Help me set this up', 'I am new here',
    'I need help setting up', 'I am trying to set this up', 'Can you guide me step by step?',
    'What should I do after registration?', 'I finished registration. What next?',
    'setup kahan se shuru karun?', 'shuru kahan se krun?', 'pehla step kya hai?',
    'سیٹ اپ کہاں سے شروع کروں؟', 'پہلا قدم کیا ہے؟', 'کہاں سے شروع کروں؟',
  ];
  for (const message of messages) {
    const selected = selectKnowledge({ surface: 'landing' }, message);
    const ids = selected.map(source => source.id);
    assert.equal(ids.includes('deployment'), true, message);
    assert.equal(ids.includes('setup-organization'), true, message);
    const setup = selected.find(source => source.id === 'setup-organization').content;
    assert.match(setup, /Start at website Register Org or Request Organization Setup/);
    assert.match(setup, /Confirm account\/approval.*Docker.*Organization.*Review Structure.*Validation.*Security.*Rollout.*extension/);
    assert.match(setup, /first action.*current step.*whole process\/from beginning/);
    for (const id of ids) assert.equal(SOURCE_IDS.includes(id), true);
  }
});

test('getting-started knowledge retains the current setup step for contextual guidance', () => {
  const ids = selectKnowledge({ surface: 'organization_setup', step: 'security' }, 'Where should I start?').map(source => source.id);
  assert.equal(ids.includes('deployment'), true);
  assert.equal(ids.includes('setup-organization'), true);
  assert.equal(ids.includes('setup-security'), true);
});

test('portal page questions retrieve the actual controls and setup-engine purpose', () => {
  for (const message of ['tell in this page what i have to do ?', 'what is launch setup engine how it helps mn ?', 'What does Start Setup Engine open?']) {
    const sources = selectKnowledge({ surface: 'deployment_portal', readiness: 'ready' }, message);
    const deployment = sources.find(source => source.id === 'deployment')?.content;
    assert.ok(deployment);
    assert.match(deployment, /Install Docker Engine.*Run Deployment Script.*Launch Setup Engine/);
    assert.match(deployment, /Start Setup Engine button opens.*dashboard on port 3002/);
    assert.match(deployment, /Organization, Review Structure, Validation, Security \(SMTP\), Rollout/);
    assert.match(deployment, /Unknown: verify locally; do not claim ready/);
  }
  assert.match(selectKnowledge({ surface: 'landing' }, 'Explain the setup engine').find(source => source.id === 'deployment')?.content || '', /Start Setup Engine/);
});

test('integration facts fit the conservative free-tier input budget without losing safeguards', () => {
  const selected = selectKnowledge({ surface: 'landing' }, 'How can I integrate AegisOne?');
  const size = selected.reduce((total, source) => total + new TextEncoder().encode(source.content).length, 0);
  assert.ok(size <= 1800, `Integration knowledge used ${size} UTF-8 bytes`);
  assert.match(SOURCES.overview, /URLs.*email.*text.*images.*attachments/);
  assert.match(SOURCES.features, /probabilistic/);
  assert.match(SOURCES.features, /certification.*perfect prevention.*uptime.*response-time guarantees/);
  assert.match(SOURCES.deployment, /dashboard 3002/);
  assert.match(SOURCES.deployment, /backend 8000/);
  assert.match(SOURCES.deployment, /Checking\/slow\/timeout\/unknown.*proves no success\/failure/);
  assert.match(SOURCES.deployment, /macOS instructions unverified/);
  assert.match(SOURCES.contact, /No invented slots\/bookings, messages or contact collection/);
});

test('compact catalog retains pricing, CSV, SMTP, privacy and rollout facts', () => {
  for (const price of ['$20 monthly/$150 annually', '$79 monthly/$699 annually', '$199 monthly/$1,799 annually']) assert.equal(SOURCES.pricing.includes(price), true);
  assert.match(SOURCES.pricing, /Annual prices are yearly totals/);
  assert.match(SOURCES.pricing, /not a negotiated quote/);
  assert.match(SOURCES['setup-structure'], /six columns: Employee ID, First Name, Last Name, Email, Department Code, Role/);
  assert.match(SOURCES['setup-structure'], /quoted commas\/line breaks/);
  assert.match(SOURCES['setup-security'], /Gmail two-step.*app password/);
  assert.match(SOURCES['setup-security'], /never disable TLS/);
  assert.match(SOURCES['setup-rollout'], /Running is not complete.*partial failure/);
  assert.match(SOURCES.privacy, /Chat expires 24h; transcription 15min; app retains no audio/);
  assert.match(SOURCES.privacy, /provider retention\/training, compliance or residency promises/);
});

test('informal capability and safety questions retrieve capabilities and their limits', () => {
  for (const message of ['What AegisOne can do ?', 'What this product does?', 'is this product safe ?', 'Is AegisOne reliable?', 'Can it protect me?']) {
    const selected = selectKnowledge({ surface: 'landing' }, message);
    assert.ok(selected.some(source => source.id === 'features'), message);
    assert.match(selected.find(source => source.id === 'features').content, /probabilistic.*no accuracy, certification, perfect prevention/);
    assert.ok(selected.some(source => source.id === 'limitations'));
  }
});
