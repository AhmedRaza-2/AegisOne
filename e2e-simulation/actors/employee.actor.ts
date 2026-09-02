/**
 * AegisOne E2E Simulation — Employee Actor
 *
 * Two modes:
 *
 * FULL BROWSER (actorType === 'full_browser'):
 *   - Playwright Chromium with the real AegisOne extension loaded
 *   - Navigates to actual URLs → extension intercepts → API events fire
 *   - Tests the complete chain: Browser → Extension → API → DB
 *
 * API SYNTHETIC (actorType === 'api_synthetic'):
 *   - No browser — directly injects events via POST /events/ingest
 *   - Tests analytics aggregation at scale without browser overhead
 *   - Uses the real SecurityEventIngestRequest schema from compatibility.py
 */

import { Browser, BrowserContext, chromium, Page } from '@playwright/test';
import axios from 'axios';
import path from 'path';
import { Config } from '../config';
import { SimulatedEmployee } from '../orchestrator/scenario-state';
import { loginUser } from '../fixtures/seed';

// ── Types matching api/database/schemas.py SecurityEventIngestRequest ─────────

interface IngestEvent {
  id: string;
  type: string;
  org_id: string;
  user_id?: string;
  device_id: string;
  url?: string;
  domain?: string;
  risk_score?: number;
  verdict?: string;
  details?: Record<string, unknown>;
}

// ── Full Browser Actor ────────────────────────────────────────────────────────

export class FullBrowserEmployeeActor {
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private token: string | null = null;
  readonly emp: SimulatedEmployee;

  constructor(emp: SimulatedEmployee) {
    this.emp = emp;
  }

  async init(browser: Browser): Promise<void> {
    if (Config.USE_REAL_EXTENSION) {
      // Launch with persistent context + unpacked extension
      // Playwright supports this via chromium.launchPersistentContext
      // with args: ['--load-extension=PATH', '--disable-extensions-except=PATH']
      const extensionPath = path.resolve(Config.EXTENSION_PATH);

      this.context = await browser.newContext({
        // Extension loading is handled at launch level — see scenario-engine.ts
        // Here we create a regular context within the extension-loaded browser
      });
    } else {
      this.context = await browser.newContext();
    }

    this.page = await this.context.newPage();
  }

  async login(): Promise<void> {
    this.token = await loginUser(this.emp.email, this.emp.password);
    console.log(`  ✓ [${this.emp.id}] ${this.emp.firstName} API logged in (${this.emp.profile})`);
  }

  /**
   * Physically log in via the Dashboard UI using Playwright.
   */
  async uiLogin(): Promise<void> {
    const page = this.requirePage();
    await page.goto(`${Config.WEB_URL}/login`);
    await page.waitForLoadState('networkidle', { timeout: 20_000 });

    await page.locator('input[type="email"]').first().fill(this.emp.email);
    await page.locator('input[type="password"]').first().fill(this.emp.password);
    
    // Check if there is a specific sign-in button
    const loginBtn = page.locator('button:has-text("Sign in"), button:has-text("Log in"), button[type="submit"]').first();
    await loginBtn.click();
    
    // Wait for redirect to dashboard
    await page.waitForURL(/\/dashboard(?!\/login)/, { timeout: 15_000 });
    this.emp.lifecycleState = 'LOGGED_IN';
    console.log(`  ✓ [${this.emp.id}] ${this.emp.firstName} UI logged in (${this.emp.profile})`);
  }

  /**
   * Open email — navigate to the dashboard communications/inbox page
   * to simulate an employee reading their welcome/campaign message.
   */
  async openEmailInDashboard(): Promise<void> {
    const page = this.requirePage();
    // Employee goes to their dashboard inbox
    await page.goto(`${Config.WEB_URL}/dashboard`);
    await page.waitForLoadState('networkidle', { timeout: 15_000 });
  }

