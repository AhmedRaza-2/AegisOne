import { Browser, BrowserContext, Page, chromium } from '@playwright/test';
import { Config } from '../config';
import { SimulatedAdmin, SimulatedManager } from '../orchestrator/scenario-state';
import { SimulationLogger } from '../orchestrator/logger';

export class ObserverActor {
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  public role: 'admin' | 'manager';
  public user: SimulatedAdmin | SimulatedManager;
  private logger: SimulationLogger;
  
  // Baseline stats to compare against
  private baselineScans: number = 0;
  private baselineThreats: number = 0;
  
  // Real-time tracking of the latest stats seen from polling
  private latestScansSeen: number = 0;
  private latestThreatsSeen: number = 0;
  private latestPollTimestamp: number = 0;

  constructor(role: 'admin' | 'manager', user: SimulatedAdmin | SimulatedManager, logger: SimulationLogger) {
    this.role = role;
    this.user = user;
    this.logger = logger;
  }

  async init(browser: Browser): Promise<void> {
    this.context = await browser.newContext();
    this.page = await this.context.newPage();
    
    // Attach event listener immediately to catch any polling that occurs right after load
    this.page.on('response', async (response) => {
      // Both admin and manager dashboards hit `/admin/stats` in this app
      if (response.url().includes('/admin/stats') && response.status() === 200) {
        try {
          const data = await response.json();
          this.latestPollTimestamp = Date.now();
          if (data.total_scans !== undefined) this.latestScansSeen = data.total_scans;
          else if (data.scans !== undefined) this.latestScansSeen = data.scans;
          
          if (data.threats_blocked !== undefined) this.latestThreatsSeen = data.threats_blocked;
          else if (data.threats_detected !== undefined) this.latestThreatsSeen = data.threats_detected;
          else if (data.threats !== undefined) this.latestThreatsSeen = data.threats;
        } catch (e) {
          // Ignore json parse errors for aborted requests
        }
      }
    });
  }

  async loginAndBaseline(): Promise<void> {
    const page = this.requirePage();
    await page.goto(`${Config.WEB_URL}/login`);
    await page.waitForLoadState('networkidle');

    await page.locator('input[type="email"]').first().fill(this.user.email);
    await page.locator('input[type="password"]').first().fill(this.user.password);
    await page.locator('button:has-text("Sign in"), button:has-text("Log in"), button[type="submit"]').first().click();
    
    // Wait for redirect to dashboard and DOM to be reasonably loaded
    await page.waitForURL(/\/dashboard(?!\/login)/, { timeout: 15_000 });
    
    // Wait until at least one polling response has been captured
    const startTime = Date.now();
    while (this.latestPollTimestamp === 0 && Date.now() - startTime < 30000) {
      await page.waitForTimeout(500);
    }
    
    if (this.latestPollTimestamp === 0) {
      throw new Error(`TEST_HARNESS_FAILURE: Observer ${this.role} never saw /admin/stats polling response after 30s`);
    }
    
    this.baselineScans = this.latestScansSeen;
    this.baselineThreats = this.latestThreatsSeen;
    
    this.logger.logEvent({
      actor: this.user.email,
      role: this.role,
      organization: Config.ORG_ID,
      action: 'OBSERVER_BASELINE',
      result: `scans=${this.baselineScans}, threats=${this.baselineThreats}`
    });
  }

  /**
   * Wait for a specific expected event based on counting logic for the vertical slice.
   */
  async waitForEvent(type: 'scan' | 'threat', timeout: number = 30000): Promise<{ t3: number, t4: number }> {
    const page = this.requirePage();
    
    const startWait = Date.now();
    let t3 = 0;

    // 1. Wait for our continuous polling listener to see the incremented value
    while (Date.now() - startWait < timeout) {
      if (type === 'scan' && this.latestScansSeen > this.baselineScans) {
        t3 = this.latestPollTimestamp;
        this.baselineScans = this.latestScansSeen;
        break;
      }
      if (type === 'threat' && this.latestThreatsSeen > this.baselineThreats) {
        t3 = this.latestPollTimestamp;
        this.baselineThreats = this.latestThreatsSeen;
        break;
      }
      await page.waitForTimeout(200);
    }
    
    if (t3 === 0) {
      throw new Error(`DASHBOARD_PROPAGATION_FAILURE: Timeout waiting for polling request to show ${type} event`);
    }

    // 2. Wait for DOM to reflect the change
    let t4 = 0;
    try {
      if (type === 'scan') {
        await page.waitForFunction(
          (expected) => {
            // @ts-ignore
            const el = document.querySelector('[data-testid="total-scans"], div:has-text("Total Scans") + div, div:has-text("total scans")');
            if (!el) return false;
            // @ts-ignore
            const text = el.innerText.replace(/[^0-9]/g, '');
            return parseInt(text, 10) >= (expected as number);
          },
          this.baselineScans,
          { timeout: 10000 }
        );
      } else {
        await page.waitForFunction(
          (expected) => {
            // @ts-ignore
            const el = document.querySelector('[data-testid="threats-blocked"], div:has-text("Threats Blocked") + div, div:has-text("threats blocked")');
            if (!el) return false;
            // @ts-ignore
            const text = el.innerText.replace(/[^0-9]/g, '');
            return parseInt(text, 10) >= (expected as number);
          },
          this.baselineThreats,
          { timeout: 10000 }
        );
      }
      t4 = Date.now();
    } catch (e) {
      throw new Error(`UI_FAILURE: DOM did not update to reflect ${type} event within timeout`);
    }

    return { t3, t4 };
  }

  async close(): Promise<void> {
    await this.context?.close();
  }

  private requirePage(): Page {
    if (!this.page) throw new Error(`TEST_HARNESS_FAILURE: ObserverActor for ${this.user.email} not initialized`);
    return this.page;
  }
}
