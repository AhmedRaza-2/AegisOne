/**
 * AegisOne E2E Simulation — Safe Browsing Scenario (Negative Path)
 *
 * Validates the HAPPY PATH: all employees browse only safe URLs.
 * Extension should NOT fire any warnings.
 * DB should show all scans with decision='allow'.
 *
 * This is a critical negative test — proves we don't have false positives.
 */

import { chromium, Browser } from '@playwright/test';
import { Config } from '../config';
import { ScenarioState } from '../orchestrator/scenario-state';
import { generateEmployees, summarizeProfiles } from '../fixtures/profiles';
import { seedOrganization, teardownOrganization } from '../fixtures/seed';
import { AdminActor } from '../actors/admin.actor';
import { SyntheticEmployeeActor } from '../actors/employee.actor';
import { DatabaseValidator } from '../validators/database.validator';
import { APIValidator } from '../validators/api.validator';
import { ScenarioResult } from './phishing-campaign';

export async function runSafeBrowsingScenario(options: {
  scale?: number;
  seed?: string;
  skipCleanup?: boolean;
}): Promise<ScenarioResult> {
  const scale = options.scale ?? Config.SCALE;
  const seed = `${options.seed ?? Config.SIMULATION_SEED}-safe`;

  const state = new ScenarioState('safe-browsing', 'org_default', seed, scale);
  state.admin = {
    email: 'e2e.admin.safe@aegisone.e2etest.local',
    password: 'E2eAdminSafe2026!',
  };

  // In the safe-browsing scenario, we override all employees to 'security_aware'
  // profile so they will NEVER click phishing links.
  state.employees = generateEmployees('org_default', scale, seed, state.admin.email);

  // Force all safe for this scenario
  for (const emp of state.employees) {
    emp.expected.clickedPhishingLink = false;
    emp.expected.reportedEmail = false;
    emp.expected.ignoredEmail = true;
    emp.expected.urlsSuspicious = [];
    emp.expected.urlsVisited = [...Config.SAFE_URLS];
  }

  state.computeExpected();

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(' AEGISONE E2E SAFE BROWSING SCENARIO (Negative Test)');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Purpose: Verify no false positives on safe URLs`);

  const dbValidator = new DatabaseValidator();
  const apiValidator = new APIValidator();
  let browser: Browser | null = null;
  let adminActor: AdminActor | null = null;

  try {
    // Phase 1: Seed
    await runPhase(state, 'Phase 1 — Seed', async () => {
      await seedOrganization(state);
      return { employeeCount: state.employees.length };
    });

    // Phase 2: All employees browse only safe URLs (no phishing)
    await runPhase(state, 'Phase 2 — Safe Browsing', async () => {
      let totalEvents = 0;

      for (const emp of state.syntheticEmployees) {
        const actor = new SyntheticEmployeeActor(emp);
        // Pass an empty/non-suspicious URL — no threat events
        const events = await actor.injectBrowsingEvents('https://github.com');
        totalEvents += events;
      }

      return { totalEventsInjected: totalEvents };
    });

    // Phase 3: Validate — no threats should have been detected
    await runPhase(state, 'Phase 3 — Validate (No False Positives)', async () => {
      await sleep(2000);

      const snap = await dbValidator.snapshot('org_default');

      const noFalsePositives = snap.websiteScansBlocked === 0 && snap.websiteScansWarned === 0;
      const noThreatReports = snap.threatReports === 0;

      console.log(`  DB: ${snap.websiteScans} scans, ${snap.websiteScansBlocked} blocked, ${snap.websiteScansWarned} warned`);
      console.log(`  DB: ${snap.threatReports} threat reports`);

      if (!noFalsePositives) {
        throw new Error(
          `FALSE POSITIVES DETECTED: ${snap.websiteScansBlocked} blocked, ${snap.websiteScansWarned} warned on safe URLs`
        );
      }

      return {
        passed: noFalsePositives && noThreatReports,
        scans: snap.websiteScans,
        blocked: snap.websiteScansBlocked,
        warned: snap.websiteScansWarned,
        threatReports: snap.threatReports,
      };
    });

  } finally {
    state.finishedAt = new Date();
    if (adminActor) await (adminActor as any).close().catch(() => {});
    if (browser) await (browser as any).close().catch(() => {});
    if (dbValidator) await dbValidator.close().catch(() => {});

    if (!options.skipCleanup) {
      await teardownOrganization(state);
    }
  }

  return { passed: state.passed, phases: state.phases, state };
}

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
    console.log(`✓ ${name} [${(durationMs / 1000).toFixed(1)}s]`);
  } catch (err) {
    const durationMs = Date.now() - start;
    const error = (err as Error).message;
    state.addPhase({ phase: name, passed: false, durationMs, details: {}, error });
    console.error(`✗ ${name} FAILED: ${error}`);
    throw err;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
