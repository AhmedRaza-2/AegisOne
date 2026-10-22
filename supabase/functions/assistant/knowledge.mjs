// Reviewed repository facts. This is an explicit, versioned allowlist: never
// scrape source files, customer records, logs, or arbitrary URLs at runtime.
import { normalizeQuestion, isPrerequisitesQuestion } from './scope.mjs';
export const KNOWLEDGE_VERSION = '2026-10-22.6';
export const SOURCES = Object.freeze({
  overview: 'AegisOne is the product name for organizational phishing detection in URLs, email, text, images and attachments. Extension, risk explanations and role-based dashboards serve staff. Name questions: explain the product first; official expansion/etymology is undocumented.',
  features: 'Specialized AI + heuristics + risk aggregation. Browser protection, manual scans, threat reports, incident review, department admin and org-local learning. Detection is probabilistic: no accuracy, certification, perfect prevention, integration, uptime or response-time guarantees.',
  pricing: 'USD catalog: Starter Shield 1-100 employees, $20 monthly/$150 annually; Growth Defense 101-1,000, $79 monthly/$699 annually; Enterprise Guardian 1,001+, $199 monthly/$1,799 annually. Annual prices are yearly totals. Suggest by employee range. Catalog is not a negotiated quote; team confirms taxes, billing, custom terms. No unverified features/SLAs.',
  deployment: 'Portal order: register/confirm account, approval if required; on Windows/Linux start Docker and run the portal command; wait for readiness; Start Setup Engine opens dashboard 3002; complete five organization-setup steps (Organization, Review Structure, Validation, Security/SMTP, Rollout); employees connect the extension. Stack: PostgreSQL, FastAPI, Next.js; backend 8000. macOS instructions unverified. API integration: installed FastAPI /docs, authentication requirements, version-matching endpoints. CRM/SIEM/webhook connectors unverified; never claim available. Checking/slow/timeout/unknown readiness proves no success/failure. Cannot inspect machines, run commands or test connectivity.',
  'setup-organization': 'Start at website Register Org or Request Organization Setup. Confirm account/approval if requested, deploy via portal with Docker, then five steps: Organization (profile), Review Structure (departments/employees, manually or CSV), Validation (duplicates/assignments), Security (test SMTP), Rollout (accounts/welcome mail). Finally employees install/connect extension. Broad setup: first action; in setup: current step unless asked for the whole process/from beginning. Flags prove no correctness; no personal values shared.',
  'setup-structure': 'Admins review departments, managers, employees and imported rows; check roles/assignments before rollout. CSV has six columns: Employee ID, First Name, Last Name, Email, Department Code, Role. Keep headers; quoted commas/line breaks work. Assistant cannot upload/edit/delete/reassign staff, merge departments or save.',
  'setup-validation': 'Checks: duplicate employee IDs/emails, unassigned departments, invalid CSV rows. Fix highlighted group, rerun existing validation. Assistant sees counts/error categories only, not employee records.',
  'setup-security': 'SMTP host, port, username, password and sender configure welcome mail; enter values only in setup. Gmail two-step may need an app password. Use Test SMTP; assistant cannot test. Auth error: verify username/app-password requirements. Network: IT checks approved connectivity. TLS: use provider-required host/port/TLS; never disable TLS. Never paste passwords/tokens in chat.',
  'setup-rollout': 'Admin alone activates existing rollout controls to provision accounts/send welcome mail. Running is not complete; partial failure means some dispatches failed. Review delivery status/failed count before your retry. Assistant cannot send/provision/reset or claim success without completed status.',
  privacy: 'Cloud guidance/opt-in voice use Groq via our server. Shared: messages + safe status only; no automatic screenshots/DOM/form values/employee lists/passwords/tokens/telemetry. Chat expires 24h; transcription 15min; app retains no audio. Clear chat deletes its session. No on-prem-only, provider retention/training, compliance or residency promises.',
  limitations: 'Advisory reviewed catalog, not live internals. No setup actions, web access, customer records or form values. No verified public launch date, founding date or founder identity. Version numbers and repository activity do not establish a launch date: say unverified, ask team. Missing facts: say unknown, offer docs/team. No security/compliance/deployment/deal guarantees. Free AI/voice may stop; text/basic help remains.',
  contact: 'Use existing contact/demo UI for human or unverified commercial help. No invented slots/bookings, messages or contact collection.',
});
export const SOURCE_IDS = Object.freeze(Object.keys(SOURCES));

