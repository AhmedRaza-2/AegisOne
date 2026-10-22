import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';
import { resolveSupabaseConfiguration } from '../src/lib/supabase-config.ts';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const config = resolveSupabaseConfiguration(loadEnv('development', projectRoot, ''));

// Read-only checks: never sign up a user, send email, print credentials or fetch rows.
async function checkRegistration() {
  if (!config.configured) {
    console.error(`Registration configuration: ${config.problem}. Check the repository-root .env and restart Vite.`);
    process.exitCode = 1;
    return;
  }
  console.log(`Registration project: ${new URL(config.url).hostname}`);
  const headers = { apikey: config.anonKey };
  for (const [label, endpoint] of [
    ['Authentication', '/auth/v1/settings'],
    ['Organization schema/access (zero rows)', '/rest/v1/organizations?select=id,name,admin_email&limit=0'],
  ]) {
    try {
      const response = await fetch(`${config.url}${endpoint}`, { headers, signal: AbortSignal.timeout(10000) });
      if (!response.ok) {
        // Status is enough to guide diagnosis without echoing remote database details.
        console.error(`${label}: HTTP ${response.status}. Check the project key, schema and permissions; keep RLS enabled.`);
        process.exitCode = 1;
      } else {
        console.log(`${label}: OK`);
      }
    } catch (error) {
      const cause = (error as { cause?: { code?: string } })?.cause?.code;
      const dnsFailure = cause === 'ENOTFOUND' || cause === 'EAI_AGAIN';
      console.error(dnsFailure
        ? `${label}: DNS lookup failed. Verify the project URL and resume the project if paused in Supabase.`
        : `${label}: connection failed or timed out. Check the project status and your network.`);
      process.exitCode = 1;
      // A network failure affects both endpoints; avoid repeating the same request.
      return;
    }
  }
}

await checkRegistration();
