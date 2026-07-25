/* ============================================================
   AegisOne — Mock Data Store
   ============================================================
   All mock data in one file. Swap this with Supabase later.
   ============================================================ */

// ── Types ────────────────────────────────────────────────────

export type Role = "global_admin" | "super_admin" | "office_admin" | "department_admin" | "employee" | "manager" | "admin";
export type ScanType = "email" | "url" | "text" | "image" | "attachment";
export type RiskLevel = "safe" | "suspicious" | "danger";
export type Verdict = "legitimate" | "phishing" | "malicious";
export type IncidentStatus = "open" | "investigating" | "resolved" | "false_positive";
export type Severity = "low" | "medium" | "high" | "critical";

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  department: string;
  organization: string;
  avatarUrl: string;
  isActive: boolean;
  lastLogin: string;
  extensionInstalled: boolean;
}

export interface ScanRecord {
  id: string;
  userId: string;
  scanType: ScanType;
  inputPreview: string;
  prediction: Verdict;
  confidence: number;
  phishingProbability: number;
  riskLevel: RiskLevel;
  xaiExplanation: string;
  xaiWords: string[];
  category?: string;
  source: "extension" | "dashboard" | "api";
  scannedAt: string;
}

export interface Incident {
  id: string;
  reportedBy: string;
  assignedTo: string | null;
  scanId: string;
  title: string;
  description: string;
  severity: Severity;
  status: IncidentStatus;
  resolutionNotes: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface Organization {
  id: string;
  name: string;
  domain: string;
  plan: "starter" | "professional" | "enterprise";
  createdAt: string;
  activeAlertsCount: number;
}

export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  target: string;
  details: string;
  createdAt: string;
}

export interface ModelHealth {
  name: string;
  key: string;
  status: "online" | "offline" | "degraded";
  accuracy: number;
  avgLatency: number;
  totalInferences: number;
  lastChecked: string;
}

export interface ThreatTrendPoint {
  date: string;
  phishing: number;
  malware: number;
  defacement: number;
  safe: number;
}

export interface DepartmentStat {
  name: string;
  employeeCount: number;
  scansToday: number;
  threatsBlocked: number;
  riskScore: number;
}

// ── In-Memory Database Arrays (with local sync fallback if window exists) ──

let organizationsList: Organization[] = [
  { id: "org-1", name: "U Bank Limited", domain: "ubank.com.pk", plan: "enterprise", createdAt: "2026-01-15", activeAlertsCount: 0 },
  { id: "org-2", name: "INARA Technologies", domain: "inara.tech", plan: "professional", createdAt: "2026-02-01", activeAlertsCount: 2 },
  { id: "org-3", name: "Apex Financial Corp", domain: "apex.corp", plan: "enterprise", createdAt: "2026-03-10", activeAlertsCount: 0 },
];

