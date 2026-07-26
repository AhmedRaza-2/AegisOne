import { UserSession, Employee, Organization, Department, OrganizationChecklist } from '../types';

// Standard Pre-populated Corporate Mock Data for a rich operational experience
const DEFAULT_CHECKLIST: OrganizationChecklist = {
  serverInstalled: true, // Auto-live node!
  orgConfigured: false,
  departmentsCreated: false,
  managersAdded: false,
  employeesAdded: false,
  extensionInstalled: false,
  connectionVerified: false,
  protectionStarted: false,
};

const DEFAULT_ORGANIZATIONS: Organization[] = [
  { 
    id: 'org-101', 
    name: 'Al-Baraka Logistics', 
    orgCode: 'ALB-3902',
    createdAt: '2026-01-10T08:00:00Z',
    checklist: { ...DEFAULT_CHECKLIST, orgConfigured: true, departmentsCreated: true, managersAdded: true, employeesAdded: true }
  },
  { 
    id: 'org-102', 
    name: 'Siddique Textile Ltd', 
    orgCode: 'SID-9210',
    createdAt: '2026-02-15T09:30:00Z',
    checklist: { ...DEFAULT_CHECKLIST }
  },
];

const DEFAULT_DEPARTMENTS: Department[] = [
  { id: 'dept-1', name: 'Logistics Operations', orgId: 'org-101', createdAt: '2026-01-11T09:00:00Z' },
  { id: 'dept-2', name: 'IT Infrastructure', orgId: 'org-101', createdAt: '2026-01-12T10:00:00Z' },
  { id: 'dept-3', name: 'Supply Chain & Storage', orgId: 'org-101', createdAt: '2026-01-12T11:00:00Z' },
  { id: 'dept-4', name: 'Spinning Division', orgId: 'org-102', createdAt: '2026-02-16T10:00:00Z' },
];

const DEFAULT_EMPLOYEES: Employee[] = [
  {
    id: 'emp-1',
    name: 'Haris Munir',
    email: 'haris.munir@albaraka.com',
    employeeId: 'EMP-LOG-4091',
    role: 'lead',
    orgId: 'org-101',
    departmentId: 'dept-1',
    assignedBy: 'Super Admin',
    createdAt: '2026-03-01T10:00:00Z',
    profileCompleted: true,
    extensionInstalled: true,
  },
  {
    id: 'emp-2',
    name: 'Aisha Jamil',
    email: 'aisha.j@albaraka.com',
    employeeId: 'EMP-LOG-4092',
    role: 'employee',
    orgId: 'org-101',
    departmentId: 'dept-1',
    assignedBy: 'Super Admin',
    createdAt: '2026-03-05T11:20:00Z',
    profileCompleted: true,
    extensionInstalled: true,
  },
  {
    id: 'emp-3',
    name: 'Zainab Bibi',
    email: 'zainab.b@siddique.com',
    employeeId: 'EMP-TEX-2003',
    role: 'lead',
    orgId: 'org-102',
    departmentId: 'dept-4',
    assignedBy: 'Siddique Admin',
    createdAt: '2026-04-10T09:15:00Z',
    profileCompleted: false,
    extensionInstalled: false,
  },
];

const DEFAULT_USERS = [
  {
    uid: 'admin-1',
    email: 'araza2125012.pgc@gmail.com',
    name: 'Ahmad Raza',
    role: 'admin' as const,
    orgId: 'org-101',
    orgName: 'Al-Baraka Logistics',
    password: 'password123',
  },
];

// Initialize local database keys
if (!localStorage.getItem('aegis_orgs')) {
  localStorage.setItem('aegis_orgs', JSON.stringify(DEFAULT_ORGANIZATIONS));
}
if (!localStorage.getItem('aegis_departments')) {
  localStorage.setItem('aegis_departments', JSON.stringify(DEFAULT_DEPARTMENTS));
}
if (!localStorage.getItem('aegis_employees')) {
  localStorage.setItem('aegis_employees', JSON.stringify(DEFAULT_EMPLOYEES));
}
if (!localStorage.getItem('aegis_users')) {
  localStorage.setItem('aegis_users', JSON.stringify(DEFAULT_USERS));
}

// Memory cache for active session
let currentSession: UserSession | null = null;
const cachedSession = localStorage.getItem('aegis_session');
if (cachedSession) {
  try {
    currentSession = JSON.parse(cachedSession);
  } catch (e) {
    currentSession = null;
  }
}

