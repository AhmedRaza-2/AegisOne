import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import { build } from 'vite';

const landingRoot = fileURLToPath(new URL('../../', import.meta.url));
const envValues = {
  VITE_ADMIN_PASSWORD: 'PRIVATE_ADMIN_SENTINEL',
  VITE_SETUP_KEY: 'PRIVATE_SETUP_SENTINEL',
  VITE_UNREVIEWED_SECRET: 'PRIVATE_UNKNOWN_SENTINEL',
  AEGIS_JWT_SECRET: 'PRIVATE_JWT_SENTINEL',
  SETUP_KEY: 'PRIVATE_SERVER_SETUP_SENTINEL',
  GROQ_API_KEY: 'PRIVATE_PROVIDER_SENTINEL',
  VITE_SUPABASE_URL: 'https://test-project.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'sb_publishable_public-test-key',
};

test('production browser bundle exposes only approved public env values', async () => {
  const original = Object.fromEntries(Object.keys(envValues).map(key => [key, process.env[key]]));
  const fixture = await mkdtemp(path.join(os.tmpdir(), 'aegis-public-env-'));
  try {
    Object.assign(process.env, envValues);
    const entry = path.join(fixture, 'entry.js');
    await writeFile(entry, 'globalThis.aegisEnv = import.meta.env;');
    const bundle = async () => {
      const result = await build({
        configFile: path.join(landingRoot, 'vite.config.ts'),
        root: fixture,
        logLevel: 'silent',
        build: { write: false, minify: false, rollupOptions: { input: entry } },
      });
      const outputs = Array.isArray(result) ? result : [result];
      return outputs.flatMap(output => output.output).filter(output => output.type === 'chunk').map(output => output.code).join('\n');
    };
    const code = await bundle();
    assert.ok(code.includes(envValues.VITE_SUPABASE_URL));
    assert.ok(code.includes(envValues.VITE_SUPABASE_ANON_KEY));
    assert.doesNotMatch(code, /PRIVATE_[A-Z_]+_SENTINEL/);

    for (const unsafeKey of ['sb_secret_PRIVATE_TEST', `${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from('{"role":"service_role"}').toString('base64url')}.signature`]) {
      process.env.VITE_SUPABASE_URL = envValues.VITE_SUPABASE_URL;
      process.env.VITE_SUPABASE_ANON_KEY = unsafeKey;
      // Capture the credential-free config error before Vite's logger can print anything.
      await assert.rejects(bundle(), error => /public publishable\/anon key/.test(error.message) && !error.message.includes(unsafeKey));

      for (const invalidUrl of ['', 'https://your-project.supabase.co', 'not-a-valid-url']) {
        // An empty override models a missing URL without falling back to the real root .env.
        process.env.VITE_SUPABASE_URL = invalidUrl;
        const sanitizedCode = await bundle();
        assert.ok(!sanitizedCode.includes(unsafeKey));
        assert.doesNotMatch(sanitizedCode, /PRIVATE_[A-Z_]+_SENTINEL/);
        const target = {};
        runInNewContext(sanitizedCode, { globalThis: target });
        assert.equal(target.aegisEnv.VITE_SUPABASE_URL, '');
        assert.equal(target.aegisEnv.VITE_SUPABASE_ANON_KEY, '');
      }
    }
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    assert.equal(path.dirname(path.resolve(fixture)), path.resolve(os.tmpdir()));
    await rm(fixture, { recursive: true, force: true });
  }
});