let usersList: User[] = [
  // Level 0: Platform Head
  { id: "u-global", email: "head@aegisone.com", fullName: "AegisOne Platform Head", role: "global_admin", department: "Operations", organization: "global", avatarUrl: "", isActive: true, lastLogin: "2026-06-19T10:30:00Z", extensionInstalled: true },
  
  // Level 1: Tenant Admins (Super Admin of that Organization)
  { id: "u-1", email: "admin@ubank.com.pk", fullName: "Nadeem Ashraf", role: "super_admin", department: "Cyber Security", organization: "org-1", avatarUrl: "", isActive: true, lastLogin: "2026-06-19T09:30:00Z", extensionInstalled: true },
  { id: "u-2", email: "maryam@inara.tech", fullName: "Maryam Tauheed", role: "super_admin", department: "Engineering", organization: "org-2", avatarUrl: "", isActive: true, lastLogin: "2026-06-19T08:15:00Z", extensionInstalled: true },
  { id: "u-11", email: "admin@apex.corp", fullName: "Zafar Masud", role: "super_admin", department: "Executive Committee", organization: "org-3", avatarUrl: "", isActive: true, lastLogin: "2026-06-19T11:00:00Z", extensionInstalled: true },

  // Level 2: Department Supervisors (Managers)
  { id: "u-3", email: "ahmed.raza@ubank.com.pk", fullName: "Ahmed Raza", role: "office_admin", department: "IT Operations", organization: "org-1", avatarUrl: "", isActive: true, lastLogin: "2026-06-19T10:00:00Z", extensionInstalled: true },
  { id: "u-4", email: "muhid@ubank.com.pk", fullName: "Muhammad Muhid", role: "office_admin", department: "Cyber Security", organization: "org-1", avatarUrl: "", isActive: true, lastLogin: "2026-06-18T16:45:00Z", extensionInstalled: true },
  { id: "u-12", email: "super@inara.tech", fullName: "Yasir Saleem", role: "office_admin", department: "Engineering", organization: "org-2", avatarUrl: "", isActive: true, lastLogin: "2026-06-19T06:00:00Z", extensionInstalled: true },

  // Level 3: Employees
  { id: "u-5", email: "ali.mazhar@ubank.com.pk", fullName: "Ali Bin Mohsin", role: "employee", department: "IT Operations", organization: "org-1", avatarUrl: "", isActive: true, lastLogin: "2026-06-19T09:00:00Z", extensionInstalled: true },
  { id: "u-6", email: "sarah.khan@ubank.com.pk", fullName: "Sarah Khan", role: "employee", department: "Finance", organization: "org-1", avatarUrl: "", isActive: true, lastLogin: "2026-06-19T08:30:00Z", extensionInstalled: false },
  { id: "u-7", email: "usman.ali@ubank.com.pk", fullName: "Usman Ali", role: "employee", department: "IT Operations", organization: "org-1", avatarUrl: "", isActive: true, lastLogin: "2026-06-18T17:00:00Z", extensionInstalled: true },
  { id: "u-8", email: "fatima.noor@ubank.com.pk", fullName: "Fatima Noor", role: "employee", department: "HR", organization: "org-1", avatarUrl: "", isActive: false, lastLogin: "2026-06-15T11:00:00Z", extensionInstalled: false },
  { id: "u-9", email: "bilal.ahmed@ubank.com.pk", fullName: "Bilal Ahmed", role: "employee", department: "Cyber Security", organization: "org-1", avatarUrl: "", isActive: true, lastLogin: "2026-06-19T07:45:00Z", extensionInstalled: true },
  { id: "u-10", email: "zara.malik@ubank.com.pk", fullName: "Zara Malik", role: "employee", department: "Finance", organization: "org-1", avatarUrl: "", isActive: true, lastLogin: "2026-06-19T09:15:00Z", extensionInstalled: true },
  { id: "u-13", email: "dev1@inara.tech", fullName: "Hamza Tariq", role: "employee", department: "Engineering", organization: "org-2", avatarUrl: "", isActive: true, lastLogin: "2026-06-19T05:30:00Z", extensionInstalled: true },
];

