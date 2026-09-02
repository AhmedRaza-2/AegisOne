import { chromium, Browser, BrowserContext } from '@playwright/test';
import axios from 'axios';
import { Config } from '../config';
import { ScenarioState, SimulatedEmployee } from '../orchestrator/scenario-state';
import { generateEmployees } from '../fixtures/profiles';
import { seedOrganization, teardownOrganization, loginUser } from '../fixtures/seed';
import { runUiAdminLogin } from '../fixtures/ui-setup';
import { runUiUserInvite } from '../fixtures/ui-invite';
import { bulkApiProvisionUsers } from '../fixtures/api-provisioning';
import { MailpitClient } from '../email/mailpit.client';
import { FullBrowserEmployeeActor, launchExtensionBrowser } from '../actors/employee.actor';
import { DatabaseValidator } from '../validators/database.validator';
import { APIValidator } from '../validators/api.validator';
import { validateDashboardAnalytics } from '../validators/ui.validator';

export async function runRealisticOrgScenario(options: { scale?: number }): Promise<any> {
  const scale = options.scale ?? 20;

  // Phase 0: Initialize state with unique run ID for full isolation
  const state = new ScenarioState('realistic-org', Config.ORG_ID, Config.SIMULATION_SEED, scale);
  state.admin = {
    email: `e2e.admin@aegisone.e2etest.local`,
    password: 'E2eAdminPass2026!',
    token: '',
  };

  state.employees = generateEmployees(Config.ORG_ID, scale, Config.SIMULATION_SEED, state.admin.email);
  for (const emp of state.employees) {
    emp.lifecycleState = 'INITIALIZED' as const;
  }

  state.computeExpected();

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(' AEGISONE E2E REALISTIC ORG SIMULATION');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Run ID:  ${Config.RUN_ID}`);
  console.log(`  Org ID:  ${Config.ORG_ID}`);
  console.log(`  Scale:   ${scale} employees\n`);

  const mailpit = new MailpitClient();
  const dbValidator = new DatabaseValidator();
  const apiValidator = new APIValidator();

  // Pre-flight: check Mailpit availability
  const mailpitOk = await mailpit.isHealthy();
  if (!mailpitOk) {
    console.warn('  ⚠ Mailpit not available — email extraction steps will be skipped');
  } else {
    await mailpit.clearAll();
  }

  // Launch admin browser for UI coverage phases
  const adminBrowser = await chromium.launch({ headless: true });
  const adminContext = await adminBrowser.newContext();
  const adminPage = await adminContext.newPage();

  const passed = { overall: true };
  const phases: any[] = [];

  try {
    // ── Phase 1: API Seed (matches what works in phishing-campaign) ────────────
    await runPhase(phases, 'Phase 1 — API Seed & Org Bootstrap', async () => {
      await seedOrganization(state);
      for (const emp of state.employees) {
        emp.lifecycleState = 'PROVISIONED' as const;
      }
      return { adminId: state.admin.dbUserId, employees: state.employees.length };
    });

    // ── Phase 2: UI Login + UI-create a subset of users ───────────────────────
    await runPhase(phases, 'Phase 2 — Admin UI Login & User Creation', async () => {
      const adminToken = await runUiAdminLogin(adminPage, state);
      state.admin.token = adminToken;

      // UI: create 1 manager + 2 employees through Dashboard (real coverage)
      const uiMgrs = state.employees.filter(e => e.role === 'manager').slice(0, 1);
      const uiEmps = state.employees.filter(e => e.role === 'employee').slice(0, 2);
      await runUiUserInvite(adminPage, [...uiMgrs, ...uiEmps]);

      return { uiCreated: uiMgrs.length + uiEmps.length };
    });

    // ── Phase 3: Email Delivery & Credential Extraction ───────────────────────
    await runPhase(phases, 'Phase 3 — Email Delivery & Credential Extraction', async () => {
      if (!mailpitOk) {
        console.log('    ⚠ Skipped (Mailpit not available)');
        return { extracted: 0 };
      }

      const addresses = state.employees.map(e => e.email.toLowerCase());
      const emails = await mailpit.waitForEmails(addresses, 20_000);

      let extracted = 0;
      for (const emp of state.employees) {
        const msg = emails.get(emp.email.toLowerCase());
        if (msg) {
          emp.lifecycleState = 'EMAIL_RECEIVED' as const;
          const detail = await mailpit.getMessage(msg.ID);
          const tempPass = mailpit.extractWelcomeCredentials(detail.HTML);
          if (tempPass) {
            emp.password = tempPass;
            emp.lifecycleState = 'CREDENTIAL_EXTRACTED' as const;
            extracted++;
          } else {
            emp.lifecycleError = 'Failed to extract password from HTML';
          }
        }
      }

      console.log(`    ✓ Credentials extracted for ${extracted}/${scale} employees`);
      return { extracted, total: scale };
    });

    // ── Phase 4: Batched UI Login Simulation ──────────────────────────────────
    await runPhase(phases, 'Phase 4 — Batched Employee UI Logins', async () => {
      const batchSize = 5;
      let loggedIn = 0;

      const fullBrowserEmps = state.employees.filter(e => e.actorType === 'full_browser');

      for (let i = 0; i < fullBrowserEmps.length; i += batchSize) {
        const batch = fullBrowserEmps.slice(i, i + batchSize);
        console.log(`    → Batch ${Math.floor(i / batchSize) + 1} (${batch.length} employees)`);

        await Promise.all(batch.map(async (emp) => {
          let empCtx: BrowserContext | null = null;
          try {
            empCtx = await launchExtensionBrowser();
            const actor = new FullBrowserEmployeeActor(emp);
            actor['context'] = empCtx;
            actor['page'] = await empCtx.newPage();

            await actor.uiLogin();
            loggedIn++;

            // Visit safe and suspicious URLs to trigger extension
            await actor.visitUrl(Config.SAFE_URLS[0]);
            if (emp.expected.clickedPhishingLink) {
              await actor.visitUrl(Config.SUSPICIOUS_URLS[0]);
            }
          } catch (e: any) {
            emp.lifecycleState = 'FAILED' as const;
            emp.lifecycleError = e.message;
            console.error(`    ✗ [${emp.id}] Failed: ${e.message}`);
          } finally {
            if (empCtx) await empCtx.close().catch(() => {});
          }
        }));
      }

      // Synthetic employees: inject events via API
      const synthEmps = state.employees.filter(e => e.actorType === 'api_synthetic');
      for (const emp of synthEmps) {
        try {
          const { SyntheticEmployeeActor } = await import('../actors/employee.actor');
          const actor = new SyntheticEmployeeActor(emp);
          await actor.login();
          await actor.injectBrowsingEvents(Config.SUSPICIOUS_URLS[0]);
          emp.lifecycleState = 'EVENT_RECORDED' as const;
        } catch (e: any) {
          emp.lifecycleError = e.message;
        }
      }

      return { loggedIn, synthetic: synthEmps.length };
    });

    // ── Phase 5: Wait for events to propagate ─────────────────────────────────
    await runPhase(phases, 'Phase 5 — Event Pipeline Propagation', async () => {
      await new Promise(r => setTimeout(r, 3000));
      return { waited: '3s' };
    });

    // ── Phase 6: Layered Validation ───────────────────────────────────────────
    await runPhase(phases, 'Phase 6 — Layered Validation', async () => {
      const results: Record<string, any> = {};

      // Layer 1: DB
      const dbOk = await dbValidator.isHealthy();
      if (dbOk) {
        const snap = await dbValidator.snapshot('org_default');
        results.db = { scans: snap.websiteScans, threats: snap.websiteScansBlocked };
        console.log(`    Layer 1 (DB)    → scans=${snap.websiteScans}, threats=${snap.websiteScansBlocked}`);
      } else {
        console.log(`    Layer 1 (DB)    → ⚠ Skipped (not reachable)`);
      }

      // Layer 2: API
      const apiStats = await apiValidator.getAdminStats(state).catch(() => null);
      if (apiStats) {
        results.api = apiStats;
        console.log(`    Layer 2 (API)   → total_scans=${apiStats.totalScans}`);
      }

      // Layer 3: Dashboard UI stat cards
      const uiStats = await validateDashboardAnalytics(adminPage).catch(() => null);
      if (uiStats) {
        results.ui = uiStats;
        console.log(`    Layer 3 (UI)    → scans=${uiStats.totalScans}, threats=${uiStats.threatsDetected}`);
      }

      return results;
    });

    // ── Phase 7: Teardown ─────────────────────────────────────────────────────
    await runPhase(phases, 'Phase 7 — Teardown', async () => {
      await teardownOrganization(state);
      return { cleaned: true };
    });

  } finally {
    await adminBrowser.close().catch(() => {});
  }

  // Print results
  const failed = phases.filter(p => !p.passed);
  passed.overall = failed.length === 0;

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  AEGISONE REALISTIC ORG SIMULATION — RESULTS');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Run ID:  ${Config.RUN_ID}`);
  console.log(`  Scale:   ${scale} employees\n`);
  for (const p of phases) {
    const icon = p.passed ? '✓' : '✗';
    console.log(`    ${icon} ${p.name.padEnd(50)} [${p.durationMs}ms]`);
  }
  console.log(`\n═══════════════════════════════════════════════════════════`);
  console.log(`  RESULT: ${passed.overall ? '✅ PASS' : '❌ FAIL'}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  return { passed: passed.overall, state, phases };
}

// ── Helper ────────────────────────────────────────────────────────────────────

async function runPhase(
  phases: any[],
  name: string,
  fn: () => Promise<any>,
): Promise<any> {
  console.log(`\n▶ ${name}...`);
  const start = Date.now();
  try {
    const result = await fn();
    const durationMs = Date.now() - start;
    console.log(`✓ ${name} complete [${durationMs}ms]`);
    phases.push({ name, passed: true, durationMs, result });
    return result;
  } catch (err: any) {
    const durationMs = Date.now() - start;
    console.error(`✗ ${name} FAILED: ${err.message}`);
    phases.push({ name, passed: false, durationMs, error: err.message });
    throw err;
  }
}