export function getCurrentSession(): UserSession | null {
  return currentSession;
}

export function getOrganizations(): Organization[] {
  const orgs: Organization[] = JSON.parse(localStorage.getItem('aegis_orgs') || '[]');
  let modified = false;
  const upgradedOrgs = orgs.map(org => {
    let upgraded = false;
    if (!org.orgCode) {
      org.orgCode = org.id === 'org-101' ? 'ALB-3902' : org.id === 'org-102' ? 'SID-9210' : `AEG-${Math.floor(1000 + Math.random() * 9000)}`;
      upgraded = true;
    }
    if (!org.checklist) {
      org.checklist = org.id === 'org-101' ? {
        ...DEFAULT_CHECKLIST,
        orgConfigured: true,
        departmentsCreated: true,
        managersAdded: true,
        employeesAdded: true
      } : { ...DEFAULT_CHECKLIST };
      upgraded = true;
    }
    if (upgraded) {
      modified = true;
    }
    return org;
  });

  if (modified) {
    localStorage.setItem('aegis_orgs', JSON.stringify(upgradedOrgs));
  }

  return upgradedOrgs;
}

export function getOrganization(orgId: string): Organization | undefined {
  const orgs = getOrganizations();
  return orgs.find(o => o.id === orgId);
}

export function updateOrganizationChecklist(orgId: string, updates: Partial<OrganizationChecklist>) {
  const orgs = getOrganizations();
  const idx = orgs.findIndex(o => o.id === orgId);
  if (idx !== -1) {
    orgs[idx].checklist = { ...(orgs[idx].checklist || {}), ...updates } as OrganizationChecklist;
    localStorage.setItem('aegis_orgs', JSON.stringify(orgs));
  }
}

export function getDepartments(orgId: string): Department[] {
  const depts: Department[] = JSON.parse(localStorage.getItem('aegis_departments') || '[]');
  return depts.filter(d => d.orgId === orgId);
}

export function addDepartment(name: string, orgId: string): Department {
  const depts: Department[] = JSON.parse(localStorage.getItem('aegis_departments') || '[]');
  const newDept: Department = {
    id: `dept-${Math.floor(100 + Math.random() * 900)}`,
    name,
    orgId,
    createdAt: new Date().toISOString(),
  };
  depts.push(newDept);
  localStorage.setItem('aegis_departments', JSON.stringify(depts));

  // Auto-mark checklist
  updateOrganizationChecklist(orgId, { departmentsCreated: true });

  return newDept;
}

export function getEmployees(orgId: string): Employee[] {
  const all: Employee[] = JSON.parse(localStorage.getItem('aegis_employees') || '[]');
  return all.filter((e) => e.orgId === orgId);
}

export function signUpUser(email: string, name: string, orgName: string): UserSession {
  const orgs: Organization[] = getOrganizations();
  const users = JSON.parse(localStorage.getItem('aegis_users') || '[]');

  // Create organization with a random human-readable Organization Join Code
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const codePrefix = orgName.substring(0, 3).toUpperCase();
  const orgCode = `${codePrefix}-${randomSuffix}`;
  const newOrgId = `org-${Math.floor(100 + Math.random() * 900)}`;

  const newOrg: Organization = {
    id: newOrgId,
    name: orgName,
    orgCode,
    createdAt: new Date().toISOString(),
    checklist: { ...DEFAULT_CHECKLIST, orgConfigured: true },
  };
  orgs.push(newOrg);
  localStorage.setItem('aegis_orgs', JSON.stringify(orgs));

  // Create User session
  const newUid = `user-${Math.floor(1000 + Math.random() * 9000)}`;
  const session: UserSession = {
    uid: newUid,
    email: email.trim().toLowerCase(),
    name,
    role: 'admin',
    orgId: newOrgId,
    orgName,
    profileCompleted: true,
    extensionInstalled: false,
  };

  users.push({
    uid: newUid,
    email: email.trim().toLowerCase(),
    name,
    role: 'admin',
    orgId: newOrgId,
    orgName,
    password: 'password123', // Demo default password
  });

  localStorage.setItem('aegis_users', JSON.stringify(users));
  localStorage.setItem('aegis_session', JSON.stringify(session));
  currentSession = session;
  return session;
}

