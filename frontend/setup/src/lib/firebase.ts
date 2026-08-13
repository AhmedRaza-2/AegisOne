/**
 * firebase.ts — Local Setup Wizard Data Store
 *
 * This module replaces Firebase with a 100% local localStorage-based
 * data store for the AegisOne Setup Wizard. No external services needed.
 * All org/employee/department data lives on the local machine only.
 */

import { UserSession, Organization, Employee, Department, OrganizationChecklist } from '../types';

// ─── Storage Keys ─────────────────────────────────────────────────────────────
const SESSION_KEY = 'aegis_setup_session';
const ORGS_KEY = 'aegis_orgs';
const EMPLOYEES_KEY = 'aegis_employees';
const DEPARTMENTS_KEY = 'aegis_departments';

// ─── Seed Data (pre-loaded for demo) ──────────────────────────────────────────
const SEED_ORGS: Organization[] = [
  {
    id: 'org-demo-001',
    name: 'Al-Baraka Logistics',
    orgCode: 'AEG-9021',
    createdAt: new Date().toISOString(),
    checklist: {
      serverInstalled: true,
      orgConfigured: false,
      departmentsCreated: false,
      managersAdded: false,
      employeesAdded: false,
      extensionInstalled: false,
      connectionVerified: false,
      protectionStarted: false,
    },
  },
];

const SEED_EMPLOYEES: Employee[] = [
  {
    id: 'emp-demo-001',
    name: 'Ahmad Raza',
    email: 'araza2125012.pgc@gmail.com',
    employeeId: 'EMP-ADM-0001',
    role: 'lead',
    orgId: 'org-demo-001',
    assignedBy: 'System',
    createdAt: new Date().toISOString(),
    profileCompleted: true,
    extensionInstalled: false,
  },
];

const SEED_DEPARTMENTS: Department[] = [
  {
    id: 'dept-demo-001',
    name: 'Logistics Operations',
    orgId: 'org-demo-001',
    createdAt: new Date().toISOString(),
  },
];

// Key that marks whether real setup has been completed — prevents demo data injection
const SETUP_COMPLETED_KEY = 'aegis_setup_completed';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function loadFromStorage<T>(key: string, seed: T[]): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T[];
    // Only seed demo data if setup has NOT been completed yet
    const setupDone = localStorage.getItem(SETUP_COMPLETED_KEY);
    if (!setupDone) {
      localStorage.setItem(key, JSON.stringify(seed));
      return seed;
    }
    // Setup completed — return empty list, not demo data
    return [];
  } catch {
    return [];
  }
}

function saveToStorage<T>(key: string, data: T[]): void {
  localStorage.setItem(key, JSON.stringify(data));
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ─── Session Management ────────────────────────────────────────────────────────
export function getCurrentSession(): UserSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as UserSession) : null;
  } catch {
    return null;
  }
}

