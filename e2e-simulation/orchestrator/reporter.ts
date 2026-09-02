/**
 * AegisOne E2E Simulation — Rich Terminal Reporter
 *
 * Renders a beautiful, structured result summary after each simulation run.
 * Also writes a machine-readable JSON report for CI consumption.
 */

import fs from 'fs';
import path from 'path';
import { ScenarioState, PhaseResult } from './scenario-state';

// ANSI color codes (chalk-free for cross-platform reliability)
const GREEN  = '\x1b[32m';
const RED    = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE   = '\x1b[34m';
const CYAN   = '\x1b[36m';
const BOLD   = '\x1b[1m';
const DIM    = '\x1b[2m';
const RESET  = '\x1b[0m';

const PASS_ICON = `${GREEN}✓${RESET}`;
const FAIL_ICON = `${RED}✗${RESET}`;
const WARN_ICON = `${YELLOW}⚠${RESET}`;

export class Reporter {
  private outputDir: string;

  constructor(outputDir = 'results') {
    this.outputDir = outputDir;
    fs.mkdirSync(outputDir, { recursive: true });
  }

  printFinalReport(state: ScenarioState): void {
    const durationSec = (state.totalDurationMs / 1000).toFixed(1);
    const passed = state.passed;

    console.log('\n');
    console.log(`${BOLD}${CYAN}═══════════════════════════════════════════════════════════${RESET}`);
    console.log(`${BOLD}${CYAN}  AEGISONE E2E ORGANIZATION SIMULATION — RESULTS${RESET}`);
    console.log(`${BOLD}${CYAN}═══════════════════════════════════════════════════════════${RESET}`);

    console.log(`\n  ${BOLD}Scenario:${RESET}  ${state.scenarioName}`);
    console.log(`  ${BOLD}Seed:${RESET}      ${state.seed}`);
    console.log(`  ${BOLD}Scale:${RESET}     ${state.scale} employees`);
    console.log(`  ${BOLD}Duration:${RESET}  ${durationSec}s`);

    // ── Phase Summary ──────────────────────────────────────────────────────
    console.log(`\n  ${BOLD}Phases:${RESET}`);
    for (const phase of state.phases) {
      const icon = phase.passed ? PASS_ICON : FAIL_ICON;
      const dur = `${(phase.durationMs / 1000).toFixed(1)}s`;
      const errMsg = phase.error ? `  ${RED}→ ${phase.error}${RESET}` : '';
      console.log(`    ${icon} ${phase.phase.padEnd(38)} ${DIM}[${dur}]${RESET}${errMsg}`);
    }

    // ── Actor Summary ──────────────────────────────────────────────────────
    console.log(`\n  ${BOLD}Actors:${RESET}`);
    console.log(`    ${PASS_ICON} Admin:          ${state.admin.email}`);
    console.log(`    ${PASS_ICON} Full-browser:   ${state.fullBrowserEmployees.length} employees (real extension)`);
    console.log(`    ${PASS_ICON} Synthetic:      ${state.syntheticEmployees.length} employees (API injection)`);

    // ── Expected vs Actual ─────────────────────────────────────────────────
    console.log(`\n  ${BOLD}Simulation Outcomes (Expected → Actual):${RESET}`);
    const exp = state.expected;
    const act = state.actual;

    printMetric('Emails delivered',     exp.totalEmailsDelivered,  exp.totalEmailsSent,  '=');
    printMetric('Website scans (DB)',   exp.totalWebsiteScans,     act.websiteScansInDB, '≥');
    printMetric('Threat reports (DB)',  exp.totalThreatReports,    act.threatReportsInDB,'≥');
    printMetric('API total scans',      exp.totalWebsiteScans + exp.totalSyntheticScans, act.apiTotalScans, '≥');

    // ── Discrepancies ──────────────────────────────────────────────────────
    const discrepancies = state.getDiscrepancies();
    if (discrepancies.length > 0) {
      console.log(`\n  ${WARN_ICON} ${BOLD}Discrepancies:${RESET}`);
      for (const d of discrepancies) {
        const symbol = d.delta >= 0 ? `+${d.delta}` : `${d.delta}`;
        console.log(`    ${YELLOW}${d.field}: expected=${d.expected} actual=${d.actual} (Δ${symbol})${RESET}`);
      }
    }

    // ── Employee Behavior Summary ──────────────────────────────────────────
    console.log(`\n  ${BOLD}Employee Behavior Distribution:${RESET}`);
    const clicks  = state.employees.filter(e => e.expected.clickedPhishingLink).length;
    const reports = state.employees.filter(e => e.expected.reportedEmail).length;
    const ignored = state.employees.filter(e => e.expected.ignoredEmail).length;
    console.log(`    Clicked phishing link:  ${clicks}`);
    console.log(`    Reported email:         ${reports}`);
    console.log(`    Ignored email:          ${ignored}`);

    // ── Overall Result ─────────────────────────────────────────────────────
    console.log('');
    console.log(`${BOLD}${CYAN}═══════════════════════════════════════════════════════════${RESET}`);
    if (passed) {
      console.log(`${BOLD}  RESULT: ${GREEN}✅ PASS${RESET}${BOLD}  |  Total: ${durationSec}s${RESET}`);
    } else {
      console.log(`${BOLD}  RESULT: ${RED}❌ FAIL${RESET}${BOLD}  |  Total: ${durationSec}s${RESET}`);
    }
    console.log(`${BOLD}${CYAN}═══════════════════════════════════════════════════════════${RESET}`);
    console.log('');
  }

  writeJSONReport(state: ScenarioState): string {
    const filename = `simulation-result-${state.scenarioName}-${Date.now()}.json`;
    const outPath = path.join(this.outputDir, filename);

    const report = {
      ...state.toJSON(),
      generatedAt: new Date().toISOString(),
      version: '1.0.0',
    };

    fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf-8');
    console.log(`  ℹ JSON report: ${outPath}`);
    return outPath;
  }

  writeLatestSymlink(state: ScenarioState, jsonPath: string): void {
    const latestPath = path.join(this.outputDir, 'latest.json');
    const report = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    fs.writeFileSync(latestPath, JSON.stringify(report, null, 2), 'utf-8');
  }
}

// ── Helper ─────────────────────────────────────────────────────────────────

function printMetric(
  label: string,
  expected: number,
  actual: number,
  operator: '=' | '≥',
): void {
  let passed: boolean;
  if (operator === '=') passed = actual === expected;
  else passed = actual >= expected;

  const icon = passed ? PASS_ICON : FAIL_ICON;
  const actualStr = actual === 0 && expected > 0 ? `${YELLOW}${actual}${RESET}` : String(actual);
  console.log(`    ${icon} ${label.padEnd(28)} expected ${operator} ${expected}, got ${actualStr}`);
}
