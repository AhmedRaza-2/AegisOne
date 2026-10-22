import assert from 'node:assert/strict';
import test from 'node:test';
import { dashboardLoginDestination, firstAdministratorContext, isFirstAdministratorMode, safeDashboardNext } from './login-navigation.ts';

const setup = '/dashboard/admin/setup?fromLanding=true&orgName=Example&adminEmail=admin%40example.com&adminName=Server+Owner';

test('dashboard return paths reject external, malformed and escaped routes', () => {
  for (const path of [null, '', 'https://evil.example/dashboard/admin', '//evil.example/dashboard/admin', '/\\evil.example', '/login', '/dashboard-other', '/dashboard/../../login', '/dashboard/%2f%2fevil.example', '/dashboard/admin\n']) {
    assert.equal(safeDashboardNext(path), null, String(path));
  }
  assert.equal(safeDashboardNext('/dashboard/employee/self'), '/dashboard/employee/self');
});

test('setup context survives sign-in without legacy passwords or fragments', () => {
  const safe = safeDashboardNext(setup + '&adminPassword=PRIVATE_SENTINEL&password=PRIVATE_SENTINEL#adminPassword=PRIVATE_SENTINEL');
  assert.equal(safe, setup);
  assert.doesNotMatch(safe || '', /PRIVATE_SENTINEL|password|#/i);
  assert.deepEqual(firstAdministratorContext(safe), { email: 'admin@example.com', fullName: 'Server Owner', organization: 'Example' });
});

test('login returns only to a dashboard section allowed for the authenticated role', () => {
  for (const role of ['admin', 'super_admin', 'global_admin']) assert.equal(dashboardLoginDestination(role, setup), setup);
  assert.equal(dashboardLoginDestination('employee', setup), '/dashboard/employee');
  assert.equal(dashboardLoginDestination('manager', setup), '/dashboard/supervisor');
  assert.equal(dashboardLoginDestination('office_admin', '/dashboard/supervisor/self'), '/dashboard/supervisor/self');
  assert.equal(dashboardLoginDestination('admin', '//evil.example'), '/dashboard/admin');
  assert.equal(dashboardLoginDestination(undefined, setup), '/dashboard/employee');
});

test('first-administrator mode requires an explicit choice and exact portal setup route', () => {
  assert.equal(isFirstAdministratorMode('create_first_admin', setup), true);
  for (const [mode, next] of [
    ['sign_in', setup], ['create_first_admin', '/dashboard/admin/setup'],
    ['create_first_admin', '/dashboard/admin/setup?fromLanding=false'],
    ['create_first_admin', '/dashboard/admin/setup/other?fromLanding=true'],
    ['create_first_admin', '//evil.example/dashboard/admin/setup?fromLanding=true'],
  ]) assert.equal(isFirstAdministratorMode(mode, next), false);
});
