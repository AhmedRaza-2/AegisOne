/** The downloadable template and importer deliberately use the same six columns. */
export const EMPLOYEE_CSV_HEADERS = [
  'Employee ID', 'First Name', 'Last Name', 'Email', 'Department Code', 'Role',
] as const;

export const EMPLOYEE_CSV_TEMPLATE = [
  EMPLOYEE_CSV_HEADERS.join(','),
  'EMP001,Sample,Manager,manager@company.local,IT,Manager',
  'EMP002,Sample,Employee,employee@company.local,HR,Employee',
].join('\r\n');

export const SETUP_STEP_IDS = ['organization', 'structure', 'validation', 'security', 'rollout'] as const;
export type SetupStepId = typeof SETUP_STEP_IDS[number];

export interface SetupEmployeeRow {
  id: string;
  employeeId?: string;
  firstName: string;
  lastName: string;
  email: string;
  departmentCode: string;
  role: string;
  phone?: string;
  designation?: string;
}

export type ValidationGroup = 'duplicate_ids' | 'duplicate_emails' | 'unassigned_members' | 'invalid_csv';

/** RFC-style CSV fields, including escaped quotes, commas and embedded line breaks. */
function readCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  let closedQuote = false;
  const source = text.replace(/^\uFEFF/, '');
  const endCell = () => { row.push(cell.trim()); cell = ''; closedQuote = false; };
  const endRow = () => {
    endCell();
    if (row.some(value => value !== '')) rows.push(row);
    row = [];
  };

  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') { cell += '"'; index++; }
      else if (char === '"') { quoted = false; closedQuote = true; }
      else cell += char;
      continue;
    }
    if (char === ',') { endCell(); continue; }
    if (char === '\r' || char === '\n') {
      endRow();
      if (char === '\r' && source[index + 1] === '\n') index++;
      continue;
    }
    if (closedQuote) {
      if (char.trim()) throw new Error('Invalid CSV quoting. Download the template and try again.');
      continue;
    }
    if (char === '"') {
      if (cell.trim()) throw new Error('Invalid CSV quoting. Download the template and try again.');
      cell = '';
      quoted = true;
    } else cell += char;
  }
  if (quoted) throw new Error('An imported CSV field has an unclosed quote.');
  if (cell || row.length) endRow();
  return rows;
}

const normalizeHeader = (value: string) => value.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');

export function parseEmployeeCsv(text: string): Omit<SetupEmployeeRow, 'id'>[] {
  const rows = readCsv(text);
  if (rows.length < 2) throw new Error('The CSV must contain a header and at least one employee.');
  const headers = rows[0].map(normalizeHeader);
  if (new Set(headers).size !== headers.length) throw new Error('CSV column headers must be unique.');
  if (EMPLOYEE_CSV_HEADERS.some(header => !headers.includes(normalizeHeader(header)))) {
    throw new Error(`CSV columns required: ${EMPLOYEE_CSV_HEADERS.join(', ')}.`);
  }
  const column = (row: string[], name: string) => row[headers.indexOf(normalizeHeader(name))] || '';
  return rows.slice(1).map(row => {
    if (row.length !== headers.length) throw new Error('A CSV row has a different number of columns from its header.');
    const role = column(row, 'Role').toLowerCase();
    return {
      employeeId: column(row, 'Employee ID').toUpperCase(),
      firstName: column(row, 'First Name'),
      lastName: column(row, 'Last Name'),
      email: column(row, 'Email').toLowerCase(),
      departmentCode: column(row, 'Department Code').toUpperCase() || 'NONE',
      role: role === 'manager' ? 'Manager' : role === 'employee' ? 'Employee' : role === 'admin' ? 'Admin' : column(row, 'Role'),
      phone: column(row, 'Phone Number'),
      designation: column(row, 'Designation'),
    };
  });
}

export function validateSetupEmployees(employees: SetupEmployeeRow[], departmentCodes: string[]) {
  const ids = new Map<string, number>();
  const emails = new Map<string, number>();
  for (const employee of employees) {
    const id = (employee.employeeId || '').trim().toUpperCase();
    const email = employee.email.trim().toLowerCase();
    if (id) ids.set(id, (ids.get(id) || 0) + 1);
    if (email) emails.set(email, (emails.get(email) || 0) + 1);
  }
  const departments = new Set(departmentCodes.map(code => code.trim().toUpperCase()));
  const byId = new Map(employees.map(employee => {
    const employeeId = (employee.employeeId || '').trim().toUpperCase();
    const email = employee.email.trim().toLowerCase();
    const isAdmin = employee.role.toLowerCase() === 'admin';
    const groups: ValidationGroup[] = [];
    if (employeeId && (ids.get(employeeId) || 0) > 1) groups.push('duplicate_ids');
    if (email && (emails.get(email) || 0) > 1) groups.push('duplicate_emails');
    if (!isAdmin && !departments.has(employee.departmentCode.trim().toUpperCase())) groups.push('unassigned_members');
    if (!employeeId || !employee.firstName.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      || !['admin', 'manager', 'employee'].includes(employee.role.toLowerCase())) groups.push('invalid_csv');
    return [employee.id, groups] as const;
  }));
  return {
    byId,
    errorCount: employees.filter(employee => (byId.get(employee.id)?.length || 0) > 0).length,
    duplicateIdCount: employees.filter(employee => byId.get(employee.id)?.includes('duplicate_ids')).length,
    duplicateEmailCount: employees.filter(employee => byId.get(employee.id)?.includes('duplicate_emails')).length,
    unassignedCount: employees.filter(employee => byId.get(employee.id)?.includes('unassigned_members')).length,
    invalidRowCount: employees.filter(employee => byId.get(employee.id)?.includes('invalid_csv')).length,
  };
}

export interface SetupNavigationState {
  organizationReady: boolean;
  hasStructure: boolean;
  validationErrorCount: number;
  smtpReady: boolean;
}

export function canOpenSetupStep(target: number, state: SetupNavigationState): boolean {
  if (target === 1) return true;
  if (target === 2) return state.organizationReady;
  if (target === 3) return state.organizationReady && state.hasStructure;
  if (target === 4) return state.organizationReady && state.hasStructure && state.validationErrorCount === 0;
  if (target === 5) return canOpenSetupStep(4, state) && state.smtpReady;
  return false;
}

export function isValidSmtpPort(port: string): boolean {
  return /^\d+$/.test(port.trim()) && Number(port) >= 1 && Number(port) <= 65535;
}