  /**
   * Navigate to a URL — the loaded AegisOne extension will intercept it,
   * call /analyze/url, and generate a security event if it's suspicious.
   * This is the REAL extension test path.
   */
  async visitUrl(url: string): Promise<{ detected: boolean; decision: string }> {
    const page = this.requirePage();

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15_000 });
      await page.waitForTimeout(2000); // Give extension time to process

      // Check if extension injected a warning/block overlay
      // The extension injects a banner or modal on dangerous pages
      const warningVisible = await page.isVisible(
        '[id*="aegis"], [class*="aegis"], [data-aegis], #aegis-warning-overlay',
      );
      
      this.emp.lifecycleState = warningVisible ? 'EXTENSION_INTERCEPTED' : 'URL_VISITED';

      return { detected: warningVisible, decision: warningVisible ? 'block' : 'allow' };
    } catch (err) {
      console.error(`  ✗ [${this.emp.id}] Navigation failed for ${url}`);
      // Navigation errors (blocked pages, etc.) are expected for phishing URLs
      const errMsg = (err as Error).message;
      const blocked = errMsg.includes('net::ERR') || errMsg.includes('blocked');
      return {
        detected: blocked,
        decision: blocked ? 'block' : 'allow',
      };
    }
  }

  /**
   * Click a phishing link (simulates risky user behavior).
   * Navigates to the suspicious URL embedded in a campaign message.
   */
  async clickPhishingLink(phishingUrl: string): Promise<{ detected: boolean }> {
    console.log(`  → [${this.emp.id}] ${this.emp.firstName} clicks phishing link (risky)`);
    const result = await this.visitUrl(phishingUrl);
    return { detected: result.detected };
  }

  /**
   * Report email (simulates security-aware user behavior).
   * Submits a threat report via POST /reports/threat.
   */
  async reportEmail(phishingUrl: string): Promise<void> {
    console.log(`  → [${this.emp.id}] ${this.emp.firstName} reports phishing email (aware)`);
    const userId = this.emp.dbUserId ? String(this.emp.dbUserId) : undefined;

    // Use the real /reports/threat endpoint from compatibility.py
    await axios.post(
      `${Config.API_URL}/reports/threat`,
      {
        organization_id: 'org_default',
        user_id: userId,
        website: phishingUrl,
        reason: 'Suspicious phishing simulation email',
      },
      {
        headers: this.token ? { Authorization: `Bearer ${this.token}` } : {},
        timeout: Config.API_TIMEOUT_MS,
      },
    );
  }

  /**
   * Run the employee's full simulation based on their behavior profile.
   * Visits safe URLs, then handles the phishing email based on profile.
   */
  async runSimulation(phishingUrl: string): Promise<void> {
    // 1. Visit safe URLs first (generates baseline website_scans)
    for (const url of this.emp.expected.urlsVisited) {
      if (!this.emp.expected.urlsSuspicious.includes(url)) {
        await this.visitUrl(url);
        await sleep(500);
      }
    }

    // 2. Handle phishing email based on profile
    if (this.emp.expected.clickedPhishingLink) {
      await this.clickPhishingLink(phishingUrl);
    } else if (this.emp.expected.reportedEmail) {
      await this.reportEmail(phishingUrl);
    } else {
      // ignored — no action needed
      console.log(`  → [${this.emp.id}] ${this.emp.firstName} ignores email (average)`);
    }
  }

  async close(): Promise<void> {
    await this.context?.close();
  }

  private requirePage(): Page {
    if (!this.page) throw new Error(`FullBrowserEmployeeActor for ${this.emp.email} not initialized`);
    return this.page;
  }
}

// ── API Synthetic Actor ───────────────────────────────────────────────────────

export class SyntheticEmployeeActor {
  readonly emp: SimulatedEmployee;
  private token: string | null = null;

  constructor(emp: SimulatedEmployee) {
    this.emp = emp;
  }