export const scanHistory: ScanRecord[] = [
  { id: "s-1", userId: "u-5", scanType: "url", inputPreview: "http://paypa1-secure.verify.com/login", prediction: "malicious", confidence: 0.96, phishingProbability: 0.96, riskLevel: "danger", xaiExplanation: "AI detected credential harvesting patterns (triggered by suspicious keywords: 'login', 'verify')", xaiWords: ["paypa1", "secure", "login"], category: "phishing", source: "extension", scannedAt: "2026-06-19T09:45:00Z" },
  { id: "s-2", userId: "u-5", scanType: "email", inputPreview: "Subject: Urgent! Verify your account immediately", prediction: "phishing", confidence: 0.94, phishingProbability: 0.94, riskLevel: "danger", xaiExplanation: "AI flagged suspicious keywords: verify, immediately, urgent", xaiWords: ["verify", "immediately", "urgent"], source: "extension", scannedAt: "2026-06-19T09:30:00Z" },
  { id: "s-3", userId: "u-6", scanType: "url", inputPreview: "https://www.google.com/search?q=weather", prediction: "legitimate", confidence: 0.99, phishingProbability: 0.01, riskLevel: "safe", xaiExplanation: "AI verified URL matches trusted domain structure", xaiWords: [], category: "benign", source: "extension", scannedAt: "2026-06-19T09:15:00Z" },
  { id: "s-4", userId: "u-7", scanType: "text", inputPreview: "Congratulations! You've won a $500 Amazon gift card. Click here to claim now!", prediction: "phishing", confidence: 0.89, phishingProbability: 0.89, riskLevel: "danger", xaiExplanation: "AI flagged suspicious keywords: congratulations, won, claim", xaiWords: ["congratulations", "won", "claim"], source: "dashboard", scannedAt: "2026-06-19T08:50:00Z" },
  { id: "s-5", userId: "u-9", scanType: "url", inputPreview: "http://amazon-deals.tk/special-offer", prediction: "malicious", confidence: 0.92, phishingProbability: 0.92, riskLevel: "danger", xaiExplanation: "AI detected credential harvesting patterns in URL structure", xaiWords: ["amazon", "deals", "special"], category: "phishing", source: "extension", scannedAt: "2026-06-19T08:30:00Z" },
  { id: "s-6", userId: "u-10", scanType: "email", inputPreview: "Subject: Meeting rescheduled to 3 PM today", prediction: "legitimate", confidence: 0.98, phishingProbability: 0.02, riskLevel: "safe", xaiExplanation: "AI identified normal business communication patterns", xaiWords: [], source: "extension", scannedAt: "2026-06-19T08:15:00Z" },
  { id: "s-7", userId: "u-5", scanType: "attachment", inputPreview: "invoice_2026.pdf (245 KB)", prediction: "phishing", confidence: 0.87, phishingProbability: 0.87, riskLevel: "danger", xaiExplanation: "Text AI: 87% risk — malicious macros found inside PDF", xaiWords: ["invoice", "payment", "overdue"], source: "extension", scannedAt: "2026-06-19T07:50:00Z" },
  { id: "s-8", userId: "u-3", scanType: "url", inputPreview: "https://linkedin.com/in/ahmed-raza", prediction: "legitimate", confidence: 0.99, phishingProbability: 0.01, riskLevel: "safe", xaiExplanation: "AI verified URL matches trusted domain structure", xaiWords: [], category: "benign", source: "extension", scannedAt: "2026-06-19T07:30:00Z" },
  { id: "s-9", userId: "u-7", scanType: "image", inputPreview: "screenshot_banklogin.png", prediction: "phishing", confidence: 0.84, phishingProbability: 0.84, riskLevel: "danger", xaiExplanation: "Visual analysis detected brand impersonation — fake bank login page", xaiWords: [], source: "extension", scannedAt: "2026-06-18T17:00:00Z" },
  { id: "s-10", userId: "u-6", scanType: "url", inputPreview: "https://github.com/AhmedRaza-2/AegisOne", prediction: "legitimate", confidence: 0.99, phishingProbability: 0.02, riskLevel: "safe", xaiExplanation: "AI verified URL matches trusted domain structure", xaiWords: [], category: "benign", source: "dashboard", scannedAt: "2026-06-18T16:30:00Z" },
];

export const incidents: Incident[] = [
  { id: "i-1", reportedBy: "u-5", assignedTo: "u-4", scanId: "s-1", title: "PayPal phishing link received via email", description: "Received an email with a fake PayPal login link. Extension blocked it but reporting for investigation.", severity: "high", status: "investigating", resolutionNotes: null, createdAt: "2026-06-19T09:50:00Z", resolvedAt: null },
  { id: "i-2", reportedBy: "u-9", assignedTo: "u-3", scanId: "s-5", title: "Suspicious Amazon deal link on social media", description: "Found a .tk domain pretending to be Amazon deals. Multiple employees may have received it.", severity: "critical", status: "open", resolutionNotes: null, createdAt: "2026-06-19T08:35:00Z", resolvedAt: null },
  { id: "i-3", reportedBy: "u-10", assignedTo: "u-4", scanId: "s-12", title: "Fake Facebook login page detected", description: "Chrome extension flagged faceb00k.com as phishing. The URL uses zero instead of 'o' characters.", severity: "high", status: "resolved", resolutionNotes: "Domain has been added to organization blocklist. Alert sent to all employees.", createdAt: "2026-06-18T14:25:00Z", resolvedAt: "2026-06-18T16:00:00Z" },
];

