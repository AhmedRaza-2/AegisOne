import assert from 'node:assert/strict';
import test from 'node:test';
import { RegistrationServiceError, registrationLookupError, requireSupabaseConfiguration, resolveSupabaseConfiguration } from './supabase-config.ts';

const jwt = (claims: Record<string, unknown>, header: unknown = { alg: 'HS256', typ: 'JWT' }): string => {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode(header)}.${encode(claims)}.test-signature`;
};

test('missing and example configuration cannot silently select an unrelated Supabase project', () => {
  for (const env of [{}, { VITE_SUPABASE_URL: 'https://your-project.supabase.co', VITE_SUPABASE_ANON_KEY: 'your-anon-key-here' }, { VITE_SUPABASE_URL: 'https://project.example', VITE_SUPABASE_ANON_KEY: 'your-anon-key-here' }]) {
    const config = resolveSupabaseConfiguration(env);
    assert.equal(config.configured, false);
    assert.equal(config.url, 'https://unconfigured.invalid');
    assert.throws(() => requireSupabaseConfiguration(config), error => error instanceof RegistrationServiceError && error.code === 'registration_unconfigured');
  }
});

test('a real configured public project or loopback instance is used without a fallback', () => {
  for (const url of ['https://configured-project.supabase.co/', 'http://localhost:54321', 'http://127.0.0.1:54321']) {
    const config = resolveSupabaseConfiguration({ VITE_SUPABASE_URL: ` ${url} `, VITE_SUPABASE_ANON_KEY: ' public-test-key ' });
    assert.equal(config.configured, true);
    assert.equal(config.url, url.replace(/\/$/, ''));
    assert.equal(config.anonKey, 'public-test-key');
    assert.doesNotThrow(() => requireSupabaseConfiguration(config));
  }
});

test('invalid project URLs are rejected without breaking module initialization', () => {
  for (const url of ['not-a-url', 'javascript:alert(1)', 'http://remote.example', 'https://user:password@project.example', 'https://project.example/rest/v1', 'https://project.example/?key=secret', 'https://project.example/#fragment']) {
    const config = resolveSupabaseConfiguration({ VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: 'public-test-key' });
    assert.equal(config.configured, false, url);
    assert.equal(config.problem, 'invalid_url', url);
  }
});

test('public publishable keys and anon JWT keys are accepted for the matching project', () => {
  for (const anonKey of ['sb_publishable_testPublicKey_123', jwt({ role: 'anon', ref: 'configured-project' })]) {
    const config = resolveSupabaseConfiguration({ VITE_SUPABASE_URL: 'https://configured-project.supabase.co', VITE_SUPABASE_ANON_KEY: anonKey });
    assert.equal(config.configured, true);
    assert.equal(config.anonKey, anonKey);
  }
  const local = resolveSupabaseConfiguration({ VITE_SUPABASE_URL: 'http://localhost:54321', VITE_SUPABASE_ANON_KEY: jwt({ role: 'anon' }) });
  assert.equal(local.configured, true);
});

test('secret keys, elevated JWT roles and mismatched projects cannot configure the browser client', () => {
  for (const anonKey of [
    'sb_secret_private-test-key',
    jwt({ role: 'service_role', ref: 'configured-project' }),
    jwt({ role: 'authenticated', ref: 'configured-project' }),
    jwt({ ref: 'configured-project' }),
    jwt({ role: 'anon', ref: 'another-project' }),
  ]) {
    const config = resolveSupabaseConfiguration({ VITE_SUPABASE_URL: 'https://configured-project.supabase.co', VITE_SUPABASE_ANON_KEY: anonKey });
    assert.equal(config.configured, false);
    assert.equal(config.problem, 'invalid_key');
    assert.equal(config.anonKey, 'unconfigured-public-key');
    assert.throws(() => requireSupabaseConfiguration(config), error => error instanceof RegistrationServiceError && !error.message.includes(anonKey));
  }
});

test('malformed JWT and publishable keys fail safely', () => {
  for (const anonKey of [
    'eyJmalformed',
    'e30.not-json.signature',
    'header.payload.signature.extra',
    jwt({ role: 'anon' }, { alg: 'none' }),
    jwt({ role: 'anon' }, []),
    jwt({ role: 'anon', ref: 123 }),
    jwt({ role: 'anon' }).replace(/\.[^.]+$/, '.'),
    'sb_publishable_',
    'sb_publishable_invalid key',
  ]) {
    const config = resolveSupabaseConfiguration({ VITE_SUPABASE_URL: 'https://configured-project.supabase.co', VITE_SUPABASE_ANON_KEY: anonKey });
    assert.equal(config.configured, false);
    assert.equal(config.problem, 'invalid_key');
  }
});

test('failed duplicate lookups report service availability or permissions without echoing internals', () => {
  const cause = { code: 'PGRST000', message: 'PRIVATE_DATABASE_ERROR_SENTINEL' };
  const unavailable = registrationLookupError(cause, 503);
  assert.equal(unavailable.code, 'registration_unavailable');
  assert.doesNotMatch(unavailable.message, /organization name|PRIVATE_DATABASE_ERROR_SENTINEL/);
  assert.equal(unavailable.cause, cause);
  assert.equal(registrationLookupError({ code: '42501' }, 400).code, 'registration_restricted');
  assert.equal(registrationLookupError({}, 401).code, 'registration_restricted');
  assert.equal(registrationLookupError({}, 403).code, 'registration_restricted');
});