// Reviewed UI labels and behavior, without reading the page DOM or deployment secrets.
const PORTAL_GUIDE = 'This deployment portal has three actions: 1 Install Docker Engine and keep Docker running on the target server; 2 Run Deployment Script using the selected Windows/Linux command on that server; 3 Launch Setup Engine. The Start Setup Engine button opens the customer organization-setup dashboard on port 3002; it does not install Docker or run the deployment script. Use Server Host IP or Domain for the machine running AegisOne (localhost only on that same machine). When readiness reports ready, the next action is Start Setup Engine, then sign in or explicitly create the first administrator on a fresh instance. The wizard guides Organization, Review Structure, Validation, Security (SMTP), Rollout. Checking/slow/timeout: wait or check Docker/container health locally. Unknown: verify locally; do not claim ready. Keep generated commands, keys and passwords out of chat.';
const ORGANIZATION_DEPLOYMENT = 'On the server, start Docker Desktop (Windows) or Docker Engine (Linux); run the portal command for that OS. After readiness confirms ready, Start Setup Engine opens the dashboard on port 3002. Unknown/timeout is not proof of success. Keep commands/keys private. macOS instructions unverified. Assistant cannot run or verify deployment.';
// Reviewed against PortalPage deployment commands and the Compose services.
const DEPLOYMENT_REQUIREMENTS = 'Prepare: organization portal account, confirmed/approved if required; Windows/Linux server and administrator access; running Docker Desktop/Engine with Docker Compose; PowerShell on Windows or shell/curl on Linux; internet for deployment files, container images and initial model downloads; server IP/domain reachable by staff (default API 8000, dashboard 3002). Later in setup: organization/department/employee details or CSV and an SMTP sending account for welcome emails; enter credentials only in setup. Employees connect the browser extension. PostgreSQL, FastAPI and dashboard services run as containers. No verified minimum CPU, RAM, disk, GPU requirement or per-employee sizing here: ask IT/team to size the workload; never invent numbers.';

// Core product context stays available even when visitors use unfamiliar wording.
// Topic matching enriches these facts; it is not required to answer a question.
const LANDING_CORE = Object.freeze({
  overview: SOURCES.overview,
  features: 'AI/heuristics score phishing risk and give reasons; browser/manual scans and role-based dashboards. Detection is probabilistic. Protected account operations use signed tokens, bcrypt password hashes and roles. Authentication is not certification.',
  deployment: 'Windows/Linux. Order: account/approval, Docker/portal deployment command, readiness, Start Setup Engine, five steps (Organization, Review Structure, Validation, Security/SMTP, Rollout), extension. API: installed /docs, version-specific authentication. Third-party connector availability unverified. Ports 8000/3002.',
  privacy: 'Organization services run on your server. Separate optional chat/voice uses Groq via our server; no automatic screen, form-value or employee-record access. Never send secrets.',
  limitations: 'No verified public launch date, founding date or founder identity; versions/activity prove no launch date. No perfect detection, certification/audit, connector or deployment guarantees. Unknown facts: docs/team. Guidance runs no actions.',
});

// Verified 2026-10-22 against PortalPage and Docker's official Get Docker,
// Engine install and Compose install documentation. No fetched content at runtime.
const DOCKER_GUIDE = 'Docker is a separate app to install on the computer hosting AegisOne; whether it is already installed is unknown. It runs the services in containers. Portal step 1 Install Docker Engine has a Download Docker button linking to official installation docs. Windows: install/open Docker Desktop (includes Engine, CLI and Compose). Linux: follow official Docker Engine and Compose plugin instructions. If already installed on Windows, find Docker Desktop in Start and wait for its engine. Then return to portal step 2 Run Deployment Script. Ask OS only if needed; do not restart registration. Official installation location: docs.docker.com/get-started/get-docker/.';
// Reviewed against api/auth/password.py, jwt_handler.py, roles.py and dependencies.py.
const AUTHENTICATION_GUIDE = 'Protected account/dashboard operations use sign-in, signed access tokens, bcrypt password hashing and role-based access checks. Some extension scans can work anonymously: not every operation requires sign-in. If authenticated means certified, independently audited or guaranteed genuine/safe, no such certification or audit is verified here. Explain the distinction; ask what assurance the user needs if ambiguous. Do not turn this into deployment instructions or claim the customer installation is secure.';

export { isPrerequisitesQuestion } from './scope.mjs';