export function setSession(session: UserSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function signOutUser(): void {
  localStorage.removeItem(SESSION_KEY);
}

// ─── Auth Functions ────────────────────────────────────────────────────────────
export function signUpUser(email: string, name: string, orgName: string): UserSession {
  const orgs = loadFromStorage<Organization>(ORGS_KEY, SEED_ORGS);

  // Check if org already exists
  let org = orgs.find(o => o.name.toLowerCase() === orgName.toLowerCase());
  if (!org) {
    org = {
      id: generateId('org'),
      name: orgName,
      orgCode: `AEG-${Math.floor(1000 + Math.random() * 9000)}`,
      createdAt: new Date().toISOString(),
      checklist: {
        serverInstalled: true,
        orgConfigured: false,
        departmentsCreated: false,
        managersAdded: false,
        employeesAdded: false,
        extensionInstalled: false,
        connectionVerified: false,
        protectionStarted: false,
      },
    };
    orgs.push(org);
    saveToStorage(ORGS_KEY, orgs);
  }

  // Create employee/admin record
  const employees = loadFromStorage<Employee>(EMPLOYEES_KEY, SEED_EMPLOYEES);
  let emp = employees.find(e => e.email.toLowerCase() === email.toLowerCase());
  if (!emp) {
    emp = {
      id: generateId('emp'),
      name,
      email,
      employeeId: `EMP-ADM-${Math.floor(1000 + Math.random() * 9000)}`,
      role: 'lead',
      orgId: org.id,
      assignedBy: 'Self-Registration',
      createdAt: new Date().toISOString(),
      profileCompleted: false,
      extensionInstalled: false,
    };
    employees.push(emp);
    saveToStorage(EMPLOYEES_KEY, employees);
  }

  const session: UserSession = {
    uid: emp.id,
    email,
    name,
    role: 'admin',
    orgId: org.id,
    orgName: org.name,
    employeeId: emp.employeeId,
    profileCompleted: false,
    extensionInstalled: false,
  };
  setSession(session);
  return session;
}

export function signInUser(email: string): UserSession {
  const employees = loadFromStorage<Employee>(EMPLOYEES_KEY, SEED_EMPLOYEES);
  const orgs = loadFromStorage<Organization>(ORGS_KEY, SEED_ORGS);

  const emp = employees.find(e => e.email.toLowerCase() === email.toLowerCase());
  if (!emp) {
    // Create a guest session for unrecognized emails — use first real org, never demo fallback
    const defaultOrg = orgs.find(o => o.id !== 'org-demo-001') || orgs[0];
    const session: UserSession = {
      uid: generateId('uid'),
      email,
      name: email.split('@')[0],
      role: 'admin',
      orgId: defaultOrg?.id || generateId('org'),
      orgName: defaultOrg?.name || email.split('@')[1]?.split('.')[0] || 'My Organization',
    };
    setSession(session);
    return session;
  }

  const org = orgs.find(o => o.id === emp.orgId) || orgs.find(o => o.id !== 'org-demo-001') || orgs[0];
  const session: UserSession = {
    uid: emp.id,
    email: emp.email,
    name: emp.name,
    role: emp.role === 'lead' ? 'admin' : 'employee',
    orgId: org?.id || emp.orgId,
    orgName: org?.name || 'My Organization',
    employeeId: emp.employeeId,
    profileCompleted: emp.profileCompleted,
    extensionInstalled: emp.extensionInstalled,
    departmentId: emp.departmentId,
  };
  setSession(session);
  return session;
}

/** Call this after setup wizard completes to prevent demo data from ever re-appearing. */
export function markSetupCompleted(): void {
  localStorage.setItem(SETUP_COMPLETED_KEY, 'true');
}

// ─── Organization Functions ───────────────────────────────────────────────────
export function getOrganizations(): Organization[] {
  return loadFromStorage<Organization>(ORGS_KEY, SEED_ORGS);
}

export function getOrganization(orgId: string): Organization | undefined {
  const orgs = loadFromStorage<Organization>(ORGS_KEY, SEED_ORGS);
  return orgs.find(o => o.id === orgId);
}

export function updateOrganizationChecklist(
  orgId: string,
  updates: Partial<OrganizationChecklist>
): void {
  const orgs = loadFromStorage<Organization>(ORGS_KEY, SEED_ORGS);
  const idx = orgs.findIndex(o => o.id === orgId);
  if (idx !== -1) {
    orgs[idx].checklist = { ...orgs[idx].checklist, ...updates };
    saveToStorage(ORGS_KEY, orgs);
  }
}

// ─── Employee Functions ───────────────────────────────────────────────────────
export function getEmployees(orgId: string): Employee[] {
  const employees = loadFromStorage<Employee>(EMPLOYEES_KEY, SEED_EMPLOYEES);
  return employees.filter(e => e.orgId === orgId);
}

export function addEmployee(
  name: string,
  email: string,
  employeeId: string,
  role: 'lead' | 'employee',
  orgId: string,
  assignedBy: string,
  departmentId?: string
): Employee {
  const employees = loadFromStorage<Employee>(EMPLOYEES_KEY, SEED_EMPLOYEES);
  const emp: Employee = {
    id: generateId('emp'),
    name,
    email,
    employeeId,
    role,
    orgId,
    departmentId,
    assignedBy,
    createdAt: new Date().toISOString(),
    profileCompleted: false,
    extensionInstalled: false,
  };
  employees.push(emp);
  saveToStorage(EMPLOYEES_KEY, employees);
  return emp;
}

export function removeEmployee(employeeId: string): void {
  const employees = loadFromStorage<Employee>(EMPLOYEES_KEY, SEED_EMPLOYEES);
  const filtered = employees.filter(e => e.id !== employeeId);
  saveToStorage(EMPLOYEES_KEY, filtered);
}

export function updateEmployeeProfile(
  uid: string,
  updates: Partial<Employee>
): void {
  const employees = loadFromStorage<Employee>(EMPLOYEES_KEY, SEED_EMPLOYEES);
  const idx = employees.findIndex(e => e.id === uid);
  if (idx !== -1) {
    employees[idx] = { ...employees[idx], ...updates };
    saveToStorage(EMPLOYEES_KEY, employees);
    // Also update current session if it's the same user
    const session = getCurrentSession();
    if (session && session.uid === uid) {
      const updated = {
        ...session,
        profileCompleted: updates.profileCompleted ?? session.profileCompleted,
        extensionInstalled: updates.extensionInstalled ?? session.extensionInstalled,
        departmentId: (updates as any).departmentId ?? session.departmentId,
      };
      setSession(updated);
    }
  }
}

// ─── Department Functions ─────────────────────────────────────────────────────
export function getDepartments(orgId: string): Department[] {
  const departments = loadFromStorage<Department>(DEPARTMENTS_KEY, SEED_DEPARTMENTS);
  return departments.filter(d => d.orgId === orgId);
}

export function addDepartment(name: string, orgId: string): Department {
  const departments = loadFromStorage<Department>(DEPARTMENTS_KEY, SEED_DEPARTMENTS);
  const dept: Department = {
    id: generateId('dept'),
    name,
    orgId,
    createdAt: new Date().toISOString(),
  };
  departments.push(dept);
  saveToStorage(DEPARTMENTS_KEY, departments);
  return dept;
}
