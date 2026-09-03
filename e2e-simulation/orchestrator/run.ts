/**
 * AegisOne E2E Simulation — Orchestrator CLI Entry Point
 *
 * Usage:
 *   npm run simulate                           # Default: phishing, 5 employees
 *   npm run simulate:phishing                  # Phishing campaign
 *   npm run simulate:safe                      # Safe browsing baseline
 *   npm run simulate -- --scale 20            # 20-employee scale
 *   npm run simulate -- --seed 20261231       # Custom seed
 *
 * Environment variables:
 *   E2E_API_URL, E2E_WEB_URL, MAILPIT_URL, E2E_DB_HOST, SIMULATION_SCALE
 *   KEEP_E2E_DATA=true    → don't delete test data after run
 */

import { runPhishingCampaign } from '../scenarios/phishing-campaign';
import { runSafeBrowsingScenario } from '../scenarios/safe-browsing';
import { runRealisticOrgScenario } from '../scenarios/realistic-org';
import { runVerticalSliceScenario } from '../scenarios/vertical-slice';
import { Reporter } from './reporter';
import { Config } from '../config';

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Parse CLI args (supports both --flag val and positional args: npm run simulate -- scenario scale)
  const positionalScenario = args.find(a => !a.startsWith('--') && isNaN(Number(a)));
  const positionalScale = args.find(a => !a.startsWith('--') && !isNaN(Number(a)));

  const scenarioArg  = getArg(args, '--scenario')  ?? positionalScenario ?? 'phishing-campaign';
  const scaleArg     = parseInt(getArg(args, '--scale') ?? positionalScale ?? String(Config.SCALE), 10);
  const seedArg      = getArg(args, '--seed')      ?? Config.SIMULATION_SEED;
  const skipCleanup  = args.includes('--keep-data') || Config.KEEP_E2E_DATA;

  const reporter = new Reporter('results');

  console.log(`\nAegisOne E2E Simulation`);
  console.log(`  API:       ${Config.API_URL}`);
  console.log(`  Dashboard: ${Config.WEB_URL}`);
  console.log(`  Mailpit:   ${Config.MAILPIT_API_URL}`);
  console.log(`  DB:        ${Config.DB.host}:${Config.DB.port}/${Config.DB.database}`);
  console.log(`  Extension: ${Config.USE_REAL_EXTENSION ? 'ENABLED' : 'disabled'} (${Config.EXTENSION_PATH})`);
  console.log(`  Scenario:  ${scenarioArg} | Scale: ${scaleArg} | Seed: ${seedArg}`);

  let exitCode = 0;

  try {
    let result;

    switch (scenarioArg) {
      case 'phishing-campaign':
      case 'phishing':
        result = await runPhishingCampaign({
          scale: scaleArg,
          seed: seedArg,
          skipCleanup,
        });
        break;

      case 'safe-browsing':
      case 'safe':
        result = await runSafeBrowsingScenario({
          scale: scaleArg,
          seed: seedArg,
          skipCleanup,
        });
        break;

      case 'realistic-org':
      case 'realistic':
        result = await runRealisticOrgScenario({
          scale: scaleArg,
        });
        break;

      case 'vertical-slice':
        result = await runVerticalSliceScenario();
        break;

      default:
        console.error(`Unknown scenario: ${scenarioArg}`);
        console.error('Available: phishing-campaign, safe-browsing');
        process.exit(1);
    }

    if (scenarioArg !== 'vertical-slice') {
      reporter.printFinalReport(result.state);
    }
    const jsonPath = reporter.writeJSONReport(result.state);
    reporter.writeLatestSymlink(result.state, jsonPath);

    if (!result.passed) {
      exitCode = 1;
    }
  } catch (err) {
    console.error('\n[FATAL] Simulation aborted:');
    console.error((err as Error).message);
    if (process.env.DEBUG) console.error((err as Error).stack);
    exitCode = 2;
  }

  process.exit(exitCode);
}

function getArg(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx === -1) return undefined;
  return args[idx + 1];
}

main().catch(err => {
  console.error(err);
  process.exit(2);
});
