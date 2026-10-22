import assert from 'node:assert/strict';
import test from 'node:test';
import { getRegistrationErrorMessage } from './registration-errors.ts';

test('configuration and service failures explain the real problem without blaming form fields', () => {
  const configuration = Object.assign(new Error('internal environment details'), { code: 'registration_unconfigured' });
  assert.match(getRegistrationErrorMessage(configuration), /not configured.*site administrator/i);

  const unavailable = Object.assign(new Error('private upstream details'), { code: 'registration_unavailable' });
  assert.match(getRegistrationErrorMessage(unavailable), /service is unavailable.*details have been kept/i);
  assert.match(getRegistrationErrorMessage(new Error('Failed to verify organization name. Please try again.')), /service is unavailable/i);
  assert.match(getRegistrationErrorMessage(new TypeError('Failed to fetch')), /could not reach.*connection/i);
});

test('permission failures never suggest changing valid organization details', () => {
  for (const error of [
    { code: 'registration_restricted', message: 'forbidden' },
    { code: '42501', message: 'sensitive database detail' },
    new Error('new row violates row-level security policy for table "organizations"'),
    new Error('permission denied for table organizations'),
  ]) {
    assert.match(getRegistrationErrorMessage(error), /temporarily restricted.*contact support/i);
    assert.doesNotMatch(getRegistrationErrorMessage(error), /42501|row-level|organizations|sensitive/);
  }
});

test('organization and email duplicates give distinct next steps without echoing personal details', () => {
  const name = getRegistrationErrorMessage(new Error('An organization named "Private Org" is already registered.'));
  const email = getRegistrationErrorMessage(new Error('An admin account for "private@example.com" already exists.'));
  assert.match(name, /organization name is already registered.*contact support/i);
  assert.match(email, /email address is already registered.*different email/i);
  assert.doesNotMatch(name + email, /Private Org|private@example.com/);
  assert.match(getRegistrationErrorMessage(new Error('duplicate key value violates unique constraint "organizations_name_key"')), /organization name/i);
  assert.match(getRegistrationErrorMessage({ code: 'user_already_exists', message: 'Auth detail' }), /email address/i);
  assert.match(getRegistrationErrorMessage(new Error('An organization is already registered for this account.')), /for this account.*sign in/i);
});

test('known auth errors keep recovery and retry guidance', () => {
  assert.match(getRegistrationErrorMessage(new Error('For security purposes, you can only request this after 20 seconds.')), /wait 20 seconds/i);
  assert.match(getRegistrationErrorMessage(new Error('email rate limit exceeded')), /too many sign-up attempts/i);
  assert.match(getRegistrationErrorMessage(new Error('Sign-up could not be verified.')), /forgot password/i);
  assert.match(getRegistrationErrorMessage(new Error('This email address already has an AegisOne login.')), /already has an AegisOne login.*forgot password/i);
  assert.match(getRegistrationErrorMessage(new Error('invalid_email')), /email address.*not valid/i);
  assert.match(getRegistrationErrorMessage(new Error('weak password')), /stronger password/i);
  assert.match(getRegistrationErrorMessage(new Error('Signups not allowed')), /registrations are temporarily paused/i);
});

test('unknown errors never appear in customer-facing messages', () => {
  const diagnostic = 'SQL exception: password=private-token host=internal-db.example.com';
  for (const error of [new Error(diagnostic), diagnostic, { code: 'unexpected', message: diagnostic }, undefined]) {
    const message = getRegistrationErrorMessage(error);
    assert.match(message, /could not complete registration/i);
    assert.doesNotMatch(message, /Debug:|SQL|private-token|internal-db|password=/);
  }
});
