import assert from 'node:assert/strict';
import test from 'node:test';
import { EMPLOYEE_CSV_TEMPLATE, parseEmployeeCsv, validateSetupEmployees, canOpenSetupStep, isValidSmtpPort } from './setup-guide.ts';

test('the shipped six-column template imports the correct departments and roles', () => {
  const rows = parseEmployeeCsv(EMPLOYEE_CSV_TEMPLATE);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].departmentCode, 'IT');
  assert.equal(rows[0].role, 'Manager');
  assert.equal(rows[1].departmentCode, 'HR');
  assert.equal(rows[1].phone, '');
});

test('header mapping supports reordered columns, optional legacy fields, BOM and quoted values', () => {
  const rows = parseEmployeeCsv('\uFEFFEmail,Role,Last Name,Phone Number,Department Code,First Name,Employee ID,Designation\r\n"PERSON@EXAMPLE.COM",manager,"Last, \"\"Name\"\"",123,IT,"First\nName",emp1,Lead\r\n');
  assert.deepEqual(rows[0], {
    employeeId: 'EMP1', firstName: 'First\nName', lastName: 'Last, "Name"', email: 'person@example.com',
    phone: '123', departmentCode: 'IT', role: 'Manager', designation: 'Lead',
  });
});

test('bad headers, malformed quotes and inconsistent row width are rejected without echoing row data', () => {
  for (const value of [
    'Email,Role\na@example.com,Employee',
    'Employee ID,First Name,Last Name,Email,Department Code,Role\n1,"unclosed,Last,a@example.com,IT,Employee',
    'Employee ID,First Name,Last Name,Email,Department Code,Role\n1,First,Last,a@example.com,IT',
  ]) assert.throws(() => parseEmployeeCsv(value));
});

test('validation flags all duplicate participants, unknown departments and invalid fields', () => {
  const base = { firstName: 'Person', lastName: '', email: 'a@example.com', employeeId: 'EMP1', role: 'Employee', departmentCode: 'IT' };
  const employees = [{ ...base, id: 'a' }, { ...base, id: 'b', employeeId: 'emp1', email: 'A@EXAMPLE.COM' }, { ...base, id: 'c', employeeId: 'EMP3', email: 'bad', departmentCode: 'NONE' }];
  const result = validateSetupEmployees(employees, ['IT']);
  assert.equal(result.duplicateIdCount, 2);
  assert.equal(result.duplicateEmailCount, 2);
  assert.equal(result.unassignedCount, 1);
  assert.equal(result.invalidRowCount, 1);
  assert.equal(result.errorCount, 3);
  const corrected = employees.map((employee, index) => ({ ...employee, employeeId: `EMP${index + 1}`, email: `p${index}@example.com`, departmentCode: 'IT' }));
  assert.equal(validateSetupEmployees(corrected, ['IT']).errorCount, 0);
});

test('setup step navigation cannot bypass prerequisites; rollout is step five', () => {
  const initial = { organizationReady: false, hasStructure: false, validationErrorCount: 0, smtpReady: false };
  assert.equal(canOpenSetupStep(1, initial), true);
  assert.equal(canOpenSetupStep(2, initial), false);
  const invalidRows = { ...initial, organizationReady: true, hasStructure: true, validationErrorCount: 1 };
  assert.equal(canOpenSetupStep(3, invalidRows), true);
  assert.equal(canOpenSetupStep(4, invalidRows), false);
  const validRows = { ...invalidRows, validationErrorCount: 0 };
  assert.equal(canOpenSetupStep(4, validRows), true);
  assert.equal(canOpenSetupStep(5, validRows), false);
  assert.equal(canOpenSetupStep(5, { ...validRows, smtpReady: true }), true);
  assert.equal(canOpenSetupStep(6, { ...validRows, smtpReady: true }), false);
});

test('SMTP port readiness rejects partial, empty and out-of-range input', () => {
  for (const value of ['', '587bad', '0', '65536', '-1', '1.5']) assert.equal(isValidSmtpPort(value), false);
  for (const value of ['465', '587', '25']) assert.equal(isValidSmtpPort(value), true);
});
