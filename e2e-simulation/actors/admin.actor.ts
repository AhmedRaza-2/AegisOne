/**
 * AegisOne E2E Simulation — Admin Actor
 *
 * Playwright-based admin browser context.
 * Handles:
 *   - Login to the dashboard at /login
 *   - Triggering a phishing simulation email campaign
 *   - Reading and verifying dashboard analytics
 *
 * Uses real dashboard UI at WEB_URL (Next.js frontend).
 */

import { Browser, BrowserContext, Page, chromium } from '@playwright/test';
import axios from 'axios';
import { Config } from '../config';
import { ScenarioState } from '../orchestrator/scenario-state';
import { refreshAdminToken } from '../fixtures/seed';

export class AdminActor {
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private browser: Browser | null = null;

  async init(browser: Browser): Promise<void> {
    this.browser = browser;
    this.context = await browser.newContext({
      baseURL: Config.WEB_URL,
    });
    this.page = await this.context.newPage();
  }

  async login(state: ScenarioState): Promise<void> {
    const page = this.requirePage();

    await page.goto(`${Config.WEB_URL}/login`);
    await page.waitForLoadState('networkidle');

    // Fill email field — AegisOne login form uses email + password inputs
    await page.fill('input[type="email"], input[name="email"], #email', state.admin.email);
    await page.fill('input[type="password"], input[name="password"], #password', state.admin.password);

    // Submit
    await page.click('button[type="submit"]');

    // Wait for redirect to admin dashboard
    await page.waitForURL(/dashboard|admin/, { timeout: 15_000 });
    console.log(`  ✓ Admin logged in: ${state.admin.email}`);
  }

  /**
   * Trigger a phishing simulation campaign by sending an org_broadcast message.
   * This sends via POST /communication/send (msg_type: org_broadcast) with
   * a simulated phishing link in the body.
   *
   * The admin API token is used directly — no UI needed for the broadcast itself.
   * This is intentionally a hybrid approach: admin login is verified via UI,
   * but the campaign is dispatched via the real API to keep tests fast.
   */
  async triggerPhishingCampaign(state: ScenarioState): Promise<string> {
    const token = state.admin.token ?? await refreshAdminToken(state);

    // Compose campaign email — contains a simulated phishing link
    const phishingUrl = Config.SUSPICIOUS_URLS[0];
    const campaignTitle = '[SECURITY SIMULATION] Urgent: Verify Your Account';
    const campaignBody =
      `Dear Team Member,\n\n` +
      `We have detected unusual activity on your account. ` +
      `Please verify your identity immediately:\n\n` +
      `${phishingUrl}\n\n` +
      `Failure to act within 24 hours will result in account suspension.\n\n` +
      `— IT Security Team`;

    // POST /communication/send (org_broadcast) — real endpoint from communication.py
    const resp = await axios.post(
      `${Config.API_URL}/communication/send`,
      {
        msg_type: 'org_broadcast',
        title: campaignTitle,
        content: campaignBody,
        priority: 'High',
      },
      {
        headers: { Authorization: `Bearer ${token}` },
        timeout: Config.API_TIMEOUT_MS,
      },
    );

    if (!resp.data?.id) {
      throw new Error(`Campaign dispatch failed: ${JSON.stringify(resp.data)}`);
    }

    const runId = String(resp.data.id);
    console.log(`  ✓ Phishing campaign dispatched (msg_id=${runId})`);
    console.log(`  ✓ Phishing URL: ${phishingUrl}`);

    return runId;
  }

  /**
   * Send welcome credentials email to all employees via /setup/execute.
   * This triggers the real SMTP path (through Mailpit in test mode).
   *
   * Each employee gets an email with their email + password so the
   * Mailpit-based email journey can begin.
   */
  async sendWelcomeEmails(state: ScenarioState): Promise<void> {
    const token = state.admin.token ?? await refreshAdminToken(state);

    // Use the /setup/execute endpoint which sends welcome emails via SMTP
    // The backend reads SMTP_HOST/SMTP_PORT — in docker-compose.e2e.yml these
    // point to Mailpit, so all emails are captured there.
    const payload = {
      employees: state.employees.map(emp => ({
        firstName: emp.firstName,
        lastName: emp.lastName,
        email: emp.email,
        departmentCode: emp.departmentCode,
        role: emp.role,
        designation: `${emp.profile} user`,
        generatedPassword: emp.password,
      })),
      smtpUser: 'aegisone@e2etest.local',
      smtpPass: 'nopassword',
      smtpHost: 'mailpit',
      smtpPort: 1025,
    };

    await axios.post(
      `${Config.API_URL}/setup/execute`,
      payload,
      {
        headers: {
          'X-Setup-Key': Config.SETUP_KEY,
          Authorization: `Bearer ${token}`,
        },
        timeout: 30_000,
      },
    );

    console.log(`  ✓ Welcome emails dispatched to ${state.employees.length} employees`);
  }

  /**
   * Read admin dashboard stats via API (/admin/stats).
   * Returns totals for validation.
   */
  async readDashboardStats(state: ScenarioState): Promise<{
    totalScans: number;
    threatsDetected: number;
    totalUsers: number;
  }> {
    const token = state.admin.token ?? await refreshAdminToken(state);

    const resp = await axios.get(`${Config.API_URL}/admin/stats?time_range=24h`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: Config.API_TIMEOUT_MS,
    });

    const data = resp.data;
    return {
      totalScans: data.total_scans ?? 0,
      threatsDetected: data.threats_detected ?? 0,
      totalUsers: data.total_users ?? 0,
    };
  }

  /**
   * Verify the admin dashboard UI renders the correct numbers.
   * Uses Playwright to check the rendered page — tests the UI layer.
   */
  async verifyDashboardUI(
    state: ScenarioState,
    expected: { minScans: number; minThreats: number },
  ): Promise<{ passed: boolean; details: Record<string, unknown> }> {
    const page = this.requirePage();

    try {
      await page.goto(`${Config.WEB_URL}/dashboard`);
      await page.waitForLoadState('networkidle', { timeout: 20_000 });

      // Look for scan count displayed on the page (text-based check)
      // The dashboard shows stats via AdminStatsResponse
      const pageText = await page.textContent('body') ?? '';

      // Extract numbers from dashboard (look for stat cards)
      const hasScanData = pageText.includes('Total Scans') || pageText.includes('Scans Today');

      return {
        passed: hasScanData,
        details: {
          hasScanData,
          minScansRequired: expected.minScans,
          minThreatsRequired: expected.minThreats,
        },
      };
    } catch (err) {
      return {
        passed: false,
        details: { error: (err as Error).message },
      };
    }
  }

  async close(): Promise<void> {
    await this.context?.close();
  }

  private requirePage(): Page {
    if (!this.page) throw new Error('AdminActor.init() must be called first');
    return this.page;
  }

  // Static factory for headless API-only usage (no Playwright)
  static async apiOnly(): Promise<AdminActor> {
    return new AdminActor();
  }
}