export const auditLogs: AuditLog[] = [
  { id: "a-1", userId: "u-1", action: "user.role_changed", target: "u-3", details: "Changed role from employee to office_admin", createdAt: "2026-06-19T08:00:00Z" },
  { id: "a-2", userId: "u-1", action: "policy.updated", target: "detection_threshold", details: "Updated URL detection threshold from 0.80 to 0.85", createdAt: "2026-06-18T16:00:00Z" },
];

export const modelHealth: ModelHealth[] = [
  { name: "Email AI", key: "email", status: "online", accuracy: 99.43, avgLatency: 33.4, totalInferences: 45230, lastChecked: "2026-06-19T10:00:00Z" },
  { name: "URL AI", key: "url", status: "online", accuracy: 98.05, avgLatency: 0.8, totalInferences: 128450, lastChecked: "2026-06-19T10:00:00Z" },
  { name: "Text AI", key: "text", status: "online", accuracy: 97.2, avgLatency: 41.2, totalInferences: 12840, lastChecked: "2026-06-19T10:00:00Z" },
  { name: "Image AI", key: "image", status: "online", accuracy: 89.5, avgLatency: 52.1, totalInferences: 3420, lastChecked: "2026-06-19T10:00:00Z" },
  { name: "Attachment AI", key: "attachment", status: "online", accuracy: 94.0, avgLatency: 105.3, totalInferences: 1890, lastChecked: "2026-06-19T10:00:00Z" },
];

export const threatTrends: ThreatTrendPoint[] = [
  { date: "Jun 13", phishing: 12, malware: 3, defacement: 1, safe: 180 },
  { date: "Jun 14", phishing: 18, malware: 5, defacement: 2, safe: 210 },
  { date: "Jun 15", phishing: 8, malware: 2, defacement: 0, safe: 195 },
  { date: "Jun 16", phishing: 25, malware: 7, defacement: 3, safe: 230 },
  { date: "Jun 17", phishing: 15, malware: 4, defacement: 1, safe: 205 },
  { date: "Jun 18", phishing: 32, malware: 9, defacement: 4, safe: 250 },
  { date: "Jun 19", phishing: 14, malware: 3, defacement: 1, safe: 145 },
];

export const departmentStats: DepartmentStat[] = [
  { name: "IT Operations", employeeCount: 24, scansToday: 342, threatsBlocked: 18, riskScore: 32 },
  { name: "Cyber Security", employeeCount: 12, scansToday: 567, threatsBlocked: 45, riskScore: 15 },
  { name: "Finance", employeeCount: 18, scansToday: 189, threatsBlocked: 12, riskScore: 48 },
  { name: "HR", employeeCount: 8, scansToday: 78, threatsBlocked: 3, riskScore: 22 },
  { name: "Marketing", employeeCount: 15, scansToday: 234, threatsBlocked: 8, riskScore: 38 },
];

// ── CRUD Helpers ──────────────────────────────────────────────

