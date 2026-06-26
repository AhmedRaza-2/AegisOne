export interface ThreatLog {
  id: string;
  timestamp: string;
  url: string;
  status: 'BLOCKED' | 'ALLOWED' | 'WARN';
  type: string;
  sourceIp: string;
  latencyMs: number;
  threatScore: number;
  employeeName?: string;
  employeeId?: string;
  department?: string;
}

export interface OnboardingState {
  currentPhase: number;
  completedPhases: number[];
  dockerUrl: string;
  dbConnected: boolean;
  extensionInstalled: boolean;
  simulatedThreatsCount: number;
}

export interface MetricCardData {
  title: string;
  value: string;
  change: string;
  isPositive: boolean;
}

export interface UserSession {
  uid: string;
  email: string;
  name: string;
  role: 'admin' | 'subadmin' | 'employee'; // admin=Org Admin, subadmin=Manager/Lead, employee=Employee
  orgId: string;
  orgName: string;
  employeeId?: string;
  profileCompleted?: boolean;
  extensionInstalled?: boolean;
  departmentId?: string;
}

export interface OrganizationChecklist {
  serverInstalled: boolean;
  orgConfigured: boolean;
  departmentsCreated: boolean;
  managersAdded: boolean;
  employeesAdded: boolean;
  extensionInstalled: boolean;
  connectionVerified: boolean;
  protectionStarted: boolean;
}

export interface Organization {
  id: string;
  name: string;
  orgCode: string; // Used by employees to join the network filter
  createdAt: string;
  checklist: OrganizationChecklist;
}

export interface Department {
  id: string;
  name: string;
  orgId: string;
  managerId?: string; // subadmin link
  createdAt: string;
}

export interface Employee {
  id: string;
  name: string;
  email: string;
  employeeId: string; // Unique corporate ID card number assigned
  role: 'lead' | 'employee'; // lead = Manager, employee = Staff
  orgId: string;
  departmentId?: string;
  assignedBy: string; // name of admin who added them
  createdAt: string;
  profileCompleted?: boolean;
  extensionInstalled?: boolean;
}

