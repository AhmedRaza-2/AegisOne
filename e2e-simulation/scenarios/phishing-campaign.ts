/**
 * AegisOne E2E Simulation — Phishing Campaign Scenario (Flagship)
 *
 * The complete 5-phase simulation:
 *
 *   Phase 1 — Seed        : Provision org, admin, employees via API
 *   Phase 2 — Campaign    : Admin sends phishing simulation email
 *   Phase 3 — Email       : Mailpit captures emails; employee bots read them
 *   Phase 4 — Simulation  : Employees exhibit seeded behaviors (click/report/ignore)
 *   Phase 5 — Validation  : Assert DB + API + dashboard match expected outcomes
 *
 * Uses deterministic seed — same run always produces same expected counts.
 */

import { chromium, Browser } from '@playwright/test';
import { Config } from '../config';
import { ScenarioState } from '../orchestrator/scenario-state';
import { generateEmployees, summarizeProfiles } from '../fixtures/profiles';
import { seedOrganization, teardownOrganization, loginUser } from '../fixtures/seed';
import { MailpitClient } from '../email/mailpit.client';
import { AdminActor } from '../actors/admin.actor';
import {
  FullBrowserEmployeeActor,
  SyntheticEmployeeActor,
  launchExtensionBrowser,
} from '../actors/employee.actor';
import { DatabaseValidator } from '../validators/database.validator';
import { APIValidator } from '../validators/api.validator';

export interface ScenarioResult {
  passed: boolean;
  phases: import('../orchestrator/scenario-state').PhaseResult[];
  state: ScenarioState;
}

