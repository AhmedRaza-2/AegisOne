import assert from 'node:assert/strict';
import test from 'node:test';
import { sanitizeContext, isAllowedAction, validateReply } from '../src/contracts.ts';

test('safe context strips secret sentinels, values, unknown fields and raw errors', () => {
  const secret = 'NEVER_SEND_SMTP_PASSWORD_OR_EMPLOYEE_EMAIL';
  const context = sanitizeContext({
    surface: 'organization_setup', step: 'security', rollout: 'running',
    orgName: secret, smtpPassword: secret, employees: [{ email: secret }], url: secret, html: secret,
    fieldStatus: { smtp_password: true, smtp_username: secret, org_name: false, unknown: secret },
    counts: { members: 7, duplicateIds: 2, departments: -1, failed: 1.5, sent: Infinity, employees: secret, unknown: 1 },
    errors: ['smtp_auth', secret, 'smtp_auth'],
  });
  assert.deepEqual(context, {
    surface: 'organization_setup', step: 'security', rollout: 'running',
    fieldStatus: { org_name: false, smtp_password: true },
    counts: { members: 7, duplicateIds: 2 }, errors: ['smtp_auth'],
  });
  assert.equal(JSON.stringify(context).includes(secret), false);
});

test('malformed context defaults safely and valid copies do not alias caller objects', () => {
  for (const value of [null, undefined, false, 'secret', [], { surface: 'secret', step: 'secret', errors: 'secret' }]) {
    assert.deepEqual(sanitizeContext(value), { surface: 'landing' });
  }
  const input = { surface: 'organization_setup', fieldStatus: { org_name: true }, counts: { members: 3 }, errors: ['duplicate_ids'] };
  const output = sanitizeContext(input);
  input.fieldStatus.org_name = false; input.counts.members = 999; input.errors.push('secret');
  assert.deepEqual(output, { surface: 'organization_setup', fieldStatus: { org_name: true }, counts: { members: 3 }, errors: ['duplicate_ids'] });
});

test('assistant actions allow guidance only and apply surface restrictions', () => {
  const setup = { surface: 'organization_setup' } as const;
  for (const action of [
    { type: 'highlight_field', target: 'smtp_password' },
    { type: 'show_validation_group', target: 'duplicate_ids' },
    { type: 'open_step', target: 'rollout' },
    { type: 'open_documentation', target: 'setup-security' },
    { type: 'contact_team', target: 'contact' },
  ]) assert.equal(isAllowedAction(action, setup), true);
  for (const action of [null, {}, { type: 'execute_dispatch', target: 'rollout' }, { type: 'reset_organization', target: 'contact' },
    { type: 'highlight_field', target: '#password' }, { type: 'highlight_field', target: '__proto__' },
    { type: 'open_step', target: '6' }, { type: 'open_documentation', target: 'https://evil.example' }]) {
    assert.equal(isAllowedAction(action, setup), false);
  }
  assert.equal(isAllowedAction({ type: 'highlight_field', target: 'org_name' }, { surface: 'landing' }), false);
  assert.equal(isAllowedAction({ type: 'open_step', target: 'security' }, { surface: 'deployment_portal' }), false);
});

test('reply validation strips unapproved sources, mutation actions and extra payload fields', () => {
  const result = validateReply({
    turnId: 'turn-1', answer: 'Review the SMTP host.', speechText: 'Review the SMTP host.', language: 'en', status: 'complete',
    sources: ['setup-security', 'https://evil.example', 'setup-security'],
    actions: [{ type: 'highlight_field', target: 'smtp_host', password: 'secret' }, { type: 'execute_dispatch', target: 'rollout' }],
    secret: 'secret',
  }, { surface: 'organization_setup', step: 'security' });
  assert.deepEqual(result.sources, ['setup-security']);
  assert.deepEqual(result.actions, [{ type: 'highlight_field', target: 'smtp_host' }]);
  assert.equal('secret' in result, false);
  for (const invalid of [null, {}, { ...result, language: 'fr' }, { ...result, answer: '' }, { ...result, speechText: 'x'.repeat(6001) }]) {
    assert.throws(() => validateReply(invalid, { surface: 'landing' }));
  }
});