  async login(): Promise<void> {
    try {
      this.token = await loginUser(this.emp.email, this.emp.password);
    } catch {
      // Synthetic actors might fail login — that's acceptable
      // They inject events directly without needing a session token on the event endpoint
    }
  }

  /**
   * Inject security events directly via POST /events/ingest.
   * This is the same endpoint the real extension uses.
   * Schema from api/database/schemas.py → SecurityEventIngestRequest
   */
  async injectBrowsingEvents(phishingUrl: string): Promise<number> {
    const userId = this.emp.dbUserId ? String(this.emp.dbUserId) : undefined;
    const deviceId = `e2e-device-${this.emp.id}`;
    const orgId = 'org_default';

    const events: IngestEvent[] = [];

    // Safe URL events (always generated)
    for (const url of Config.SAFE_URLS.slice(0, 2)) {
      events.push({
        id: `e2e-${this.emp.id}-safe-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        type: 'page_scan',
        org_id: orgId,
        user_id: userId,
        device_id: deviceId,
        url,
        domain: extractDomain(url),
        risk_score: Math.floor(Math.random() * 20),  // safe: 0-19
        verdict: 'allow',
        details: { decision: 'allow', module: 'url_model', scan_type: 'navigation' },
      });
    }

    // Phishing/suspicious URL event (if employee clicked)
    if (this.emp.expected.clickedPhishingLink) {
      events.push({
        id: `e2e-${this.emp.id}-phish-${Date.now()}`,
        type: 'website_threat',
        org_id: orgId,
        user_id: userId,
        device_id: deviceId,
        url: phishingUrl,
        domain: extractDomain(phishingUrl),
        risk_score: 88,
        verdict: 'block',
        details: {
          decision: 'block',
          module: 'url_model',
          threat_type: 'phishing',
          scan_type: 'navigation',
        },
      });
    }

    // Threat report event (if security-aware employee)
    if (this.emp.expected.reportedEmail) {
      // Direct threat report via /reports/threat (same endpoint as real extension)
      await axios.post(
        `${Config.API_URL}/reports/threat`,
        {
          organization_id: orgId,
          user_id: userId,
          website: phishingUrl,
          reason: `[E2E Simulation] ${this.emp.firstName} reported suspicious phishing email`,
        },
        { timeout: Config.API_TIMEOUT_MS },
      );
    }

    if (events.length === 0) return 0;

    // POST /events/ingest — real endpoint from compatibility.py
    const resp = await axios.post(
      `${Config.API_URL}/events/ingest`,
      { events },
      { timeout: Config.API_TIMEOUT_MS },
    );

    return resp.data.count ?? 0;
  }

  async runSimulation(phishingUrl: string): Promise<void> {
    await this.login();
    const count = await this.injectBrowsingEvents(phishingUrl);
    const action = this.emp.expected.clickedPhishingLink ? 'CLICK'
      : this.emp.expected.reportedEmail ? 'REPORT' : 'IGNORE';
    console.log(`  → [${this.emp.id}] ${this.emp.firstName} (synthetic, ${action}) → ${count} events`);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url.split('/')[0];
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Launch a Chromium browser with the AegisOne extension preloaded.
 * Used for full_browser actors.
 *
 * NOTE: Playwright requires a persistent context (launchPersistentContext)
 * to load unpacked extensions. We use the standard `chromium.launch()` for
 * non-extension scenarios and a separate persistent context for extension actors.
 */
import fs from 'fs';
import os from 'os';

export async function launchExtensionBrowser(userDataDir?: string): Promise<BrowserContext> {
  const extensionPath = path.resolve(Config.EXTENSION_PATH);
  
  if (!userDataDir) {
    userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'playwright-aegisone-'));
  }

  // Playwright MV3 extension loading:
  // --load-extension + --disable-extensions-except are required for MV3
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false, // Extensions require non-headless mode
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--no-sandbox',
    ],
  });

  // Wait for extension service worker to initialize
  await sleep(2000);
  return context;
}