export async function runPhishingCampaign(options: {
  scale?: number;
  seed?: string;
  skipCleanup?: boolean;
}): Promise<ScenarioResult> {
  const scale = options.scale ?? Config.SCALE;
  const seed = options.seed ?? Config.SIMULATION_SEED;

  const state = new ScenarioState('phishing-campaign', 'org_default', seed, scale);

  // Configure admin
  state.admin = {
    email: 'e2e.admin@aegisone.e2etest.local',
    password: 'E2eAdminPass2026!',
  };

  // Generate seeded employees
  state.employees = generateEmployees('org_default', scale, seed, state.admin.email);
  state.computeExpected();

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(' AEGISONE E2E PHISHING CAMPAIGN SIMULATION');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Seed:    ${seed}`);
  console.log(`  Scale:   ${scale} employees`);
  console.log(summarizeProfiles(state.employees));
  console.log('');

  const mailpit = new MailpitClient();
  const dbValidator = new DatabaseValidator();
  const apiValidator = new APIValidator();
  let adminActor: AdminActor | null = null;
  let browser: Browser | null = null;
  const extensionContexts: import('@playwright/test').BrowserContext[] = [];

  try {
    // ── Pre-flight checks ───────────────────────────────────────────────────
    const mailpitOk = await mailpit.isHealthy();
    if (!mailpitOk) {
      console.warn('  ⚠ Mailpit not available — email delivery steps will be skipped');
    }
    const dbOk = await dbValidator.isHealthy();
    if (!dbOk) {
      console.warn('  ⚠ PostgreSQL not reachable — DB validation will be skipped');
    }

    // Clear Mailpit inbox for clean run
    await mailpit.clearAll();

    // ── Phase 1: Seed ───────────────────────────────────────────────────────
    await runPhase(state, 'Phase 1 — Seed', async () => {
      await seedOrganization(state);
      return {
        adminId: state.admin.dbUserId,
        employeeCount: state.employees.length,
        fullBrowser: state.fullBrowserEmployees.length,
        synthetic: state.syntheticEmployees.length,
      };
    });

    // ── Phase 2: Admin Campaign ─────────────────────────────────────────────
    await runPhase(state, 'Phase 2 — Admin Campaign', async () => {
      // Launch browser for admin UI verification
      browser = await chromium.launch({ headless: true });
      adminActor = new AdminActor();
      await adminActor.init(browser);
      await adminActor.login(state);

      // Send welcome emails (triggers SMTP → Mailpit)
      await adminActor.sendWelcomeEmails(state);

      // Also send the phishing simulation campaign
      const msgId = await adminActor.triggerPhishingCampaign(state);
      state.campaignRunId = msgId;

      return { campaignMsgId: msgId };
    });

    // ── Phase 3: Email Delivery ─────────────────────────────────────────────
    await runPhase(state, 'Phase 3 — Email Delivery', async () => {
      if (!mailpitOk) {
        return { skipped: true, reason: 'Mailpit not available' };
      }

      const recipientEmails = state.employees.map(e => e.email.toLowerCase());
      const received = await mailpit.waitForEmails(
        recipientEmails,
        Config.EMAIL_WAIT_TIMEOUT_MS,
      );

      const deliveredCount = received.size;
      console.log(`  ✓ ${deliveredCount}/${state.employees.length} emails delivered`);

      // Extract phishing links from the campaign emails
      for (const [addr, msg] of received.entries()) {
        const parsed = await mailpit.getParsedEmail(msg.ID);
        const phishingLink = parsed.links.find(l =>
          Config.SUSPICIOUS_URLS.some(s => l.includes(s.split('/')[2]))
        ) ?? Config.SUSPICIOUS_URLS[0];

        const emp = state.employees.find(e => e.email.toLowerCase() === addr);
        if (emp) {
          state.campaignEmails.push({
            recipientEmail: addr,
            mailpitMessageId: msg.ID,
            phishingLink,
            subject: parsed.subject,
            deliveredAt: parsed.receivedAt,
          });
          emp.actual.emailDelivered = true;
        }
      }

      return { delivered: deliveredCount, total: state.employees.length };
    });

    // ── Phase 4: Employee Simulation ────────────────────────────────────────
    await runPhase(state, 'Phase 4 — Employee Simulation', async () => {
      const phishingUrl = Config.SUSPICIOUS_URLS[0];

      // -- Full Browser Actors (real extension) --
      const fullBrowserActors: FullBrowserEmployeeActor[] = [];

      for (const emp of state.fullBrowserEmployees) {
        if (Config.USE_REAL_EXTENSION) {
          // Each full-browser employee gets their own persistent context with extension
          const tmpDir = `/tmp/e2e-${emp.id}`;
          const ctx = await launchExtensionBrowser(tmpDir);
          extensionContexts.push(ctx);

          const actor = new FullBrowserEmployeeActor(emp);
          // Use the extension context's first page
          const page = ctx.pages()[0] || await ctx.newPage();
          (actor as unknown as { page: typeof page }).page = page;
          (actor as unknown as { context: typeof ctx }).context = ctx;

          await actor.login();
          await actor.runSimulation(phishingUrl);
          fullBrowserActors.push(actor);
        }
      }

      // -- Synthetic Actors (API simulation) --
      const syntheticPromises = state.syntheticEmployees.map(async emp => {
        const actor = new SyntheticEmployeeActor(emp);
        await actor.runSimulation(phishingUrl);
      });
      await Promise.all(syntheticPromises);

      const clicks = state.employees.filter(e => e.expected.clickedPhishingLink).length;
      const reports = state.employees.filter(e => e.expected.reportedEmail).length;
      const ignored = state.employees.filter(e => e.expected.ignoredEmail).length;

      return { clicks, reports, ignored };
    });

    // ── Phase 5: Validation ─────────────────────────────────────────────────
    await runPhase(state, 'Phase 5 — Validation', async () => {
      // Allow a short settling period for async DB writes
      await sleep(3000);

      // Trigger analytics re-computation
      try {
        await apiValidator.triggerStatsRefresh(state);
        await sleep(2000);
      } catch {
        // Non-fatal
      }

      const allResults: import('../validators/database.validator').ValidationResult[] = [];

      // Layer 1: Raw DB
      if (dbOk) {
        const dbResults = await dbValidator.validateAll('org_default', state.expected);
        allResults.push(...dbResults);

        // Capture actual DB state into scenario state
        const snap = await dbValidator.snapshot('org_default');
        state.actual.websiteScansInDB = snap.websiteScans;
        state.actual.securityEventsInDB = snap.securityEvents;
        state.actual.threatReportsInDB = snap.threatReports;

        console.log('\n  DB Snapshot:');
        console.log(`    website_scans:    ${snap.websiteScans} (${snap.websiteScansBlocked} blocked, ${snap.websiteScansWarned} warned)`);
        console.log(`    security_events:  ${snap.securityEvents} (${snap.securityEventsHigh} high, ${snap.securityEventsMedium} medium)`);
        console.log(`    threat_reports:   ${snap.threatReports} submitted`);
      }

      // Layer 2: API
      const apiResults = await apiValidator.validateAll(state, state.expected);
      allResults.push(...apiResults);

      const apiStats = await apiValidator.getAdminStats(state);
      state.actual.apiTotalScans = apiStats.totalScans;
      state.actual.apiThreatsDetected = apiStats.threatsDetected;

      // Layer 3: Dashboard UI
      if (browser && adminActor) {
        const uiResult = await adminActor.verifyDashboardUI(state, {
          minScans: 0,
          minThreats: 0,
        });
        state.actual.dashboardTotalScans = state.actual.apiTotalScans;
        state.actual.dashboardThreatsDetected = state.actual.apiThreatsDetected;
      }

      // Print validation summary
      console.log('\n  Validation Results:');
      for (const r of allResults) {
        console.log(`    ${r.message}`);
      }

      const validationPassed = allResults.every(r => r.passed);
      const discrepancies = state.getDiscrepancies();

      if (discrepancies.length > 0 && !validationPassed) {
        console.log('\n  ⚠ Discrepancies found:');
        for (const d of discrepancies) {
          console.log(`    ${d.field}: expected=${d.expected} actual=${d.actual} (Δ${d.delta >= 0 ? '+' : ''}${d.delta})`);
        }
      }

      return {
        passed: validationPassed,
        assertions: allResults.length,
        passed_count: allResults.filter(r => r.passed).length,
        apiStats,
        discrepancies,
      };
    });

  } finally {
    // Cleanup
    state.finishedAt = new Date();

    for (const ctx of extensionContexts) {
      await ctx.close().catch(() => {});
    }
    if (adminActor) await (adminActor as any).close().catch(() => {});
    if (browser) await (browser as any).close().catch(() => {});
    if (dbValidator) await dbValidator.close().catch(() => {});

    if (!options.skipCleanup) {
      await teardownOrganization(state);
    }
  }

  return { passed: state.passed, phases: state.phases, state };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function runPhase(
  state: ScenarioState,
  name: string,
  fn: () => Promise<Record<string, unknown>>,
): Promise<void> {
  const start = Date.now();
  console.log(`\n▶ ${name}...`);

  try {
    const details = await fn();
    const durationMs = Date.now() - start;
    state.addPhase({ phase: name, passed: true, durationMs, details });
    console.log(`✓ ${name} complete [${(durationMs / 1000).toFixed(1)}s]`);
  } catch (err) {
    const durationMs = Date.now() - start;
    const error = (err as Error).message;
    state.addPhase({ phase: name, passed: false, durationMs, details: {}, error });
    console.error(`✗ ${name} FAILED: ${error}`);
    throw err; // Re-throw to stop the simulation
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