export function signInUser(email: string): UserSession {
  const normalizedEmail = email.trim().toLowerCase();
  
  // 1. Check if registered as admin users
  const users = JSON.parse(localStorage.getItem('aegis_users') || '[]');
  const matchedAdmin = users.find((u: any) => u.email.toLowerCase() === normalizedEmail);

  if (matchedAdmin) {
    const session: UserSession = {
      uid: matchedAdmin.uid,
      email: matchedAdmin.email,
      name: matchedAdmin.name,
      role: matchedAdmin.role,
      orgId: matchedAdmin.orgId,
      orgName: matchedAdmin.orgName,
      profileCompleted: true,
    };
    localStorage.setItem('aegis_session', JSON.stringify(session));
    currentSession = session;
    return session;
  }

  // 2. Check if registered under Organization Employees / Leads (Manager / Employee)
  const employees: Employee[] = JSON.parse(localStorage.getItem('aegis_employees') || '[]');
  const matchedEmp = employees.find((e) => e.email.toLowerCase() === normalizedEmail);

  if (matchedEmp) {
    const orgs = getOrganizations();
    const org = orgs.find(o => o.id === matchedEmp.orgId);
    const session: UserSession = {
      uid: matchedEmp.id,
      email: matchedEmp.email,
      name: matchedEmp.name,
      role: matchedEmp.role === 'lead' ? 'subadmin' : 'employee', // lead = subadmin (Manager), employee = standard
      orgId: matchedEmp.orgId,
      orgName: org ? org.name : 'AegisOne Shield Node',
      employeeId: matchedEmp.employeeId,
      profileCompleted: matchedEmp.profileCompleted || false,
      extensionInstalled: matchedEmp.extensionInstalled || false,
      departmentId: matchedEmp.departmentId,
    };
    localStorage.setItem('aegis_session', JSON.stringify(session));
    currentSession = session;
    return session;
  }

  // 3. Fallback: Auto-create a brand new sandbox SME admin account for direct access
  return signUpUser(email, email.split('@')[0], `${email.split('@')[0]} Protection Group`);
}

export function updateEmployeeProfile(empId: string, updates: Partial<Employee>) {
  const employees: Employee[] = JSON.parse(localStorage.getItem('aegis_employees') || '[]');
  const idx = employees.findIndex(e => e.id === empId);
  if (idx !== -1) {
    employees[idx] = { ...employees[idx], ...updates };
    localStorage.setItem('aegis_employees', JSON.stringify(employees));
    
    // Also update current active session if applicable
    if (currentSession && currentSession.uid === empId) {
      if (updates.profileCompleted !== undefined) currentSession.profileCompleted = updates.profileCompleted;
      if (updates.extensionInstalled !== undefined) currentSession.extensionInstalled = updates.extensionInstalled;
      localStorage.setItem('aegis_session', JSON.stringify(currentSession));
    }
  }
}

export function signOutUser() {
  localStorage.removeItem('aegis_session');
  currentSession = null;
}

export function addEmployee(
  name: string,
  email: string,
  employeeId: string,
  role: 'lead' | 'employee',
  orgId: string,
  adminName: string,
  departmentId?: string
): Employee {
  const employees: Employee[] = JSON.parse(localStorage.getItem('aegis_employees') || '[]');
  
  const newEmp: Employee = {
    id: `emp-${Math.floor(1000 + Math.random() * 9000)}`,
    name,
    email: email.trim().toLowerCase(),
    employeeId: employeeId.trim().toUpperCase(),
    role,
    orgId,
    departmentId,
    assignedBy: adminName,
    createdAt: new Date().toISOString(),
    profileCompleted: false,
    extensionInstalled: false,
  };

  employees.push(newEmp);
  localStorage.setItem('aegis_employees', JSON.stringify(employees));

  // Mark the checklist accordingly
  if (role === 'lead') {
    updateOrganizationChecklist(orgId, { managersAdded: true });
  } else {
    updateOrganizationChecklist(orgId, { employeesAdded: true });
  }

  return newEmp;
}

export function removeEmployee(id: string) {
  const employees: Employee[] = JSON.parse(localStorage.getItem('aegis_employees') || '[]');
  const filtered = employees.filter((e) => e.id !== id);
  localStorage.setItem('aegis_employees', JSON.stringify(filtered));
}
