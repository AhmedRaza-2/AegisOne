import assert from 'node:assert/strict';
import test from 'node:test';
import { hasTrustedSuperAdminRole } from './admin-access.ts';

test('super-admin access requires the server-controlled app role', () => {
  assert.equal(hasTrustedSuperAdminRole({ app_metadata: { role: 'super_admin' } }), true);
  for (const user of [null, undefined, {}, { app_metadata: null }, { app_metadata: {} }, { app_metadata: { role: 'admin' } }]) {
    assert.equal(hasTrustedSuperAdminRole(user), false);
  }
});

test('user-editable metadata and email never grant super-admin access', () => {
  for (const user of [
    { app_metadata: {}, user_metadata: { role: 'super_admin' } },
    { app_metadata: { role: 'admin' }, user_metadata: { role: 'super_admin' } },
    { app_metadata: {}, email: 'administrator@example.com' },
  ]) {
    assert.equal(hasTrustedSuperAdminRole(user), false);
  }
});
