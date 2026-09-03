/**
 * AegisOne E2E Simulation — API Fixture Seed
 *
 * Fast provisioning via the actual AegisOne API — no Playwright UI needed for setup.
 * Uses the real /setup/execute endpoint with the X-Setup-Key header.
 *
 * Creates:
 *   - Organization: org_e2e_test (or configured ORG_ID)
 *   - Admin user
 *   - Departments: ENG, HR, FIN
 *   - N employees (from profiles.ts)
 *
 * Uses the REAL API contracts from api/routers/setup.py
 */

import axios from 'axios';
import { Config } from '../config';
import { ScenarioState } from '../orchestrator/scenario-state';

const DEPARTMENTS = [
  { name: 'Engineering',      code: 'ENG' },
  { name: 'Human Resources',  code: 'HR'  },
  { name: 'Finance',          code: 'FIN' },
];

export async function seedOrganization(state: ScenarioState): Promise<void> {
  const baseURL = Config.API_URL;
  const headers = {
    'X-Setup-Key': Config.SETUP_KEY,
    'Content-Type': 'application/json',
  };

  // Build employee payload matching the API's SetupExecuteRequest schema
  // (from api/routers/setup.py → class Employee)
  const allPersonnel = [
    // Admin first
    {
      firstName: 'TestAdmin',
      lastName: 'AegisOne',
      email: state.admin.email,
      departmentCode: 'ENG',   // ignored for admin role by the API
      role: 'admin',
      designation: 'System Administrator',
      generatedPassword: state.admin.password,
    },
    // Employees
    ...state.employees.map(emp => ({
      firstName: emp.firstName,
      lastName: emp.lastName,
      email: emp.email,
      departmentCode: emp.departmentCode,
      role: emp.role,
      designation: `${emp.profile} user`,
      generatedPassword: emp.password,
    })),
  ];

  // POST /setup/execute — creates all users and departments
  // SMTP fields are left empty — we're using Mailpit, so no real email sending here
  const payload = {
    employees: allPersonnel,
    orgId: state.orgId,
    smtpUser: null,
    smtpPass: null,
    smtpHost: 'mailpit',
    smtpPort: 1025,
  };

  const response = await axios.post(`${baseURL}/setup/execute`, payload, {
    headers,
    timeout: Config.API_TIMEOUT_MS,
  });

  if (response.data.status !== 'success') {
    throw new Error(`Seed failed: ${JSON.stringify(response.data)}`);
  }

  // Capture fresh admin token from setup response
  state.admin.token = response.data.access_token;

  // Resolve db user IDs from /setup/structure/:orgId
  // Uses the real /setup/structure/{org_id} endpoint
  const structureResp = await axios.get(`${baseURL}/setup/structure/org_default`, {
    timeout: Config.API_TIMEOUT_MS,
  });
  const structureEmployees: Array<{ id: number; email: string }> =
    structureResp.data.employees || [];

  const emailToId = new Map(structureEmployees.map((u) => [u.email.toLowerCase(), u.id]));

  // Assign resolved DB IDs back into state
  state.admin.dbUserId = emailToId.get(state.admin.email.toLowerCase());
  for (const emp of state.employees) {
    emp.dbUserId = emailToId.get(emp.email.toLowerCase());
  }

  console.log(`  ✓ Admin created: ${state.admin.email} (id=${state.admin.dbUserId})`);
  console.log(`  ✓ ${state.employees.length} employees provisioned`);
}

export async function teardownOrganization(state: ScenarioState): Promise<void> {
  if (Config.KEEP_E2E_DATA) {
    console.log('  ℹ KEEP_E2E_DATA=true — skipping teardown');
    return;
  }

  // Login as admin to get a fresh token
  const token = await loginUser(state.admin.email, state.admin.password);

  // Delete each test employee via DELETE /admin/users/:id
  for (const emp of state.employees) {
    if (!emp.dbUserId) continue;
    try {
      await axios.delete(`${Config.API_URL}/admin/users/${emp.dbUserId}`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: Config.API_TIMEOUT_MS,
      });
    } catch {
      // Best-effort cleanup — don't fail the run
    }
  }

  console.log('  ✓ Teardown complete');
}

export async function loginUser(email: string, password: string): Promise<string> {
  // POST /auth/login — real contract from api/routers/auth.py
  const resp = await axios.post(
    `${Config.API_URL}/auth/login`,
    { email, password },
    { timeout: Config.API_TIMEOUT_MS },
  );

  if (!resp.data.access_token) {
    throw new Error(`Login failed for ${email}: ${JSON.stringify(resp.data)}`);
  }
  return resp.data.access_token;
}

export async function refreshAdminToken(state: ScenarioState): Promise<string> {
  const token = await loginUser(state.admin.email, state.admin.password);
  state.admin.token = token;
  return token;
}