export const organizations = {
  getAll: (): Organization[] => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("aegis_organizations");
      if (saved) {
        try { organizationsList = JSON.parse(saved); } catch (_) {}
      }
    }
    return organizationsList;
  },
  add: (name: string, domain: string, plan: Organization["plan"]): Organization => {
    const newOrg: Organization = {
      id: `org-${Date.now()}`,
      name,
      domain,
      plan,
      createdAt: new Date().toISOString().split("T")[0],
      activeAlertsCount: 0,
    };
    organizationsList.push(newOrg);
    if (typeof window !== "undefined") {
      localStorage.setItem("aegis_organizations", JSON.stringify(organizationsList));
    }
    return newOrg;
  },
  delete: (id: string): boolean => {
    organizationsList = organizationsList.filter(o => o.id !== id);
    if (typeof window !== "undefined") {
      localStorage.setItem("aegis_organizations", JSON.stringify(organizationsList));
    }
    return true;
  },
  sendBroadcast: (id: string): void => {
    organizationsList = organizationsList.map(o => o.id === id ? { ...o, activeAlertsCount: o.activeAlertsCount + 1 } : o);
    if (typeof window !== "undefined") {
      localStorage.setItem("aegis_organizations", JSON.stringify(organizationsList));
    }
  }
};

export const users = {
  getAll: (): User[] => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("aegis_users");
      if (saved) {
        try { usersList = JSON.parse(saved); } catch (_) {}
      }
    }
    return usersList;
  },
  find: (predicate: (u: User) => boolean): User | undefined => {
    return users.getAll().find(predicate);
  },
  filter: (predicate: (u: User) => boolean): User[] => {
    return users.getAll().filter(predicate);
  },
  add: (u: Omit<User, "id" | "isActive" | "lastLogin">): User => {
    const newUser: User = {
      ...u,
      id: `u-${Date.now()}`,
      isActive: true,
      lastLogin: new Date().toISOString(),
    };
    usersList.push(newUser);
    if (typeof window !== "undefined") {
      localStorage.setItem("aegis_users", JSON.stringify(usersList));
    }
    return newUser;
  },
  delete: (id: string): boolean => {
    usersList = usersList.filter(u => u.id !== id);
    if (typeof window !== "undefined") {
      localStorage.setItem("aegis_users", JSON.stringify(usersList));
    }
    return true;
  }
};

// ── Statistics Calculations ──────────────────────────────────

export function getGlobalStats() {
  const totalScans = scanHistory.length;
  const threats = scanHistory.filter(s => s.prediction !== "legitimate").length;
  const activeUsersCount = users.filter(u => u.isActive).length;

  return {
    totalScans: 12847,
    threatsBlocked: 234,
    activeUsers: activeUsersCount,
    extensionUsers: users.filter(u => u.extensionInstalled).length,
    safeRate: 98.2,
    avgLatency: 28,
    modelsOnline: modelHealth.filter(m => m.status === "online").length,
    totalModels: modelHealth.length,
    openIncidents: incidents.filter(i => i.status === "open" || i.status === "investigating").length,
  };
}

export function getUserStats(userId: string) {
  const userScans = scanHistory.filter(s => s.userId === userId);
  const threats = userScans.filter(s => s.prediction !== "legitimate");
  return {
    totalScans: userScans.length + 127,
    threatsBlocked: threats.length + 8,
    safeRate: userScans.length > 0 ? Math.round(((userScans.length - threats.length) / userScans.length) * 100) : 100,
    lastScan: userScans[0]?.scannedAt || null,
  };
}

export function getUserById(id: string) {
  return users.getAll().find(u => u.id === id);
}

export function getRoleBadge(role: Role | string) {
  switch (role as string) {
    case "global_admin": return { label: "Platform Head", color: "text-purple-650 bg-purple-600/10 dark:text-purple-400 dark:bg-purple-600/10" };
    case "super_admin": 
    case "admin": return { label: "Admin", color: "text-red-650 bg-red-600/10 dark:text-red-400 dark:bg-red-600/10" };
    case "department_admin":
    case "office_admin": 
    case "manager": return { label: "Manager", color: "text-amber-650 bg-amber-600/10 dark:text-amber-400 dark:bg-amber-600/10" };
    case "employee": 
    default: return { label: "Employee", color: "text-blue-650 bg-blue-600/10 dark:text-blue-400 dark:bg-blue-600/10" };
  }
}