export function selectKnowledge(context, message) {
  const landing = context.surface === 'landing';
  const selected = new Set(landing ? Object.keys(LANDING_CORE) : ['overview', 'limitations']);
  const portalGuide = context.surface === 'deployment_portal' || /\bsetup engine\b|سیٹ\s*اپ\s*انجن/iu.test(message);
  if (portalGuide) selected.add('deployment');
  const lower = normalizeQuestion(message);
  const docker = /\bdocker\b|ڈوکر/iu.test(lower);
  const authentication = /authent|athent|authen|certifi|\b(?:legit|legitimate|genuine|verified|audit(?:ed)?)\b/iu.test(lower) && !/\bsmtp\b/iu.test(lower);
  const prerequisites = isPrerequisitesQuestion(lower);
  const privacyDetails = /privacy|data|retain|cloud|confiden|رازداری|mahfooz/.test(lower) || context.section === 'privacy';
  if (privacyDetails) selected.add('privacy');
  if (/pric|cost|plan|bill|قیمت|خرچ|paisa|qeemat/.test(lower) || context.section === 'pricing') selected.add('pricing');
  const featureDetails = /feature|capabilit|protect|phish|\b(?:safe|safety|secure|security|trustworthy|reliable|reliability)\b|how.*work|what.*(?:\bcan do\b|\bdoes\b|\boffer\b)|کیا|kaam/.test(lower) || context.section === 'features';
  if (featureDetails) selected.add('features');
  const integration = /integrat|\bapi\b|\bsiem\b|webhook|\bconnect\b|\bhook up\b|\bplug\b|انٹیگری|انٹگری|جوڑ|منسلک|\bjor(?:na|ne|ain|ein|en)?\b/.test(lower);
  const gettingStarted = /\b(?:setup|set[ -]?up|getting started|get started|first step|start first|do first|new here|registration|registered|prerequisites?|requirements?|walkthrough|checklist|step by step|walk me through)\b|\bwhere\b.{0,40}\b(?:start|begin)\b|\bhow\b.{0,24}\b(?:start|begin)\b|\b(?:start|begin)\b.{0,24}\b(?:setup|using|aegis[ -]?one)\b|\bset(?:ting)?\b.{0,12}\bup\b|سیٹ ?اپ|کہاں.*شروع|شروع.*(?:کہاں|کیسے)|پہلا.*(?:قدم|مرحلہ)|\b(?:shuru|shuroo|shroo|pehla step)\b/.test(lower);
  if (prerequisites) selected.add('deployment');
  if (gettingStarted) { selected.add('deployment'); if (!portalGuide && !prerequisites) selected.add('setup-organization'); }
  const deploymentDetails = context.surface === 'deployment_portal' || /docker|install|deploy|server|deployment|انسٹال|تنصیب|ڈوکر|سرور/.test(lower) || integration || gettingStarted || portalGuide || prerequisites;
  if (deploymentDetails) selected.add('deployment');
  if (integration) { selected.add('features'); selected.add('contact'); }
  if (context.step) selected.add(`setup-${context.step}`);
  if (/smtp|password|email|tls/.test(lower)) selected.add('setup-security');
  if (/valid|csv|duplicate|assign/.test(lower)) selected.add('setup-validation');
  if (/rollout|dispatch|welcome/.test(lower)) selected.add('setup-rollout');
  if (/team|demo|meeting|contact|deal|sla|support/.test(lower) || ['demo', 'contact'].includes(context.section)) selected.add('contact');
  return [...selected].filter(id => SOURCES[id]).map(id => {
    let content = landing ? LANDING_CORE[id] || SOURCES[id] : SOURCES[id];
    if (id === 'deployment') {
      if (prerequisites) content = DEPLOYMENT_REQUIREMENTS;
      else if (portalGuide) content = PORTAL_GUIDE;
      else if (docker) content = DOCKER_GUIDE;
      else if (!integration && selected.has('setup-organization')) content = ORGANIZATION_DEPLOYMENT;
      else if (deploymentDetails || !landing) content = SOURCES[id];
    } else if (id === 'features' && authentication) content = AUTHENTICATION_GUIDE;
    else if (id === 'features' && featureDetails || id === 'privacy' && privacyDetails) content = SOURCES[id];
    else if (id === 'limitations' && /launch|releas|found|origin|etymolog|mean|لانچ|اجرا|بانی|\bkab\b/iu.test(lower)) content = SOURCES[id];
    return { id, content };
  });
}
